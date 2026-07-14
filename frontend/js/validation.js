/* =========================================================
   validation.js — Reusable validation rules for course forms.
   Pure functions only: no DOM access here except through the
   small helper at the bottom used by both add & edit forms.

   These rules mirror the backend exactly (see
   backend/utils/courseValidators.js) so the same input is judged
   the same way on both sides — the backend is still the final
   authority (never trust the client alone), but this keeps the
   user experience consistent.
   ========================================================= */

const Validation = (() => {
  // Letters and numbers ONLY — no spaces, no punctuation, no symbols.
  // Rejects things like "...", "@@@", "COS-201", "COS 201".
  const COURSE_CODE_PATTERN = /^[A-Za-z0-9]+$/;

  // A title is valid as soon as it contains at least one letter or digit —
  // rules out "###", ",,,", "@@@" while still allowing normal titles that
  // happen to include punctuation ("Intro to Programming (I)").
  const HAS_ALPHANUMERIC_PATTERN = /[A-Za-z0-9]/;

  // Whole positive numbers only.
  const COURSE_UNIT_PATTERN = /^\d+$/;

  function validateCourseCode(value) {
    const trimmed = (value || "").trim();
    if (!trimmed) return "Course Code is required.";
    if (trimmed.length < 2 || trimmed.length > 15) return "Course Code must be between 2 and 15 characters.";
    if (!COURSE_CODE_PATTERN.test(trimmed)) {
      return "Course Code can only contain letters and numbers.";
    }
    return "";
  }

  function validateCourseTitle(value) {
    const trimmed = (value || "").trim();
    if (!trimmed) return "Please enter a valid course title.";
    if (trimmed.length < 3 || trimmed.length > 150) return "Please enter a valid course title.";
    if (!HAS_ALPHANUMERIC_PATTERN.test(trimmed)) return "Please enter a valid course title.";
    return "";
  }

  function validateCourseUnit(value) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return "Credit Unit must be a valid number.";
    if (!COURSE_UNIT_PATTERN.test(trimmed)) return "Credit Unit must be a valid number.";
    const num = Number(trimmed);
    if (!Number.isInteger(num) || num < 1 || num > 10) {
      return "Credit Unit must be a whole number between 1 and 10.";
    }
    return "";
  }

  /**
   * Validates a course object made of { courseCode, courseTitle, courseUnit }.
   * Returns an object of field -> error message (empty string means valid).
   */
  function validateCourseForm({ courseCode, courseTitle, courseUnit }) {
    return {
      courseCode: validateCourseCode(courseCode),
      courseTitle: validateCourseTitle(courseTitle),
      courseUnit: validateCourseUnit(courseUnit),
    };
  }

  function isFormValid(errors) {
    return Object.values(errors).every((msg) => !msg);
  }

  /**
   * Returns the field name of the FIRST invalid field, in the priority
   * order the brief specifies (code, then title, then unit), or null if
   * everything is valid. Used to decide which specific "Invalid ___"
   * modal to show.
   */
  function firstInvalidField(errors) {
    if (errors.courseCode) return "courseCode";
    if (errors.courseTitle) return "courseTitle";
    if (errors.courseUnit) return "courseUnit";
    return null;
  }

  /**
   * Applies error messages to input fields + associated .field-error spans.
   * fieldMap: { courseCode: {input, errorEl}, ... }
   */
  function applyErrors(fieldMap, errors) {
    Object.keys(fieldMap).forEach((key) => {
      const { input, errorEl } = fieldMap[key];
      const message = errors[key] || "";
      if (message) {
        input.classList.add("invalid");
        errorEl.textContent = message;
      } else {
        input.classList.remove("invalid");
        errorEl.textContent = "";
      }
    });
  }

  return {
    validateCourseCode,
    validateCourseTitle,
    validateCourseUnit,
    validateCourseForm,
    isFormValid,
    firstInvalidField,
    applyErrors,
  };
})();
