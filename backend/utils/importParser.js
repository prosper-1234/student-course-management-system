/**
 * utils/importParser.js
 * ---------------------------------------------------------------
 * Turns an uploaded CSV or Excel (.xlsx) file buffer into a plain
 * array of row objects: [{ courseCode, courseTitle, courseUnit }, ...]
 *
 * Column headers are matched loosely (case-insensitive, ignoring
 * spaces/underscores) so files exported from Excel/Google Sheets with
 * slightly different header casing ("Course Code" vs "coursecode")
 * still import correctly.
 * ---------------------------------------------------------------
 */

const XLSX = require("xlsx");

const HEADER_ALIASES = {
  courseCode: ["coursecode", "course_code", "code"],
  courseTitle: ["coursetitle", "course_title", "title", "coursename", "course_name"],
  courseUnit: ["courseunit", "course_unit", "unit", "units", "creditunit", "credit_unit", "credits"],
};

function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "");
}

/** Builds a map of { normalizedHeaderVariant -> canonicalFieldName } */
function buildHeaderLookup() {
  const lookup = {};
  Object.entries(HEADER_ALIASES).forEach(([canonical, aliases]) => {
    aliases.forEach((alias) => {
      lookup[normalizeHeader(alias)] = canonical;
    });
  });
  return lookup;
}

/**
 * Maps a raw parsed row (object keyed by original spreadsheet headers)
 * to our canonical { courseCode, courseTitle, courseUnit } shape.
 */
function mapRowToCanonicalFields(rawRow, headerLookup) {
  const mapped = { courseCode: "", courseTitle: "", courseUnit: "" };
  Object.keys(rawRow).forEach((header) => {
    const canonical = headerLookup[normalizeHeader(header)];
    if (canonical) {
      mapped[canonical] = rawRow[header] == null ? "" : String(rawRow[header]).trim();
    }
  });
  return mapped;
}

/**
 * Parses a CSV or XLSX file buffer into canonical course row objects.
 * Works for both formats via SheetJS, which reads CSV text just as
 * happily as a binary workbook.
 *
 * @param {Buffer} buffer
 * @param {string} originalName - used only to pick a sensible parse hint
 * @returns {Array<{courseCode: string, courseTitle: string, courseUnit: string}>}
 */
function parseCourseFile(buffer, originalName = "") {
  const isCsv = /\.csv$/i.test(originalName);

  const workbook = XLSX.read(buffer, {
    type: "buffer",
    raw: false,
    ...(isCsv ? { codepage: 65001 } : {}),
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const headerLookup = buildHeaderLookup();
  return rawRows.map((row) => mapRowToCanonicalFields(row, headerLookup));
}

module.exports = { parseCourseFile };
