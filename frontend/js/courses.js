/* =========================================================
   courses.js — Core course data state + CRUD operations.
   This is the single source of truth for the in-memory course
   list, which is always kept in sync with the SQLite database
   through the backend REST API (no localStorage, no dummy data).
   ========================================================= */

const Courses = (() => {
  let courseList = []; // in-memory cache mirroring the last known backend state
  let pendingDeleteId = null;

  /* ---------------------------------------------------------
     ALERT MODAL HELPERS — maps a validation field to its
     required "Invalid ___" modal title + message (per brief).
     --------------------------------------------------------- */

  const FIELD_MODAL_COPY = {
    courseCode: { title: "Invalid Course Code", message: "Course Code can only contain letters and numbers." },
    courseTitle: { title: "Invalid Course Title", message: "Please enter a valid course title." },
    courseUnit: { title: "Invalid Credit Unit", message: "Credit Unit must be a valid number." },
  };

  function showFieldInvalidModal(field) {
    const copy = FIELD_MODAL_COPY[field];
    if (!copy) return;
    AlertModal.show({ title: copy.title, message: copy.message, tone: "warning" });
    NotificationCenter.add("error", copy.title);
  }

  /* ---------------------------------------------------------
     DATA LOADING
     --------------------------------------------------------- */

  /** GET /api/courses — load every active course and refresh the whole UI */
  async function loadAll() {
    App.showLoading("Fetching your courses…");
    try {
      const data = await API.getAllCourses();
      courseList = Array.isArray(data) ? data : [];
      renderTable();
      Dashboard.setSavedStatus("Synced");
      await refreshTotalUnits();
      Dashboard.renderCourseInfo(courseList);
      return courseList;
    } catch (err) {
      Toast.show(err.message || "Failed to load courses.", "error");
      renderTable(); // will show empty state
      Dashboard.setSavedStatus("Offline");
      Dashboard.renderCourseInfo(courseList);
      return [];
    } finally {
      App.hideLoading();
    }
  }

  /** GET /api/total-units — pulls the server-computed (recursive) total */
  async function refreshTotalUnits() {
    try {
      const totals = await API.getTotalUnits();
      Dashboard.renderTotals(totals.totalCourses, totals.totalUnits);
    } catch (err) {
      // Fall back to a client-side count so the UI still shows something
      // sensible even if this specific endpoint is briefly unreachable.
      Dashboard.renderTotals(
        courseList.length,
        courseList.reduce((sum, c) => sum + Number(c.courseUnit || 0), 0)
      );
    }
  }

  function getAll() {
    return courseList;
  }

  /* ---------------------------------------------------------
     RENDERING — View Courses table
     --------------------------------------------------------- */

  function renderTable() {
    const tbody = document.getElementById("coursesTableBody");
    const emptyState = document.getElementById("viewCoursesEmpty");
    const table = document.getElementById("coursesTable");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!courseList.length) {
      table.style.display = "none";
      emptyState.classList.remove("hidden");
      return;
    }

    table.style.display = "";
    emptyState.classList.add("hidden");

    courseList.forEach((course) => {
      tbody.appendChild(buildRow(course));
    });
  }

  function buildRow(course) {
    const tr = document.createElement("tr");

    const codeTd = document.createElement("td");
    codeTd.setAttribute("data-label", "Course Code");
    codeTd.innerHTML = `<span class="course-code-pill">${escapeHtml(course.courseCode)}</span>`;

    const titleTd = document.createElement("td");
    titleTd.setAttribute("data-label", "Course Title");
    titleTd.textContent = course.courseTitle;

    const unitTd = document.createElement("td");
    unitTd.setAttribute("data-label", "Credit Unit");
    unitTd.innerHTML = `<span class="unit-pill">${escapeHtml(String(course.courseUnit))}</span>`;

    const actionsTd = document.createElement("td");
    actionsTd.setAttribute("data-label", "Actions");
    actionsTd.innerHTML = `
      <div class="action-cell">
        <button class="btn-icon-sm btn-edit" data-action="edit" data-id="${course.id}" aria-label="Edit course">
          <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        <button class="btn-icon-sm btn-delete" data-action="delete" data-id="${course.id}" aria-label="Delete course">
          <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>`;

    tr.append(codeTd, titleTd, unitTd, actionsTd);
    return tr;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---------------------------------------------------------
     CREATE — POST /api/courses
     --------------------------------------------------------- */

  async function addCourse(course, { onSuccess } = {}) {
    App.showLoading("Saving course…");
    try {
      const created = await API.createCourse(course);
      if (created) courseList.unshift(created);
      renderTable();
      Dashboard.setSavedStatus("Saved");
      Dashboard.renderCourseInfo(courseList);
      await refreshTotalUnits();

      Toast.show(`"${course.courseCode}" added successfully.`, "success");
      NotificationCenter.add("success", "Course Added Successfully");
      AlertModal.show({ title: "Success", message: "Course added successfully.", tone: "success" });

      if (onSuccess) onSuccess();
    } catch (err) {
      handleSaveError(err, course.courseCode);
    } finally {
      App.hideLoading();
    }
  }

  /**
   * Shared failure handling for add/update: a 409 means the course code
   * is already taken (per brief, this gets its own specific message);
   * anything else is a generic "Failed to save" popup.
   */
  function handleSaveError(err, courseCode) {
    if (err.status === 409) {
      Toast.show("Course Code Already Exists", "error");
      NotificationCenter.add("error", "Duplicate Course Code");
      AlertModal.show({ title: "Duplicate Course Code", message: "Course Code Already Exists", tone: "warning" });
      return;
    }

    Toast.show(err.message || "Unable to save course.", "error");
    NotificationCenter.add("error", "Failed to Save Course");
    AlertModal.show({
      title: "Failed",
      message: "Unable to save course. Please try again.",
      tone: "error",
    });
  }

  /* ---------------------------------------------------------
     UPDATE — PUT /api/courses/:id
     --------------------------------------------------------- */

  async function updateCourse(id, course) {
    App.showLoading("Updating course…");
    try {
      const updated = await API.updateCourse(id, course);
      const idx = courseList.findIndex((c) => String(c.id) === String(id));
      if (idx > -1 && updated) {
        courseList[idx] = updated;
      }
      renderTable();
      Dashboard.setSavedStatus("Saved");
      Dashboard.renderCourseInfo(courseList);
      await refreshTotalUnits();

      Toast.show("Course updated successfully.", "success");
      NotificationCenter.add("success", "Course Updated Successfully");
      closeEditModal();
    } catch (err) {
      handleSaveError(err, course.courseCode);
    } finally {
      App.hideLoading();
    }
  }

  /* ---------------------------------------------------------
     DELETE (soft delete -> Recycle Bin) — DELETE /api/courses/:id
     --------------------------------------------------------- */

  async function performDelete(id) {
    App.showLoading("Deleting course…");
    try {
      await API.deleteCourse(id);
      courseList = courseList.filter((c) => String(c.id) !== String(id));
      renderTable();
      Dashboard.setSavedStatus("Saved");
      Dashboard.renderCourseInfo(courseList);
      await refreshTotalUnits();

      Toast.show("Course moved to Recycle Bin.", "success");
      NotificationCenter.add("success", "Course Deleted Successfully");
      closeDeleteModal();

      // Keep the Search page + Deleted Courses badge in sync.
      document.dispatchEvent(new CustomEvent("scms:courses-changed"));
      if (typeof DeletedCourses !== "undefined") DeletedCourses.loadAll();
    } catch (err) {
      Toast.show(err.message || "Could not delete the course.", "error");
      NotificationCenter.add("error", "Failed to Delete Course");
    } finally {
      App.hideLoading();
    }
  }

  /* ---------------------------------------------------------
     EDIT MODAL
     --------------------------------------------------------- */

  function openEditModal(id) {
    const course = courseList.find((c) => String(c.id) === String(id));
    if (!course) return;

    document.getElementById("editCourseId").value = course.id;
    document.getElementById("editCourseCode").value = course.courseCode;
    document.getElementById("editCourseTitle").value = course.courseTitle;
    document.getElementById("editCreditUnit").value = course.courseUnit;

    ["editCourseCode", "editCourseTitle", "editCreditUnit"].forEach((id2) => {
      document.getElementById(id2).classList.remove("invalid");
    });
    ["err-editCourseCode", "err-editCourseTitle", "err-editCreditUnit"].forEach((id2) => {
      document.getElementById(id2).textContent = "";
    });

    document.getElementById("editModalOverlay").classList.remove("hidden");
  }

  function closeEditModal() {
    document.getElementById("editModalOverlay").classList.add("hidden");
  }

  /* ---------------------------------------------------------
     DELETE MODAL
     --------------------------------------------------------- */

  function openDeleteModal(id) {
    const course = courseList.find((c) => String(c.id) === String(id));
    if (!course) return;
    pendingDeleteId = id;
    document.getElementById("deleteCourseLabel").textContent = `${course.courseCode} — ${course.courseTitle}`;
    document.getElementById("deleteModalOverlay").classList.remove("hidden");
  }

  function closeDeleteModal() {
    pendingDeleteId = null;
    document.getElementById("deleteModalOverlay").classList.add("hidden");
  }

  /* ---------------------------------------------------------
     EVENT WIRING
     --------------------------------------------------------- */

  function initEvents() {
    // Delegate edit/delete button clicks from both the main table and
    // the search-results table (same row markup, same data-action attrs)
    document.getElementById("coursesTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      if (btn.dataset.action === "edit") openEditModal(id);
      if (btn.dataset.action === "delete") openDeleteModal(id);
    });

    document.getElementById("searchResultsBody").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      if (btn.dataset.action === "edit") openEditModal(id);
      if (btn.dataset.action === "delete") openDeleteModal(id);
    });

    // Add Course form
    const addForm = document.getElementById("addCourseForm");
    const addSubmitBtn = document.getElementById("submitCourseBtn");
    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const course = {
        courseCode: document.getElementById("courseCode").value.trim().toUpperCase(),
        courseTitle: document.getElementById("courseTitle").value.trim(),
        courseUnit: document.getElementById("creditUnit").value,
      };
      const errors = Validation.validateCourseForm(course);
      Validation.applyErrors(
        {
          courseCode: { input: document.getElementById("courseCode"), errorEl: document.getElementById("err-courseCode") },
          courseTitle: { input: document.getElementById("courseTitle"), errorEl: document.getElementById("err-courseTitle") },
          courseUnit: { input: document.getElementById("creditUnit"), errorEl: document.getElementById("err-creditUnit") },
        },
        errors
      );

      if (!Validation.isFormValid(errors)) {
        const field = Validation.firstInvalidField(errors);
        showFieldInvalidModal(field);
        return;
      }

      setButtonsDisabled([addSubmitBtn, document.getElementById("clearFormBtn"), document.getElementById("importCoursesBtn")], true);
      addCourse({ ...course, courseUnit: Number(course.courseUnit) }, { onSuccess: () => addForm.reset() }).finally(() =>
        setButtonsDisabled([addSubmitBtn, document.getElementById("clearFormBtn"), document.getElementById("importCoursesBtn")], false)
      );
    });

    document.getElementById("clearFormBtn").addEventListener("click", () => {
      addForm.reset();
      ["courseCode", "courseTitle", "creditUnit"].forEach((id) => {
        document.getElementById(id).classList.remove("invalid");
        document.getElementById(`err-${id}`).textContent = "";
      });
    });

    // Edit form
    document.getElementById("editCourseForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const id = document.getElementById("editCourseId").value;
      const course = {
        courseCode: document.getElementById("editCourseCode").value.trim().toUpperCase(),
        courseTitle: document.getElementById("editCourseTitle").value.trim(),
        courseUnit: document.getElementById("editCreditUnit").value,
      };
      const errors = Validation.validateCourseForm(course);
      Validation.applyErrors(
        {
          courseCode: { input: document.getElementById("editCourseCode"), errorEl: document.getElementById("err-editCourseCode") },
          courseTitle: { input: document.getElementById("editCourseTitle"), errorEl: document.getElementById("err-editCourseTitle") },
          courseUnit: { input: document.getElementById("editCreditUnit"), errorEl: document.getElementById("err-editCreditUnit") },
        },
        errors
      );

      if (!Validation.isFormValid(errors)) {
        const field = Validation.firstInvalidField(errors);
        showFieldInvalidModal(field);
        return;
      }

      const editSubmitBtn = e.target.querySelector('button[type="submit"]');
      setButtonsDisabled([editSubmitBtn, document.getElementById("cancelEditBtn")], true);
      updateCourse(id, { ...course, courseUnit: Number(course.courseUnit) }).finally(() =>
        setButtonsDisabled([editSubmitBtn, document.getElementById("cancelEditBtn")], false)
      );
    });

    document.getElementById("closeEditModal").addEventListener("click", closeEditModal);
    document.getElementById("cancelEditBtn").addEventListener("click", closeEditModal);
    document.getElementById("editModalOverlay").addEventListener("click", (e) => {
      if (e.target.id === "editModalOverlay") closeEditModal();
    });

    // Delete modal
    document.getElementById("closeDeleteModal").addEventListener("click", closeDeleteModal);
    document.getElementById("cancelDeleteBtn").addEventListener("click", closeDeleteModal);
    document.getElementById("deleteModalOverlay").addEventListener("click", (e) => {
      if (e.target.id === "deleteModalOverlay") closeDeleteModal();
    });
    document.getElementById("confirmDeleteBtn").addEventListener("click", () => {
      if (pendingDeleteId !== null) {
        const confirmBtn = document.getElementById("confirmDeleteBtn");
        const cancelBtn = document.getElementById("cancelDeleteBtn");
        setButtonsDisabled([confirmBtn, cancelBtn], true);
        performDelete(pendingDeleteId).finally(() => setButtonsDisabled([confirmBtn, cancelBtn], false));
      }
    });
  }

  /** Disables/enables a list of buttons while an async action is in flight. */
  function setButtonsDisabled(buttons, disabled) {
    buttons.forEach((btn) => {
      if (btn) btn.disabled = disabled;
    });
  }

  return {
    loadAll,
    getAll,
    renderTable,
    buildRow,
    escapeHtml,
    initEvents,
    refreshTotalUnits,
  };
})();
