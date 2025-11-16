// calendar.js
export let calendarDateObj = new Date();
let selectedDate = null;
let onDayClickCallback = null;  // optional callback for main.js

const calendarContainer = document.getElementById("calendarContainer");
const calendarGrid = document.getElementById("calendarGrid");
const monthLabel = document.getElementById("monthLabel");

export function renderCalendar() {
    if (!calendarGrid) return;
    calendarGrid.innerHTML = "";
    const year = calendarDateObj.getFullYear();
    const month = calendarDateObj.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    monthLabel.textContent = calendarDateObj.toLocaleString("default", { month: "long", year: "numeric" });

    // Previous month blanks
    for (let i = 0; i < firstDay; i++) {
        const cell = document.createElement("div");
        cell.className = "calendar-day disabled";
        calendarGrid.appendChild(cell);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement("div");
        cell.className = "calendar-day";
        cell.textContent = d;

        const cellDate = new Date(year, month, d);
        if (selectedDate && cellDate.toDateString() === selectedDate.toDateString()) {
            cell.classList.add("selected");
        }

        cell.addEventListener("click", () => {
            selectedDate = cellDate;
            renderCalendar();
            if (onDayClickCallback) onDayClickCallback(selectedDate);
        });

        calendarGrid.appendChild(cell);
    }
}

export function renderCalendarFor(dateObj) {
    calendarDateObj = dateObj;
    renderCalendar();
}

export function updateCalendarVisibility() {
    if (!calendarContainer) return;
    calendarContainer.style.display = document.getElementById("eventsContent")?.hidden ? "none" : "block";
}

export function setDayClickCallback(cb) {
    onDayClickCallback = cb;
}
