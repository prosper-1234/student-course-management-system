/* =========================================================
   search.js — Search Course page.

   UX: as the user types, we instantly filter the in-memory
   course list (Courses.getAll()) for a snappy partial-match
   preview. Once the input looks like a complete course code,
   we confirm against the backend with GET /api/courses/:code
   (the authoritative, database-backed search endpoint) and
   replace the preview with the server's answer.
   ========================================================= */

const Search = (() => {
  let debounceTimer = null;

  function renderResults(matches) {
    const tbody = document.getElementById("searchResultsBody");
    const emptyState = document.getElementById("searchEmpty");
    const table = document.getElementById("searchResultsTable");

    tbody.innerHTML = "";

    if (!matches.length) {
      table.style.display = "none";
      emptyState.classList.remove("hidden");
      return;
    }

    table.style.display = "";
    emptyState.classList.add("hidden");
    matches.forEach((course) => tbody.appendChild(Courses.buildRow(course)));
  }

  function filterLocal(query) {
    const q = query.trim().toLowerCase();
    if (!q) return Courses.getAll();
    return Courses.getAll().filter((c) => c.courseCode.toLowerCase().includes(q));
  }

  /** GET /api/courses/:code — authoritative lookup against the database */
  async function searchBackend(code) {
    try {
      const course = await API.getCourseByCode(code);
      renderResults(course ? [course] : []);
    } catch (err) {
      // A 404 means "no course with this code" — that's a normal, expected
      // outcome of a search, not a failure, so just show the empty state.
      if (err.status === 404) {
        renderResults([]);
      } else {
        Toast.show(err.message || "Search failed. Showing local results instead.", "error");
      }
    }
  }

  function handleInput(e) {
    const query = e.target.value;
    clearTimeout(debounceTimer);

    // Instant local filter first, for a snappy preview while typing.
    renderResults(filterLocal(query));

    if (!query.trim()) return;

    debounceTimer = setTimeout(() => {
      searchBackend(query.trim());
    }, 350);
  }

  function initEvents() {
    const input = document.getElementById("searchInput");
    input.addEventListener("input", handleInput);

    // Populate with the full list initially when the page is shown
    document.addEventListener("scms:page-shown", (e) => {
      if (e.detail.page === "search-course") {
        input.value = "";
        renderResults(Courses.getAll());
      }
    });

    // Keep the search results table in sync if a course was deleted
    // from elsewhere in the app while this page's results were showing it.
    document.addEventListener("scms:courses-changed", () => {
      const input2 = document.getElementById("searchInput");
      renderResults(filterLocal(input2.value));
    });

    // Top nav search icon jumps to the Search Course page
    document.getElementById("topSearchBtn").addEventListener("click", () => {
      App.navigateTo("search-course");
      setTimeout(() => input.focus(), 350);
    });
  }

  return { initEvents, renderResults, filterLocal };
})();
