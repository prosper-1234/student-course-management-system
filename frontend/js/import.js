/* =========================================================
   import.js — "Import Courses" button on the Add Course page.
   Sends the chosen CSV/Excel file to the backend, which validates
   every row with the exact same rules as the manual form, then
   shows a summary modal: Imported / Failed / Reasons.
   ========================================================= */

const ImportCourses = (() => {
  function showResultsModal(result) {
    document.getElementById("importResultsImported").textContent = result.importedCount;
    document.getElementById("importResultsFailed").textContent = result.failedCount;

    const reasonsWrap = document.getElementById("importResultsReasonsWrap");
    const reasonsList = document.getElementById("importResultsReasons");
    reasonsList.innerHTML = "";

    if (result.reasons && result.reasons.length) {
      result.reasons.forEach((reason) => {
        const li = document.createElement("li");
        li.textContent = reason;
        reasonsList.appendChild(li);
      });
      reasonsWrap.classList.remove("hidden");
    } else {
      reasonsWrap.classList.add("hidden");
    }

    document.getElementById("importModalOverlay").classList.remove("hidden");
  }

  function hideResultsModal() {
    document.getElementById("importModalOverlay").classList.add("hidden");
  }

  async function handleFile(file) {
    const importBtn = document.getElementById("importCoursesBtn");
    const addBtn = document.getElementById("submitCourseBtn");
    importBtn.disabled = true;
    if (addBtn) addBtn.disabled = true;

    App.showLoading("Importing courses…");
    try {
      const result = await API.importCourses(file);

      if (result.importedCount > 0) {
        Toast.show(`Imported ${result.importedCount} course(s) successfully.`, "success");
      }
      if (result.failedCount > 0) {
        Toast.show(`${result.failedCount} row(s) could not be imported.`, "warning");
      }

      if (result.importedCount > 0) {
        NotificationCenter.add("success", `Imported ${result.importedCount} Course(s) Successfully`);
      }
      if (result.failedCount > 0) {
        const reasonSummary = (result.reasons && result.reasons[0]) || "some rows were invalid";
        NotificationCenter.add("error", `Upload Failed for ${result.failedCount} row(s): ${reasonSummary}`);
      }

      showResultsModal(result);

      // Refresh the active course list so newly-imported courses show up
      // immediately, without a page reload.
      await Courses.loadAll();
    } catch (err) {
      Toast.show(err.message || "Import failed. Please try again.", "error");
      NotificationCenter.add("error", "Upload Failed");
      AlertModal.show({
        title: "Failed",
        message: err.message || "Unable to import courses. Please try again.",
        tone: "error",
      });
    } finally {
      App.hideLoading();
      importBtn.disabled = false;
      if (addBtn) addBtn.disabled = false;
    }
  }

  function initEvents() {
    const input = document.getElementById("importFileInput");
    const button = document.getElementById("importCoursesBtn");

    button.addEventListener("click", () => input.click());

    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;
      handleFile(file);
      input.value = ""; // allow re-selecting the same file later
    });

    document.getElementById("closeImportModal").addEventListener("click", hideResultsModal);
    document.getElementById("importModalOkBtn").addEventListener("click", hideResultsModal);
    document.getElementById("importModalOverlay").addEventListener("click", (e) => {
      if (e.target.id === "importModalOverlay") hideResultsModal();
    });
  }

  return { initEvents };
})();
