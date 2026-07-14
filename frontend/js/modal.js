/* =========================================================
   modal.js — Generic "alert" modal used for validation errors,
   success confirmations, and failure notices (Add Course flow,
   Restore flow, Import flow, etc). One reusable component instead
   of a bespoke modal per message, per the brief's request for
   "professional modal popups".
   ========================================================= */

const AlertModal = (() => {
  const ICONS = {
    success: '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
    warning: '<svg viewBox="0 0 24 24"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  };

  let onOkCallback = null;

  function elements() {
    return {
      overlay: document.getElementById("alertModalOverlay"),
      icon: document.getElementById("alertModalIcon"),
      title: document.getElementById("alertModalTitle"),
      message: document.getElementById("alertModalMessage"),
      okBtn: document.getElementById("alertModalOkBtn"),
    };
  }

  /**
   * Shows the alert modal.
   * @param {{title: string, message: string, tone?: 'success'|'error'|'warning', okText?: string, onOk?: Function}} opts
   */
  function show({ title, message, tone = "warning", okText = "OK", onOk = null }) {
    const { overlay, icon, title: titleEl, message: messageEl, okBtn } = elements();

    icon.className = `alert-modal-icon tone-${tone}`;
    icon.innerHTML = ICONS[tone] || ICONS.warning;
    titleEl.textContent = title;
    messageEl.textContent = message;
    okBtn.textContent = okText;

    onOkCallback = onOk;
    overlay.classList.remove("hidden");
    okBtn.focus();
  }

  function hide() {
    document.getElementById("alertModalOverlay").classList.add("hidden");
    onOkCallback = null;
  }

  function initEvents() {
    const { overlay, okBtn } = elements();
    okBtn.addEventListener("click", () => {
      const cb = onOkCallback;
      hide();
      if (cb) cb();
    });
    overlay.addEventListener("click", (e) => {
      if (e.target.id === "alertModalOverlay") hide();
    });
  }

  return { show, hide, initEvents };
})();

document.addEventListener("DOMContentLoaded", AlertModal.initEvents);
