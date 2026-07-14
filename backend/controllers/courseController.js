/**
 * controllers/courseController.js
 * ---------------------------------------------------------------
 * Request handlers for every course-related endpoint. Controllers
 * are intentionally "thin": they read the request, delegate to the
 * model for data access, and shape the response. Validation has
 * already run (see middleware/validation.js) by the time these
 * functions execute.
 *
 * Every function uses try/catch and forwards unexpected errors to
 * the centralized error handler via next(err).
 * ---------------------------------------------------------------
 */

const courseModel = require("../models/courseModel");
const { AppError } = require("../middleware/errorHandler");
const { calculateTotalUnitsRecursive } = require("../utils/recursion");
const { parseCourseFile } = require("../utils/importParser");
const {
  validateCourseCode,
  validateCourseTitle,
  validateCourseUnit,
} = require("../utils/courseValidators");

/**
 * GET /api/courses
 * Returns every ACTIVE course in the database (soft-deleted courses
 * are excluded — see GET /api/courses/deleted for the recycle bin).
 */
async function getAllCourses(req, res, next) {
  try {
    const courses = await courseModel.getAllCourses();
    res.status(200).json({
      success: true,
      message: "Courses retrieved successfully.",
      data: courses,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/courses/deleted
 * Returns every course currently sitting in the Recycle Bin.
 */
async function getDeletedCourses(req, res, next) {
  try {
    const courses = await courseModel.getDeletedCourses();
    res.status(200).json({
      success: true,
      message: "Deleted courses retrieved successfully.",
      data: courses,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/courses/:code
 * Finds a single active course by its course code.
 */
async function getCourseByCode(req, res, next) {
  try {
    const { code } = req.params;
    const course = await courseModel.getCourseByCode(code);

    if (!course) {
      throw new AppError(`No course found with code "${code}".`, 404);
    }

    res.status(200).json({
      success: true,
      message: "Course found.",
      data: course,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/courses
 * Creates a new course. Field validation + duplicate-code checking
 * has already happened in the validation middleware.
 */
async function createCourse(req, res, next) {
  try {
    const { courseCode, courseTitle, courseUnit } = req.body;

    const newCourse = await courseModel.createCourse({
      courseCode: courseCode.trim().toUpperCase(),
      courseTitle: courseTitle.trim(),
      courseUnit: Number(courseUnit),
    });

    res.status(201).json({
      success: true,
      message: "Course added successfully.",
      data: newCourse,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/courses/:id
 * Updates an existing course.
 */
async function updateCourse(req, res, next) {
  try {
    const { id } = req.params;
    const { courseCode, courseTitle, courseUnit } = req.body;

    const updated = await courseModel.updateCourse(id, {
      courseCode: courseCode.trim().toUpperCase(),
      courseTitle: courseTitle.trim(),
      courseUnit: Number(courseUnit),
    });

    if (!updated) {
      throw new AppError(`No course found with id ${id}.`, 404);
    }

    res.status(200).json({
      success: true,
      message: "Course updated successfully.",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/courses/:id
 * Soft-deletes a course by id — moves it into the Recycle Bin.
 */
async function deleteCourse(req, res, next) {
  try {
    const { id } = req.params;
    const wasDeleted = await courseModel.softDeleteCourse(id);

    if (!wasDeleted) {
      throw new AppError(`No course found with id ${id}.`, 404);
    }

    res.status(200).json({
      success: true,
      message: "Course deleted successfully.",
      data: { id: Number(id) },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/courses/:id/restore
 * Restores a soft-deleted course back to the active course list.
 */
async function restoreCourse(req, res, next) {
  try {
    const { id } = req.params;
    const restored = await courseModel.restoreCourse(id);

    if (!restored) {
      throw new AppError(`No deleted course found with id ${id}.`, 404);
    }

    res.status(200).json({
      success: true,
      message: "Course restored successfully.",
      data: restored,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/courses/:id/permanent
 * Permanently removes a course that is already in the Recycle Bin.
 */
async function permanentlyDeleteCourse(req, res, next) {
  try {
    const { id } = req.params;
    const wasDeleted = await courseModel.permanentlyDeleteCourse(id);

    if (!wasDeleted) {
      throw new AppError(`No deleted course found with id ${id}.`, 404);
    }

    res.status(200).json({
      success: true,
      message: "Course permanently deleted.",
      data: { id: Number(id) },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/total-units
 * Returns the sum of courseUnit across every active course, computed
 * with a recursive function (utils/recursion.js) rather than a loop.
 */
async function getTotalUnits(req, res, next) {
  try {
    const courses = await courseModel.getAllCourses();
    const totalUnits = calculateTotalUnitsRecursive(courses);

    res.status(200).json({
      success: true,
      message: "Total units calculated successfully.",
      data: {
        totalCourses: courses.length,
        totalUnits,
      },
      totalUnits, // also exposed top-level to match the exact shape requested in the brief
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/courses/import
 * Bulk-imports courses from an uploaded CSV or Excel (.xlsx) file.
 * Every row is validated with the exact same rules as the manual
 * "Add Course" form. Valid, non-duplicate rows are saved; anything
 * else is skipped and reported back with a reason.
 *
 * multer (memory storage) puts the uploaded file on req.file.
 */
async function importCourses(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError("No file was uploaded. Please choose a CSV or Excel file.", 400);
    }

    const allowedExtensions = /\.(csv|xlsx|xls)$/i;
    if (!allowedExtensions.test(req.file.originalname)) {
      throw new AppError("Unsupported file type. Please upload a .csv or .xlsx file.", 400);
    }

    let rows;
    try {
      rows = parseCourseFile(req.file.buffer, req.file.originalname);
    } catch (parseErr) {
      throw new AppError("Could not read that file. Please check the format and try again.", 400);
    }

    if (!rows.length) {
      throw new AppError("The uploaded file has no rows to import.", 400);
    }

    const imported = [];
    const failed = [];
    // Codes already committed earlier in THIS same import batch, so two
    // duplicate rows inside one file don't both slip through.
    const codesSeenThisBatch = new Set();

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +1 for 0-index, +1 for the header row
      const row = rows[i];

      const codeResult = validateCourseCode(row.courseCode);
      const titleResult = validateCourseTitle(row.courseTitle);
      const unitResult = validateCourseUnit(row.courseUnit);

      if (!codeResult.valid) {
        failed.push({ row: rowNumber, courseCode: row.courseCode || "", reason: codeResult.message });
        continue;
      }
      if (!titleResult.valid) {
        failed.push({ row: rowNumber, courseCode: row.courseCode || "", reason: titleResult.message });
        continue;
      }
      if (!unitResult.valid) {
        failed.push({ row: rowNumber, courseCode: row.courseCode || "", reason: unitResult.message });
        continue;
      }

      const normalizedCode = codeResult.value;

      if (codesSeenThisBatch.has(normalizedCode)) {
        failed.push({ row: rowNumber, courseCode: normalizedCode, reason: "Duplicate Course Code" });
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const existing = await courseModel.getCourseByCode(normalizedCode);
      if (existing) {
        failed.push({ row: rowNumber, courseCode: normalizedCode, reason: "Duplicate Course Code" });
        continue;
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        const created = await courseModel.createCourse({
          courseCode: normalizedCode,
          courseTitle: titleResult.value,
          courseUnit: unitResult.value,
        });
        codesSeenThisBatch.add(normalizedCode);
        imported.push(created);
      } catch (createErr) {
        failed.push({ row: rowNumber, courseCode: normalizedCode, reason: "Could not save this row." });
      }
    }

    // De-duplicated, human-readable list of why rows failed, for the
    // "Reasons:" summary the frontend shows after an import.
    const reasons = [...new Set(failed.map((f) => f.reason))];

    res.status(200).json({
      success: true,
      message: "Import completed.",
      data: {
        importedCount: imported.length,
        failedCount: failed.length,
        imported,
        failed,
        reasons,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllCourses,
  getDeletedCourses,
  getCourseByCode,
  createCourse,
  updateCourse,
  deleteCourse,
  restoreCourse,
  permanentlyDeleteCourse,
  getTotalUnits,
  importCourses,
};
