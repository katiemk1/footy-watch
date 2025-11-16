// calendar.js
// -----------------------------------
// Module for custom calendar
// -----------------------------------

import { parseDateIso, toIsoDate } from './utils.js'; // optional if you want to keep utils separate

// DOM
const calendarContainer = document.getElementById("calendarContainer");
const calendarGrid = document.getElementById("calendarGrid");
const calMonthLabel = document.getElementById("calMonthLabel");
const calPrevBtn = document.getElementById("calPrev");
const calNextBtn = document.getElementById("calNext");
const calNextEventBtn = document.getElementById("calNextEventBtn");

// Module state
let calCurrentMonth = new Date();
let eventType = "all";

// External state references from main.js (to be set after import)
export let clubsRef = [];
export let eventsRef = [];
export let updateEventsByDate = null;
export let modeRef = null;

// -----------------------------------
// Utilities
function getAllEventDates(){
    const dates = new Set();
    clubsRef.forEach(c=>{
        (c.games||[]).forEach(ev=>dates.add(ev.date));
        (c.practices||[]).forEach(ev=>dates.add(ev.date));
    });
    eventsRef.forEach(ev=>{
        if((ev.Club||"").trim().toLowerCase()==="usafl" && ev.Date) dates.add(ev.Date);
    });
    return Array.from(dates);
}

// -----------------------------------
// Calendar rendering
export function renderCalendar(){
    if(!calendarGrid) return;

    calendarGrid.innerHTML="";
    const y=calCurrentMonth.getFullYear();
    const m=calCurrentMonth.getMonth();
    calMonthLabel.textContent=calCurrentMonth.toLocaleString("default",{month:"long",year:"numeric"});

    const first=new Date(y,m,1);
    const startDay=first.getDay();
    const lastDate=new Date(y,m+1,0).getDate();

    const eventDates=getAllEventDates();

    // pad empty days
    for(let i=0;i<startDay;i++){
        const pad=document.createElement("div");
        calendarGrid.appendChild(pad);
    }

    // render days
    for(let d=1; d<=lastDate; d++){
        const iso=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        const cell=document.createElement("div");
        cell.className="calendarDay";
        cell.textContent=d;

        if(iso===new Date().toISOString().slice(0,10)) cell.classList.add("today");
        if(eventDates.includes(iso)) cell.classList.add("event");

        cell.onclick=()=>{
            if(modeRef && modeRef.value==="events" && updateEventsByDate){
                updateEventsByDate(parseDateIso(iso));
            }
        };
        calendarGrid.appendChild(cell);
    }

    calendarContainer.style.display = "block";
}

// -----------------------------------
// Month navigation
calPrevBtn.onclick = () => { calCurrentMonth.setMonth(calCurrentMonth.getMonth()-1); renderCalendar(); };
calNextBtn.onclick = () => { calCurrentMonth.setMonth(calCurrentMonth.getMonth()+1); renderCalendar(); };

// -----------------------------------
// Next event button
calNextEventBtn.onclick = () => {
    const todayIso = new Date().toISOString().slice(0,10);
    const future = getAllEventDates().filter(d => d >= todayIso).sort();
    if(future.length){
        const nextIso = future[0];
        const dt = parseDateIso(nextIso);
        calCurrentMonth = new Date(dt.getFullYear(), dt.getMonth(), 1);
        renderCalendar();
        if(modeRef && modeRef.value==="events" && updateEventsByDate){
            updateEventsByDate(dt);
        }
    }
};

// -----------------------------------
// Event type filter
export function setEventType(type){
    eventType=type;
    renderCalendar();
}

export function clearMarkers(){
    calendarContainer.style.display = "none";
}
