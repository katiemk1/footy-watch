// main.js
import { initCalendar, prevMonth, nextMonth, jumpToNextEvent, setClubsAndEvents } from './calendar.js';

// DOM
const calendarGrid = document.getElementById("calendarGrid");
const calMonthLabel = document.getElementById("calMonthLabel");
const clubsToggle = document.getElementById("clubsToggle");
const clubsContent = document.getElementById("clubsContent");
const eventsToggle = document.getElementById("eventsToggle");
const eventsContent = document.getElementById("eventsContent");
const clubListEl = document.getElementById("clubList");
const tickerText = document.getElementById("tickerText");
const clubsCount = document.getElementById("clubsCount");

let map, clubs = [], events = [];
let lastClickedMarker = null;
let mode = "clubs";
let eventType = "all";
let markers = [];
let tempEventMarkers = [];

// Initialize map
map = L.map("map").setView([39.5, -85], 4);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// Calendar
initCalendar(calendarGrid, calMonthLabel, updateEventsByDate);

// CSV fetch helper
async function fetchCsv(url) {
  const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
  if (!r.ok) throw new Error("Fetch failed: " + r.status);
  const text = await r.text();
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
}

// Load clubs
async function loadClubs() {
  clubListEl.textContent = "Loading clubs…";
  try {
    const data = await fetchCsv("https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2pBQSzKGgCOYPtXyCnC-WOkn-N_6rzjgXPJg3icI-OtgESyHp2WDAPgtYXj_4F0NDNhTfT-zi82cx/pub?output=csv");
    clubs = [];
    markers.forEach(m => map.removeLayer(m.marker));
    markers = [];
    clubListEl.innerHTML = "";

    for (const row of data) {
      const lat = parseFloat(row.Latitude);
      const lon = parseFloat(row.Longitude);
      if (!lat || !lon) continue;
      const club = {
        name: row.Name || row.Club,
        lat, lon,
        logo: row.Logo || "https://upload.wikimedia.org/wikipedia/en/e/ec/USAFL_logo.png",
        instagram: row.InstagramHandle || "",
        games: [], practices: []
      };
      clubs.push(club);

      const marker = L.marker([lat, lon]).addTo(map);
      marker.bindPopup(`<strong>${club.name}</strong>`);
      markers.push({ club, marker });

      const li = document.createElement("div");
      li.className = "club-item";
      li.innerHTML = `<img src="${club.logo}" alt="${club.name}"><div>${club.name}</div>`;
      li.onclick = () => {
        map.flyTo([club.lat, club.lon], 6);
        marker.openPopup();
      };
      clubListEl.appendChild(li);
    }
    clubsCount.textContent = clubs.length;
    setClubsAndEvents(clubs, events);
  } catch(e) {
    console.error(e);
    clubListEl.textContent = "Error loading clubs";
  }
}

// Load events
async function loadEvents() {
  try {
    const data = await fetchCsv("https://docs.google.com/spreadsheets/d/e/2PACX-1vQ23xarhIttcDfoXomCljmxYJo59Fb6Xqbw3wcFcj-gkLena0UTY1-BR5keuQx71h_zLrKsy_cV8aFg/pub?output=csv");
    events = data.map(ev => ({
      ...ev,
      Date: normalizeDate(ev.Date)
    }));
    setClubsAndEvents(clubs, events);
  } catch(e) {
    console.error(e);
  }
}

// Calendar buttons
document.getElementById("calPrev").onclick = prevMonth;
document.getElementById("calNext").onclick = nextMonth;
document.getElementById("calNextEventBtn").onclick = jumpToNextEvent;

// Sidebar toggles
clubsToggle.onclick = () => {
  clubsContent.hidden = !clubsContent.hidden;
  if (clubsContent.hidden) mode = "events";
};
eventsToggle.onclick = () => {
  const opening = eventsContent.hidden;
  if (opening) clubsContent.hidden = true;
  eventsContent.hidden = !eventsContent.hidden;
  mode = eventsContent.hidden ? "clubs" : "events";
};

// Filters
document.getElementById("gamesBtn").onclick = () => { eventType="games"; };
document.getElementById("practicesBtn").onclick = () => { eventType="practices"; };
document.getElementById("allBtn").onclick = () => { eventType="all"; };

// Update events for selected date
function updateEventsByDate(date) {
  tempEventMarkers.forEach(m => map.removeLayer(m));
  tempEventMarkers = [];

  const iso = date.toISOString().slice(0,10);
  clubs.forEach(c => {
    let show = false;
    (c.games||[]).forEach(ev => { if (normalizeDate(ev.date) === iso) show = true; });
    (c.practices||[]).forEach(ev => { if (normalizeDate(ev.date) === iso) show = true; });
    if (show) {
      const marker = L.marker([c.lat, c.lon]).addTo(map);
      tempEventMarkers.push(marker);
    }
  });
}

function normalizeDate(input) {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d)) return input; 
  return d.toISOString().slice(0,10);
}

// Initialize everything
(async function init() {
  await loadClubs();
  await loadEvents();
})();
