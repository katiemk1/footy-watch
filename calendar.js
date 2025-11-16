// calendar.js
export let calCurrentMonth = new Date();  

let calendarGrid, calMonthLabel;
let clubs = [], events = [], updateEventsByDateFn;

export function initCalendar(gridEl, monthLabelEl, updateEventsByDateCallback) {
  calendarGrid = gridEl;
  calMonthLabel = monthLabelEl;
  updateEventsByDateFn = updateEventsByDateCallback;
  renderCalendar();
}

export function setClubsAndEvents(clubsData, eventsData) {
  clubs = clubsData;
  events = eventsData.map(ev => ({ ...ev, Date: normalizeDate(ev.Date) }));
}

export function renderCalendar() {
  if (!calendarGrid || !calMonthLabel) return;

  calendarGrid.innerHTML = "";
  const y = calCurrentMonth.getFullYear();
  const m = calCurrentMonth.getMonth();

  calMonthLabel.textContent = calCurrentMonth.toLocaleString("default", { month:"long", year:"numeric" });

  const first = new Date(y, m, 1);
  const startDay = first.getDay();
  const lastDate = new Date(y, m+1, 0).getDate();

  const eventDates = getAllEventDates();

  // pad empty days
  for (let i=0; i<startDay; i++){
    const pad = document.createElement("div");
    pad.className = "calendarDay disabled";
    calendarGrid.appendChild(pad);
  }

  for (let d=1; d<=lastDate; d++){
    const iso = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const cell = document.createElement("div");
    cell.className = "calendarDay";
    cell.textContent = d;

    if (iso === new Date().toISOString().slice(0,10)) cell.classList.add("today");
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
  const future = getAllEventDates().filter(d => d >= new Date().toISOString().slice(0,10));
  if (future.length) {
    const nextDate = new Date(future[0]);
    calCurrentMonth = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
    renderCalendar();
    if (updateEventsByDateFn) updateEventsByDateFn(nextDate);
  }
}

function getAllEventDates() {
  const dates = new Set();

  clubs.forEach(club => {
    (club.games || []).forEach(ev => dates.add(normalizeDate(ev.date)));
    (club.practices || []).forEach(ev => dates.add(normalizeDate(ev.date)));
  });

  events.forEach(ev => {
    if (ev.Date) dates.add(normalizeDate(ev.Date));
  });

  return Array.from(dates);
}

function normalizeDate(input) {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d)) return input; 
  return d.toISOString().slice(0,10);
}
