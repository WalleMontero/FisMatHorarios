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
    if (!calendar) return fallback;
    const raw = getComputedStyle(calendar).getPropertyValue(name).trim();
    const n = parseInt(raw.replace("px", ""), 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
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
