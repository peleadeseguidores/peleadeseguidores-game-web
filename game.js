// Configura aquí la URL de tu WebApp de Google Sheets:
const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbxhvAZ_6ajaSzW50AROEh8IUGAAXK4NOPRIyreK5gE2_CYkzVwhr7XWp4NOLyGyJzyW/exec";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let players = [];
let running = false;
let lastTime = 0;
let leaderboardOn = true;
const AREA_W = canvas.width;
const AREA_H = canvas.height;
let winner = null;

// Bots
let botsCount = 0;
let botImageBlobUrl = null;
document.getElementById("botsCount").addEventListener("change", e => {
  botsCount = Math.max(0, parseInt(e.target.value) || 0);
});
function setBotImage() {
  const fileInput = document.getElementById('botImageFile');
  if (fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      botImageBlobUrl = e.target.result;
      alert('Imagen para bots cargada ✔️');
    };
    reader.readAsDataURL(fileInput.files[0]);
  } else {
    alert('Seleccione una imagen primero');
  }
}

// -- Utilidades --
function toDirectDownload(url) {
  if (!url) return url;
  let m = url.match(/\/file\/d\/([^/]+)\//);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  if (url.includes("export=view")) return url.replace("export=view", "export=download");
  return url;
}

// -- Sincronización Google Sheets --
async function fetchPlayersFromSheet() {
  try {
    const res = await fetch(SHEET_API_URL);
    const data = await res.json();
    if (!data.jugadores) return [];
    // Formato: { nombre, url_foto }
    return data.jugadores.map(jg => ({
      name: jg.nombre || "Desconocido",
      image: jg.url_foto ? toDirectDownload(jg.url_foto) : null,
      health: 8,
      isBot: false,
    }));
  } catch (e) {
    alert("Error al sincronizar jugadores desde Sheets");
    return [];
  }
}

// -- Jugador --
class Player {
  constructor(obj, idx, total) {
    this.name = obj.name || "Desconocido";
    this.imageUrl = obj.image;
    this.isBot = obj.isBot || false;
    this.baseSize = 38 + Math.random()*22;
    this.size = this.baseSize * 0.22;
    this.targetSize = this.baseSize;
    this.growSpeed = 2 + Math.random()*2;
    this.health = obj.health || 8;
    this.maxHealth = obj.health || 8;
    this.alive = true;
    this.img = null;
    this.x = Math.random()*(AREA_W-120)+60;
    this.y = Math.random()*(AREA_H-120)+60;
    this.vx = (Math.random()-0.5)*1.6;
    this.vy = (Math.random()-0.5)*1.6;
    this.idx = idx;
    this.total = total;
    this.imgLoaded = false;
    // Carga la imagen (bots usan la misma imagen)
    if (this.imageUrl) {
      let img = new Image();
      img.crossOrigin = "anonymous";
      img.src = this.imageUrl;
      img.onload = () => { this.imgLoaded = true; this.img = img; };
      img.onerror = () => { this.imgLoaded = false; };
    } else if (this.isBot && botImageBlobUrl) {
      let img = new Image();
      img.src = botImageBlobUrl;
      img.onload = () => { this.imgLoaded = true; this.img = img; };
      img.onerror = () => { this.imgLoaded = false; };
    } else {
      this.imgLoaded = false;
    }
  }
  grow(dt){
    if(this.size < this.targetSize){
      this.size += this.growSpeed * dt/20;
      if(this.size > this.targetSize) this.size = this.targetSize;
    }
  }
  move(){
    this.x += this.vx;
    this.y += this.vy;
    if(this.x-this.size/2 < 0){ this.x = this.size/2; this.vx *= -1; }
    if(this.x+this.size/2 > AREA_W){ this.x = AREA_W-this.size/2; this.vx *= -1; }
    if(this.y-this.size/2 < 0){ this.y = this.size/2; this.vy *= -1; }
    if(this.y+this.size/2 > AREA_H){ this.y = AREA_H-this.size/2; this.vy *= -1; }
  }
  draw(ctx){
    // Avatar circular
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size/2, 0, 2*Math.PI);
    ctx.closePath();
    ctx.clip();
    if (this.img && this.imgLoaded) {
      ctx.drawImage(this.img, this.x-this.size/2, this.y-this.size/2, this.size, this.size);
    } else {
      ctx.fillStyle = "#aaa";
      ctx.fill();
    }
    ctx.restore();
    // Borde blanco
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size/2, 0, 2*Math.PI);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.restore();

    // Nombre
    ctx.font = "15px Segoe UI, Arial";
    ctx.fillStyle = "#FFD700";
    ctx.textAlign = "center";
    ctx.fillText(this.name, this.x, this.y+this.size/2+16);

    // Barra de vida (arriba del avatar)
    let bw = Math.max(55, this.size);
    let bh = 9;
    let pct = Math.max(0, Math.min(1, this.health / this.maxHealth));
    let bx = this.x-bw/2, by = this.y-this.size/2-16;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 4);
    ctx.fillStyle = "#222";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.closePath();
    ctx.beginPath();
    ctx.roundRect(bx+2, by+2, (bw-4)*pct, bh-4, 3);
    ctx.fillStyle = "#43E73A";
    ctx.fill();
    ctx.restore();
  }
}

// -- Leaderboard --
function drawLeaderboard() {
  if (!leaderboardOn) {
    document.getElementById("leaderboard").style.display = "none";
    return;
  }
  let sorted = [...players].sort((a,b)=>b.health-a.health);
  let top10 = sorted.slice(0,10);
  let html = "<h3>Marcador</h3><ul>";
  for (let i=0; i<top10.length; i++) {
    let p = top10[i];
    html += `<li>${i+1}. <span style="color:#FFD700">${p.name}</span> <span style="color:#fff">(${p.health.toFixed(1)})</span></li>`;
  }
  html += "</ul>";
  document.getElementById("leaderboard").innerHTML = html;
  document.getElementById("leaderboard").style.display = "block";
}

// -- Colisiones --
function handleCollisions() {
  for(let i=0; i<players.length; i++){
    for(let j=i+1; j<players.length; j++){
      let p1 = players[i], p2 = players[j];
      let dx = p1.x-p2.x, dy = p1.y-p2.y;
      let dist = Math.hypot(dx, dy);
      if(dist < (p1.size+p2.size)/2){
        let nx = dx/dist, ny = dy/dist;
        p1.vx -= nx*0.1; p1.vy -= ny*0.1;
        p2.vx += nx*0.1; p2.vy += ny*0.1;
        p1.health -= 0.025; p2.health -= 0.025;
      }
    }
  }
  // Eliminar muertos
  players = players.filter(p=>p.health>0);
}

// -- Juego principal --
function startGame(){
  running = true;
  winner = null;
  document.getElementById("count").innerText = "Vivos: "+players.length;
  leaderboardOn = true;
  requestAnimationFrame(gameLoop);
}

function gameLoop(ts){
  let dt = ts - lastTime;
  lastTime = ts;
  ctx.clearRect(0,0,AREA_W,AREA_H);

  for(let p of players){
    p.grow(dt||16);
    p.move();
    p.draw(ctx);
  }
  handleCollisions();
  drawLeaderboard();

  document.getElementById("count").innerText = "Vivos: "+players.length;

  if(running && players.length>1){
    requestAnimationFrame(gameLoop);
  }else if(players.length==1){
    leaderboardOn = false;
    showWinner(players[0]);
  }
}

function showWinner(winner){
  ctx.clearRect(0,0,AREA_W,AREA_H);
  ctx.save();
  ctx.translate(AREA_W/2, AREA_H/2);
  ctx.beginPath();
  ctx.arc(0,0,180,0,2*Math.PI);
  ctx.closePath();
  ctx.clip();
  if (winner.img && winner.imgLoaded) {
    ctx.drawImage(winner.img, -180, -180, 360, 360);
  } else {
    ctx.fillStyle = "#aaa";
    ctx.fill();
  }
  ctx.restore();

  // Borde dorado
  ctx.save();
  ctx.beginPath();
  ctx.arc(AREA_W/2, AREA_H/2, 180, 0, 2*Math.PI);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#FFD700";
  ctx.stroke();
  ctx.restore();

  ctx.font = "58px Segoe UI, Arial";
  ctx.fillStyle = "#FFD700";
  ctx.textAlign = "center";
  ctx.fillText("¡Ganador!", AREA_W/2, AREA_H/2-160);
  ctx.fillStyle = "#fff";
  ctx.font = "44px Segoe UI, Arial";
  ctx.fillText(winner.name, AREA_W/2, AREA_H/2+210);
  ctx.font = "34px Segoe UI, Arial";
  ctx.fillText("@peleadeseguidores", AREA_W/2, AREA_H/2+270);
  ctx.font = "24px Segoe UI, Arial";
  ctx.fillText("Presiona Jugar para reiniciar", AREA_W/2, AREA_H/2+320);
}

async function syncPlayers() {
  document.getElementById("count").innerText = "Sincronizando...";
  let sheetPlayers = await fetchPlayersFromSheet();
  let botsArray = [];
  if (botsCount > 0 && botImageBlobUrl) {
    for (let i = 0; i < botsCount; i++) {
      botsArray.push({
        name: "Bot-" + (i + 1),
        image: botImageBlobUrl,
        health: 8,
        isBot: true,
      });
    }
  }
  players = [];
  let totalPlayers = sheetPlayers.length + botsArray.length;
  for (let i = 0; i < sheetPlayers.length; i++) {
    players.push(new Player(sheetPlayers[i], i, totalPlayers));
  }
  for (let i = 0; i < botsArray.length; i++) {
    players.push(new Player(botsArray[i], sheetPlayers.length + i, totalPlayers));
  }
  document.getElementById("count").innerText = "Jugadores sincronizados: " + players.length;
  leaderboardOn = true;
  winner = null;
}

// Sincroniza jugadores al cargar la página
window.onload = () => {
  syncPlayers();
};
