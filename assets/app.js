document.addEventListener("DOMContentLoaded", async () => {
  renderCalendarGrid();
  const menu = document.getElementById("subjectMenu");
  const backdrop = document.getElementById("menuBackdrop");
  const menuToggle = document.getElementById("menuToggle");

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

  // Abrir/cerrar menú (móvil)
  const setMenuOpen = (open) => {
    if (menu) menu.classList.toggle("active", open);
    if (backdrop) backdrop.classList.toggle("active", open);
    if (document.body) document.body.classList.toggle("no-scroll", open && window.innerWidth <= 900);
  };

  if (menuToggle) menuToggle.addEventListener("click", () => setMenuOpen(true));
  if (backdrop) backdrop.addEventListener("click", () => setMenuOpen(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenuOpen(false);
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const data = window.__subjectsData;
      if (!data) return;
      const currentSelected = loadSelectedSections().filter((key) => {
        const [s, sec] = key.split("|");
        return Boolean(data?.[s]?.Secciones?.[sec]);
      });
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
});
