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

function parseColorToRgb(color) {
    if (!color || typeof color !== "string") return null;
    const raw = color.trim();
    if (raw.startsWith("#")) {
        const hex = raw.slice(1);
        if (hex.length === 3) {
            const r = parseInt(hex[0] + hex[0], 16);
            const g = parseInt(hex[1] + hex[1], 16);
            const b = parseInt(hex[2] + hex[2], 16);
            return { r, g, b };
        }
        if (hex.length === 6) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            return { r, g, b };
        }
        return null;
    }
    const match = raw.match(/rgba?\(([^)]+)\)/i);
    if (!match) return null;
    const parts = match[1].split(",").map((p) => Number.parseFloat(p.trim()));
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
    return {
        r: clamp(Math.round(parts[0]), 0, 255),
        g: clamp(Math.round(parts[1]), 0, 255),
        b: clamp(Math.round(parts[2]), 0, 255),
    };
}

function getRelativeLuminance({ r, g, b }) {
    const toLinear = (v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const rLin = toLinear(r);
    const gLin = toLinear(g);
    const bLin = toLinear(b);
    return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

function getReadableTextColor(bgColor, lightColor = "#f8fafc", darkColor = "#0f172a") {
    const bg = parseColorToRgb(bgColor);
    const light = parseColorToRgb(lightColor);
    const dark = parseColorToRgb(darkColor);
    if (!bg || !light || !dark) return darkColor;
    const bgL = getRelativeLuminance(bg);
    const lightL = getRelativeLuminance(light);
    const darkL = getRelativeLuminance(dark);
    const contrastLight = (Math.max(bgL, lightL) + 0.05) / (Math.min(bgL, lightL) + 0.05);
    const contrastDark = (Math.max(bgL, darkL) + 0.05) / (Math.min(bgL, darkL) + 0.05);
    return contrastLight >= contrastDark ? lightColor : darkColor;
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
