/**
 * database/database.js
 * ---------------------------------------------------------------
 * Sets up the SQLite connection and makes sure the `courses` table
 * exists before the rest of the app tries to use it.
 *
 * We export the raw `db` connection (a sqlite3.Database instance).
 * Models use it directly with parameterized queries to avoid SQL
 * injection.
 * ---------------------------------------------------------------
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Resolve the database file path from .env, falling back to a sane default.
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.resolve(__dirname, "student_courses.db");

// Create (or open) the database file.
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("❌ Failed to connect to SQLite database:", err.message);
    process.exit(1);
  }
  console.log(`✅ Connected to SQLite database at ${DB_PATH}`);
});

// Enforce foreign key constraints (good practice even without FKs yet).
db.run("PRAGMA foreign_keys = ON");

/**
 * Creates the `courses` table if it does not already exist.
 * Called once at server startup.
 */
function initializeDatabase() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courseCode TEXT UNIQUE NOT NULL,
      courseTitle TEXT NOT NULL,
      courseUnit INTEGER NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deletedAt TIMESTAMP DEFAULT NULL
    );
  `;

  db.run(createTableSQL, (err) => {
    if (err) {
      console.error("❌ Failed to create 'courses' table:", err.message);
      process.exit(1);
    }
    console.log("✅ 'courses' table is ready.");
    migrateSoftDeleteColumns();
  });
}

/**
 * Recycle-bin support was added after the original table shape shipped.
 * For anyone upgrading an existing database file, make sure the new
 * `updatedAt` / `deletedAt` columns exist without touching any data.
 * SQLite has no "ADD COLUMN IF NOT EXISTS", so we inspect the schema
 * first via PRAGMA table_info and only add what's missing.
 */
function migrateSoftDeleteColumns() {
  db.all("PRAGMA table_info(courses)", [], (err, columns) => {
    if (err) {
      console.error("❌ Failed to inspect 'courses' table schema:", err.message);
      return;
    }
    const existing = new Set(columns.map((c) => c.name));

    if (!existing.has("deletedAt")) {
      db.run("ALTER TABLE courses ADD COLUMN deletedAt TIMESTAMP DEFAULT NULL", (alterErr) => {
        if (alterErr) console.error("❌ Failed to add 'deletedAt' column:", alterErr.message);
        else console.log("✅ Added 'deletedAt' column (recycle bin support).");
      });
    }

    if (!existing.has("updatedAt")) {
      db.run("ALTER TABLE courses ADD COLUMN updatedAt TIMESTAMP DEFAULT NULL", (alterErr) => {
        if (alterErr) console.error("❌ Failed to add 'updatedAt' column:", alterErr.message);
        else console.log("✅ Added 'updatedAt' column.");
      });
    }
  });
}

module.exports = { db, initializeDatabase };
