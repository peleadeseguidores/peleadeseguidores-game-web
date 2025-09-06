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
let gameSize = {w:1360, h:800}; // Limites más grandes
let globalSpeed = 0.18; // Mucho más lento

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
  globalSpeed = Math.max(0.05, parseFloat(e.target.value) || 0.18);
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

// PREVIEW antes de iniciar (igual que antes, solo muestra imagen y nombre en config)
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
  let size = 24; // PEQUEÑAS al inicio

  previewCtx.clearRect(0,0,1280,720);

  let loadedImgs = Array(N).fill(false);

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

// Juego principal
function startGame() {
  let allPlayers = [...playerConfig];
  if (botsCount > 0 && botImageDataURL) {
    for(let i=0; i<botsCount; i++) {
      allPlayers.push({name:"Bot-"+(i+1), image:botImageDataURL, health:8, isBot:true});
    }
  }
  let N = allPlayers.length;
  let minSize = 22; // PEQUEÑAS al inicio
  players = [];
  let tries = 0;
  let positions = [];

  // Posiciones aleatorias SIN SOBREPOSICIÓN
  for(let i=0; i<N; i++) {
    let placed = false;
    let attempts = 0;
    while(!placed && attempts<1000) {
      attempts++;
      let size = minSize;
      let x = Math.random()*(gameSize.w-size*2) + size;
      let y = Math.random()*(gameSize.h-size*2) + size;
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
    if(!placed) { // Si no encuentra espacio, lo pone igual
      let size = minSize;
      let x = Math.random()*(gameSize.w-size*2) + size;
      let y = Math.random()*(gameSize.h-size*2) + size;
      positions.push({x,y});
      players.push(new Player(allPlayers[i], size, x, y));
    }
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
    this.growSpeed = 0.25 + Math.random()*0.08;
    this.health = obj.isBot ? 0.2 + Math.random()*0.2 : 8; // bots mueren primero
    this.maxHealth = obj.isBot ? 0.2 + Math.random()*0.2 : 8;
    this.alive = true;
    this.img = new Image();
    this.imgLoaded = false;
    this.img.src = this.imageUrl || '';
    this.img.onload = () => { this.imgLoaded = true; };
    this.img.onerror = () => { this.imgLoaded = false; };
    this.x = x;
    this.y = y;
    let angle = Math.random()*2*Math.PI;
    let speed = globalSpeed * (0.4 + Math.random()*0.18); // muy lento y rango estrecho
    this.vx = Math.cos(angle)*speed;
    this.vy = Math.sin(angle)*speed;
  }
  growTo(newSize,dt) {
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
    // NO mostrar nombre ni vida
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size/2, 0, 2*Math.PI);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.restore();
  }
}

// Colisiones y crecimiento naturales
function handleCollisions(dt) {
  let N = players.length;
  let minSize = 22;
  let maxSize = 92;
  let newSize = minSize + (maxSize-minSize) * (1 - Math.log(N+1)/Math.log(playerConfig.length+botsCount+1));
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
        // Rebote elástico (más natural)
        let k = 0.40; // fuerza del rebote
        p1.x += nx*overlap*k/2;
        p1.y += ny*overlap*k/2;
        p2.x -= nx*overlap*k/2;
        p2.y -= ny*overlap*k/2;
        // Intercambio de velocidad con rebote y fricción leve
        let v1x = p1.vx, v1y = p1.vy, v2x = p2.vx, v2y = p2.vy;
        p1.vx = v2x*0.7 + v1x*0.2;
        p1.vy = v2y*0.7 + v1y*0.2;
        p2.vx = v1x*0.7 + v2x*0.2;
        p2.vy = v1y*0.7 + v2y*0.2;
        // Daño
        p1.health -= p1.isBot ? 0.16 : 0.016;
        p2.health -= p2.isBot ? 0.16 : 0.016;
      }
    }
    if(players[i].x-players[i].size/2 < 0){ players[i].x = players[i].size/2; players[i].vx *= -1; }
    if(players[i].x+players[i].size/2 > gameSize.w){ players[i].x = gameSize.w-players[i].size/2; players[i].vx *= -1; }
    if(players[i].y-players[i].size/2 < 0){ players[i].y = players[i].size/2; players[i].vy *= -1; }
    if(players[i].y+players[i].size/2 > gameSize.h){ players[i].y = gameSize.h-players[i].size/2; players[i].vy *= -1; }
  }
  players = players.filter(p=>p.health>0);
}

// Leaderboard (opcional, puedes ocultarlo si no lo quieres)
function drawLeaderboard() {
  leaderboardDiv.style.display = "none";
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

  // Contador de vivos, solo texto blanco arriba a la izquierda
  leftInfoDiv.style.background = "none";
  leftInfoDiv.style.color = "#fff";
  leftInfoDiv.style.fontWeight = "bold";
  leftInfoDiv.style.fontSize = "31px";
  leftInfoDiv.style.borderRadius = "0";
  leftInfoDiv.style.padding = "0";
  leftInfoDiv.style.left = "22px";
  leftInfoDiv.style.top = "22px";
  leftInfoDiv.innerText = `Vivos: ${players.length}`;

  if(running !== false && players.length>1){
    requestAnimationFrame(gameLoop);
  }else if(players.length==1){
    leaderboardOn = false;
    showWinner(players[0]);
  }
}

// GANADOR: Solo la imagen, centrada, sin círculo blanco ni texto
function showWinner(winner){
  ctx.clearRect(0,0,gameSize.w,gameSize.h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(gameSize.w/2, gameSize.h/2, 180, 0, 2*Math.PI);
  ctx.closePath();
  ctx.clip();
  if (winner.imgLoaded && winner.img) {
    ctx.drawImage(winner.img, gameSize.w/2-180, gameSize.h/2-180, 360, 360);
  } else {
    ctx.fillStyle = "#777";
    ctx.fillRect(gameSize.w/2-180, gameSize.h/2-180, 360, 360);
  }
  ctx.restore();
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
