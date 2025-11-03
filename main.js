/*
 * Loy Krathong Online - Main JavaScript Logic
 *
 * This file consolidates and refines the JavaScript logic from the original index.html and main.js.
 * The goal is to ensure all features (Responsive, Krathong, Fireworks, Tuk-Tuk, Music, Stats) work correctly.
 */

/* ===== Configuration & Constants ===== */
const VQS = "?v=12.4"; // Version Query String for cache busting
const WATER_FACTOR = 0.75;   // Adjusted to 0.75 to raise the water level further, preventing krathongs from sinking too much
const ROAD_DY      = 0;      // Road position relative to water surface (0 means road is at water level)
const LANES        = 5;      // Number of krathong lanes
const LANE_STEP    = 16;     // Vertical distance between lanes
const KR_SIZE      = 90;     // Krathong size (increased from 60 to 90 for better visibility)
const MAX_BOATS    = 24;     // Maximum number of krathongs on screen
const TUK_W        = 140;    // Tuk-Tuk width
const TUK_H        = 90;     // Tuk-Tuk height
const TUK_SPEED    = 35;     // Tuk-Tuk speed

/* ===== DOM Elements ===== */
const cvs = document.getElementById("scene");
const ctx = cvs.getContext("2d");
const header = document.querySelector("header");
const wishEl = document.getElementById("wish");
const statEl = document.getElementById("statCount");
const toast  = document.getElementById("toast");
const bgm    = document.getElementById("bgm");
const wishListEl = document.getElementById("wishList");

/* ===== Utility Functions ===== */
const rnd = (a,b)=>Math.random()*(b-a)+a;
function makeImg(p){ const i=new Image(); i.crossOrigin="anonymous"; i.decoding="async"; i.onload=()=>i._ok=true; i.src=p+VQS; return i; }
function roundRect(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m]));}
function haptic(){ if('vibrate' in navigator) try{ navigator.vibrate(12); }catch{} }

/* ===== Assets Loading ===== */
const tukImg  = makeImg("images/tuktuk.png");
const logoImg = makeImg("images/logo.png");
const krImgs  = ["kt1.png","kt2.png","kt3.png","kt4.png","kt5.png"].map(n=>makeImg("images/"+n));

/* ===== Canvas Sizing & Anchors ===== */
function size(){
  const h = header ? header.offsetHeight : 0;
  // Set canvas CSS size to fill the remaining viewport
  cvs.style.top = `${h}px`;
  cvs.style.height = `calc(100% - ${h}px)`;
  cvs.style.width = '100%';

  // Set drawing buffer size to match CSS size
  cvs.width  = cvs.offsetWidth;
  cvs.height = cvs.offsetHeight;
}
addEventListener("resize", ()=>requestAnimationFrame(size));
addEventListener("orientationchange", size);
size();

const waterY = () => Math.round(cvs.height * WATER_FACTOR);
const roadY  = () => waterY() + ROAD_DY;
function laneY(i){ return waterY() + 10 + i*LANE_STEP; }

/* ===== Statistics (localStorage) ===== */
const LS_COUNT="loy.count", LS_WQ="loy.wishes.queue", LS_SEQ="loy.seq", LS_LOG="loy.wishes.log";
let total=+(localStorage.getItem(LS_COUNT)||0), seq=+(localStorage.getItem(LS_SEQ)||0);
statEl.textContent = total;

function bump(){ total++; localStorage.setItem(LS_COUNT,total); statEl.textContent = total; }
function pushWish(t){
  let a=[]; try{ a=JSON.parse(localStorage.getItem(LS_WQ)||"[]"); }catch{}
  seq++; localStorage.setItem(LS_SEQ,seq);
  const item={n:seq,w:(t||"").trim(),t:Date.now()};
  a.push(item); localStorage.setItem(LS_WQ,JSON.stringify(a));
  let log=[]; try{ log=JSON.parse(localStorage.getItem(LS_LOG)||"[]"); }catch{}
  log.push(item); localStorage.setItem(LS_LOG,JSON.stringify(log));
  renderWish();
}

function renderWish(){
  let a=[]; try{ a=JSON.parse(localStorage.getItem(LS_WQ)||"[]"); }catch{}
  const view=a.slice(-6); // Show last 6 wishes
  wishListEl.innerHTML = view.map(x=>`<li><span class="num">คนที่ ${x.n}</span>🕯️ ${escapeHtml(x.w)}</li>`).join("");
}
renderWish();

// Reset Button Logic
document.getElementById('resetBtn').onclick=()=>{
  if(confirm("ยืนยันเริ่มนับใหม่และลบคำอธิษฐานทั้งหมด?")){
    localStorage.removeItem(LS_COUNT);
    localStorage.removeItem(LS_WQ);
    localStorage.removeItem(LS_SEQ);
    localStorage.removeItem(LS_LOG);
    total=0; seq=0; statEl.textContent=0;
    boats.length=0; renderWish();
  }
};

// Export CSV Logic
document.getElementById('exportBtn').onclick=()=>{
  let log=[]; try{ log=JSON.parse(localStorage.getItem(LS_LOG)||"[]"); }catch{}
  const rows=[["seq","timestamp","ISO","wish"]];
  for(const x of log){ const iso=new Date(x.t||Date.now()).toISOString(); rows.push([x.n, x.t, iso, (x.w||"").replace(/"/g,'""')]); }
  const csv=rows.map(r=>r.map(v=>`"${String(v)}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download="loykrathong_report.csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
};

/* ===== Krathong Class & Logic ===== */
let nextKrathongIndex=0;
class Krathong{
  constructor(img, text){
    this.img=img; this.text=text||"";
    this.size=KR_SIZE;
    this.lane=nextKrathongIndex % LANES; // Assign a lane
    this.x=-120; this.vx=rnd(18,24); // Slightly slower speed for better spacing
    this.phase=rnd(0,Math.PI*2); this.amp=2.2; this.freq=.9+rnd(0,.5); this.t=0;
    this.y=this.computeY(0);
  }
  computeY(t){
    const bob=Math.sin(t*this.freq+this.phase)*this.amp;
    return laneY(this.lane) + bob;
  }
  update(dt){
    this.x+=this.vx*dt;
    if(this.x>cvs.width+160) this.x=-160 - rnd(0,250); // Increased random offset for better spacing
    this.t+=dt;
    this.y=this.computeY(this.t);
  }
  draw(g){
    const wy=waterY(), rx=this.size*.55, ry=6;
    // Shadow
    const grd=g.createRadialGradient(this.x,wy,1,this.x,wy,rx);
    grd.addColorStop(0,'rgba(0,0,0,.22)'); grd.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=grd; g.beginPath(); g.ellipse(this.x,wy,rx,ry,0,0,Math.PI*2); g.fill();

    // Krathong Image
    if(this.img && this.img._ok){ g.drawImage(this.img,this.x-this.size/2,this.y-this.size/2,this.size,this.size); }
    else { g.fillStyle='#27ae60'; g.beginPath(); g.arc(this.x,this.y,this.size/2,0,Math.PI*2); g.fill(); }

    // Wish text
    if(this.text){
      const msg = this.text;
      g.font="600 15px system-ui, -apple-system, 'TH Sarabun New', Prompt, sans-serif";
      g.textAlign="center"; g.textBaseline="middle";
      const padX=12, padY=6;
      const w = Math.min(320, g.measureText(msg).width + padX*2);
      const h = 26;
      const cy=this.y - this.size*0.75;
      const cx=this.x;

      // pill background
      g.save();
      g.globalAlpha=.85; g.fillStyle="#0e1726"; roundRect(g, cx - w/2, cy - h/2, w, h, 14); g.fill();
      g.globalAlpha=1; g.strokeStyle="rgba(255,255,255,.25)"; g.lineWidth=1; roundRect(g, cx - w/2, cy - h/2, w, h, 14); g.stroke();
      // text
      g.fillStyle="#e9f0ff"; g.fillText(msg, cx, cy);
      g.restore();
    }
  }
}

const boats=[];
// Initialize with 5 krathongs
for(let i=0; i<LANES; i++){
  const im=krImgs[i % krImgs.length];
  boats.push(new Krathong(im, ""));
  boats[i].x = -180 - i*120; // Stagger initial positions
  nextKrathongIndex++;
}

function launch(text){
  const imgs=krImgs.filter(Boolean);
  let im=null;
  if(imgs.length){ im=imgs[nextKrathongIndex % imgs.length]; nextKrathongIndex=(nextKrathongIndex+1)%imgs.length; }

  // Remove the oldest krathong if max limit is reached
  if(boats.length>=MAX_BOATS){ boats.shift(); }

  boats.push(new Krathong(im, text));
  bump(); pushWish(text);
}

/* ===== Launch & Input Handlers ===== */
function showToast(){ toast?.classList.add("show"); setTimeout(()=>toast?.classList.remove("show"),700); }

// Launch button
document.getElementById('launch').onclick=()=>{
  launch(wishEl.value||"");
  wishEl.value="";
  showToast();
  haptic();
};

// Mobile tap launch (if element exists)
const tapLaunchMobile = document.getElementById('tapLaunchMobile'); if(tapLaunchMobile) tapLaunchMobile.onclick=()=>{
  launch("");
  showToast();
  haptic();
};

// Canvas click/tap launch
cvs.addEventListener('click', ()=>{ launch(""); showToast(); haptic(); });
cvs.addEventListener('touchstart', ()=>{ launch(""); showToast(); haptic(); }, {passive:true});


/* ===== Music Control ===== */
function safePlay(){ try{ const p=bgm.play(); if(p&&p.catch) p.catch(()=>{});}catch{} }

// Play/Pause button
const tapMusicMobile = document.getElementById('tapMusicMobile'); if(tapMusicMobile) tapMusicMobile.onclick = ()=>{
  if(bgm.paused) safePlay(); else bgm.pause();
};

// Start button on splash screen
document.getElementById('startBtn').onclick = ()=>{
  hideSplash();
  safePlay();
};

// Hide splash screen logic
const splash=document.getElementById('splash');
function hideSplash(){
  if(!splash) return;
  splash.classList.add('hide');
  setTimeout(()=>splash.remove?.(),350);
}
// Auto-hide splash after a delay if user doesn't interact
setTimeout(hideSplash, 1800);


/* ===== Firework Class & Logic ===== */
class Firework{
  constructor(x){ this.x=x; this.y=waterY(); this.vy=-280; this.state='rise'; this.parts=[]; }
  update(dt){
    if(this.state==='rise'){ this.y+=this.vy*dt; this.vy+=140*dt; if(this.vy>=-10) this.explode(); }
    else { for(const p of this.parts){ p.vx*=0.99; p.vy+=70*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.a*=0.985; } this.parts=this.parts.filter(p=>p.a>0.06); }
  }
  explode(){
    this.state='explode';
    for(let i=0;i<36;i++){
      const a=i/36*Math.PI*2, sp=110+rnd(0,90);
      this.parts.push({x:this.x,y:this.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,a:1});
    }
  }
  draw(g){
    if(this.state==='rise'){ g.strokeStyle='rgba(255,220,120,.9)'; g.beginPath(); g.moveTo(this.x,this.y+16); g.lineTo(this.x,this.y); g.stroke(); }
    for(const p of this.parts){
      const R=64*p.a;
      if(logoImg && logoImg._ok){
        g.save(); g.globalAlpha=p.a; g.drawImage(logoImg,p.x-R,p.y-R,R*2,R*2); g.restore();
      }else{
        g.save(); g.globalAlpha=p.a; g.fillStyle='#fff'; g.beginPath(); g.arc(p.x,p.y,R,0,Math.PI*2); g.fill(); g.lineWidth=8; g.strokeStyle='#e31f26'; g.beginPath(); g.arc(p.x,p.y,R-4,0,Math.PI*2); g.stroke(); g.restore();
      }
    }
  }
}
const fireworks=[];
function spawnTriple(){ const w=cvs.width; [w*.25,w*.5,w*.75].forEach(x=>fireworks.push(new Firework(x))); }
setTimeout(spawnTriple, 2500); // Initial burst
setInterval(spawnTriple,10000); // Recurring bursts

/* ===== Tuk-Tuk Logic ===== */
// Road Y from visible background <img>
// Since we set object-fit: cover and object-position: center bottom,
// the bottom of the image aligns with the bottom of the stage.
// We will use a fixed offset from the bottom of the canvas for the road.
const ROAD_OFFSET_FROM_BOTTOM = 450; // Adjusted to 450 to ensure tuk-tuk is definitely on the red line (based on user feedback)

function roadYFromBackground(){
  // Calculate the road Y position relative to the canvas bottom
  let y = cvs.height - ROAD_OFFSET_FROM_BOTTOM;
  // Ensure it's not above the water line (optional, but good for safety)
  y = Math.max(y, waterY() + 10);
  return y;
}

const tuk={x:-220,w:TUK_W,h:TUK_H,speed:TUK_SPEED};
function drawTuk(dt){
  tuk.x += tuk.speed*dt;
  if(tuk.x > cvs.width + 220) tuk.x = -220;
  const y = roadYFromBackground() - tuk.h; // Position based on background image
  if(tukImg && tukImg._ok){ ctx.drawImage(tukImg, tuk.x, Math.min(Math.max(y,0), cvs.height-tuk.h), tuk.w, tuk.h); }
  else { ctx.fillStyle='#2ecc71'; ctx.fillRect(tuk.x, Math.min(Math.max(y,0), cvs.height-tuk.h), tuk.w, tuk.h); }
}

/* ===== Drawing Loop ===== */
let waveT=0,last=performance.now();
function drawWater(){
  const w=cvs.width,h=cvs.height,y=waterY();
  ctx.fillStyle='rgba(10,32,63,0.96)'; ctx.fillRect(0,y,w,h-y);
  ctx.lineWidth=1.6; ctx.lineCap='round'; ctx.strokeStyle='rgba(255,255,255,0.2)';
  for(let i=0;i<10;i++){
    ctx.beginPath();
    for(let x=0;x<w;x+=20){
      const yy=y+Math.sin((x/40)+waveT*1.2+i)*6+i*16;
      if(x===0) ctx.moveTo(x,yy); else ctx.lineTo(x,yy);
    }
    ctx.stroke();
  }
}

function loop(ts){
  const dt = Math.min(0.033,(ts-last)/1000); last=ts; waveT+=dt;
  ctx.clearRect(0,0,cvs.width,cvs.height);

  // 1. Draw Water
  drawWater();

  // 2. Draw Fireworks (behind tuk-tuk and krathongs)
  for(const fw of fireworks){ fw.update(dt); fw.draw(ctx); }

  // 3. Draw Tuk-Tuk
  drawTuk(dt);

  // 4. Draw Krathongs (sorted by Y for depth effect)
  const ordered=boats.slice().sort((a,b)=>a.y-b.y);
  for(const b of ordered){ b.update(dt); b.draw(ctx); }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
