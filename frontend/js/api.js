/* =========================================================
   api.js — Centralized communication layer with the
   Node.js + Express REST backend. Every network call in the
   app goes through the functions exposed here, and every
   frontend request uses the single API_BASE_URL constant
   defined below (per the assignment brief).

   Backend contract (matches backend/routes/courseRoutes.js):
     GET    /api/courses          -> [{ id, courseCode, courseTitle, courseUnit, createdAt }]
     GET    /api/courses/:code    -> { id, courseCode, courseTitle, courseUnit, createdAt }
     POST   /api/courses          -> body { courseCode, courseTitle, courseUnit } -> created course
     PUT    /api/courses/:id      -> body { courseCode, courseTitle, courseUnit } -> updated course
     DELETE /api/courses/:id      -> { success, message, data: { id } }
     GET    /api/total-units      -> { success, message, data: { totalCourses, totalUnits }, totalUnits }
   ========================================================= */

// Single source of truth for the backend base URL, as required by the brief.
// Every fetch call in this app is built on top of this constant.
const API_BASE_URL = "https://student-course-management-system-wj3q.onrender.com";

const API = (() => {
  // The base URL can still be overridden from the Settings page (useful if
  // the backend is deployed elsewhere), but defaults to the constant above.
  let baseUrl = API_BASE_URL;

  function setBaseUrl(url) {
    if (url && url.trim()) {
      baseUrl = url.trim().replace(/\/$/, "");
    }
  }

  function getBaseUrl() {
    return baseUrl;
  }

  /**
   * Generic fetch wrapper with JSON handling and consistent error shape.
   * Every API method below funnels through this so that network failures,
   * server errors, and malformed responses are all handled in one place.
   */
  async function request(path, options = {}) {
    const url = `${baseUrl}${path}`;
    const config = {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    };
    if (options.body) {
      config.body = JSON.stringify(options.body);
    }

    let response;
    try {
      response = await fetch(url, config);
    } catch (networkError) {
      // fetch() throws (rather than resolving) on network-level failures:
      // server down, CORS blocked, DNS failure, offline, etc.
      throw new Error(
        "Could not reach the server. Please make sure the backend is running on " +
          baseUrl.replace(/\/api$/, "") +
          " and try again."
      );
    }

    let payload = null;
    const text = await response.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (parseError) {
        payload = null;
      }
    }

    if (!response.ok) {
      const message = (payload && payload.message) || `Request failed with status ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  return {
    setBaseUrl,
    getBaseUrl,

    /** GET /api/courses — fetch every course from the backend */
    getAllCourses() {
      return request("/courses", { method: "GET" }).then((res) => (res && res.data) || []);
    },

    /** GET /api/courses/:code — fetch a single course by its exact course code */
    getCourseByCode(code) {
      return request(`/courses/${encodeURIComponent(code)}`, { method: "GET" }).then(
        (res) => (res && res.data) || null
      );
    },

    /** POST /api/courses — create a new course */
    createCourse(course) {
      return request("/courses", { method: "POST", body: course }).then((res) => (res && res.data) || null);
    },

    /** PUT /api/courses/:id — update an existing course */
    updateCourse(id, course) {
      return request(`/courses/${encodeURIComponent(id)}`, { method: "PUT", body: course }).then(
        (res) => (res && res.data) || null
      );
    },

    /** DELETE /api/courses/:id — soft-delete a course (moves it to the Recycle Bin) */
    deleteCourse(id) {
      return request(`/courses/${encodeURIComponent(id)}`, { method: "DELETE" }).then((res) => res);
    },

    /** GET /api/courses/deleted — fetch every course in the Recycle Bin */
    getDeletedCourses() {
      return request("/courses/deleted", { method: "GET" }).then((res) => (res && res.data) || []);
    },

    /** PATCH /api/courses/:id/restore — restore a soft-deleted course */
    restoreCourse(id) {
      return request(`/courses/${encodeURIComponent(id)}/restore`, { method: "PATCH" }).then(
        (res) => (res && res.data) || null
      );
    },

    /** DELETE /api/courses/:id/permanent — permanently remove a soft-deleted course */
    permanentlyDeleteCourse(id) {
      return request(`/courses/${encodeURIComponent(id)}/permanent`, { method: "DELETE" }).then((res) => res);
    },

    /** GET /api/total-units — server-computed (recursive) total credit units */
    getTotalUnits() {
      return request("/total-units", { method: "GET" }).then(
        (res) => (res && res.data) || { totalCourses: 0, totalUnits: 0 }
      );
    },

    /**
     * POST /api/courses/import — bulk-import courses from a CSV/Excel file.
     * Bypasses the shared `request()` helper because this is a multipart
     * upload, not JSON.
     */
    async importCourses(file) {
      const formData = new FormData();
      formData.append("file", file);

      let response;
      try {
        response = await fetch(`${baseUrl}/courses/import`, { method: "POST", body: formData });
      } catch (networkError) {
        throw new Error(
          "Could not reach the server. Please make sure the backend is running on " +
            baseUrl.replace(/\/api$/, "") +
            " and try again."
        );
      }

      let payload = null;
      const text = await response.text();
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch (parseError) {
          payload = null;
        }
      }

      if (!response.ok) {
        const message = (payload && payload.message) || `Import failed with status ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }

      return (payload && payload.data) || { importedCount: 0, failedCount: 0, imported: [], failed: [], reasons: [] };
    },
  };
})();
