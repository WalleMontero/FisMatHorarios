const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const DAY_COLORS = ["#5DA157", "#00AEB5", "#F05254", "#F18422", "#EDCF1F"];

const START_HOUR = 8;
const END_HOUR = 21;
const SLOT_MINUTES = 30; // 30 min por fila

const STORAGE_KEY = "fastweb_selected_sections_v1";

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

function setSelectedCount(n) {
  const el = document.getElementById("selectedCount");
  el.textContent = `${n} sección${n === 1 ? "" : "es"} seleccionada${n === 1 ? "" : "s"}`;
}

function renderCalendarGrid() {
  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";

  // Headers de días: cada día ocupa 2 columnas
  DAYS.forEach((dia, index) => {
    const header = document.createElement("div");
    const contenido = document.createElement("div");
    contenido.style.backgroundColor = DAY_COLORS[index];
    contenido.classList.add("content");
    header.classList.add("day-header");
    contenido.textContent = dia;
    header.style.gridRow = "1";
    header.style.gridColumn = `${index * 2 + 2} / span 2`;
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
      cell.style.gridColumn = `${dayIndex * 2 + 2} / span 2`;
      calendar.appendChild(cell);
    }
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
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    subjectName,
    subject?.Clave,
    subject?.Area,
    String(subject?.Semestre ?? ""),
  ]
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();
  return hay.includes(q);
}

function buildSubjectMenu(subjectsData) {
  const subjectList = document.getElementById("subjectList");
  const query = document.getElementById("searcher").value;
  const selected = new Set(loadSelectedSections());

  subjectList.innerHTML = "";

  const subjectNames = Object.keys(subjectsData).sort((a, b) => a.localeCompare(b));
  for (const subjectName of subjectNames) {
    const subject = subjectsData[subjectName];
    if (!subjectMatchesQuery(subjectName, subject, query)) continue;
    const sections = subject?.Secciones ? Object.keys(subject.Secciones) : [];
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
        renderSelectedSections(subjectsData, Array.from(next));
      });

      const meta = [];
      if (subject?.Clave) meta.push(subject.Clave);
      if (subject?.Area) meta.push(subject.Area);
      if (subject?.Semestre != null) meta.push(`S${subject.Semestre}`);

      label.appendChild(cb);
      label.appendChild(
        document.createTextNode(` ${subjectName} · S${secId} (${meta.join(" · ")})`),
      );
      subjectList.appendChild(label);
    }
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

function recalculateDayEvents(day) {
  const dayIndex = DAYS.indexOf(day);
  if (dayIndex < 0) return;
  const baseColumn = 2 + dayIndex * 2;

  const eventEls = Array.from(document.querySelectorAll(`.event[data-day="${day}"]`));
  const events = eventEls
    .map((el) => ({
      el,
      startMin: parseInt(el.getAttribute("data-start-min"), 10),
      endMin: parseInt(el.getAttribute("data-end-min"), 10),
    }))
    .sort((a, b) => a.startMin - b.startMin);

  let groups = [];
  let currentGroup = [];
  let currentGroupEnd = 0;
  for (const ev of events) {
    if (currentGroup.length === 0) {
      currentGroup.push(ev);
      currentGroupEnd = ev.endMin;
      continue;
    }
    if (ev.startMin < currentGroupEnd) {
      currentGroup.push(ev);
      currentGroupEnd = Math.max(currentGroupEnd, ev.endMin);
    } else {
      groups.push(currentGroup);
      currentGroup = [ev];
      currentGroupEnd = ev.endMin;
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  groups.forEach((group) => {
    if (group.length === 1) {
      group[0].el.style.gridColumnStart = String(baseColumn);
      group[0].el.style.gridColumnEnd = String(baseColumn + 2);
    } else if (group.length === 2) {
      group[0].el.style.gridColumnStart = String(baseColumn);
      group[0].el.style.gridColumnEnd = String(baseColumn + 1);
      group[1].el.style.gridColumnStart = String(baseColumn + 1);
      group[1].el.style.gridColumnEnd = String(baseColumn + 2);
    } else {
      group.forEach((item) => {
        item.el.style.gridColumnStart = String(baseColumn);
        item.el.style.gridColumnEnd = String(baseColumn + 2);
      });
    }
  });
}

function showSubjectModal(subjectsData, subjectName, sectionId) {
  const subject = subjectsData[subjectName];
  const section = subject?.Secciones?.[sectionId];
  if (!subject || !section) return;

  const modalOverlay = document.createElement("div");
  modalOverlay.id = "modalOverlay";
  modalOverlay.classList.add("modal-overlay");

  const modalContent = document.createElement("div");
  modalContent.id = "modalContent";
  modalContent.classList.add("modal-content");
  modalContent.style.backgroundColor = stableColorFromString(subjectName);

  const closeButton = document.createElement("span");
  closeButton.textContent = "X";
  closeButton.classList.add("close-button");
  closeButton.addEventListener("click", closeModal);

  const title = document.createElement("h2");
  title.textContent = subjectName;

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
    li.innerHTML = `<b>${m.day}</b>, de ${startHH} a ${endHH}${m.salon ? ` en ${m.salon}` : ""}`;
    activitiesList.appendChild(li);
  }

  modalContent.appendChild(closeButton);
  modalContent.appendChild(title);
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

  const calendar = document.getElementById("calendar");
  const affectedDays = new Set();

  for (const key of selectedKeys) {
    const [subjectName, sectionId] = key.split("|");
    const subject = subjectsData[subjectName];
    const section = subject?.Secciones?.[sectionId];
    if (!section) continue;

    const meetings = sectionToMeetings(section);
    for (const m of meetings) {
      const dayIndex = DAYS.indexOf(m.day);
      if (dayIndex < 0) continue;
      affectedDays.add(m.day);

      const baseColumn = 2 + dayIndex * 2;
      const dayStartMin = START_HOUR * 60;

      const rowStart = Math.floor((m.startMin - dayStartMin) / SLOT_MINUTES) + 2;
      const rowEnd = Math.ceil((m.endMin - dayStartMin) / SLOT_MINUTES) + 2;

      const eventEl = document.createElement("div");
      eventEl.classList.add("event");
      eventEl.style.backgroundColor = stableColorFromString(subjectName);
      eventEl.innerHTML = `<p>${subjectName} · S${sectionId}</p><p>${m.salon || ""}</p>`;
      eventEl.setAttribute("data-day", m.day);
      eventEl.setAttribute("data-start-min", String(m.startMin));
      eventEl.setAttribute("data-end-min", String(m.endMin));
      eventEl.style.gridColumnStart = String(baseColumn);
      eventEl.style.gridColumnEnd = String(baseColumn + 2);
      eventEl.style.gridRowStart = String(rowStart);
      eventEl.style.gridRowEnd = String(rowEnd);

      eventEl.addEventListener("click", (e) => {
        e.stopPropagation();
        showSubjectModal(subjectsData, subjectName, sectionId);
      });

      calendar.appendChild(eventEl);
    }
  }

  affectedDays.forEach((d) => recalculateDayEvents(d));
}

document.addEventListener("DOMContentLoaded", async () => {
  renderCalendarGrid();

  let subjectsData;
  try {
    subjectsData = await loadMergedData();
  } catch (err) {
    console.error(err);
    alert(String(err));
    return;
  }

  const selected = loadSelectedSections();
  setSelectedCount(selected.length);
  buildSubjectMenu(subjectsData);
  renderSelectedSections(subjectsData, selected);

  document.getElementById("searcher").addEventListener("input", () => buildSubjectMenu(subjectsData));

  // Abrir/cerrar menú (móvil)
  document.getElementById("menuToggle").addEventListener("click", () => {
    document.getElementById("subjectMenu").classList.toggle("active");
  });
  document.getElementById("closeMenu").addEventListener("click", () => {
    document.getElementById("subjectMenu").classList.remove("active");
  });
  document.addEventListener("click", (event) => {
    const subjectMenu = document.getElementById("subjectMenu");
    const toggle = document.getElementById("menuToggle");
    if (!subjectMenu.contains(event.target) && !toggle.contains(event.target)) subjectMenu.classList.remove("active");
  });

  document.getElementById("clearBtn").addEventListener("click", () => {
    saveSelectedSections([]);
    setSelectedCount(0);
    buildSubjectMenu(subjectsData);
    clearRenderedEvents();
  });
});
