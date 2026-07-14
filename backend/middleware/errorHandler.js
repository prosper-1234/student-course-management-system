/**
 * middleware/errorHandler.js
 * ---------------------------------------------------------------
 * Centralized error handling for the whole API.
 *
 *  - AppError: a small helper class controllers can `throw` with
 *    a specific HTTP status code attached.
 *  - notFoundHandler: catches requests to routes that don't exist.
 *  - errorHandler: the final Express error middleware (must be
 *    registered LAST, after all routes) that turns any thrown or
 *    forwarded error into the standard JSON error shape.
 * ---------------------------------------------------------------
 */

/** Custom error type that carries an HTTP status code. */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes expected errors from bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 404 handler for unknown routes — placed after all defined routes. */
function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

/**
 * Final error-handling middleware. Express recognizes this as an
 * error handler because it declares four parameters.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // SQLite unique constraint violations bubble up as generic errors —
  // translate them into a friendly 409 Conflict if they slip through
  // past our explicit uniqueness checks (e.g. a race condition).
  let statusCode = err.statusCode || 500;
  let message = err.message || "An unexpected error occurred.";

  if (err.code === "SQLITE_CONSTRAINT" || /UNIQUE constraint failed/i.test(message)) {
    statusCode = 409;
    message = "A course with this course code already exists.";
  }

  // Multer (file upload) errors — e.g. the import file exceeded the 5MB limit.
  if (err.name === "MulterError") {
    statusCode = 400;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? "That file is too large. Please upload a file under 5MB."
        : `Upload failed: ${err.message}`;
  }

  if (process.env.NODE_ENV !== "production") {
    console.error("❌ Error:", err.stack || err);
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
}

module.exports = { AppError, notFoundHandler, errorHandler };
