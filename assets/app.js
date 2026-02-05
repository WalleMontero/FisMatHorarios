const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const DAY_COLORS = ["#5DA157", "#00AEB5", "#F05254", "#F18422", "#EDCF1F"];

const START_HOUR = 8;
const END_HOUR = 21;
const SLOT_MINUTES = 30; // 30 min por fila

const STORAGE_KEY = "fastweb_selected_sections_v1";
const COLOR_KEY = "fastweb_section_colors_v1";
const DAY_LANES = new Map(); // day -> element
let cachedSlotHeightPx = null;
let layoutTimer = null;

function minutesFromHHMM(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function stableColorFromString(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  const base = 180;
  const r = base + (hash & 0x3f);
  const g = base + ((hash >> 6) & 0x3f);
  const b = base + ((hash >> 12) & 0x3f);
  const toHex = (c) => clamp(c, 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function loadSelectedSections() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveSelectedSections(sectionKeys) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sectionKeys));
}

function loadColorMap() {
  try {
    const raw = localStorage.getItem(COLOR_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveColorMap(map) {
  localStorage.setItem(COLOR_KEY, JSON.stringify(map));
}

function getSectionColor(key, fallbackName) {
  const map = loadColorMap();
  return map[key] || stableColorFromString(fallbackName);
}

function setSectionColor(key, color) {
  const map = loadColorMap();
  map[key] = color;
  saveColorMap(map);
}

function setSelectedCount(n) {
  const el = document.getElementById("selectedCount");
  el.textContent = String(n);
}

function getSlotHeightPx() {
  if (cachedSlotHeightPx != null) return cachedSlotHeightPx;
  const calendar = document.getElementById("calendar");
  const raw = getComputedStyle(calendar).getPropertyValue("--slot-h").trim();
  const n = parseInt(raw.replace("px", ""), 10);
  cachedSlotHeightPx = Number.isFinite(n) && n > 0 ? n : 28;
  return cachedSlotHeightPx;
}

function getCalendarVarPx(name, fallback) {
  const calendar = document.getElementById("calendar");
  const raw = getComputedStyle(calendar).getPropertyValue(name).trim();
  const n = parseInt(raw.replace("px", ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function renderCalendarGrid() {
  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";

  DAY_LANES.clear();
  cachedSlotHeightPx = null;

  // Headers de días
  DAYS.forEach((dia, index) => {
    const header = document.createElement("div");
    const contenido = document.createElement("div");
    contenido.style.backgroundColor = DAY_COLORS[index];
    contenido.classList.add("content");
    header.classList.add("day-header");
    contenido.textContent = dia;
    header.style.gridRow = "1";
    header.style.gridColumn = String(index + 2);
    header.appendChild(contenido);
    calendar.appendChild(header);
  });

  const totalSlots = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;

  // Etiquetas de hora: 1 etiqueta por hora, abarca 2 slots (60 min)
  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    const timeDiv = document.createElement("div");
    timeDiv.classList.add("time-label");
    timeDiv.textContent = String(hour).padStart(2, "0");
    const rowStart = (hour - START_HOUR) * (60 / SLOT_MINUTES) + 2;
    timeDiv.style.gridRow = `${rowStart} / span ${60 / SLOT_MINUTES}`;
    timeDiv.style.gridColumn = "1";
    calendar.appendChild(timeDiv);
  }

  // Celdas de fondo: 1 por slot y día (cada día ocupa 2 columnas)
  for (let row = 2; row < 2 + totalSlots; row++) {
    for (let dayIndex = 0; dayIndex < DAYS.length; dayIndex++) {
      const cell = document.createElement("div");
      cell.classList.add("slot-cell");
      cell.style.gridRow = String(row);
      cell.style.gridColumn = String(dayIndex + 2);
      calendar.appendChild(cell);
    }
  }

  // Lanes por día (contenedores absolutos para eventos)
  for (let dayIndex = 0; dayIndex < DAYS.length; dayIndex++) {
    const day = DAYS[dayIndex];
    const lane = document.createElement("div");
    lane.classList.add("day-lane");
    lane.setAttribute("data-day", day);
    lane.style.gridColumn = String(dayIndex + 2);
    lane.style.gridRow = `2 / span ${totalSlots}`;
    calendar.appendChild(lane);
    DAY_LANES.set(day, lane);
  }
}

async function loadMergedData() {
  const response = await fetch("data/merged_data.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`No pude cargar data/merged_data.json (${response.status})`);
  const data = await response.json();
  if (!data || typeof data !== "object") throw new Error("Datos inválidos en merged_data.json");
  return data;
}

function subjectMatchesQuery(subjectName, subject, query) {
  if (!query) return true;
  const normalize = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const q = normalize(query.trim());
  if (!q) return true;
  const hay = [
    subjectName,
    subject?.Clave,
    subject?.Area,
    String(subject?.Semestre ?? ""),
  ]
    .filter(Boolean)
    .join(" | ");
  const text = normalize(hay);
  return text.includes(q);
}

function buildSubjectMenu(subjectsData) {
  const subjectList = document.getElementById("subjectList");
  const query = document.getElementById("searcher").value;
  const selected = new Set(loadSelectedSections());
  const emptyState = document.getElementById("emptyState");
  const loadingState = document.getElementById("loadingState");

  subjectList.innerHTML = "";
  if (loadingState) loadingState.hidden = true;
  let added = 0;

  const subjectNames = Object.keys(subjectsData).sort((a, b) => a.localeCompare(b));
  for (const subjectName of subjectNames) {
    const subject = subjectsData[subjectName];
    if (!subjectMatchesQuery(subjectName, subject, query)) continue;
    const sections = subject?.Secciones ? Object.keys(subject.Secciones) : [];
    sections.sort((a, b) => a.localeCompare(b));
    for (const secId of sections) {
      const combinedKey = `${subjectName}|${secId}`;
      const checkboxId = `subj-${combinedKey}`;

      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = combinedKey;
      cb.id = checkboxId;
      cb.checked = selected.has(combinedKey);

      cb.addEventListener("change", () => {
        const next = new Set(loadSelectedSections());
        if (cb.checked) next.add(combinedKey);
        else next.delete(combinedKey);
        saveSelectedSections(Array.from(next));
        setSelectedCount(next.size);
        label.classList.toggle("selected", cb.checked);
        buildSubjectMenu(subjectsData);
        renderSelectedSections(subjectsData, Array.from(next));
      });

      const meta = [];
      if (subject?.Clave) meta.push(subject.Clave);
      if (subject?.Area) meta.push(subject.Area);
      if (subject?.Semestre != null) meta.push(`S${subject.Semestre}`);

      const textWrap = document.createElement("div");
      textWrap.classList.add("subject-text");

      const title = document.createElement("div");
      title.classList.add("subject-title");
      title.textContent = `${subjectName} · S${secId}`;

      const metaLine = document.createElement("div");
      metaLine.classList.add("subject-meta");
      metaLine.textContent = meta.join(" · ");

      textWrap.appendChild(title);
      if (metaLine.textContent) textWrap.appendChild(metaLine);

      label.appendChild(cb);
      label.appendChild(textWrap);
      if (cb.checked) label.classList.add("selected");
      subjectList.appendChild(label);
      added += 1;
    }
  }
  if (emptyState) emptyState.hidden = added > 0;

  renderSelectedPanel(subjectsData, Array.from(selected));
}

function renderSelectedPanel(subjectsData, selectedKeys) {
  const container = document.getElementById("selectedList");
  if (!container) return;
  container.innerHTML = "";

  if (!selectedKeys.length) {
    const empty = document.createElement("div");
    empty.classList.add("selected-empty");
    empty.textContent = "Ninguna seleccionada";
    container.appendChild(empty);
    return;
  }

  const sorted = selectedKeys
    .map((key) => {
      const [subjectName, secId] = key.split("|");
      return { key, subjectName, secId };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName) || a.secId.localeCompare(b.secId));

  for (const item of sorted) {
    const row = document.createElement("div");
    row.classList.add("selected-item");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    cb.classList.add("selected-checkbox");
    cb.addEventListener("change", () => {
      const next = new Set(loadSelectedSections());
      next.delete(item.key);
      saveSelectedSections(Array.from(next));
      setSelectedCount(next.size);
      buildSubjectMenu(subjectsData);
      renderSelectedSections(subjectsData, Array.from(next));
    });

    const label = document.createElement("div");
    label.classList.add("selected-name");
    label.textContent = `${item.subjectName} · ${item.secId}`;

    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.classList.add("color-swatch");
    const currentColor = getSectionColor(item.key, item.subjectName);
    swatch.style.backgroundColor = currentColor;
    swatch.setAttribute("title", "Cambiar color");

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.classList.add("color-input");
    colorInput.value = currentColor;

    swatch.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      colorInput.click();
    });
    colorInput.addEventListener("change", (e) => {
      const color = e.target.value;
      setSectionColor(item.key, color);
      swatch.style.backgroundColor = color;
      renderSelectedSections(subjectsData, selectedKeys);
    });

    row.appendChild(cb);
    row.appendChild(label);
    row.appendChild(swatch);
    row.appendChild(colorInput);
    container.appendChild(row);
  }
}

function sectionToMeetings(section) {
  const meetings = [];
  const acts = section?.Actividades || {};
  for (const actId of Object.keys(acts)) {
    const act = acts[actId];
    if (!act?.Dia || !act?.Horario || act.Horario.length < 2) continue;
    meetings.push({
      day: act.Dia,
      startMin: minutesFromHHMM(act.Horario[0]),
      endMin: minutesFromHHMM(act.Horario[1]),
      salon: act.Salon || "",
    });
  }
  return meetings;
}


function clearRenderedEvents() {
  document.querySelectorAll("#calendar .event").forEach((el) => el.remove());
  const modalOverlay = document.getElementById("modalOverlay");
  if (modalOverlay) modalOverlay.remove();
}

function showSubjectModal(subjectsData, subjectName, sectionId) {
  const subject = subjectsData[subjectName];
  const section = subject?.Secciones?.[sectionId];
  if (!subject || !section) return;

  const combinedKey = `${subjectName}|${sectionId}`;
  const modalColor = getSectionColor(combinedKey, subjectName);

  const modalOverlay = document.createElement("div");
  modalOverlay.id = "modalOverlay";
  modalOverlay.classList.add("modal-overlay");

  const modalContent = document.createElement("div");
  modalContent.id = "modalContent";
  modalContent.classList.add("modal-content");
  modalContent.style.backgroundColor = modalColor;

  const title = document.createElement("h2");
  title.textContent = subjectName;

  const closeButton = document.createElement("span");
  closeButton.textContent = "X";
  closeButton.classList.add("close-button");
  closeButton.addEventListener("click", closeModal);

  const subjectTittle = document.createElement("h3");
  subjectTittle.textContent = subjectName;
  modalContent.appendChild(subjectTittle);

  const infoList = document.createElement("ul");
  const items = [
    ["Clave", subject.Clave],
    ["Área", subject.Area],
    ["Semestre", subject.Semestre],
    ["Créditos", subject.Creditos],
    ["Requisitos", subject.Requisitos],
  ].filter(([, v]) => v != null && String(v).trim() !== "");
  for (const [k, v] of items) {
    const li = document.createElement("li");
    li.innerHTML = `<b>${k}:</b> ${String(v)}`;
    infoList.appendChild(li);
  }

  const sectionTitle = document.createElement("h4");
  sectionTitle.innerHTML = `Sección: ${sectionId} <br> Profesor: ${section.Profesor || "—"}`;

  const activitiesTitle = document.createElement("h4");
  activitiesTitle.textContent = "Actividades:";
  activitiesTitle.style.marginBottom = "3px";

  const activitiesList = document.createElement("ul");
  activitiesList.style.marginTop = "0";

  const meetings = sectionToMeetings(section);
  for (const m of meetings) {
    const li = document.createElement("li");
    const startHH = String(Math.floor(m.startMin / 60)).padStart(2, "0") + ":" + String(m.startMin % 60).padStart(2, "0");
    const endHH = String(Math.floor(m.endMin / 60)).padStart(2, "0") + ":" + String(m.endMin % 60).padStart(2, "0");
    li.innerHTML = `<b>${m.day}</b>, de ${startHH} a ${endHH}${m.salon ? ` en <b>${m.salon}</b>` : ""}`;
    activitiesList.appendChild(li);
  }

  modalContent.appendChild(closeButton);
  modalContent.appendChild(infoList);
  modalContent.appendChild(sectionTitle);
  modalContent.appendChild(activitiesTitle);
  modalContent.appendChild(activitiesList);
  modalOverlay.appendChild(modalContent);

  const calendar = document.getElementById("calendar");
  calendar.appendChild(modalOverlay);

  setTimeout(() => {
    modalOverlay.classList.add("show");
    modalContent.classList.add("show");
  }, 10);

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
}

function closeModal() {
  const modalOverlay = document.getElementById("modalOverlay");
  if (!modalOverlay) return;
  const modalContent = modalOverlay.querySelector(".modal-content");
  modalOverlay.classList.remove("show");
  if (modalContent) modalContent.classList.remove("show");
  setTimeout(() => modalOverlay.remove(), 250);
}

function renderSelectedSections(subjectsData, selectedKeys) {
  clearRenderedEvents();
  const emptyEl = document.getElementById("calendarEmpty");
  if (!selectedKeys.length) {
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;

  const byDay = new Map(DAYS.map((d) => [d, []]));

  for (const key of selectedKeys) {
    const [subjectName, sectionId] = key.split("|");
    const subject = subjectsData[subjectName];
    const section = subject?.Secciones?.[sectionId];
    if (!section) continue;

    const meetings = sectionToMeetings(section);
    for (const m of meetings) {
      const dayIndex = DAYS.indexOf(m.day);
      if (dayIndex < 0) continue;
      const dayStartMin = START_HOUR * 60;

      const startSlots = Math.round((m.startMin - dayStartMin) / SLOT_MINUTES);
      const endSlots = Math.round((m.endMin - dayStartMin) / SLOT_MINUTES);
      byDay.get(m.day).push({
        subjectName,
        sectionId,
        meeting: m,
        startSlots,
        endSlots,
      });
    }
  }

  // Render por día con grid (sin posicionamiento absoluto)
  for (const day of DAYS) {
    const lane = DAY_LANES.get(day);
    if (!lane) continue;
    lane.innerHTML = "";
    const items = byDay.get(day) || [];
    if (!items.length) continue;

    items.sort((a, b) => a.startSlots - b.startSlots || a.endSlots - b.endSlots);

    // Crear clusters por traslape para que cada grupo use su propio número de columnas
    const clusters = [];
    let cluster = [];
    let clusterEnd = -Infinity;
    for (const item of items) {
      if (!cluster.length) {
        cluster = [item];
        clusterEnd = item.endSlots;
        continue;
      }
      if (item.startSlots < clusterEnd) {
        cluster.push(item);
        clusterEnd = Math.max(clusterEnd, item.endSlots);
      } else {
        clusters.push(cluster);
        cluster = [item];
        clusterEnd = item.endSlots;
      }
    }
    if (cluster.length) clusters.push(cluster);

    for (const cl of clusters) {
      // Asignar columnas dentro del cluster
      const colEnds = [];
      const assignments = [];
      let clusterStart = Infinity;
      let clusterEndSlots = -Infinity;

      for (const item of cl) {
        clusterStart = Math.min(clusterStart, item.startSlots);
        clusterEndSlots = Math.max(clusterEndSlots, item.endSlots);
        let col = -1;
        for (let i = 0; i < colEnds.length; i++) {
          if (colEnds[i] <= item.startSlots) {
            col = i;
            break;
          }
        }
        if (col === -1) {
          colEnds.push(item.endSlots);
          col = colEnds.length - 1;
        } else {
          colEnds[col] = item.endSlots;
        }
        assignments.push({ item, col });
      }

      const cols = Math.max(1, colEnds.length);
      const clusterEl = document.createElement("div");
      clusterEl.classList.add("cluster");
      clusterEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      clusterEl.style.gridRowStart = String(clusterStart + 1);
      clusterEl.style.gridRowEnd = String(clusterEndSlots + 1);

      for (const { item, col } of assignments) {
      const eventEl = document.createElement("div");
      eventEl.classList.add("event");
      const combinedKey = `${item.subjectName}|${item.sectionId}`;
      eventEl.style.backgroundColor = getSectionColor(combinedKey, item.subjectName);
        const titleHtml = `<span class="event-title">${item.subjectName}</span>`;
        const roomHtml = item.meeting.salon ? `<span class="event-room">${item.meeting.salon}</span>` : "";
        eventEl.innerHTML = `${titleHtml}${roomHtml}`;
        eventEl.setAttribute("data-day", day);
        eventEl.addEventListener("click", (e) => {
          e.stopPropagation();
          showSubjectModal(subjectsData, item.subjectName, item.sectionId);
        });

        eventEl.style.gridColumn = `${col + 1} / span 1`;
        eventEl.style.gridRowStart = String(item.startSlots - clusterStart + 1);
        eventEl.style.gridRowEnd = String(item.endSlots - clusterStart + 1);

        clusterEl.appendChild(eventEl);
      }

      lane.appendChild(clusterEl);
    }
  }
}

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

  document.getElementById("searcher").addEventListener("input", () => buildSubjectMenu(subjectsData));
  document.getElementById("searcher").addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.target.value = "";
      buildSubjectMenu(subjectsData);
    }
  });

  // Abrir/cerrar menú (móvil)
  const setMenuOpen = (open) => {
    menu.classList.toggle("active", open);
    backdrop.classList.toggle("active", open);
    document.body.classList.toggle("no-scroll", open && window.innerWidth <= 900);
  };
  menuToggle.addEventListener("click", () => setMenuOpen(true));
  backdrop.addEventListener("click", () => setMenuOpen(false));
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

  // Recalcular distribución (ancho y solapamiento) cuando cambia el tamaño real del calendario
  if (window.ResizeObserver) {
    const calendarEl = document.getElementById("calendar");
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
});
