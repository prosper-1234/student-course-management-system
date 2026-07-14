/**
 * routes/courseRoutes.js
 * ---------------------------------------------------------------
 * Maps HTTP verbs + URL patterns to controller functions, running
 * the appropriate validation middleware first.
 *
 * This router is mounted at /api/courses in server.js. The separate
 * GET /api/total-units endpoint requested in the brief is wired up
 * directly in server.js (it lives outside the /courses prefix), but
 * reuses the exact same controller function defined here.
 *
 * IMPORTANT: literal sub-paths like /deleted and /import MUST be
 * declared before the /:code catch-all route below, or Express will
 * try to look up a course literally named "deleted" / "import".
 * ---------------------------------------------------------------
 */

const express = require("express");
const multer = require("multer");
const router = express.Router();

const courseController = require("../controllers/courseController");
const {
  validateCreateCourse,
  validateUpdateCourse,
  validateIdParam,
  validateCodeParam,
} = require("../middleware/validation");

// Files are kept in memory (never written to disk) and capped at 5MB —
// plenty for a course-list spreadsheet, small enough to guard against
// someone trying to upload something enormous.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// GET /api/courses -> all active courses
router.get("/", courseController.getAllCourses);

// GET /api/courses/deleted -> Recycle Bin contents
router.get("/deleted", courseController.getDeletedCourses);

// POST /api/courses/import -> bulk import from CSV/Excel
router.post("/import", upload.single("file"), courseController.importCourses);

// POST /api/courses -> create a new course
router.post("/", validateCreateCourse, courseController.createCourse);

// PATCH /api/courses/:id/restore -> restore a soft-deleted course
router.patch("/:id/restore", validateIdParam, courseController.restoreCourse);

// DELETE /api/courses/:id/permanent -> permanently remove a soft-deleted course
router.delete("/:id/permanent", validateIdParam, courseController.permanentlyDeleteCourse);

// PUT /api/courses/:id -> update a course by id
router.put("/:id", validateUpdateCourse, courseController.updateCourse);

// DELETE /api/courses/:id -> soft-delete (move to Recycle Bin)
router.delete("/:id", validateIdParam, courseController.deleteCourse);

// GET /api/courses/:code -> single course by course code (must stay LAST:
// it's a catch-all for any single path segment under /courses)
router.get("/:code", validateCodeParam, courseController.getCourseByCode);

module.exports = router;
