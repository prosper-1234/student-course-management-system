/**
 * utils/recursion.js
 * ---------------------------------------------------------------
 * Assignment requirement: calculate the total course units using
 * RECURSION instead of an iterative loop (for/while/.reduce, etc.).
 * ---------------------------------------------------------------
 */

/**
 * Recursively sums the `courseUnit` field of an array of course
 * objects. Each call handles exactly one element (the head of the
 * array) and delegates the rest of the work to itself on the
 * remaining slice (the tail) — the classic head/tail recursion
 * pattern.
 *
 * @param {Array<{courseUnit: number}>} courses
 * @param {number} index - internal accumulator, do not pass manually
 * @returns {number} total of all courseUnit values
 *
 * Example:
 *   calculateTotalUnitsRecursive([{courseUnit:3},{courseUnit:4}]) // -> 7
 */
function calculateTotalUnitsRecursive(courses, index = 0) {
  // Base case: we've walked past the last element, nothing left to add.
  if (!Array.isArray(courses) || index >= courses.length) {
    return 0;
  }

  // Current element's contribution.
  const currentUnit = Number(courses[index].courseUnit) || 0;

  // Recursive case: this element's units + the sum of everything after it.
  return currentUnit + calculateTotalUnitsRecursive(courses, index + 1);
}

module.exports = { calculateTotalUnitsRecursive };
