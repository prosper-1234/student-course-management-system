/**
 * utils/courseValidators.js
 * ---------------------------------------------------------------
 * Single source of truth for what makes a course field valid.
 * Both the express-validator middleware chain (middleware/validation.js)
 * AND the bulk file-import flow (controllers/courseController.js)
 * call into these same functions, so a row typed by hand and a row
 * imported from a spreadsheet are held to identical rules.
 * ---------------------------------------------------------------
 */

// Letters and numbers ONLY — no spaces, no punctuation, no symbols.
// Rejects things like "...", "@@@", "COS-201", "COS 201".
const COURSE_CODE_PATTERN = /^[A-Za-z0-9]+$/;

// A title is valid as soon as it contains at least one letter or digit —
// this is what rules out "###", ",,,", "@@@" while still allowing normal
// titles with punctuation in them ("Intro to Programming (I)").
const HAS_ALPHANUMERIC_PATTERN = /[A-Za-z0-9]/;

// Whole positive numbers only — "3" is fine, "3.5", "-3", "abc", "..." are not.
const COURSE_UNIT_PATTERN = /^\d+$/;

/**
 * @param {string} rawValue
 * @returns {{ valid: boolean, value: string, message: string }}
 */
function validateCourseCode(rawValue) {
  const value = String(rawValue ?? "").trim();

  if (!value) {
    return { valid: false, value, message: "Course Code is required." };
  }
  if (String(rawValue ?? "") !== value) {
    // Leading/trailing whitespace was present in the raw input.
    // We still auto-trim it, but flag it so the caller can decide.
  }
  if (value.length < 2 || value.length > 15) {
    return { valid: false, value, message: "Course Code must be between 2 and 15 characters." };
  }
  if (!COURSE_CODE_PATTERN.test(value)) {
    return { valid: false, value, message: "Course Code can only contain letters and numbers." };
  }

  return { valid: true, value: value.toUpperCase(), message: "" };
}

/**
 * @param {string} rawValue
 * @returns {{ valid: boolean, value: string, message: string }}
 */
function validateCourseTitle(rawValue) {
  const value = String(rawValue ?? "").trim();

  if (!value) {
    return { valid: false, value, message: "Please enter a valid course title." };
  }
  if (value.length < 3 || value.length > 150) {
    return { valid: false, value, message: "Please enter a valid course title." };
  }
  if (!HAS_ALPHANUMERIC_PATTERN.test(value)) {
    return { valid: false, value, message: "Please enter a valid course title." };
  }

  return { valid: true, value, message: "" };
}

/**
 * @param {string|number} rawValue
 * @returns {{ valid: boolean, value: number|null, message: string }}
 */
function validateCourseUnit(rawValue) {
  const value = String(rawValue ?? "").trim();

  if (!value) {
    return { valid: false, value: null, message: "Credit Unit must be a valid number." };
  }
  if (!COURSE_UNIT_PATTERN.test(value)) {
    return { valid: false, value: null, message: "Credit Unit must be a valid number." };
  }

  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 10) {
    return { valid: false, value: null, message: "Credit Unit must be a whole number between 1 and 10." };
  }

  return { valid: true, value: num, message: "" };
}

module.exports = {
  COURSE_CODE_PATTERN,
  HAS_ALPHANUMERIC_PATTERN,
  COURSE_UNIT_PATTERN,
  validateCourseCode,
  validateCourseTitle,
  validateCourseUnit,
};
