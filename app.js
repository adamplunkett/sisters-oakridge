(async function(){
const D = await (await fetch("route.json")).json();
const css = getComputedStyle(document.documentElement);
const C = k => css.getPropertyValue(k).trim();
const COL = {
  "Easy":[C("--easy"),"circle"], "Intermediate":[C("--inter"),"square"],
  "Intermediate — but remote":[C("--inter"),"square"],
  "Intermediate / Difficult":[C("--adv"),"diamond"],
  "Advanced":[C("--adv"),"diamond"], "Difficult / Black":[C("--black"),"dbl"],
  "Driven":[C("--driven"),"drive"]
};
const col = d => (COL[d]||[C("--inter"),"square"])[0];
const MAPC = {"Easy":"#1f7a3f","Intermediate":"#12599b","Intermediate — but remote":"#12599b",
  "Intermediate / Difficult":"#1c2529","Advanced":"#1c2529","Difficult / Black":"#7d2050",
  "Driven":"#5d6763"};
const mcol = d => MAPC[d] || "#12599b";
const shape = d => (COL[d]||["","square"])[1];
const mk = d => `<i class="mk ${shape(d)}"></i>`;
const f0 = n => n==null ? "—" : Math.round(n).toLocaleString();

/* ---------- map ---------- */
// zoomSnap:0 lets fitBounds use a fractional zoom — integer zoom wasted half the frame
const map = L.map("map",{scrollWheelZoom:true, zoomControl:true, attributionControl:true,
  zoomSnap:0, zoomDelta:0.5, wheelPxPerZoomLevel:120});
const USGS_ATTR = 'Tiles © <a href="https://www.usgs.gov/">USGS</a> The National Map';
const bases = {
  "USGS Topo": L.tileLayer(
    "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}",
    {maxZoom:16, minZoom:8, attribution:USGS_ATTR}),
  "Imagery + topo": L.tileLayer(
    "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}",
    {maxZoom:16, minZoom:8, attribution:USGS_ATTR}),
  "Contours (OpenTopoMap)": L.tileLayer(
    "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    {maxZoom:16, minZoom:8, subdomains:"abc",
     attribution:'© <a href="https://opentopomap.org">OpenTopoMap</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'})
};
bases["USGS Topo"].addTo(map);
L.control.layers(bases,null,{position:"bottomright",collapsed:false}).addTo(map);

let layer = L.layerGroup().addTo(map);
let cursor = null, curOpt = "opt2", segLines = [], flat = [];

const el = id => document.getElementById(id);

const MAJOR = new Set(["Sisters","Camp Sherman","Big Lake","McKenzie Bridge","Cougar HS",
                       "High point 5,018 ft","Elk Camp","Oakridge"]);
const DIR = {"Clear Lake":"left","Blue Pool":"left","Big Lake":"top","Cougar HS":"left",
             "Elk Camp":"left","Westfir":"left","Oakridge":"bottom","Camp Sherman":"top",
             "High point 5,018 ft":"right","Belknap HS":"left"};
function drawMarks(){
  D.marks.forEach(m=>{
    const major = MAJOR.has(m.n);
    L.circleMarker([m.lat,m.lon],{radius: major?4.5:3.5, color:C("--ink"),
      weight: major?2:1.5, fillColor:C("--card"), fillOpacity:1, interactive:!major})
     .addTo(layer)
     .bindTooltip(m.n,{permanent:major, direction:DIR[m.n]||"right",
       className:"wp", offset:[DIR[m.n]==="left"?-7:7,0]});
  });
}

function render(key){
  curOpt = key;
  layer.clearLayers(); segLines = []; flat = [];
  const o = D[key];
  o.segs.forEach((s,i)=>{
    const latlngs = s.pts.map(p=>[p[0],p[1]]);
    const base = {weight: s.ridden?6:4.5, opacity: 1,
      color: s.ridden?mcol(s.diff):MAPC.Driven, lineCap:"round", lineJoin:"round"};
    if(!s.verified) base.dashArray = "10 8";
    if(!s.ridden)   base.dashArray = "2 9";
    // white casing so the line reads over topo shading
    L.polyline(latlngs,{color:"#fff",weight:base.weight+5,opacity:0.9,
      interactive:false,lineCap:"round",lineJoin:"round"}).addTo(layer);
    const line = L.polyline(latlngs, base).addTo(layer);
    line.on("mouseover",()=>line.setStyle({weight:base.weight+3}));
    line.on("mouseout", ()=>line.setStyle({weight:base.weight}));
    segLines.push(line);
    s.pts.forEach(p=>flat.push({lat:p[0],lng:p[1],mi:p[2],el:p[3],si:i}));
  });
  drawMarks();
  cursor = L.circleMarker([0,0],{radius:7,color:C("--accent"),weight:3.5,
    fillColor:C("--card"),fillOpacity:1,interactive:false,opacity:0}).addTo(layer);
  const b = L.latLngBounds(o.segs.flatMap(s=>s.pts.map(p=>[p[0],p[1]])));
  map.fitBounds(b,{padding:[22,22]});
  el("t-dist").textContent = o.tot.dist+" mi";
  el("t-meas").textContent = "+"+o.tot.gain.toLocaleString()+" ft";
  el("hint").textContent = key==="opt2"
    ? "Option 2 rides the ridge behind the Wall — the 23.3 miles from the high point to Elk Camp are what Option 5 never touches."
    : "Option 5's grey dotted line is the Aufderheide, driven in about 75 minutes. Everything ridden is trail except the Larison Rock road climb.";
  buildTable(o); buildProfile(o); clearOut();
  document.getElementById("b2").setAttribute("aria-pressed", key==="opt2");
  document.getElementById("b5").setAttribute("aria-pressed", key==="opt5");
}

/* ---------- readout ---------- */
function clearOut(){
  ["r-mi","r-el","r-gr","r-dy"].forEach(i=>el(i).textContent="—");
  el("r-sn").textContent="Hover the route";
  el("r-sm").textContent="Distance, grade and difficulty follow the cursor along the line.";
  el("r-sr").textContent=""; el("r-sr").className="src";
  if(cursor) cursor.setStyle({opacity:0,fillOpacity:0});
  document.querySelectorAll("#tb tr").forEach(r=>r.classList.remove("on"));
  if(profCur) profCur.setAttribute("opacity","0");
}
function showIdx(i){
  const o = D[curOpt], p = flat[i], s = o.segs[p.si];
  el("r-mi").textContent = p.mi.toFixed(1);
  el("r-el").textContent = f0(p.el)+" ft";
  el("r-dy").textContent = s.ridden ? "Day "+s.day : "driven";
  if(s.verified){
    const a=flat[Math.max(0,i-1)], b=flat[Math.min(flat.length-1,i+1)];
    const dm=(b.mi-a.mi)*5280;
    el("r-gr").textContent = dm>0 ? ((b.el-a.el)/dm*100>=0?"+":"")+((b.el-a.el)/dm*100).toFixed(1)+"%" : "0.0%";
  } else el("r-gr").textContent = "n/a";
  el("r-sn").innerHTML = mk(s.diff)+"<span>"+s.name+"</span>";
  el("r-sm").innerHTML = `<b>${s.dist} mi</b> · ${s.surface} · ${s.diff}`
    + (s.verified?` · +${f0(s.gain)} / −${f0(s.loss)} ft`:"")
    + `<br>${s.note}`;
  el("r-sr").textContent = s.source;
  el("r-sr").className = "src"+(s.verified?"":" approx");
  cursor.setLatLng([p.lat,p.lng]).setStyle({opacity:1,fillOpacity:1,color:s.ridden?mcol(s.diff):MAPC.Driven});
  cursor.bringToFront();
  document.querySelectorAll("#tb tr").forEach(r=>r.classList.toggle("on", +r.dataset.i===p.si));
  if(profCur){
    profCur.setAttribute("opacity","1");
    profCur.setAttribute("cx", px(p.mi)); profCur.setAttribute("cy", py(p.el));
    profLine.setAttribute("opacity","1");
    profLine.setAttribute("x1", px(p.mi)); profLine.setAttribute("x2", px(p.mi));
  }
}
function nearestTo(latlng){
  const cp = map.latLngToContainerPoint(latlng);
  let best=-1, bd=1e9;
  for(let i=0;i<flat.length;i++){
    const q = map.latLngToContainerPoint([flat[i].lat,flat[i].lng]);
    const d = (q.x-cp.x)**2 + (q.y-cp.y)**2;
    if(d<bd){bd=d;best=i;}
  }
  return bd < 40*40 ? best : -1;
}
map.on("mousemove", e => { const i = nearestTo(e.latlng); if(i>=0) showIdx(i); else clearOut(); });
map.on("mouseout", clearOut);

/* ---------- table ---------- */
function buildTable(o){
  el("tb").innerHTML = o.segs.map((s,i)=>`
    <tr data-i="${i}" class="${s.ridden?"":"drv"}">
      <td><div class="sn">${mk(s.diff)}<span>${s.name}</span></div>
        <div class="segmeta" style="margin-top:3px">${s.surface}</div>
        <div class="src ${s.verified?"":"approx"}">${s.source}</div></td>
      <td class="n">${s.dist}</td>
      <td class="n">${s.verified?"+"+f0(s.gain):"—"}</td>
      <td class="n">${s.verified?"−"+f0(s.loss):"—"}</td>
      <td>${s.diff}</td></tr>`).join("");
  [...document.querySelectorAll("#tb tr")].forEach(r=>{
    const i=+r.dataset.i;
    r.addEventListener("mouseenter",()=>{
      const j=flat.findIndex(p=>p.si===i); if(j>=0) showIdx(j+Math.floor((flat.filter(p=>p.si===i).length)/2));
    });
    r.addEventListener("click",()=>map.fitBounds(segLines[i].getBounds(),{padding:[40,40]}));
  });
}

/* ---------- profile ---------- */
const PW=1000,PH=150,PL=44,PR=12,PT=10,PB=22;
let XMAX=160, YMIN=900, YMAX=5300, profCur=null, profLine=null;
const px = m => PL + (m/XMAX)*(PW-PL-PR);
const py = e => PT + (1-(e-YMIN)/(YMAX-YMIN))*(PH-PT-PB);
function buildProfile(o){
  const last = o.segs[o.segs.length-1];
  XMAX = Math.ceil(last.b/10)*10;
  let g="";
  for(let e=1000;e<=5000;e+=1000){
    g+=`<line x1="${PL}" y1="${py(e).toFixed(1)}" x2="${PW-PR}" y2="${py(e).toFixed(1)}" stroke="${C("--rule-2")}"/>`;
    g+=`<text x="${PL-6}" y="${(py(e)+3.5).toFixed(1)}" text-anchor="end" class="ax">${e/1000}k</text>`;
  }
  for(let m=0;m<=XMAX;m+=20)
    g+=`<text x="${px(m).toFixed(1)}" y="${PH-6}" text-anchor="middle" class="ax">${m}</text>`;
  o.segs.forEach(s=>{
    const d = s.pts.map((p,k)=>`${k?"L":"M"} ${px(p[2]).toFixed(1)} ${py(p[3]).toFixed(1)}`).join(" ");
    const area = d+` L ${px(s.b).toFixed(1)} ${PH-PB} L ${px(s.a).toFixed(1)} ${PH-PB} Z`;
    g+=`<path d="${area}" fill="${s.ridden?col(s.diff):C("--driven")}" fill-opacity="${s.ridden?(s.verified?.8:.35):.22}"/>`;
    g+=`<path d="${d}" fill="none" stroke="${s.ridden?col(s.diff):C("--driven")}" stroke-width="1.5"
        ${s.verified?"":'stroke-dasharray="5 4"'}/>`;
  });
  g+=`<line id="pl" x1="0" y1="${PT}" x2="0" y2="${PH-PB}" stroke="${C("--accent")}" stroke-width="1.2" opacity="0"/>`;
  g+=`<circle id="pc" r="4" fill="${C("--card")}" stroke="${C("--accent")}" stroke-width="2.2" opacity="0"/>`;
  g+=`<rect id="ph" x="${PL}" y="${PT}" width="${PW-PL-PR}" height="${PH-PT-PB}" fill="transparent" style="cursor:crosshair"/>`;
  const svg=el("prof"); svg.dataset.xmax=XMAX;
  svg.innerHTML=`<style>.ax{font:400 10px ui-monospace,Menlo,monospace;fill:${C("--ink-3")}}</style>`+g;
  profCur=svg.querySelector("#pc"); profLine=svg.querySelector("#pl");
  svg.querySelector("#ph").addEventListener("pointermove",ev=>{
    const r=svg.getBoundingClientRect();
    const mi=Math.max(0,((ev.clientX-r.left)/r.width*PW-PL)/(PW-PL-PR)*XMAX);
    let best=0,bd=1e9;
    for(let i=0;i<flat.length;i++){const d=Math.abs(flat[i].mi-mi); if(d<bd){bd=d;best=i;}}
    showIdx(best);
  });
  svg.addEventListener("pointerleave",clearOut);
}

document.getElementById("b2").addEventListener("click",()=>render("opt2"));
document.getElementById("b5").addEventListener("click",()=>render("opt5"));
render("opt2");
})();
