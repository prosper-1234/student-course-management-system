/* =========================================================
   app.js — Application shell: page navigation, sidebar/hamburger,
   live clock, toast notification system, global loading overlay,
   settings page, and the bootstrap sequence.
   ========================================================= */

/* ---------------------------------------------------------
   TOAST NOTIFICATION SYSTEM
   --------------------------------------------------------- */
const Toast = (() => {
  const ICONS = {
    success: '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    warning: '<svg viewBox="0 0 24 24"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  };

  function show(message, type = "info", duration = 3500) {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${ICONS[type] || ICONS.info}</span>
      <span class="toast-message">${message}</span>
    `;
    container.appendChild(toast);

    const remove = () => {
      toast.classList.add("hide");
      setTimeout(() => toast.remove(), 300);
    };

    const timer = setTimeout(remove, duration);
    toast.addEventListener("click", () => {
      clearTimeout(timer);
      remove();
    });
  }

  return { show };
})();

/* ---------------------------------------------------------
   MAIN APP MODULE
   --------------------------------------------------------- */
const App = (() => {
  let clockInterval = null;

  /* ----- Global loading overlay ----- */
  function showLoading(message = "Loading…") {
    const overlay = document.getElementById("loadingOverlay");
    overlay.querySelector(".loading-text").textContent = message;
    overlay.classList.remove("hidden");
  }

  function hideLoading() {
    document.getElementById("loadingOverlay").classList.add("hidden");
  }

  /* ----- Page navigation (SPA-style section switching) ----- */
  function navigateTo(pageId) {
    document.querySelectorAll(".page").forEach((el) => el.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));

    const targetPage = document.getElementById(`page-${pageId}`);
    const targetNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (targetPage) targetPage.classList.add("active");
    if (targetNav) targetNav.classList.add("active");

    closeSidebarMobile();

    document.dispatchEvent(new CustomEvent("scms:page-shown", { detail: { page: pageId } }));

    // Scroll main content back to top on page change
    document.getElementById("pageContainer").scrollTo({ top: 0, behavior: "smooth" });
  }

  function initNavigation() {
    document.querySelectorAll(".nav-item[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => navigateTo(btn.dataset.page));
    });

    // Any element with data-goto acts as a shortcut link (e.g. Quick Actions, empty states)
    document.querySelectorAll("[data-goto]").forEach((btn) => {
      btn.addEventListener("click", () => navigateTo(btn.dataset.goto));
    });
  }

  /* ----- Sidebar / hamburger (mobile) ----- */
  function openSidebarMobile() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("sidebarOverlay").classList.add("visible");
  }
  function closeSidebarMobile() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebarOverlay").classList.remove("visible");
  }

  function initSidebarToggle() {
    document.getElementById("hamburgerBtn").addEventListener("click", () => {
      const sidebar = document.getElementById("sidebar");
      if (sidebar.classList.contains("open")) closeSidebarMobile();
      else openSidebarMobile();
    });
    document.getElementById("sidebarOverlay").addEventListener("click", closeSidebarMobile);
  }

  /* ----- Live clock in the top navigation ----- */
  function updateClock() {
    const el = document.getElementById("liveClock");
    if (!el) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    const timeStr = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    el.textContent = `${dateStr} · ${timeStr}`;
  }

  function initClock() {
    updateClock();
    clockInterval = setInterval(updateClock, 1000);
  }

  /* ----- Admin profile dropdown (topnav avatar) -----
     Purely frontend/UI: hardcoded admin details are already in the
     markup (index.html). This just toggles visibility. ----- */
  function initAdminProfile() {
    const btn = document.getElementById("adminProfileBtn");
    const dropdown = document.getElementById("adminProfileDropdown");
    if (!btn || !dropdown) return;

    function toggleDropdown(forceState) {
      const shouldOpen = forceState !== undefined ? forceState : dropdown.classList.contains("hidden");
      dropdown.classList.toggle("hidden", !shouldOpen);
      btn.setAttribute("aria-expanded", String(shouldOpen));
    }

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleDropdown();
    });

    document.addEventListener("click", (e) => {
      const wrap = document.querySelector(".admin-profile-wrap");
      if (wrap && !wrap.contains(e.target)) toggleDropdown(false);
    });
  }

  /* ----- Settings page ----- */
  function initSettings() {
    const input = document.getElementById("apiBaseInput");
    input.value = API.getBaseUrl();

    document.getElementById("saveApiBaseBtn").addEventListener("click", () => {
      const value = input.value.trim();
      if (!value) {
        Toast.show("Please enter a valid API base URL.", "warning");
        return;
      }
      API.setBaseUrl(value);
      Toast.show("Setting saved. Reload data to apply it.", "success");
    });

    document.getElementById("reloadDataBtn").addEventListener("click", () => {
      Courses.loadAll();
    });
  }

  /* ----- Bootstrap ----- */
  async function init() {
    initNavigation();
    initSidebarToggle();
    initClock();
    initAdminProfile();
    initSettings();
    Courses.initEvents();
    Search.initEvents();
    DeletedCourses.initEvents();
    ImportCourses.initEvents();

    await Courses.loadAll();
    await DeletedCourses.loadAll(); // populates the sidebar recycle-bin badge on startup
  }

  return { showLoading, hideLoading, navigateTo, init };
})();

document.addEventListener("DOMContentLoaded", App.init);
