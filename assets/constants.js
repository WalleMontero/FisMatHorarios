const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const DAY_COLORS = ["#5DA157", "#00AEB5", "#F05254", "#F18422", "#EDCF1F"];

const START_HOUR = 8;
const END_HOUR = 21;
const SLOT_MINUTES = 30; // 30 min por fila

const STORAGE_KEY = "fastweb_selected_sections_v1";
const COLOR_KEY = "fastweb_section_colors_v1";
const OVERRIDE_KEY = "fastweb_schedule_overrides_v1";

// Configuración de Google Calendar API
const CLIENT_ID = "387315380682-frt987vv2h0maire8gtrlagoru3o8lj5.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/calendar.events";
