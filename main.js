// main.js
import { renderCalendar, calCurrentMonth, updateCalendarVisibility, calendarDateObj, renderCalendarFor } from './calendar.js';

/* CONFIG */
const CLUB_SHEET_URL  = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2pBQSzKGgCOYPtXyCnC-WOkn-N_6rzjgXPJg3icI-OtgESyHp2WDAPgtYXj_4F0NDNhTfT-zi82cx/pub?output=csv";
const EVENTS_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ23xarhIttcDfoXomCljmxYJo59Fb6Xqbw3wcFcj-gkLena0UTY1-BR5keuQx71h_zLrKsy_cV8aFg/pub?output=csv";
const PROXY = "https://api.allorigins.win/raw?url=";
const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

/* app state */
let clubs = [];      // {name, lat, lon, logo, instagram, games[], practices[]}
let events = [];     // raw events rows
let markers = [];    // {club, marker}
let lastClickedMarker = null;
let mode = "clubs";       // 'clubs' or 'events'
let eventType = "all";    // 'all', 'games', 'practices'

/* DOM */
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
const calendarContainer = document.getElementById("calendarContainer");

/* MAP */
const map = L.map("map").setView([39.5, -85], 4);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors" }).addTo(map);

/* UTILITIES */
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
function iconSizeForZoom(z){ return clamp(Math.round(30 + (z - 3) * 8), 28, 96); }
function parseDateIso(s){ return s ? new Date(s + "T00:00:00") : new Date(NaN); }
function formatDate(d){ return d.toLocaleString("default", { month: "short", day: "numeric" }); }
function toIsoDate(d){ return d.toISOString().slice(0,10); }

/* ICONS & POPUPS */
function makeLogoIcon(logoUrl, borderColor=null, opacity=1){
  const z = map.getZoom();
  const size = iconSizeForZoom(z);
  const border = borderColor ? `border:3px solid ${borderColor};` : "border:2px solid rgba(255,255,255,0.95);";
  const html = `<div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;${opacity<1?`opacity:${opacity};`:``}">
    <img src="${logoUrl}" style="width:${size-6}px;height:${size-6}px;object-fit:cover;${border}border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,0.12);">
  </div>`;
  return L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size/2, size], popupAnchor: [0, -(size + 8)] });
}

function clubPopupHTML(club, selectedDateIso){
  const insta = club.instagram ? `<div style="margin-top:4px"><a href="https://instagram.com/${club.instagram.replace(/^@/,"")}" target="_blank" rel="noopener noreferrer">${club.instagram}</a></div>` : "";
  const next = nextEventText(club, parseDateIso(selectedDateIso || toIsoDate(new Date())));
  return `<div class="popup-card">
    <img src="${club.logo}" alt="${club.name}">
    <div style="font-weight:700">${club.name}</div>
    ${insta}
    <div class="small-muted">${next}</div>
  </div>`;
}

function nextEventText(club, date){
  const future = [];
  (club.games || []).forEach(ev => { const d=parseDateIso(ev.date); if(d>=date){future.push({date:d,label:ev.subtitle||"Game"});}});
  (club.practices || []).forEach(ev => { const d=parseDateIso(ev.date||ev); if(d>=date){future.push({date:d,label:ev.subtitle||"Practice"});}});
  if(!future.length) return "No upcoming events";
  future.sort((a,b)=>a.date-b.date);
  return `${future[0].label}: ${formatDate(future[0].date)}`;
}

/* CSV FETCH */
async function fetchCsv(url){
  const r = await fetch(PROXY + encodeURIComponent(url));
  if (!r.ok) throw new Error("Fetch failed: " + r.status);
  const text = await r.text();
  return Papa.parse(text, { header:true, skipEmptyLines:true }).data;
}

/* LOAD CLUBS */
async function loadClubs(){
  clubListEl.textContent = "Loading clubs...";
  try {
    const data = await fetchCsv(CLUB_SHEET_URL);
    clubs = []; markers.forEach(m=>map.removeLayer(m.marker)); markers=[];
    clubListEl.innerHTML = "";
    for(const row of data){
      const name = (row.Name||row.Club||"").trim();
      if(!name || name.toLowerCase()==="usafl") continue;
      const lat=parseFloat(row.Latitude), lon=parseFloat(row.Longitude);
      if(isNaN(lat)||isNaN(lon)) continue;
      let logo=(row.Logo||row["Logo URL"]||"").trim();
      if(!logo.startsWith("http")) logo="https://aussierulesusa.com/wp-content/uploads/2024/05/placeholder.png";
      const insta=(row.InstagramHandle||"").trim();
      const club={name,lat,lon,logo,instagram:insta,games:[],practices:[]};
      clubs.push(club);

      const marker=L.marker([lat,lon],{icon:makeLogoIcon(club.logo)}).addTo(map);
      marker.bindPopup(clubPopupHTML(club),{closeButton:false});
      marker.on("mouseover",()=>{if(lastClickedMarker!==marker)marker.openPopup();});
      marker.on("mouseout",()=>{if(lastClickedMarker!==marker)marker.closePopup();});
      marker.on("click",()=>{
        if(lastClickedMarker && lastClickedMarker!==marker) lastClickedMarker.closePopup();
        lastClickedMarker=marker; marker.openPopup();
        map.flyTo([lat,lon],6);
      });
      markers.push({club,marker});

      // sidebar item
      const el=document.createElement("div");
      el.className="club-item";
      el.innerHTML=`<img src="${club.logo}" alt="${club.name}"><div style="flex:1">${club.name}</div>`;
      el.onclick=()=>{ marker.fire("click"); };
      clubListEl.appendChild(el);
    }
    clubsCount.textContent=clubs.length;
  } catch(err){console.error(err); clubListEl.textContent="Error loading clubs.";}
}

/* LOAD EVENTS */
async function loadEvents(){
  try{
    events = await fetchCsv(EVENTS_SHEET_URL);
    clubs.forEach(c=>{c.games=[];c.practices=[];});
    for(const ev of events){
      const clubName=(ev.Club||"").trim();
      if(!clubName) continue;
      const type=(ev.EventType||"").toLowerCase();
      const subtitle=(ev.Subtitle||"").trim();
      const title=(ev.Title||"").trim();
      const evLat=ev.Latitude?parseFloat(ev.Latitude):null;
      const evLon=ev.Longitude?parseFloat(ev.Longitude):null;
      const obj={clubName,date:(ev.Date||"").trim(),type,category:(ev.EventCategory||"club-metro").toLowerCase(),subtitle:subtitle||null,title,lat:(evLat&&evLon)?evLat:null,lon:(evLat&&evLon)?evLon:null};
      const club=clubs.find(c=>c.name===clubName);
      if(club){
        if(type==="game") club.games.push(obj);
        else if(type==="practice") club.practices.push(obj);
      }
    }
  }catch(err){console.error("loadEvents error",err);}
}

/* TICKER */
function buildTickerItems(){
  const items=[]; const today=new Date(); const cutoff=new Date(today.getTime()+5*30*24*60*60*1000);
  clubs.forEach(c=>{
    (c.games||[]).forEach(g=>{const d=parseDateIso(g.date); if(d>=today&&d<=cutoff) items.push(`${formatDate(d)} — ${c.name} — ${g.subtitle||"Game"}`);});
    (c.practices||[]).forEach(p=>{const d=parseDateIso(p.date||p); if(d>=today&&d<=cutoff) items.push(`${formatDate(d)} — ${c.name} — ${p.subtitle||"Practice"}`);});
  });
  events.forEach(ev=>{
    if((ev.Club||"").trim().toLowerCase()==="usafl"){ const d=parseDateIso(ev.Date||""); if(!isNaN(d)&&d>=today&&d<=cutoff){ items.push(`${formatDate(d)} — USAFL — ${ev.Subtitle||ev.EventCategory||"League Tournament"}`);}}});
  items.sort((a,b)=>new Date(a.split(" — ")[0])-new Date(b.split(" — ")[0]));
  return items.length?items:["No upcoming events in next 5 months"];
}
let tickerItems=[],tickerIndex=0,tickerTimer=null;
function startTicker(){tickerItems=buildTickerItems(); tickerIndex=0; tickerText.textContent=tickerItems[0]||""; if(tickerTimer) clearInterval(tickerTimer); tickerTimer=setInterval(()=>{tickerIndex=(tickerIndex+1)%tickerItems.length; tickerText.textContent=tickerItems[tickerIndex];},5000);}

/* MAP UTILS */
function applyOverlapFades(){const threshold=30000; markers.forEach(({club,marker})=>{let close=false; for(const {club:other} of markers){if(other===club) continue; if(map.distance([club.lat,club.lon],[other.lat,other.lon])<threshold){close=true; break;}} marker.setIcon(makeLogoIcon(club.logo,null,close?0.75:1));});}
function refreshIcons(){markers.forEach(({club,marker})=>{marker.setIcon(makeLogoIcon(club.logo));}); applyOverlapFades();}
function showAllClubs(){markers.forEach(({marker})=>map.removeLayer(marker)); markers.forEach(({club,marker})=>{marker.setLatLng([club.lat,club.lon]); marker.setIcon(makeLogoIcon(club.logo)); marker.addTo(map); marker.bindPopup(clubPopupHTML(club));}); applyOverlapFades();}

/* EVENTS BY DATE */
window._tempEventMarkers = [];
function updateEventsByDate(selectedDate){
  markers.forEach(({marker})=>map.removeLayer(marker));
  window._tempEventMarkers.forEach(m=>map.removeLayer(m));
  window._tempEventMarkers=[];

  const selectedIso = toIsoDate(selectedDate);

  markers.forEach(({club,marker})=>{
    let show=false, color=null, lat=club.lat, lon=club.lon;
    (club.games||[]).forEach(ev=>{if((eventType==="all"||eventType==="games")&&ev.date===selectedIso){show=true;color="#0077cc"; if(ev.lat&&ev.lon){lat=ev.lat; lon=ev.lon;}}});
    (club.practices||[]).forEach(ev=>{if((eventType==="all"||eventType==="practices")&&(ev.date===selectedIso)){show=true;color="#32cd32"; if(ev.lat&&ev.lon){lat=ev.lat; lon=ev.lon;}}});
    if(show){marker.setLatLng([lat,lon]); marker.setIcon(makeLogoIcon(club.logo,color,1)); marker.addTo(map); marker.bindPopup(clubPopupHTML(club,selectedIso));}
  });
}

/* NEXT EVENT */
function findNextEventDate(forFilter){
  const allDates=[]; const today=new Date();
  clubs.forEach(c=>{(c.games||[]).forEach(g=>{if(forFilter==="games"||forFilter==="all") allDates.push(parseDateIso(g.date));}); (c.practices||[]).forEach(p=>{if(forFilter==="practices"||forFilter==="all") allDates.push(parseDateIso(p.date||p));});});
  events.forEach(ev=>{if((ev.Club||"").trim().toLowerCase()==="usafl"){if(forFilter==="all"||forFilter===ev.EventType) allDates.push(parseDateIso(ev.Date));}});
  const future=allDates.filter(d=>d&&d>=today); if(!future.length) return null;
  future.sort((a,b)=>a-b); return toIsoDate(future[0]);
}

/* SIDEBAR TOGGLE */
function repositionEventsSidebar(){ if(clubsContent.hidden){ eventsSidebar.style.top="128px"; }else{ const offset=70+clubsContent.offsetHeight+12; eventsSidebar.style.top=offset+"px"; } }
clubsToggle.onclick=()=>{
  clubsContent.hidden=!clubsContent.hidden;
  if(!clubsContent.hidden&&!eventsContent.hidden) eventsContent.hidden=true;
  repositionEventsSidebar(); updateCalendarVisibility();
  if(!clubsContent.hidden){mode="clubs"; showAllClubs();}
};
eventsToggle.onclick=()=>{
  const eventsIsOpening = eventsContent.hidden;
  if(eventsIsOpening && !clubsContent.hidden){clubsContent.hidden=true;}
  eventsContent.hidden=!eventsContent.hidden;
  updateCalendarVisibility(); repositionEventsSidebar();
  if(!eventsContent.hidden){
    mode="events";
    const nextIso=findNextEventDate(eventType)||toIsoDate(new Date());
    const dt=parseDateIso(nextIso);
    calendarDateObj=new Date(dt.getFullYear(),dt.getMonth(),1);
    renderCalendarFor(calendarDateObj);
    setTimeout(()=>{
      const nodes=Array.from(document.querySelectorAll("#calendarGrid .calendar-day"));
      for(const node of nodes){if(node.classList.contains("disabled")) continue; if(parseInt(node.textContent,10)===dt.getDate()){node.click(); break;}}
    },20);
  }else{mode="clubs"; showAllClubs();}
};

/* FILTER BUTTONS */
function setType(t){eventType=t; gamesBtn.classList.toggle("active",t==="games"); practicesBtn.classList.toggle("active",t==="practices"); allBtn.classList.toggle("active",t==="all"); renderCalendarFor(calendarDateObj);}
gamesBtn.onclick=()=>setType("games");
practicesBtn.onclick=()=>setType("practices");
allBtn.onclick=()=>setType("all");

/* MAP EVENTS */
map.on("click",()=>{if(lastClickedMarker){try{lastClickedMarker.closePopup();}catch{} lastClickedMarker=null;}});
map.on("zoomend",()=>{refreshIcons();});

/* FULL REFRESH */
async function fullRefresh(){
  await loadClubs();
  await loadEvents();
  startTicker();
  if(mode==="events"){
    const nextIso=findNextEventDate(eventType)||toIsoDate(new Date());
    const dt=parseDateIso(nextIso);
    calendarDateObj=new Date(dt.getFullYear(),dt.getMonth(),1);
    renderCalendarFor(calendarDateObj);
    setTimeout(()=>{
      const nodes=Array.from(document.querySelectorAll("#calendarGrid .calendar-day"));
      for(const node of nodes){if(node.classList.contains("disabled")) continue; if(parseInt(node.textContent,10)===dt.getDate()){node.click(); break;}}
    },20);
  }else{showAllClubs();}
}
setInterval(fullRefresh,REFRESH_MS);

/* INIT */
(async function init(){
  await loadClubs();
  await loadEvents();
  startTicker();
  calendarDateObj=new Date();
  renderCalendarFor(calendarDateObj);
  showAllClubs();
  updateCalendarVisibility();
  renderCalendar();
})();
