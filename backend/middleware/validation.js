/**
 * middleware/validation.js
 * ---------------------------------------------------------------
 * express-validator rule sets + a shared handler that turns any
 * validation failures into a consistent 400 JSON error response.
 *
 * The duplicate course-code check needs a database lookup, so it is
 * implemented as standalone middleware (not an express-validator
 * rule) that runs AFTER field validation passes, returning a 409
 * Conflict — a more accurate status than lumping it into the 400
 * "bad input shape" response.
 * ---------------------------------------------------------------
 */

const { body, param, validationResult } = require("express-validator");
const courseModel = require("../models/courseModel");
const { AppError } = require("./errorHandler");
const {
  validateCourseCode,
  validateCourseTitle,
  validateCourseUnit,
} = require("../utils/courseValidators");

/**
 * Runs after every validation chain. If express-validator collected
 * any errors, respond with 400 and a clear, beginner-friendly message
 * for each field. Otherwise, pass control to the controller.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg, // most relevant single message
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

/* -----------------------------------------------------------
   Field-level rules, reused between create and update
   ----------------------------------------------------------- */

// Sanitize first (trim + strip control/zero-width characters that could be
// used to sneak past the alphanumeric checks), THEN validate with the same
// pure functions the file-import flow uses, so typed input and imported
// rows are always judged by identical rules.
const courseCodeRule = body("courseCode")
  .trim()
  .stripLow()
  .custom((value) => {
    const result = validateCourseCode(value);
    if (!result.valid) throw new Error(result.message);
    return true;
  });

const courseTitleRule = body("courseTitle")
  .trim()
  .stripLow()
  .custom((value) => {
    const result = validateCourseTitle(value);
    if (!result.valid) throw new Error(result.message);
    return true;
  });

const courseUnitRule = body("courseUnit")
  .trim()
  .custom((value) => {
    const result = validateCourseUnit(value);
    if (!result.valid) throw new Error(result.message);
    return true;
  });

/**
 * Ensures the course code is not already taken by another course.
 * Used on create (always) and update (only if the code is changing).
 */
async function checkDuplicateCourseCodeOnCreate(req, res, next) {
  try {
    const courseCode = (req.body.courseCode || "").trim();
    const existing = await courseModel.getCourseByCode(courseCode);
    if (existing) {
      return next(new AppError(`Course code "${courseCode}" already exists.`, 409));
    }
    next();
  } catch (err) {
    next(err);
  }
}

async function checkDuplicateCourseCodeOnUpdate(req, res, next) {
  try {
    const courseCode = (req.body.courseCode || "").trim();
    const existing = await courseModel.getCourseByCode(courseCode);
    if (existing && String(existing.id) !== String(req.params.id)) {
      return next(new AppError(`Course code "${courseCode}" already exists.`, 409));
    }
    next();
  } catch (err) {
    next(err);
  }
}

/* -----------------------------------------------------------
   Param rules
   ----------------------------------------------------------- */

const idParamRule = param("id")
  .notEmpty()
  .withMessage("Course id is required.")
  .bail()
  .isInt({ min: 1 })
  .withMessage("Course id must be a positive integer.")
  .toInt();

const codeParamRule = param("code")
  .trim()
  .notEmpty()
  .withMessage("Course code is required.")
  .isLength({ min: 1, max: 15 })
  .withMessage("Course code is invalid.");

/* -----------------------------------------------------------
   Exported validation chains (array of middlewares per route)
   ----------------------------------------------------------- */

const validateCreateCourse = [
  courseCodeRule,
  courseTitleRule,
  courseUnitRule,
  handleValidationErrors, // 400 for shape/format problems first
  checkDuplicateCourseCodeOnCreate, // then 409 for a real duplicate
];

const validateUpdateCourse = [
  idParamRule,
  courseCodeRule,
  courseTitleRule,
  courseUnitRule,
  handleValidationErrors, // 400 for shape/format problems first
  checkDuplicateCourseCodeOnUpdate, // then 409 for a real duplicate
];

const validateIdParam = [idParamRule, handleValidationErrors];

const validateCodeParam = [codeParamRule, handleValidationErrors];

module.exports = {
  validateCreateCourse,
  validateUpdateCourse,
  validateIdParam,
  validateCodeParam,
  handleValidationErrors,
  checkDuplicateCourseCodeOnCreate,
  checkDuplicateCourseCodeOnUpdate,
};
