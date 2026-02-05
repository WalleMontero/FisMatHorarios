function setSelectedCount(count) {
    const el = document.getElementById("selectedCount");
    if (el) el.textContent = String(count);
}

function renderCalendarGrid() {
    const calendar = document.getElementById("calendar");
    if (!calendar) return;
    const emptyEl = document.getElementById("calendarEmpty");
    if (emptyEl) emptyEl.hidden = true;
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

    // Etiquetas de hora
    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
        const timeDiv = document.createElement("div");
        timeDiv.classList.add("time-label");
        timeDiv.textContent = String(hour).padStart(2, "0");
        const rowStart = (hour - START_HOUR) * (60 / SLOT_MINUTES) + 2;
        timeDiv.style.gridRow = `${rowStart} / span ${60 / SLOT_MINUTES}`;
        timeDiv.style.gridColumn = "1";
        calendar.appendChild(timeDiv);
    }

    // Celdas de fondo
    for (let row = 2; row < 2 + totalSlots; row++) {
        for (let dayIndex = 0; dayIndex < DAYS.length; dayIndex++) {
            const cell = document.createElement("div");
            cell.classList.add("slot-cell");
            cell.style.gridRow = String(row);
            cell.style.gridColumn = String(dayIndex + 2);
            calendar.appendChild(cell);
        }
    }

    // Lanes por día
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

function buildSubjectMenu(subjectsData) {
    const subjectList = document.getElementById("subjectList");
    if (!subjectList) return;

    const searcher = document.getElementById("searcher");
    const query = searcher ? searcher.value : "";
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

        const currentColor = getSectionColor(item.key, item.subjectName);
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.classList.add("color-input");
        colorInput.value = currentColor;
        colorInput.setAttribute("title", "Cambiar color");

        colorInput.addEventListener("change", (e) => {
            const color = e.target.value;
            setSectionColor(item.key, color);
            renderSelectedSections(subjectsData, selectedKeys);
        });

        row.appendChild(cb);
        row.appendChild(label);
        row.appendChild(colorInput);
        container.appendChild(row);
    }
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
        li.innerHTML = `<b>${m.day}</b>, de ${startHH} a ${endHH}${m.salon ? ` en: <b>${m.salon}</b>` : ""}`;
        activitiesList.appendChild(li);
    }

    modalContent.appendChild(closeButton);
    modalContent.appendChild(infoList);
    modalContent.appendChild(sectionTitle);
    modalContent.appendChild(activitiesTitle);
    modalContent.appendChild(activitiesList);
    modalOverlay.appendChild(modalContent);

    const calendar = document.getElementById("calendar");
    if (calendar) calendar.appendChild(modalOverlay);

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

    for (const day of DAYS) {
        const lane = DAY_LANES.get(day);
        if (!lane) continue;
        lane.innerHTML = "";
        const items = byDay.get(day) || [];
        if (!items.length) continue;

        items.sort((a, b) => a.startSlots - b.startSlots || a.endSlots - b.endSlots);

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
