/**
 * server.js
 * ---------------------------------------------------------------
 * Application entry point. Responsible for:
 *   1. Loading environment variables
 *   2. Initializing the SQLite database
 *   3. Configuring global middleware (security, logging, parsing)
 *   4. Mounting routes
 *   5. Registering the 404 + centralized error handlers
 *   6. Starting the HTTP server
 * ---------------------------------------------------------------
 */

require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { initializeDatabase } = require("./database/database");
const courseController = require("./controllers/courseController");
const courseRoutes = require("./routes/courseRoutes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 5000;

/* -----------------------------------------------------------
   1. Make sure the database + table exist before anything else
   ----------------------------------------------------------- */
initializeDatabase();

/* -----------------------------------------------------------
   2. Global middleware
   ----------------------------------------------------------- */

// Security headers. CSP is disabled because this server may also serve the
// static frontend below, which loads Google Fonts from an external origin;
// a default CSP would silently block that.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// Cross-Origin Resource Sharing — lets the frontend (served from a
// different origin, e.g. a static file server or Live Server) call this API.
const corsOrigin = process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== "*"
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : "*";
app.use(cors({ origin: corsOrigin }));

// HTTP request logging (concise in production, verbose in development)
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// JSON body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* -----------------------------------------------------------
   3. Routes
   ----------------------------------------------------------- */

// Simple health check — useful for confirming the server is up
app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, message: "API is healthy." });
});

// GET /api/total-units — declared directly here since it sits
// outside the /api/courses resource prefix, per the brief.
app.get("/api/total-units", courseController.getTotalUnits);

// All course CRUD endpoints
app.use("/api/courses", courseRoutes);

/* -----------------------------------------------------------
   3b. Optional: serve the frontend as static files.
   This lets the whole app run from a single `npm run dev` in
   the backend folder — just open http://localhost:5000 in a
   browser and both the UI and API are served from here. If the
   sibling ../frontend folder isn't present (e.g. the backend is
   deployed on its own), this block is skipped entirely.
   ----------------------------------------------------------- */
const FRONTEND_DIR = path.resolve(__dirname, "../frontend");
if (fs.existsSync(FRONTEND_DIR)) {
  app.use(express.static(FRONTEND_DIR));

  // SPA fallback: any non-API GET request returns index.html so the
  // single-page app can handle its own client-side "routing".
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, "index.html"));
  });
}

/* -----------------------------------------------------------
   4. 404 + centralized error handling (must be registered LAST)
   ----------------------------------------------------------- */
app.use(notFoundHandler);
app.use(errorHandler);

/* -----------------------------------------------------------
   5. Start the server
   ----------------------------------------------------------- */
app.listen(PORT, () => {
  console.log(`🚀 Student Course Management API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;
