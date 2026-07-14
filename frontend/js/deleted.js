/* =========================================================
   deleted.js — Deleted Courses (Recycle Bin) page.
   Loads soft-deleted courses from the backend and lets the user
   Restore them (back to the active course list) or Delete
   Permanently (irreversible, real SQL DELETE on the backend).
   ========================================================= */

const DeletedCourses = (() => {
  let deletedList = [];
  let pendingPermanentDeleteId = null;

  function formatDeletedAt(isoString) {
    if (!isoString) return "—";
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function updateSidebarBadge() {
    const badge = document.getElementById("deletedCoursesBadge");
    if (!badge) return;
    badge.textContent = deletedList.length > 99 ? "99+" : String(deletedList.length);
    badge.classList.toggle("hidden", deletedList.length === 0);
  }

  function renderTable() {
    const tbody = document.getElementById("deletedCoursesTableBody");
    const emptyState = document.getElementById("deletedCoursesEmpty");
    const table = document.getElementById("deletedCoursesTable");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!deletedList.length) {
      table.style.display = "none";
      emptyState.classList.remove("hidden");
      return;
    }

    table.style.display = "";
    emptyState.classList.add("hidden");

    deletedList.forEach((course) => {
      const tr = document.createElement("tr");

      const codeTd = document.createElement("td");
      codeTd.setAttribute("data-label", "Course Code");
      codeTd.innerHTML = `<span class="course-code-pill">${Courses.escapeHtml(course.courseCode)}</span>`;

      const titleTd = document.createElement("td");
      titleTd.setAttribute("data-label", "Course Title");
      titleTd.textContent = course.courseTitle;

      const unitTd = document.createElement("td");
      unitTd.setAttribute("data-label", "Credit Unit");
      unitTd.innerHTML = `<span class="unit-pill">${Courses.escapeHtml(String(course.courseUnit))}</span>`;

      const deletedTd = document.createElement("td");
      deletedTd.setAttribute("data-label", "Deleted");
      deletedTd.innerHTML = `<span class="deleted-at-label">${formatDeletedAt(course.deletedAt)}</span>`;

      const actionsTd = document.createElement("td");
      actionsTd.setAttribute("data-label", "Actions");
      actionsTd.innerHTML = `
        <div class="action-cell">
          <button class="btn-icon-sm btn-restore" data-action="restore" data-id="${course.id}" aria-label="Restore course">
            <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 109-9"/><path d="M3 4v8h8"/></svg>
          </button>
          <button class="btn-icon-sm btn-delete" data-action="permanent-delete" data-id="${course.id}" aria-label="Delete permanently">
            <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          </button>
        </div>`;

      tr.append(codeTd, titleTd, unitTd, deletedTd, actionsTd);
      tbody.appendChild(tr);
    });
  }

  async function loadAll() {
    App.showLoading("Fetching deleted courses…");
    try {
      const data = await API.getDeletedCourses();
      deletedList = Array.isArray(data) ? data : [];
      renderTable();
      updateSidebarBadge();
    } catch (err) {
      Toast.show(err.message || "Failed to load deleted courses.", "error");
    } finally {
      App.hideLoading();
    }
  }

  async function restore(id) {
    const course = deletedList.find((c) => String(c.id) === String(id));
    App.showLoading("Restoring course…");
    try {
      await API.restoreCourse(id);
      deletedList = deletedList.filter((c) => String(c.id) !== String(id));
      renderTable();
      updateSidebarBadge();
      Toast.show("Course restored successfully.", "success");
      NotificationCenter.add("success", "Course Restored Successfully");
      AlertModal.show({
        title: "Success",
        message: "Course Restored Successfully",
        tone: "success",
      });
      // Bring the active course list (and dashboard totals) back in sync.
      await Courses.loadAll();
    } catch (err) {
      Toast.show(err.message || "Could not restore the course.", "error");
      NotificationCenter.add("error", `Restore Failed${course ? `: ${course.courseCode}` : ""}`);
    } finally {
      App.hideLoading();
    }
  }

  function openPermanentDeleteModal(id) {
    const course = deletedList.find((c) => String(c.id) === String(id));
    if (!course) return;
    pendingPermanentDeleteId = id;
    document.getElementById("permanentDeleteCourseLabel").textContent = `${course.courseCode} — ${course.courseTitle}`;
    document.getElementById("permanentDeleteModalOverlay").classList.remove("hidden");
  }

  function closePermanentDeleteModal() {
    pendingPermanentDeleteId = null;
    document.getElementById("permanentDeleteModalOverlay").classList.add("hidden");
  }

  async function permanentlyDelete(id) {
    App.showLoading("Permanently deleting course…");
    try {
      await API.permanentlyDeleteCourse(id);
      deletedList = deletedList.filter((c) => String(c.id) !== String(id));
      renderTable();
      updateSidebarBadge();
      Toast.show("Course permanently deleted.", "success");
      closePermanentDeleteModal();
    } catch (err) {
      Toast.show(err.message || "Could not permanently delete the course.", "error");
    } finally {
      App.hideLoading();
    }
  }

  function initEvents() {
    document.getElementById("deletedCoursesTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      if (btn.dataset.action === "restore") restore(id);
      if (btn.dataset.action === "permanent-delete") openPermanentDeleteModal(id);
    });

    document.getElementById("closePermanentDeleteModal").addEventListener("click", closePermanentDeleteModal);
    document.getElementById("cancelPermanentDeleteBtn").addEventListener("click", closePermanentDeleteModal);
    document.getElementById("permanentDeleteModalOverlay").addEventListener("click", (e) => {
      if (e.target.id === "permanentDeleteModalOverlay") closePermanentDeleteModal();
    });
    document.getElementById("confirmPermanentDeleteBtn").addEventListener("click", () => {
      if (pendingPermanentDeleteId !== null) permanentlyDelete(pendingPermanentDeleteId);
    });

    // Refresh the recycle bin every time its page is shown, so it never
    // shows stale data after a delete/restore happened elsewhere.
    document.addEventListener("scms:page-shown", (e) => {
      if (e.detail.page === "deleted-courses") loadAll();
    });
  }

  return { loadAll, initEvents, updateSidebarBadge };
})();
