/* =========================================================
   dashboard.js — Dashboard & Total Units statistic rendering,
   including the animated counter effect.

   Total course count + total credit units are always sourced
   from the backend (GET /api/total-units, which itself uses a
   RECURSIVE sum on the server — see backend/utils/recursion.js),
   so the numbers shown here are guaranteed to match the database.
   ========================================================= */

const Dashboard = (() => {
  /**
   * Animates a number from its current displayed value up to `target`.
   */
  function animateCounter(el, target, duration = 900) {
    const start = Number(el.textContent.replace(/,/g, "")) || 0;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const value = Math.round(start + (target - start) * eased);
      el.textContent = value.toLocaleString();
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = target.toLocaleString();
      }
    }
    requestAnimationFrame(tick);
  }

  /**
   * Renders the "Total Courses" and "Total Credit Units" cards on both
   * the Dashboard and the Total Units page, using numbers that came
   * straight from GET /api/total-units.
   */
  function renderTotals(totalCourses, totalUnits) {
    const targets = [
      ["statTotalCourses", totalCourses],
      ["statTotalUnits", totalUnits],
      ["unitsTotalCourses", totalCourses],
      ["unitsTotalUnits", totalUnits],
    ];
    targets.forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) animateCounter(el, Number(value) || 0);
    });
  }

  /**
   * Renders the "Recently Added Course" card from the in-memory list
   * that courses.js keeps in sync with the backend.
   */
  function renderCourseInfo(courses) {
    const recentCourseEl = document.getElementById("statRecentCourse");
    if (!recentCourseEl) return;

    const mostRecent = courses.length
      ? [...courses].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]
      : null;

    recentCourseEl.textContent = mostRecent
      ? `${mostRecent.courseCode} — ${mostRecent.courseTitle}`
      : "No courses yet";
  }

  function setSavedStatus(text) {
    const savedStatusEl = document.getElementById("statSavedStatus");
    if (savedStatusEl) savedStatusEl.textContent = text;
  }

  return { renderTotals, renderCourseInfo, setSavedStatus };
})();
