// Configuración
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
let globalSpeed = 0.8; // BAJA VELOCIDAD INICIAL para suavidad

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
  globalSpeed = Math.max(0.2, parseFloat(e.target.value) || 0.8);
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

// Sincronización GitHub avatars
async function fetchAvatarsFromGitHub() {
  const apiUrl = "https://api.github.com/repos/peleadeseguidores/peleadeseguidores-game-web/contents/images";
  try {
    const res = await fetch(apiUrl, {
      headers: { "Accept": "application/vnd.github.v3+json" }
    });
    const files = await res.json();
    // Solo archivos de imagen
    const avatars = files
      .filter(f => f.type === "file" && f.download_url)
      .map(f => ({
        name: f.name.replace(/\.[^/.]+$/, ""), // sin extensión
        image: f.download_url,
        health: 8,
        isBot: false,
      }));
    return avatars;
  } catch (e) {
    alert("Error al cargar avatares de GitHub");
    return [];
  }
}

// Sincroniza los avatares desde GitHub
async function syncPlayers() {
  syncStatus.innerText = "Sincronizando avatares desde GitHub...";
  playerConfig = await fetchAvatarsFromGitHub();
  updatePlayerList();
  syncStatus.innerText = `Sincronizado (${playerConfig.length} avatares de GitHub)`;
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
  let size = 36; // PEQUEÑAS al inicio

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
  let N = allPlayers.length;
  let minSize = 36; // PEQUEÑAS al inicio
  players = [];
  let gridCols = Math.ceil(Math.sqrt(N*16/9));
  let gridRows = Math.ceil(N/gridCols);
  let margin = 8;
  let cellW = (gameSize.w-margin*2)/gridCols;
  let cellH = (gameSize.h-margin*2)/gridRows;
  let initSize = minSize;
  for(let i=0; i<N; i++) {
    let col = i%gridCols;
    let row = Math.floor(i/gridCols);
    let x = margin + cellW*col + cellW/2;
    let y = margin + cellH*row + cellH/2;
    players.push(new Player(allPlayers[i], initSize, x, y));
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
    this.growSpeed = 0.45 + Math.random()*0.15; // velocidad de crecimiento baja
    this.health = obj.health || 8;
    this.maxHealth = obj.health || 8;
    this.alive = true;
    this.img = new Image();
    this.imgLoaded = false;
    this.img.src = this.imageUrl || '';
    this.img.onload = () => { this.imgLoaded = true; };
    this.img.onerror = () => { this.imgLoaded = false; };
    this.x = x;
    this.y = y;
    let angle = Math.random()*2*Math.PI;
    let speed = globalSpeed * (0.48 + Math.random()*0.32); // velocidad menor y rango más estrecho
    this.vx = Math.cos(angle)*speed;
    this.vy = Math.sin(angle)*speed;
  }
  growTo(newSize,dt) {
    // Interpolación suave
    this.size += (newSize - this.size) * 0.08;
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

// Colisiones y crecimiento
function handleCollisions(dt) {
  // Tamaño base pequeño, aumenta según jugadores vivos
  let N = players.length;
  let minSize = 36;
  let maxSize = 120;
  // Escala logarítmica para crecimiento más natural
  let newSize = minSize + (maxSize-minSize) * (1 - Math.log(N+1)/Math.log(playerConfig.length+1));
  for(let i=0; i<N; i++){
    players[i].growTo(newSize,dt);
    for(let j=i+1; j<N; j++){
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
        p1.vx -= nx*0.08; p1.vy -= ny*0.08;
        p2.vx += nx*0.08; p2.vy += ny*0.08;
        p1.health -= 0.02; p2.health -= 0.02;
      }
    }
    // Límites pantalla
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

// NUEVO FRAME GANADOR ESTILO VIDEO
function showWinner(winner){
  ctx.clearRect(0,0,gameSize.w,gameSize.h);

  // Fondo oscuro
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, gameSize.w, gameSize.h);

  // Felicidades @nombre
  ctx.font = "54px Segoe UI, Arial, sans-serif";
  ctx.fillStyle = "#FFD700";
  ctx.textAlign = "center";
  ctx.fillText(`¡Felicidades @${winner.name}!`, gameSize.w/2, 120);

  // Círculo blanco
  ctx.save();
  ctx.beginPath();
  ctx.arc(gameSize.w/2, gameSize.h/2, 140, 0, 2*Math.PI);
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.clip();

  // Avatar del ganador (imagen)
  if (winner.imgLoaded && winner.img) {
    ctx.drawImage(winner.img, gameSize.w/2-110, gameSize.h/2-110, 220, 220);
  } else {
    // Si no hay imagen, muestra el nombre centrado
    ctx.font = "42px Segoe UI, Arial";
    ctx.fillStyle = "#222";
    ctx.textAlign = "center";
    ctx.fillText(winner.name, gameSize.w/2, gameSize.h/2 + 15);
  }
  ctx.restore();

  // ¡Eres el campeón!
  ctx.font = "28px Segoe UI, Arial";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText("¡Eres el campeón!", gameSize.w/2, gameSize.h/2 + 180);

  // @peleadeseguidores
  ctx.font = "26px Segoe UI, Arial";
  ctx.fillStyle = "#FFD700";
  ctx.textAlign = "center";
  ctx.fillText("@peleadeseguidores", gameSize.w/2, gameSize.h/2 + 228);
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
