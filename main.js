// main.js
import { initCalendar, prevMonth, nextMonth, jumpToNextEvent, setClubsAndEvents } from "./calendar.js";

// DOM elements
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
let markers = [];
let tempEventMarkers = [];
let mode = "clubs";
let eventType = "all";

// Initialize map
map = L.map("map").setView([39.5, -85], 4);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// Initialize calendar
initCalendar(calendarGrid, calMonthLabel, updateEventsByDate);

// Fetch CSV helper
async function fetchCsv(url) {
  const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
  if (!response.ok) throw new Error("CSV fetch failed: " + response.status);
  const text = await response.text();
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
}

// Load clubs from Google Sheets CSV
async function loadClubs() {
  clubListEl.textContent = "Loading clubs…";
  try {
    const data = await fetchCsv(
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2pBQSzKGgCOYPtXyCnC-WOkn-N_6rzjgXPJg3icI-OtgESyHp2WDAPgtYXj_4F0NDNhTfT-zi82cx/pub?output=csv"
    );
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
        lat,
        lon,
        logo: row.Logo || "https://aussierulesusa.com/wp-content/uploads/2024/05/placeholder.png",
        games: row.Games ? JSON.parse(row.Games) : [],
        practices: row.Practices ? JSON.parse(row.Practices) : [],
        instagram: row.InstagramHandle || "",
      };
      clubs.push(club);

      const marker = L.marker([lat, lon]).addTo(map);
      marker.bindPopup(`<b>${club.name}</b>`);
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
  } catch (e) {
    console.error(e);
    clubListEl.textContent = "Error loading clubs";
  }
}

// Load events from Google Sheets CSV
async function loadEvents() {
  try {
    const data = await fetchCsv(
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ23xarhIttcDfoXomCljmxYJo59Fb6Xqbw3wcFcj-gkLena0UTY1-BR5keuQx71h_zLrKsy_cV8aFg/pub?output=csv"
    );
    events = data;
    setClubsAndEvents(clubs, events);
  } catch (e) {
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
  if (!clubsContent.hidden) eventsContent.hidden = true;
};

eventsToggle.onclick = () => {
  eventsContent.hidden = !eventsContent.hidden;
  if (!eventsContent.hidden) {
    clubsContent.hidden = true;
    document.getElementById("calendarContainer").style.display = "block";
  } else {
    document.getElementById("calendarContainer").style.display = "none";
  }
};

// Event type filters
document.getElementById("gamesBtn").onclick = () => setEventType("games");
document.getElementById("practicesBtn").onclick = () => setEventType("practices");
document.getElementById("allBtn").onclick = () => setEventType("all");

function setEventType(type) {
  eventType = type;
  document.getElementById("gamesBtn").classList.toggle("active", type === "games");
  document.getElementById("practicesBtn").classList.toggle("active", type === "practices");
  document.getElementById("allBtn").classList.toggle("active", type === "all");
  updateEventsByDate(new Date());
}

// Update events markers for selected date
function updateEventsByDate(date) {
  markers.forEach(m => map.removeLayer(m.marker));
  tempEventMarkers.forEach(m => map.removeLayer(m));
  tempEventMarkers = [];

  const iso = date.toISOString().slice(0, 10);

  clubs.forEach(c => {
    let show = false;
    (c.games || []).forEach(ev => { if (ev.date === iso) show = true; });
    (c.practices || []).forEach(ev => { if (ev.date === iso) show = true; });
    if (show) {
      const marker = L.marker([c.lat, c.lon]).addTo(map);
      tempEventMarkers.push(marker);
    }
  });
}

// Initialize
(async function init() {
  await loadClubs();
  await loadEvents();
})();
