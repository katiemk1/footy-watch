// calendar.js
export let calCurrentMonth = new Date();
let calendarGrid, calMonthLabel;
let clubs = [], events = [];
let updateEventsByDateFn;

export function initCalendar(gridEl, monthLabelEl, updateFn) {
  calendarGrid = gridEl;
  calMonthLabel = monthLabelEl;
  updateEventsByDateFn = updateFn;
  renderCalendar();
}

export function setClubsAndEvents(clubsData, eventsData) {
  clubs = clubsData;
  events = eventsData;
}

export function renderCalendar() {
  if (!calendarGrid || !calMonthLabel) return;

  calendarGrid.innerHTML = "";
  const year = calCurrentMonth.getFullYear();
  const month = calCurrentMonth.getMonth();

  calMonthLabel.textContent = calCurrentMonth.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();

  const eventDates = getAllEventDates();

  // Add padding for empty days
  for (let i = 0; i < firstDay; i++) {
    const pad = document.createElement("div");
    pad.className = "calendarDay disabled";
    calendarGrid.appendChild(pad);
  }

  for (let d = 1; d <= lastDate; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const cell = document.createElement("div");
    cell.className = "calendarDay";
    cell.textContent = d;

    if (iso === new Date().toISOString().slice(0, 10)) cell.classList.add("today");
    if (eventDates.includes(iso)) cell.classList.add("event");

    cell.onclick = () => {
      if (updateEventsByDateFn) updateEventsByDateFn(new Date(iso));
    };

    calendarGrid.appendChild(cell);
  }
}

export function prevMonth() {
  calCurrentMonth.setMonth(calCurrentMonth.getMonth() - 1);
  renderCalendar();
}

export function nextMonth() {
  calCurrentMonth.setMonth(calCurrentMonth.getMonth() + 1);
  renderCalendar();
}

export function jumpToNextEvent() {
  const todayISO = new Date().toISOString().slice(0, 10);
  const futureDates = getAllEventDates().filter(d => d >= todayISO);
  if (!futureDates.length) return;

  const nextDate = new Date(futureDates[0]);
  calCurrentMonth = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
  renderCalendar();
  if (updateEventsByDateFn) updateEventsByDateFn(nextDate);
}

function getAllEventDates() {
  const dates = new Set();
  clubs.forEach(club => {
    (club.games || []).forEach(ev => ev.date && dates.add(ev.date));
    (club.practices || []).forEach(ev => ev.date && dates.add(ev.date));
  });
  events.forEach(ev => {
    if ((ev.Club || "").trim().toLowerCase() === "usafl" && ev.Date) dates.add(ev.Date);
  });
  return Array.from(dates).sort();
}
