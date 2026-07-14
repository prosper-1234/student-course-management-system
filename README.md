# Student Course Management System

A full-stack course registry built for the COS201 Programming I lab
assessment. A vanilla HTML/CSS/JavaScript frontend talks to a Node.js +
Express + SQLite REST API over the Fetch API — no localStorage, no dummy
data, everything is persisted in a real database.

```
Student-Course-Management-System/
│
├── backend/                  Node.js + Express + SQLite REST API
│   ├── server.js             App entry point (middleware, routes, startup)
│   ├── package.json
│   ├── .env                  Environment configuration (PORT, DB_PATH, CORS_ORIGIN)
│   ├── routes/                courseRoutes.js — maps URLs -> controllers
│   ├── controllers/           courseController.js — request/response handlers
│   ├── models/                 courseModel.js — SQL data-access layer (soft delete / recycle bin)
│   ├── middleware/             validation.js, errorHandler.js
│   ├── database/               database.js — SQLite connection + schema + migrations
│   └── utils/                  recursion.js, courseValidators.js, importParser.js
│
├── frontend/                 HTML / CSS / JavaScript client
│   ├── index.html             Single-page app shell (all "pages" live here)
│   ├── css/                   style.css, dashboard.css, forms.css, table.css,
│   │                           notifications.css, responsive.css
│   ├── js/
│   │   ├── api.js             API_BASE_URL + every fetch() call to the backend
│   │   ├── validation.js      Client-side form validation
│   │   ├── modal.js           Reusable alert modal (validation/success/failure)
│   │   ├── notifications.js   Notification bell: stores + renders notifications
│   │   ├── dashboard.js       Stat cards + animated counters
│   │   ├── courses.js         CRUD state, table rendering, modals
│   │   ├── deleted.js         Deleted Courses (Recycle Bin) page
│   │   ├── import.js          Import Courses from CSV/Excel
│   │   ├── search.js          Search Course page
│   │   └── app.js             Navigation, toasts, loading overlay, bootstrap
│   ├── assets/                 icons/, images/
│   └── pages/                  (see pages/README.md — this app is a single-page app)
│
└── README.md                 You are here
```

## How the pieces fit together

* **Database:** SQLite file at `backend/database/student_courses.db`, created
  automatically on first run. One table, `courses`, with columns `id`,
  `courseCode` (unique), `courseTitle`, `courseUnit`, `createdAt`, `updatedAt`,
  and `deletedAt` (soft-delete timestamp — `NULL` means the course is active).
* **API layer:** Express routes → validation middleware (`express-validator`)
  → controllers → model (parameterized SQL, no string concatenation).
* **Frontend ↔ backend contract**, all defined in `frontend/js/api.js`:

  | Feature              | Method & Route                    |
  |------------------------|--------------------------------------|
  | Add Course            | `POST /api/courses`                  |
  | View All Courses      | `GET /api/courses`                   |
  | Search Course          | `GET /api/courses/:code`             |
  | Edit Course            | `PUT /api/courses/:id`               |
  | Delete Course (soft)   | `DELETE /api/courses/:id`            |
  | Deleted Courses list   | `GET /api/courses/deleted`           |
  | Restore Course         | `PATCH /api/courses/:id/restore`     |
  | Permanently Delete     | `DELETE /api/courses/:id/permanent`  |
  | Import Courses         | `POST /api/courses/import`           |
  | Total Units            | `GET /api/total-units`               |

  `frontend/js/api.js` stores this base URL in one place:

  ```js
  const API_BASE_URL = "http://localhost:5000/api";
  ```

  Every request in the app is built on top of that constant — change it
  once (or from the in-app **Settings** page) and everything follows.

* **Full round trip, no page refresh:** adding, editing, and deleting a
  course all call the backend, update the in-memory course list with the
  server's response, then re-render the table — so the UI, the API, and
  the SQLite database are always in sync. The Total Units card is
  refreshed from `GET /api/total-units` (which sums units **recursively**
  on the server, see `backend/utils/recursion.js`) after every mutation.
* **UX details:** a global loading overlay shows during every request,
  every operation raises a success/error toast, and network failures
  (backend not running, dropped connection) are caught and shown as a
  friendly toast instead of a silent failure or a broken UI.

## Requirements

* Node.js 18+ and npm

## Running the project

### 1. Start the backend

```bash
cd backend
npm install
npm run dev
```

You should see:

```
🚀 Student Course Management API running on http://localhost:5000
✅ Connected to SQLite database at .../backend/database/student_courses.db
✅ 'courses' table is ready.
```

`npm run dev` uses `nodemon` (auto-restarts on file changes). Use
`npm start` for a plain `node server.js` run instead.

### 2. Open the frontend

You have two options — pick whichever is more convenient:

**Option A — one server for everything (simplest).**
The Express backend automatically serves the `frontend/` folder as static
files and falls back to `index.html` for any non-`/api` route. With the
backend running from step 1, just open:

```
http://localhost:5000
```

No second server, no CORS to worry about — frontend and API share an origin.

**Option B — serve the frontend separately.**
Useful if you want to edit the frontend with a live-reloading dev server
(VS Code "Live Server", `npx serve frontend`, etc). CORS is already
configured on the backend (`CORS_ORIGIN=*` in `.env`) to accept requests
from any origin during development, so just open `frontend/index.html`
with your tool of choice, e.g.:

```bash
cd frontend
npx serve .
```

Then visit the URL it prints (e.g. `http://localhost:3000`). As long as
the backend from step 1 is running on port 5000, everything will connect.

If you serve the backend on a different host/port, update the constant at
the top of `frontend/js/api.js` (or use the **Settings** page in the app,
which lets you change and save the API base URL at runtime).

## Environment configuration (`backend/.env`)

```env
PORT=5000
NODE_ENV=development
DB_PATH=./database/student_courses.db
CORS_ORIGIN=*
```

For production, set `CORS_ORIGIN` to your exact frontend origin(s) instead
of `*`, e.g. `CORS_ORIGIN=https://your-frontend.com`.

## API reference

All responses share a consistent JSON envelope: `{ success, message, data }`.

| Method | Endpoint                     | Body                                             | Description                                   |
|--------|--------------------------------|---------------------------------------------------|-------------------------------------------------|
| GET    | `/api/health`                 | —                                                   | Health check                                    |
| GET    | `/api/courses`                | —                                                   | List every active course                        |
| GET    | `/api/courses/deleted`        | —                                                   | List every course in the Recycle Bin            |
| GET    | `/api/courses/:code`          | —                                                   | Find one active course by course code           |
| POST   | `/api/courses`                | `{ courseCode, courseTitle, courseUnit }`          | Create a course                                 |
| POST   | `/api/courses/import`         | `multipart/form-data`, field `file` (.csv/.xlsx)   | Bulk-import courses; returns imported/failed/reasons |
| PUT    | `/api/courses/:id`            | `{ courseCode, courseTitle, courseUnit }`          | Update a course                                 |
| PATCH  | `/api/courses/:id/restore`    | —                                                   | Restore a soft-deleted course                   |
| DELETE | `/api/courses/:id`            | —                                                   | Soft-delete a course (moves it to Recycle Bin)  |
| DELETE | `/api/courses/:id/permanent`  | —                                                   | Permanently delete a course already in the bin  |
| GET    | `/api/total-units`            | —                                                   | `{ totalCourses, totalUnits }` (recursive sum, active courses only) |

**Validation rules** (identical on client, server, and file-import — see
`backend/utils/courseValidators.js`, the single source of truth for all three):
* `courseCode` — letters and numbers only (no symbols, no spaces), 2–15 characters, no leading/trailing whitespace, must be unique among active courses.
* `courseTitle` — 3–150 characters, must contain at least one letter or digit (rejects titles that are only punctuation/symbols).
* `courseUnit` — whole positive number, 1–10.

**Error handling:** invalid input → `400`, duplicate course code → `409`,
not found → `404`, unexpected errors → `500`. Every response is JSON, so
the frontend can always parse `message` and show it as a toast.

## Recycle Bin (soft delete)

Deleting a course never removes it from the database immediately — it
stamps a `deletedAt` timestamp instead, which:
* Excludes it from `GET /api/courses`, search, and the Total Units sum.
* Makes it appear on the **Deleted Courses** page, where it can be
  **restored** (clears `deletedAt`) or **permanently deleted** (a real
  `DELETE` — irreversible, and only allowed on rows already in the bin).

## Importing courses from CSV/Excel

The **Import Courses** button (Add Course page) accepts `.csv` or `.xlsx`
files with headers `courseCode`/`courseTitle`/`courseUnit` (case- and
spacing-insensitive, e.g. "Course Code" also works). The backend
(`backend/utils/importParser.js`, powered by SheetJS) parses every row and
validates it with the exact same rules as the manual form; valid,
non-duplicate rows are saved, everything else is skipped and reported back
as `{ importedCount, failedCount, reasons }`.

## Assignment requirements checklist

* ✅ Classes/objects — `AppError` (custom error class), IIFE modules
  (`API`, `Courses`, `DeletedCourses`, `ImportCourses`, `NotificationCenter`,
  `AlertModal`, `Dashboard`, `Search`, `Toast`, `App`) encapsulating state
  and behavior on the frontend.
* ✅ Validation — shared pure validator functions
  (`backend/utils/courseValidators.js`) used by `express-validator`
  middleware AND the file-import flow, mirrored client-side with inline
  field errors + professional modal popups for each invalid field.
* ✅ Exception handling — `try/catch` throughout controllers and frontend
  fetch calls; centralized Express error middleware (including multer
  upload errors); network-failure toasts.
* ✅ File/database operations — SQLite via `sqlite3`, parameterized
  queries, schema auto-created and auto-migrated on startup; CSV/Excel
  file parsing via SheetJS.
* ✅ Recursion — `calculateTotalUnitsRecursive` in `backend/utils/recursion.js`
  sums credit units without a loop.
* ✅ Loops — table rendering, form field wiring, stat computation, import
  row processing.
* ✅ Professional UI — responsive glassmorphism dashboard, sidebar
  navigation, notification bell, modals, toasts, loading spinners,
  animated counters, empty states, Recycle Bin.
