// Pelea de Seguidores - Sincronización original + mejoras solicitadas

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const playerListDiv = document.getElementById("player-list");
const leftInfoDiv = document.getElementById("left-info");
const leaderboardDiv = document.getElementById("leaderboard");
const speedInput = document.getElementById("speedInput");

let mainMenu = document.getElementById("main-menu");
let gameScreen = document.getElementById("game-screen");
let previewDiv = document.getElementById("preview-screen");
let previewCanvas = document.getElementById("preview-canvas");
let previewCtx = previewCanvas.getContext("2d");
let previewLabel = document.getElementById("preview-label");
let botsCount = 0;
let botImageBlobUrl = null;
let botImageDataURL = null;
let syncStatus = document.getElementById("status-sync");
let running = false;
let lastTime = 0;
let winner = null;
let players = [];
let playerConfig = [];
let gameSize = {w:1360, h:800};

let globalSpeed = 0.36; // velocidad aumentada

// --- ÁREA DEL RECTÁNGULO DE JUEGO (solo visual) ---
const centralArea = {
  x: 260,
  y: 80,
  w: 920,
  h: 640
};

// --- UI ---
document.getElementById("botsCount").addEventListener("change", e => {
  botsCount = Math.max(0, parseInt(e.target.value) || 0);
  updatePlayerList();
});
speedInput.addEventListener("change", e => {
  globalSpeed = Math.max(0.05, parseFloat(e.target.value) || 0.36);
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

// --- Sincronización original: obtiene avatares desde GitHub (como antes) ---
async function fetchAvatarsFromGitHub() {
  const apiUrl = "https://api.github.com/repos/peleadeseguidores/peleadeseguidores-game-web/contents/images";
  const res = await fetch(apiUrl, { headers: { "Accept": "application/vnd.github.v3+json" } });
  const files = await res.json();
  const avatars = files
    .filter(f => f.type === "file" && f.download_url)
    .map(f => ({
      name: f.name.replace(/\.[^/.]+$/, ""),
      image: f.download_url,
      health: 8,
      isBot: false,
    }));
  return avatars;
}

async function syncPlayers() {
  syncStatus.innerText = "Sincronizando avatares desde GitHub...";
  playerConfig = await fetchAvatarsFromGitHub();
  updatePlayerList();
  syncStatus.innerText = `Sincronizado (${playerConfig.length} avatares de GitHub)`;
}

function updatePlayerList() {
  let html = "<h4 style='color:#FFD700;margin-bottom:12px;'>Jugadores:</h4>";
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
      <span style="margin-left:8px;font-weight:bold;color:#FFD700;">${p.name}</span>
      <input type="number" min="1" max="99" value="${p.health}" style="margin-left:6px;" onchange="editHealth(${i},this.value)">
      <button onclick="deletePlayer(${i})" title="Eliminar jugador">✖</button>
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
    if (idx < playerConfig.length) playerConfig[idx].health = val;
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

function showMenu() {
  mainMenu.style.display = "flex";
  gameScreen.style.display = "none";
  previewDiv.style.display = "none";
  running = false;
}

// --- PREVIEW --- (visual)
function showPreview() {
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
  let size = 24;

  previewCtx.clearRect(0,0,1280,720);

  allPlayers.forEach((pl, i) => {
    let col = i%cols;
    let row = Math.floor(i/cols);
    let x = margin + cellW*col + cellW/2;
    let y = margin + cellH*row + cellH/2;
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
    };
  });

  setTimeout(()=> {
    previewDiv.style.display = "none";
    startGame();
  }, 3000);
}

// --- JUEGO PRINCIPAL ---
function startGame() {
  let allPlayers = [...playerConfig];
  if (botsCount > 0 && botImageDataURL) {
    for(let i=0; i<botsCount; i++) {
      allPlayers.push({name:"Bot-"+(i+1), image:botImageDataURL, health:8, isBot:true});
    }
  }
  let N = allPlayers.length;
  let minSize = 18;
  players = [];
  let positions = [];
  // Posiciones iniciales aleatorias en TODO el canvas
  for(let i=0; i<N; i++) {
    let placed = false;
    let attempts = 0;
    while(!placed && attempts<1000) {
      attempts++;
      let size = minSize;
      let x = Math.random() * (gameSize.w - size) + size/2;
      let y = Math.random() * (gameSize.h - size) + size/2;
      let valid = true;
      for(let p of positions) {
        let dx = x-p.x, dy = y-p.y;
        if(Math.hypot(dx,dy) < size*1.2) { valid=false; break; }
      }
      if(valid) {
        positions.push({x,y});
        players.push(new Player(allPlayers[i], size, x, y));
        placed = true;
      }
    }
    if(!placed) {
      let size = minSize;
      let x = Math.random() * (gameSize.w - size) + size/2;
      let y = Math.random() * (gameSize.h - size) + size/2;
      positions.push({x,y});
      players.push(new Player(allPlayers[i], size, x, y));
    }
  }
  mainMenu.style.display = "none";
  gameScreen.style.display = "block";
  leaderboardDiv.style.display = "none";
  winner = null;
  lastTime = performance.now();
  running = true;
  requestAnimationFrame(gameLoop);
}

// --- CLASE PLAYER ---
class Player {
  constructor(obj, size, x, y) {
    this.name = obj.name || "Desconocido";
    this.imageUrl = obj.image;
    this.isBot = obj.isBot || false;
    this.size = size;
    this.targetSize = size;
    this.health = obj.isBot ? 0.2 + Math.random()*0.3 : (obj.health || 8); // bots: menos vida
    this.maxHealth = obj.isBot ? 1 : (obj.health || 8);
    this.img = new Image();
    this.imgLoaded = false;
    this.img.src = this.imageUrl || '';
    this.img.onload = () => { this.imgLoaded = true; };
    this.x = x;
    this.y = y;
    let angle = Math.random()*2*Math.PI;
    let speed = globalSpeed * (0.55 + Math.random()*0.22);
    this.vx = Math.cos(angle)*speed;
    this.vy = Math.sin(angle)*speed;
  }

  growTo(newSize) {
    this.size += (newSize - this.size) * 0.10;
    this.targetSize = newSize;
  }

  move() {
    this.x += this.vx;
    this.y += this.vy;
    // Rebote en TODO el canvas
    if(this.x-this.size/2 < 0){ this.x = this.size/2; this.vx = Math.abs(this.vx) || 0.1; }
    if(this.x+this.size/2 > gameSize.w){ this.x = gameSize.w-this.size/2; this.vx = -Math.abs(this.vx) || -0.1; }
    if(this.y-this.size/2 < 0){ this.y = this.size/2; this.vy = Math.abs(this.vy) || 0.1; }
    if(this.y+this.size/2 > gameSize.h){ this.y = gameSize.h-this.size/2; this.vy = -Math.abs(this.vy) || -0.1; }
    if(Math.abs(this.vx) < 0.025) this.vx = (Math.random()-0.5)*0.34;
    if(Math.abs(this.vy) < 0.025) this.vy = (Math.random()-0.5)*0.34;
  }

  draw(ctx) {
    // Imagen circular
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

    // Borde blanco
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size/2, 0, 2*Math.PI);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.restore();

    // Barra de vida verde-rojo como la imagen
    let barWidth = this.size * 0.84;
    let barHeight = 7;
    let barX = this.x - barWidth/2;
    let barY = this.y - this.size/2 - barHeight - 5;
    let percent = Math.max(0, Math.min(1, this.health/this.maxHealth));
    ctx.fillStyle = "#111";
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = "#25ff25";
    ctx.fillRect(barX, barY, barWidth*percent, barHeight);
    ctx.fillStyle = "#ff2222";
    ctx.fillRect(barX+barWidth*percent, barY, barWidth*(1-percent), barHeight);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }
}

// --- COLISIONES Y CRECIMIENTO NATURAL ---
function handleCollisions() {
  let N = players.length;
  let minSize = 18, maxSize = 98;
  let total = playerConfig.length + botsCount;
  let newSize = minSize + (maxSize-minSize) * (1 - Math.log(N+1)/Math.log(total+1));
  for(let i=0; i<N; i++){
    players[i].growTo(newSize);
    for(let j=i+1; j<N; j++){
      let p1 = players[i], p2 = players[j];
      let dx = p1.x-p2.x, dy = p1.y-p2.y;
      let dist = Math.hypot(dx, dy);
      let minDist = (p1.size+p2.size)/2;
      if(dist < minDist){
        let overlap = minDist - dist;
        let nx = dx/(dist||1), ny = dy/(dist||1);
        let k = 0.45;
        p1.x += nx*overlap*k/2;
        p1.y += ny*overlap*k/2;
        p2.x -= nx*overlap*k/2;
        p2.y -= ny*overlap*k/2;
        let v1x = p1.vx, v1y = p1.vy, v2x = p2.vx, v2y = p2.vy;
        p1.vx = v2x*0.7 + v1x*0.25;
        p1.vy = v2y*0.7 + v1y*0.25;
        p2.vx = v1x*0.7 + v2x*0.25;
        p2.vy = v1y*0.7 + v2y*0.25;
        p1.health -= p1.isBot ? 0.18 : 0.017;
        p2.health -= p2.isBot ? 0.18 : 0.017;
      }
    }
    // Rebote en todo el canvas
    if(players[i].x-players[i].size/2 < 0){ players[i].x = players[i].size/2; players[i].vx = Math.abs(players[i].vx) || 0.1; }
    if(players[i].x+players[i].size/2 > gameSize.w){ players[i].x = gameSize.w-players[i].size/2; players[i].vx = -Math.abs(players[i].vx) || -0.1; }
    if(players[i].y-players[i].size/2 < 0){ players[i].y = players[i].size/2; players[i].vy = Math.abs(players[i].vy) || 0.1; }
    if(players[i].y+players[i].size/2 > gameSize.h){ players[i].y = gameSize.h-players[i].size/2; players[i].vy = -Math.abs(players[i].vy) || -0.1; }
  }
  players = players.filter(p=>p.health>0);
}

// --- GAME LOOP ---
function gameLoop(ts){
  let dt = ts - lastTime;
  lastTime = ts;
  ctx.clearRect(0,0,gameSize.w,gameSize.h);

  // Dibuja solo un rectángulo visual para el área de juego (no afecta movimiento)
  ctx.save();
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = "#222";
  ctx.fillRect(centralArea.x, centralArea.y, centralArea.w, centralArea.h);
  ctx.globalAlpha = 0.6;
  ctx.strokeRect(centralArea.x, centralArea.y, centralArea.w, centralArea.h);
  ctx.restore();

  for(let p of players){
    p.move();
    p.draw(ctx);
  }
  handleCollisions();

  // Vivos: texto más chico y muestra jugadores + bots
  ctx.font = "21px Segoe UI, Arial, sans-serif";
  ctx.fillStyle = "#FFD700";
  ctx.textAlign = "left";
  ctx.fillText(`Vivos: ${players.length} / ${playerConfig.length + botsCount}`, 32, 38);

  if(running !== false && players.length>1){
    requestAnimationFrame(gameLoop);
  }else if(players.length==1){
    showWinner(players[0]);
  }
}

// --- GANADOR: IMAGEN CIRCULAR + MENSAJE ---
function showWinner(winner){
  ctx.clearRect(0,0,gameSize.w,gameSize.h);
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, gameSize.w, gameSize.h);

  let winnerTag = winner.name.startsWith('@') ? winner.name : '@' + winner.name;
  ctx.font = "54px Segoe UI, Arial, sans-serif";
  ctx.fillStyle = "#FFD700";
  ctx.textAlign = "center";
  ctx.fillText(`¡Felicidades ${winnerTag}!`, gameSize.w/2, 120);

  ctx.save();
  ctx.beginPath();
  ctx.arc(gameSize.w/2, gameSize.h/2, 140, 0, 2*Math.PI);
  ctx.closePath();
  ctx.clip();
  if (winner.imgLoaded && winner.img) {
    ctx.drawImage(winner.img, gameSize.w/2-140, gameSize.h/2-140, 280, 280);
  } else {
    ctx.fillStyle = "#777";
    ctx.fillRect(gameSize.w/2-140, gameSize.h/2-140, 280, 280);
  }
  ctx.restore();

  ctx.font = "28px Segoe UI, Arial";
  ctx.fillStyle = "#fff";
  ctx.fillText("¡Eres el campeón!", gameSize.w/2, gameSize.h/2 + 180);

  ctx.font = "26px Segoe UI, Arial";
  ctx.fillStyle = "#FFD700";
  ctx.fillText("@peleadeseguidores", gameSize.w/2, gameSize.h/2 + 228);
}

// --- INICIALIZACIÓN ---
window.onload = () => {};
