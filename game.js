// Configuración
const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbxhvAZ_6ajaSzW50AROEh8IUGAAXK4NOPRIyreK5gE2_CYkzVwhr7XWp4NOLyGyJzyW/exec";
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const playerListDiv = document.getElementById("player-list");
const leftInfoDiv = document.getElementById("left-info");
const leaderboardDiv = document.getElementById("leaderboard");
const speedInput = document.getElementById("speedInput");
let mainMenu = document.getElementById("main-menu");
let gameScreen = document.getElementById("game-screen");
let botsCount = 0;
let botImageBlobUrl = null;
let botImageDataURL = null;
let syncStatus = document.getElementById("status-sync");
let running = false;
let lastTime = 0;
let leaderboardOn = true;
let winner = null;
let players = [];
let playerConfig = [];
let gameSize = {w:1280, h:720};
let globalSpeed = 1.2;

// Preview
let previewDiv = document.getElementById("preview-screen");
let previewCanvas = document.getElementById("preview-canvas");
let previewCtx = previewCanvas.getContext("2d");
let previewLabel = document.getElementById("preview-label");

// Gestión de UI
document.getElementById("botsCount").addEventListener("change", e => {
  botsCount = Math.max(0, parseInt(e.target.value) || 0);
  updatePlayerList();
});
speedInput.addEventListener("change", e => {
  globalSpeed = Math.max(0.2, parseFloat(e.target.value) || 1.2);
});
function setBotImage() {
  const fileInput = document.getElementById('botImageFile');
  if (fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      botImageBlobUrl = e.target.result;
      botImageDataURL = e.target.result;
      alert('Imagen para bots cargada ✔️');
      updatePlayerList();
    };
    reader.readAsDataURL(fileInput.files[0]);
  } else {
    alert('Seleccione una imagen primero');
  }
}

// Utilidades de imagen
function toDirectDownload(url) {
  if (!url) return url;
  let m = url.match(/id=([^&]+)/);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  return url;
}

// Sincronización Google Sheets
async function fetchPlayersFromSheet() {
  syncStatus.innerText = "Sincronizando...";
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
    syncStatus.innerText = "Error al sincronizar";
    alert("Error al sincronizar jugadores desde Sheets");
    return [];
  }
}

// Pantalla de configuración
function updatePlayerList() {
  let html = "<h4>Jugadores:</h4>";
  let allPlayers = [...playerConfig];
  if (botsCount > 0 && botImageDataURL) {
    for(let i=0; i<botsCount; i++) {
      allPlayers.push({name:"Bot-"+(i+1), image:botImageDataURL, health:8, isBot:true});
    }
  }
  html += `<div style="max-height:350px;overflow-y:auto;">`;
  allPlayers.forEach((p,i) => {
    html += `<div class="player-row" id="row${i}">
      <img src="${p.image}" alt="Avatar" />
      <span style="margin-left:8px;font-weight:bold;">${p.name}</span>
      <input type="number" min="1" max="99" value="${p.health}" style="margin-left:6px;" onchange="editHealth(${i},this.value)">
      <button onclick="deletePlayer(${i})" style="background:#F55;color:#fff;border:none;padding:3px 10px;border-radius:6px;">✖</button>
    </div>`;
  });
  html += `</div>`;
  playerListDiv.innerHTML = html;
}
function editHealth(idx,val) {
  let allPlayers = [...playerConfig];
  if (botsCount > 0 && botImageDataURL) {
    for(let i=0; i<botsCount; i++) allPlayers.push({name:"Bot-"+(i+1), image:botImageDataURL, health:8, isBot:true});
  }
  val = Math.max(1,Math.min(99,parseInt(val)||8));
  if (allPlayers[idx]) {
    allPlayers[idx].health = val;
    if (idx < playerConfig.length) playerConfig[idx].health = val;
    else { }
    updatePlayerList();
  }
}
function deletePlayer(idx) {
  if (idx < playerConfig.length) {
    playerConfig.splice(idx,1);
  } else {
    botsCount--;
    document.getElementById("botsCount").value = botsCount;
  }
  updatePlayerList();
}

async function syncPlayers() {
  playerConfig = await fetchPlayersFromSheet();
  updatePlayerList();
  syncStatus.innerText = `Sincronizado (${playerConfig.length} jugadores de Sheets)`;
}

// Pantalla de juego
function showMenu() {
  mainMenu.style.display = "flex";
  gameScreen.style.display = "none";
  previewDiv.style.display = "none";
  running = false;
}

// PREVIEW antes de iniciar
function showPreview() {
  // Generar todos los jugadores
  let allPlayers = [...playerConfig];
  if (botsCount > 0 && botImageDataURL) {
    for(let i=0; i<botsCount; i++) {
      allPlayers.push({name:"Bot-"+(i+1), image:botImageDataURL, health:8, isBot:true});
    }
  }
  previewDiv.style.display = "flex";
  previewLabel.innerText = "Jugadores listos para la pelea";

  let N = allPlayers.length || 1;
  let cols = Math.ceil(Math.sqrt(N*16/9));
  let rows = Math.ceil(N/cols);
  let margin = 12;
  let cellW = (1280-margin*2)/cols;
  let cellH = (720-margin*2)/rows;
  let size = Math.min(cellW, cellH)*0.78;

  previewCtx.clearRect(0,0,1280,720);

  let loadedImgs = Array(N).fill(false);

  allPlayers.forEach((pl, i) => {
    let col = i%cols;
    let row = Math.floor(i/cols);
    let x = margin + cellW*col + cellW/2;
    let y = margin + cellH*row + cellH/2;
    // Avatar circular
    let img = new Image();
    img.src = pl.image || '';
    img.onload = () => {
      previewCtx.save();
      previewCtx.beginPath();
      previewCtx.arc(x, y, size/2, 0, 2*Math.PI);
      previewCtx.closePath();
      previewCtx.clip();
      previewCtx.drawImage(img, x-size/2, y-size/2, size, size);
      previewCtx.restore();
      // Borde blanco
      previewCtx.save();
      previewCtx.beginPath();
      previewCtx.arc(x, y, size/2, 0, 2*Math.PI);
      previewCtx.lineWidth = 2.5;
      previewCtx.strokeStyle = "#fff";
      previewCtx.stroke();
      previewCtx.restore();
      // Nombre
      previewCtx.font = "15px Segoe UI, Arial";
      previewCtx.fillStyle = "#FFD700";
      previewCtx.textAlign = "center";
      previewCtx.fillText(pl.name, x, y+size/2+16);
      // Vida
      previewCtx.font = "13px Segoe UI, Arial";
      previewCtx.fillStyle = "#43E73A";
      previewCtx.fillText("Vida: "+pl.health, x, y+size/2+32);
    };
    img.onerror = () => {
      previewCtx.save();
      previewCtx.beginPath();
      previewCtx.arc(x, y, size/2, 0, 2*Math.PI);
      previewCtx.closePath();
      previewCtx.clip();
      previewCtx.fillStyle = "#777";
      previewCtx.fill();
      previewCtx.restore();
      // Borde blanco
      previewCtx.save();
      previewCtx.beginPath();
      previewCtx.arc(x, y, size/2, 0, 2*Math.PI);
      previewCtx.lineWidth = 2.5;
      previewCtx.strokeStyle = "#fff";
      previewCtx.stroke();
      previewCtx.restore();
      // Nombre
      previewCtx.font = "15px Segoe UI, Arial";
      previewCtx.fillStyle = "#FFD700";
      previewCtx.textAlign = "center";
      previewCtx.fillText(pl.name, x, y+size/2+16);
      // Vida
      previewCtx.font = "13px Segoe UI, Arial";
      previewCtx.fillStyle = "#43E73A";
      previewCtx.fillText("Vida: "+pl.health, x, y+size/2+32);
    };
  });

  // Espera 3s y empieza el juego
  setTimeout(()=> {
    previewDiv.style.display = "none";
    startGame();
  }, 3000);
}

// Juego principal
function startGame() {
  // Generar jugadores desde la config
  let allPlayers = [...playerConfig];
  if (botsCount > 0 && botImageDataURL) {
    for(let i=0; i<botsCount; i++) {
      allPlayers.push({name:"Bot-"+(i+1), image:botImageDataURL, health:8, isBot:true});
    }
  }
  // Ajustar tamaño global para que entren todos
  let N = allPlayers.length;
  let minSize = Math.max(42, Math.min((gameSize.w*gameSize.h)/(N*230), 82));
  players = [];
  let gridCols = Math.ceil(Math.sqrt(N*16/9));
  let gridRows = Math.ceil(N/gridCols);
  let margin = 8;
  let cellW = (gameSize.w-margin*2)/gridCols;
  let cellH = (gameSize.h-margin*2)/gridRows;
  let initSize = Math.min(cellW, cellH)*0.75;
  for(let i=0; i<N; i++) {
    let col = i%gridCols;
    let row = Math.floor(i/gridCols);
    let x = margin + cellW*col + cellW/2;
    let y = margin + cellH*row + cellH/2;
    players.push(new Player(allPlayers[i], minSize, x, y));
  }
  mainMenu.style.display = "none";
  gameScreen.style.display = "block";
  leaderboardOn = true;
  winner = null;
  lastTime = performance.now();
  running = true;
  requestAnimationFrame(gameLoop);
}

// Jugador
class Player {
  constructor(obj, size, x, y) {
    this.name = obj.name || "Desconocido";
    this.imageUrl = obj.image;
    this.isBot = obj.isBot || false;
    this.size = size;
    this.targetSize = size;
    this.growSpeed = 1.7 + Math.random()*1.2;
    this.health = obj.health || 8;
    this.maxHealth = obj.health || 8;
    this.alive = true;
    this.img = new Image();
    this.imgLoaded = false;
    this.img.src = this.imageUrl || '';
    // NO crossOrigin
    this.img.onload = () => { this.imgLoaded = true; };
    this.img.onerror = () => { this.imgLoaded = false; };
    this.x = x;
    this.y = y;
    let angle = Math.random()*2*Math.PI;
    let speed = globalSpeed * (0.7 + Math.random()*0.6);
    this.vx = Math.cos(angle)*speed;
    this.vy = Math.sin(angle)*speed;
  }
  growTo(newSize,dt) {
    if (this.size < newSize) {
      this.size += 0.6 * dt/16;
      if (this.size > newSize) this.size = newSize;
    }
    this.targetSize = newSize;
  }
  move() {
    this.x += this.vx;
    this.y += this.vy;
    // Limite pantalla
    if(this.x-this.size/2 < 0){ this.x = this.size/2; this.vx *= -1; }
    if(this.x+this.size/2 > gameSize.w){ this.x = gameSize.w-this.size/2; this.vx *= -1; }
    if(this.y-this.size/2 < 0){ this.y = this.size/2; this.vy *= -1; }
    if(this.y+this.size/2 > gameSize.h){ this.y = gameSize.h-this.size/2; this.vy *= -1; }
  }
  draw(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size/2, 0, 2*Math.PI);
    ctx.closePath();
    ctx.clip();
    if (this.imgLoaded) {
      ctx.drawImage(this.img, this.x-this.size/2, this.y-this.size/2, this.size, this.size);
    } else {
      ctx.fillStyle = "#777";
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size/2, 0, 2*Math.PI);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.restore();
    ctx.font = "15px Segoe UI, Arial";
    ctx.fillStyle = "#FFD700";
    ctx.textAlign = "center";
    ctx.fillText(this.name, this.x, this.y+this.size/2+16);
    let bw = Math.max(55, this.size);
    let bh = 9;
    let pct = Math.max(0, Math.min(1, this.health / this.maxHealth));
    let bx = this.x-bw/2, by = this.y-this.size/2-16;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    roundRect(ctx, bx, by, bw, bh, 4);
    ctx.fillStyle = "#222";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.beginPath();
    roundRect(ctx, bx+2, by+2, (bw-4)*pct, bh-4, 3);
    ctx.fillStyle = "#43E73A";
    ctx.fill();
    ctx.restore();
  }
}

// Colisiones (lógica anterior, rebote simple)
function handleCollisions(dt) {
  let growFactor = Math.min(1.25, 1 + 0.25*(players.length/Math.max(2,playerConfig.length + botsCount)));
  let newSize = Math.max(48, Math.min((gameSize.w*gameSize.h)/(players.length*260), 120))*growFactor;
  for(let i=0; i<players.length; i++){
    players[i].growTo(newSize,dt);
    for(let j=i+1; j<players.length; j++){
      let p1 = players[i], p2 = players[j];
      let dx = p1.x-p2.x, dy = p1.y-p2.y;
      let dist = Math.hypot(dx, dy);
      let minDist = (p1.size+p2.size)/2;
      if(dist < minDist){
        let overlap = minDist - dist;
        let nx = dx/(dist||1), ny = dy/(dist||1);
        p1.x += nx*overlap/2;
        p1.y += ny*overlap/2;
        p2.x -= nx*overlap/2;
        p2.y -= ny*overlap/2;
        p1.vx -= nx*0.12; p1.vy -= ny*0.12;
        p2.vx += nx*0.12; p2.vy += ny*0.12;
        p1.health -= 0.02; p2.health -= 0.02;
      }
    }
    if(players[i].x-players[i].size/2 < 0){ players[i].x = players[i].size/2; players[i].vx *= -1; }
    if(players[i].x+players[i].size/2 > gameSize.w){ players[i].x = gameSize.w-players[i].size/2; players[i].vx *= -1; }
    if(players[i].y-players[i].size/2 < 0){ players[i].y = players[i].size/2; players[i].vy *= -1; }
    if(players[i].y+players[i].size/2 > gameSize.h){ players[i].y = gameSize.h-players[i].size/2; players[i].vy *= -1; }
  }
  players = players.filter(p=>p.health>0);
}

// Leaderboard
function drawLeaderboard() {
  if (!leaderboardOn) {
    leaderboardDiv.style.display = "none";
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
  leaderboardDiv.innerHTML = html;
  leaderboardDiv.style.display = "block";
}

// Juego principal
function gameLoop(ts){
  let dt = ts - lastTime;
  lastTime = ts;
  ctx.clearRect(0,0,gameSize.w,gameSize.h);

  for(let p of players){
    p.move();
    p.draw(ctx);
  }
  handleCollisions(dt);
  drawLeaderboard();
  leftInfoDiv.innerText = `Vivos: ${players.length}`;

  if(running !== false && players.length>1){
    requestAnimationFrame(gameLoop);
  }else if(players.length==1){
    leaderboardOn = false;
    showWinner(players[0]);
  }
}

// Ganador
function showWinner(winner){
  ctx.clearRect(0,0,gameSize.w,gameSize.h);
  ctx.save();
  ctx.translate(gameSize.w/2, gameSize.h/2);
  ctx.beginPath();
  ctx.arc(0,0,180,0,2*Math.PI);
  ctx.closePath();
  ctx.clip();
  if (winner.imgLoaded) {
    ctx.drawImage(winner.img, -180, -180, 360, 360);
  } else {
    ctx.fillStyle = "#777";
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(gameSize.w/2, gameSize.h/2, 180, 0, 2*Math.PI);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#FFD700";
  ctx.stroke();
  ctx.restore();

  ctx.font = "58px Segoe UI, Arial";
  ctx.fillStyle = "#FFD700";
  ctx.textAlign = "center";
  ctx.fillText("¡Ganador!", gameSize.w/2, gameSize.h/2-160);
  ctx.fillStyle = "#fff";
  ctx.font = "44px Segoe UI, Arial";
  ctx.fillText(winner.name, gameSize.w/2, gameSize.h/2+210);
  ctx.font = "34px Segoe UI, Arial";
  ctx.fillText("@peleadeseguidores", gameSize.w/2, gameSize.h/2+270);
  ctx.font = "24px Segoe UI, Arial";
  ctx.fillText("Configurar para reiniciar", gameSize.w/2, gameSize.h/2+320);
}

// Utilidad: rectángulo redondeado
function roundRect(ctx,x,y,w,h,r) {
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
}

// Inicialización
window.onload = () => {
  syncPlayers();
};
