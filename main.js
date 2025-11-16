// main.js
// -----------------------------------
// Imports
import L from 'https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.esm.js';
import * as Calendar from './calendar.js';

// -----------------------------------
// Config
const CLUB_SHEET_URL  = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2pBQSzKGgCOYPtXyCnC-WOkn-N_6rzjgXPJg3icI-OtgESyHp2WDAPgtYXj_4F0NDNhTfT-zi82cx/pub?output=csv";
const EVENTS_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ23xarhIttcDfoXomCljmxYJo59Fb6Xqbw3wcFcj-gkLena0UTY1-BR5keuQx71h_zLrKsy_cV8aFg/pub?output=csv";
const PROXY = "https://api.allorigins.win/raw?url=";
const REFRESH_MS = 5 * 60 * 1000; // 5 min

// -----------------------------------
// State
let clubs = [];
let events = [];
let markers = [];
let lastClickedMarker = null;
let mode = "clubs";
let eventType = "all";

// DOM
const clubListEl = document.getElementById("clubList");
const clubsToggle = document.getElementById("clubsToggle");
const clubsContent = document.getElementById("clubsContent");
const eventsToggle = document.getElementById("eventsToggle");
const eventsContent = document.getElementById("eventsContent");
const gamesBtn = document.getElementById("gamesBtn");
const practicesBtn = document.getElementById("practicesBtn");
const allBtn = document.getElementById("allBtn");
const tickerText = document.getElementById("tickerText");
const clubsCount = document.getElementById("clubsCount");

// -----------------------------------
// Utilities
const parseDateIso = s => s ? new Date(s + "T00:00:00") : new Date(NaN);
const formatDate = d => d.toLocaleString("default", { month:"short", day:"numeric" });
const toIsoDate = d => d.toISOString().slice(0,10);

async function fetchCsv(url) {
    const res = await fetch(PROXY + encodeURIComponent(url));
    const text = await res.text();
    return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
}

// -----------------------------------
// Map
const map = L.map("map").setView([39.5, -85], 4);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// Icon generator
function makeLogoIcon(url, borderColor=null, opacity=1){
    const z = map.getZoom();
    const size = Math.max(28, Math.min(96, Math.round(30 + (z-3)*8)));
    const border = borderColor ? `border:3px solid ${borderColor};` : "border:2px solid rgba(255,255,255,0.95);";
    const html = `<div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;${opacity<1?`opacity:${opacity};`:``}">
        <img src="${url}" style="width:${size-6}px;height:${size-6}px;object-fit:cover;${border}border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,0.12);">
    </div>`;
    return L.divIcon({ html, className:"", iconSize:[size,size], iconAnchor:[size/2,size], popupAnchor:[0,-(size+8)] });
}

// -----------------------------------
// Load clubs
async function loadClubs(){
    clubListEl.textContent = "Loading clubs...";
    try {
        const data = await fetchCsv(CLUB_SHEET_URL);
        clubs = [];
        markers.forEach(m => map.removeLayer(m.marker));
        markers = [];
        clubListEl.innerHTML = "";

        data.forEach(row => {
            const name = (row.Name || row.Club || "").trim();
            if (!name || name.toLowerCase() === "usafl") return;

            const lat = parseFloat(row.Latitude);
            const lon = parseFloat(row.Longitude);
            if (isNaN(lat) || isNaN(lon)) return;

            let logo = (row.Logo || row["Logo URL"] || row.Image || "").trim();
            if (!logo.startsWith("http")) logo = "https://aussierulesusa.com/wp-content/uploads/2024/05/placeholder.png";

            const club = { name, lat, lon, logo, instagram: row.InstagramHandle?.trim()||"", games: [], practices: [] };
            clubs.push(club);

            const marker = L.marker([lat,lon], { icon: makeLogoIcon(logo) }).addTo(map);
            marker.on("click", () => {
                if(lastClickedMarker && lastClickedMarker!==marker) lastClickedMarker.closePopup();
                lastClickedMarker = marker;
                marker.openPopup();
                map.flyTo([lat,lon],6);
            });
            markers.push({ club, marker });

            const el = document.createElement("div");
            el.className = "club-item";
            el.innerHTML = `<img src="${club.logo}" alt="${club.name}"><div style="flex:1">${club.name}</div>`;
            el.onclick = () => { marker.fire("click"); };
            clubListEl.appendChild(el);
        });

        clubsCount.textContent = `${clubs.length}`;
        if (!clubs.length) clubListEl.textContent = "No clubs found.";
    } catch(e) {
        console.error(e);
        clubListEl.textContent = "Error loading clubs.";
    }
}

// -----------------------------------
// Load events
async function loadEvents(){
    try {
        events = await fetchCsv(EVENTS_SHEET_URL);
        clubs.forEach(c=>{c.games=[]; c.practices=[];});

        events.forEach(ev => {
            const clubName = (ev.Club || "").trim();
            const type = (ev.EventType||"").toLowerCase();
            const category = (ev.EventCategory||"club-metro").toLowerCase();
            const subtitle = (ev.Subtitle||"").trim();
            const title = (ev.Title||"").trim();
            const evLat = parseFloat(ev.Latitude);
            const evLon = parseFloat(ev.Longitude);

            const obj = { clubName, date: (ev.Date||"").trim(), type, category, subtitle, title, lat: evLat||null, lon: evLon||null };
            const club = clubs.find(c=>c.name===clubName);
            if(club){
                if(type==="game") club.games.push(obj);
                else if(type==="practice") club.practices.push(obj);
            }
        });
    } catch(e){ console.error(e); }
}

// -----------------------------------
// Ticker
function buildTickerItems(){
    const items=[];
    const today=new Date();
    const cutoff=new Date(today.getTime()+5*30*24*60*60*1000);
    clubs.forEach(c=>{
        c.games.forEach(g=>{
            const d=parseDateIso(g.date);
            if(d>=today && d<=cutoff) items.push(`${formatDate(d)} — ${c.name} — ${g.subtitle||g.category||"Game"}`);
        });
        c.practices.forEach(p=>{
            const d=parseDateIso(p.date||p);
            if(d>=today && d<=cutoff) items.push(`${formatDate(d)} — ${c.name} — ${p.subtitle||"Practice"}`);
        });
    });
    return items.length?items:["No upcoming events"];
}

let tickerIndex=0;
let tickerTimer=null;
function startTicker(){
    const items = buildTickerItems();
    tickerIndex=0;
    tickerText.textContent=items[0]||"";
    if(tickerTimer) clearInterval(tickerTimer);
    tickerTimer=setInterval(()=>{
        tickerIndex=(tickerIndex+1)%items.length;
        tickerText.textContent=items[tickerIndex];
    },5000);
}

// -----------------------------------
// UI Handlers
clubsToggle.onclick = () => {
    clubsContent.hidden = !clubsContent.hidden;
    if(!clubsContent.hidden) mode="clubs";
};

eventsToggle.onclick = () => {
    const opening = eventsContent.hidden;
    if(opening) clubsContent.hidden = true;
    eventsContent.hidden = !eventsContent.hidden;
    mode = eventsContent.hidden ? "clubs" : "events";

    if(!eventsContent.hidden){
        Calendar.renderCalendar();
    } else {
        Calendar.clearMarkers();
    }
};

gamesBtn.onclick = () => Calendar.setEventType("games");
practicesBtn.onclick = () => Calendar.setEventType("practices");
allBtn.onclick = () => Calendar.setEventType("all");

// -----------------------------------
// Refresh loop
async function fullRefresh(){
    await loadClubs();
    await loadEvents();
    startTicker();
    if(mode==="events") Calendar.renderCalendar();
}
setInterval(fullRefresh, REFRESH_MS);

// -----------------------------------
// Init
(async function init(){
    await fullRefresh();
})();
