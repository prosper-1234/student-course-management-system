/**
 * models/courseModel.js
 * ---------------------------------------------------------------
 * Data-access layer for the `courses` table. Every function
 * returns a Promise so controllers can use async/await with
 * try/catch instead of nested callbacks.
 *
 * All queries use parameterized placeholders (?) to prevent SQL
 * injection — no string concatenation of user input, ever.
 *
 * Soft delete: rows are never removed from the table by the normal
 * "delete" flow. Instead `deletedAt` is stamped with the current
 * time, which moves the course into the Recycle Bin. Every "active"
 * query filters on `deletedAt IS NULL`; every "recycle bin" query
 * filters on `deletedAt IS NOT NULL`. A separate permanent-delete
 * function is the only thing that issues a real SQL DELETE.
 * ---------------------------------------------------------------
 */

const { db } = require("../database/database");

/**
 * Fetch every ACTIVE (non-deleted) course, most recently added first.
 * @returns {Promise<Array>}
 */
function getAllCourses() {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM courses WHERE deletedAt IS NULL ORDER BY createdAt DESC, id DESC";
    db.all(sql, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

/**
 * Fetch every course currently in the Recycle Bin (soft-deleted),
 * most recently deleted first.
 * @returns {Promise<Array>}
 */
function getDeletedCourses() {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM courses WHERE deletedAt IS NOT NULL ORDER BY deletedAt DESC, id DESC";
    db.all(sql, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

/**
 * Find a single ACTIVE course by its course code (case-insensitive).
 * @param {string} courseCode
 * @returns {Promise<Object|undefined>}
 */
function getCourseByCode(courseCode) {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM courses WHERE UPPER(courseCode) = UPPER(?) AND deletedAt IS NULL";
    db.get(sql, [courseCode], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

/**
 * Find a single course by its numeric primary key, active or not.
 * @param {number} id
 * @returns {Promise<Object|undefined>}
 */
function getCourseById(id) {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM courses WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

/**
 * Insert a new course.
 * @param {{courseCode: string, courseTitle: string, courseUnit: number}} course
 * @returns {Promise<Object>} the newly created row
 */
function createCourse({ courseCode, courseTitle, courseUnit }) {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO courses (courseCode, courseTitle, courseUnit, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)";
    db.run(sql, [courseCode, courseTitle, courseUnit], function (err) {
      if (err) return reject(err);
      // `this.lastID` is populated by sqlite3 after a successful INSERT
      getCourseById(this.lastID).then(resolve).catch(reject);
    });
  });
}

/**
 * Update an existing (active) course by id.
 * @param {number} id
 * @param {{courseCode: string, courseTitle: string, courseUnit: number}} course
 * @returns {Promise<Object>} the updated row
 */
function updateCourse(id, { courseCode, courseTitle, courseUnit }) {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE courses
      SET courseCode = ?, courseTitle = ?, courseUnit = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND deletedAt IS NULL
    `;
    db.run(sql, [courseCode, courseTitle, courseUnit, id], function (err) {
      if (err) return reject(err);
      if (this.changes === 0) return resolve(null); // nothing updated -> id not found (or already deleted)
      getCourseById(id).then(resolve).catch(reject);
    });
  });
}

/**
 * Soft-delete a course by id — moves it into the Recycle Bin instead
 * of removing the row. A course can only be soft-deleted once.
 * @param {number} id
 * @returns {Promise<boolean>} true if a row was moved to the recycle bin
 */
function softDeleteCourse(id) {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE courses SET deletedAt = CURRENT_TIMESTAMP WHERE id = ? AND deletedAt IS NULL";
    db.run(sql, [id], function (err) {
      if (err) return reject(err);
      resolve(this.changes > 0);
    });
  });
}

/**
 * Restore a soft-deleted course back to the active course list.
 * @param {number} id
 * @returns {Promise<Object|null>} the restored row, or null if it wasn't found in the bin
 */
function restoreCourse(id) {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE courses SET deletedAt = NULL, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND deletedAt IS NOT NULL";
    db.run(sql, [id], function (err) {
      if (err) return reject(err);
      if (this.changes === 0) return resolve(null);
      getCourseById(id).then(resolve).catch(reject);
    });
  });
}

/**
 * Permanently remove a soft-deleted course from the database. Only
 * works on rows already in the recycle bin, so an active course can
 * never be permanently deleted by accident without going through the
 * soft-delete step first.
 * @param {number} id
 * @returns {Promise<boolean>} true if a row was permanently deleted
 */
function permanentlyDeleteCourse(id) {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM courses WHERE id = ? AND deletedAt IS NOT NULL";
    db.run(sql, [id], function (err) {
      if (err) return reject(err);
      resolve(this.changes > 0);
    });
  });
}

module.exports = {
  getAllCourses,
  getDeletedCourses,
  getCourseByCode,
  getCourseById,
  createCourse,
  updateCourse,
  softDeleteCourse,
  restoreCourse,
  permanentlyDeleteCourse,
};
