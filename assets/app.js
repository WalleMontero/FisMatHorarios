const THEME_STORAGE_KEY = "theme";

function getPreferredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch (_) {
    // ignore storage errors
  }
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("themeToggle");
  if (btn) {
    const isDark = theme === "dark";
    btn.textContent = isDark ? "☀️" : "🌙";
    btn.setAttribute("aria-label", isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
    btn.setAttribute("title", isDark ? "Tema claro" : "Tema oscuro");
  }
}

function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  applyTheme(getPreferredTheme());
  if (!btn) return;
  btn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (_) {
      // ignore storage errors
    }
    applyTheme(next);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initThemeToggle();
  renderCalendarGrid();

  let subjectsData;
  try {
    subjectsData = await loadMergedData();
  } catch (err) {
    console.error(err);
    const loadingState = document.getElementById("loadingState");
    if (loadingState) {
      loadingState.textContent = "No se pudo cargar el archivo de datos.";
      loadingState.hidden = false;
    }
    return;
  }

  const loadingState = document.getElementById("loadingState");
  if (loadingState) loadingState.hidden = true;
  window.__subjectsData = subjectsData;

  const selected = loadSelectedSections();
  const cleaned = selected.filter((key) => {
    const [subjectName, sectionId] = key.split("|");
    return Boolean(subjectsData?.[subjectName]?.Secciones?.[sectionId]);
  });
  if (cleaned.length !== selected.length) saveSelectedSections(cleaned);
  setSelectedCount(cleaned.length);
  buildSubjectMenu(subjectsData);
  renderSelectedSections(subjectsData, cleaned);

  // Reseteo de scroll al cambiar de vista (opcional)
  const searcher = document.getElementById("searcher");
  if (searcher) {
    searcher.addEventListener("input", () => buildSubjectMenu(subjectsData));
    searcher.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.target.value = "";
        buildSubjectMenu(subjectsData);
      }
    });
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const data = window.__subjectsData;
      if (!data) return;
      const currentSelected = loadSelectedSections();
      renderCalendarGrid();
      renderSelectedSections(data, currentSelected);
    }, 120);
  });

  if (window.ResizeObserver) {
    const calendarEl = document.getElementById("calendar");
    if (calendarEl) {
      const ro = new ResizeObserver(() => {
        const data = window.__subjectsData;
        if (!data) return;
        const currentSelected = loadSelectedSections().filter((key) => {
          const [s, sec] = key.split("|");
          return Boolean(data?.[s]?.Secciones?.[sec]);
        });
        renderCalendarGrid();
        renderSelectedSections(data, currentSelected);
      });
      ro.observe(calendarEl);
    }
  }

  const syncBtn = document.getElementById("syncGoogle");
  if (syncBtn) {
    syncBtn.addEventListener("click", () => handleSyncClick(subjectsData));
  }

  // Anuncio de nueva función (una sola vez)
  if (localStorage.getItem("hasSeenEditorAnnouncement") !== "true") {
    setTimeout(() => {
      showAnnouncementModal();
    }, 1000); // Pequeño delay para que no sea tan brusco
  }
});
