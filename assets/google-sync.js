let tokenClient;
let gapiInited = false;
let gisInited = false;

// Funciones globales para carga de scripts
window.gapiLoaded = function () {
    gapi.load("client", async () => {
        await gapi.client.init({
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
        });
        gapiInited = true;
        checkBeforeStart();
    });
};

window.gisLoaded = function () {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: "", // definido al momento de pedir el token
    });
    gisInited = true;
    checkBeforeStart();
};

function checkBeforeStart() {
    if (gapiInited && gisInited) {
        console.log("Google API Ready");
    }
}

async function handleSyncClick(subjectsData) {
    const selectedKeys = loadSelectedSections();
    if (!selectedKeys.length) {
        alert("No has seleccionado ninguna materia.");
        return;
    }

    const modal = document.getElementById("syncModal");
    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");

    if (!modal || !startInput || !endInput) return;

    const today = new Date();
    startInput.value = today.toISOString().split("T")[0];
    const fourMonths = new Date();
    fourMonths.setMonth(today.getMonth() + 4);
    endInput.value = fourMonths.toISOString().split("T")[0];

    modal.hidden = false;

    const confirmBtn = document.getElementById("confirmSync");
    const cancelBtn = document.getElementById("cancelSync");
    const closeBtn = document.getElementById("closeSyncModal");

    const cleanup = () => {
        modal.hidden = true;
        if (confirmBtn) confirmBtn.onclick = null;
        if (cancelBtn) cancelBtn.onclick = null;
        if (closeBtn) closeBtn.onclick = null;
    };

    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            const startVal = startInput.value;
            const endVal = endInput.value;
            if (!startVal || !endVal) {
                alert("Selecciona ambas fechas.");
                return;
            }
            cleanup();
            await startSyncProcess(subjectsData, startVal, endVal);
        };
    }

    if (cancelBtn) cancelBtn.onclick = cleanup;
    if (closeBtn) closeBtn.onclick = cleanup;
}

async function startSyncProcess(subjectsData, startDateStr, endDateStr) {
    const selectedKeys = loadSelectedSections();
    const syncBtn = document.getElementById("syncGoogle");
    if (!syncBtn) return;

    const originalText = syncBtn.innerHTML;
    syncBtn.disabled = true;
    syncBtn.innerHTML = "Sincronizando...";

    try {
        const tokenResponse = await new Promise((resolve, reject) => {
            tokenClient.callback = (resp) => {
                if (resp.error) reject(resp);
                else resolve(resp);
            };
            tokenClient.requestAccessToken({ prompt: "consent" });
        });

        if (!tokenResponse.access_token) {
            syncBtn.disabled = false;
            syncBtn.innerHTML = originalText;
            return;
        }

        const startDate = new Date(startDateStr + "T00:00:00");
        const endDate = new Date(endDateStr + "T23:59:59");
        let totalEvents = 0;

        for (const key of selectedKeys) {
            const [subjectName, sectionId] = key.split("|");
            const subject = subjectsData[subjectName];
            const section = subject?.Secciones?.[sectionId];
            if (!section) continue;

            const entries = generateGCalEntriesForAPI(subjectName, sectionId, section, startDate, endDate);
            for (const entry of entries) {
                await gapi.client.calendar.events.insert({
                    calendarId: "primary",
                    resource: entry,
                });
                totalEvents++;
            }
        }

        alert(`¡Éxito! Se han añadido ${totalEvents} bloques de horario.`);
    } catch (err) {
        console.error(err);
        alert("Error al sincronizar. Revisa la consola.");
    } finally {
        syncBtn.disabled = false;
        syncBtn.innerHTML = originalText;
    }
}

function generateGCalEntriesForAPI(subjectName, sectionId, section, rangeStart, rangeEnd) {
    const dayMap = { "Lunes": "MO", "Martes": "TU", "Miércoles": "WE", "Jueves": "TH", "Viernes": "FR", "Sábado": "SA", "Domingo": "SU" };
    const daysOrdered = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    const meetings = sectionToMeetings(section);
    const groups = new Map();
    for (const m of meetings) {
        const key = `${m.startMin}-${m.endMin}-${m.salon}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(m);
    }

    const events = [];
    const formatUntil = (date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    for (const groupMeetings of groups.values()) {
        const meetingDayIndices = groupMeetings.map(m => daysOrdered.indexOf(m.day));
        let firstEventDate = null;
        let prototypeMeeting = null;

        for (let i = 0; i < 7; i++) {
            const checkDate = new Date(rangeStart);
            checkDate.setDate(rangeStart.getDate() + i);
            const dayIdx = checkDate.getDay();
            if (meetingDayIndices.includes(dayIdx)) {
                firstEventDate = checkDate;
                prototypeMeeting = groupMeetings.find(m => daysOrdered.indexOf(m.day) === dayIdx);
                break;
            }
        }
        if (!firstEventDate) continue;

        const getISO = (date, min) => {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            d.setMinutes(min);
            return d.toISOString();
        };

        const byDays = groupMeetings.map(mtg => dayMap[mtg.day]).join(",");
        const untilStr = formatUntil(rangeEnd);

        events.push({
            summary: `${subjectName} (S${sectionId})`,
            location: prototypeMeeting.salon || "Sin asignar",
            description: `Profesor: ${section.Profesor || "N/A"}\nGenerado por FisMat Horarios FastWeb`,
            start: { dateTime: getISO(firstEventDate, prototypeMeeting.startMin), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
            end: { dateTime: getISO(firstEventDate, prototypeMeeting.endMin), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
            recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${byDays};UNTIL=${untilStr}`],
        });
    }
    return events;
}
