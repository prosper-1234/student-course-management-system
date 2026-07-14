/* =========================================================
   notifications.js — Notification bell in the top navigation.
   Stores a running log of what happened (course added, deleted,
   restored, validation failures, etc), shown in a dropdown with
   unread counts, timestamps, and a "mark all as read" action.

   Notifications persist in localStorage so the bell still shows
   recent history after a page refresh (this is a real deployed
   web app, not a sandboxed preview, so localStorage is safe here).
   ========================================================= */

const NotificationCenter = (() => {
  const STORAGE_KEY = "scms_notifications";
  const MAX_NOTIFICATIONS = 50;

  const ICONS = {
    success: '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  };

  let notifications = [];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      notifications = raw ? JSON.parse(raw) : [];
    } catch (err) {
      notifications = [];
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch (err) {
      // Storage can fail in private-browsing modes — non-critical, ignore.
    }
  }

  function timeAgo(isoString) {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
    if (diffSec < 5) return "just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  }

  /**
   * @param {'success'|'error'} type
   * @param {string} message
   */
  function add(type, message) {
    notifications.unshift({
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      message,
      timestamp: new Date().toISOString(),
      read: false,
    });
    notifications = notifications.slice(0, MAX_NOTIFICATIONS);
    persist();
    render();
  }

  function unreadCount() {
    return notifications.filter((n) => !n.read).length;
  }

  function markAllRead() {
    notifications.forEach((n) => (n.read = true));
    persist();
    render();
  }

  function markRead(id) {
    const found = notifications.find((n) => n.id === id);
    if (found) found.read = true;
    persist();
    render();
  }

  function render() {
    const badge = document.getElementById("notificationBadge");
    const list = document.getElementById("notificationList");
    const empty = document.getElementById("notificationEmpty");
    if (!badge || !list) return;

    const count = unreadCount();
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.classList.toggle("hidden", count === 0);

    if (!notifications.length) {
      list.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    list.innerHTML = notifications
      .map(
        (n) => `
        <div class="notification-item ${n.type} ${n.read ? "" : "unread"}" data-id="${n.id}">
          <span class="notification-item-icon">${ICONS[n.type] || ICONS.success}</span>
          <div class="notification-item-body">
            <div class="notification-item-message">${escapeHtml(n.message)}</div>
            <div class="notification-item-time">${timeAgo(n.timestamp)}</div>
          </div>
          ${n.read ? "" : '<span class="notification-item-dot"></span>'}
        </div>`
      )
      .join("");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function toggleDropdown(forceState) {
    const dropdown = document.getElementById("notificationDropdown");
    const btn = document.getElementById("notificationBellBtn");
    const shouldOpen = forceState !== undefined ? forceState : dropdown.classList.contains("hidden");
    dropdown.classList.toggle("hidden", !shouldOpen);
    btn.setAttribute("aria-expanded", String(shouldOpen));
    if (shouldOpen) render();
  }

  function initEvents() {
    load();
    render();

    document.getElementById("notificationBellBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleDropdown();
    });

    document.getElementById("markAllReadBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      markAllRead();
    });

    document.getElementById("notificationList").addEventListener("click", (e) => {
      const item = e.target.closest(".notification-item");
      if (item) markRead(item.dataset.id);
    });

    // Close the dropdown when clicking anywhere else on the page.
    document.addEventListener("click", (e) => {
      const wrap = document.querySelector(".notification-wrap");
      if (wrap && !wrap.contains(e.target)) toggleDropdown(false);
    });
  }

  return { add, initEvents };
})();

document.addEventListener("DOMContentLoaded", NotificationCenter.initEvents);
