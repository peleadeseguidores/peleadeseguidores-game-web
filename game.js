// Pelea de Seguidores - Mejorado (pelotas siempre en movimiento, barra de vida, tamaño dinámico, bots mueren primero)

// --- CONFIGURACIÓN ---
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const gameSize = {w:1360, h:800}; // canvas tamaño grande

// Define el área central (similar a preview)
const centralArea = {
  x: gameSize.w * 0.14,
  y: gameSize.h * 0.17,
  w: gameSize.w * 0.72,
  h: gameSize.h * 0.67
};

let globalSpeed = 0.14; // movimiento natural
let running = false;
let lastTime = 0;
let players = [];
let playerConfig = [];
let botsCount = 0;
let botImageDataURL = null;

// Ejemplo de configuración de jugadores y bots
// playerConfig = [{name: "user1", image: "img1.png", health: 8, isBot: false}, ...];
// botsCount = 5; botImageDataURL = "imgBot.png";

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
  // Posiciones iniciales SOLO dentro del área central
  for(let i=0; i<N; i++) {
    let placed = false;
    let attempts = 0;
    while(!placed && attempts<1000) {
      attempts++;
      let size = minSize;
      let x = Math.random()*centralArea.w + centralArea.x;
      let y = Math.random()*centralArea.h + centralArea.y;
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
      let x = Math.random()*centralArea.w + centralArea.x;
      let y = Math.random()*centralArea.h + centralArea.y;
      positions.push({x,y});
      players.push(new Player(allPlayers[i], size, x, y));
    }
  }
  running = true;
  lastTime = performance.now();
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
    this.health = obj.isBot ? 0.2 + Math.random()*0.3 : 8; // bots: menos vida
    this.maxHealth = 8;
    this.alive = true;
    this.img = new Image();
    this.imgLoaded = false;
    this.img.src = this.imageUrl || '';
    this.img.onload = () => { this.imgLoaded = true; };
    this.img.onerror = () => { this.imgLoaded = false; };
    this.x = x;
    this.y = y;
    let angle = Math.random()*2*Math.PI;
    let speed = globalSpeed * (0.45 + Math.random()*0.18); // siempre en movimiento
    this.vx = Math.cos(angle)*speed;
    this.vy = Math.sin(angle)*speed;
  }

  growTo(newSize) {
    this.size += (newSize - this.size) * 0.08;
    this.targetSize = newSize;
  }

  move() {
    this.x += this.vx;
    this.y += this.vy;
    // Rebote dentro del área central
    if(this.x-this.size/2 < centralArea.x){ this.x = centralArea.x+this.size/2; this.vx = Math.abs(this.vx) || 0.1; }
    if(this.x+this.size/2 > centralArea.x+centralArea.w){ this.x = centralArea.x+centralArea.w-this.size/2; this.vx = -Math.abs(this.vx) || -0.1; }
    if(this.y-this.size/2 < centralArea.y){ this.y = centralArea.y+this.size/2; this.vy = Math.abs(this.vy) || 0.1; }
    if(this.y+this.size/2 > centralArea.y+centralArea.h){ this.y = centralArea.y+centralArea.h-this.size/2; this.vy = -Math.abs(this.vy) || -0.1; }
    // Si se detiene accidentalmente, dale impulso
    if(Math.abs(this.vx) < 0.025) this.vx = (Math.random()-0.5)*0.24;
    if(Math.abs(this.vy) < 0.025) this.vy = (Math.random()-0.5)*0.24;
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

    // Barra de vida arriba
    let barWidth = this.size * 0.82;
    let barHeight = 9;
    let barX = this.x - barWidth/2;
    let barY = this.y - this.size/2 - barHeight - 4;
    // Fondo barra
    ctx.fillStyle = "#222";
    ctx.fillRect(barX, barY, barWidth, barHeight);
    // Vida actual
    let percent = Math.max(0, Math.min(1, this.health/this.maxHealth));
    ctx.fillStyle = percent > 0.3 ? "#1aff1a" : "#ff3c3c";
    ctx.fillRect(barX, barY, barWidth*percent, barHeight);
    // Borde barra
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }
}

// --- COLISIONES Y CRECIMIENTO NATURAL ---
function handleCollisions() {
  let N = players.length;
  let minSize = 18;
  let maxSize = 88;
  // El tamaño crece gradualmente según quedan menos jugadores
  let newSize = minSize + (maxSize-minSize) * (1 - Math.log(N+1)/Math.log(playerConfig.length+botsCount+1));
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
        // Rebote elástico
        let k = 0.45;
        p1.x += nx*overlap*k/2;
        p1.y += ny*overlap*k/2;
        p2.x -= nx*overlap*k/2;
        p2.y -= ny*overlap*k/2;
        // Intercambio de velocidad
        let v1x = p1.vx, v1y = p1.vy, v2x = p2.vx, v2y = p2.vy;
        p1.vx = v2x*0.7 + v1x*0.25;
        p1.vy = v2y*0.7 + v1y*0.25;
        p2.vx = v1x*0.7 + v2x*0.25;
        p2.vy = v1y*0.7 + v2y*0.25;
        // Daño (bots reciben mucho más daño)
        p1.health -= p1.isBot ? 0.18 : 0.017;
        p2.health -= p2.isBot ? 0.18 : 0.017;
      }
    }
    // Limites: nunca salen del área
    if(players[i].x-players[i].size/2 < centralArea.x){ players[i].x = centralArea.x+players[i].size/2; players[i].vx = Math.abs(players[i].vx) || 0.1; }
    if(players[i].x+players[i].size/2 > centralArea.x+centralArea.w){ players[i].x = centralArea.x+centralArea.w-players[i].size/2; players[i].vx = -Math.abs(players[i].vx) || -0.1; }
    if(players[i].y-players[i].size/2 < centralArea.y){ players[i].y = centralArea.y+players[i].size/2; players[i].vy = Math.abs(players[i].vy) || 0.1; }
    if(players[i].y+players[i].size/2 > centralArea.y+centralArea.h){ players[i].y = centralArea.y+centralArea.h-players[i].size/2; players[i].vy = -Math.abs(players[i].vy) || -0.1; }
  }
  players = players.filter(p=>p.health>0);
}

// --- GAME LOOP ---
function gameLoop(ts){
  let dt = ts - lastTime;
  lastTime = ts;
  ctx.clearRect(0,0,gameSize.w,gameSize.h);

  for(let p of players){
    p.move();
    p.draw(ctx);
  }
  handleCollisions();

  // Contador de vivos
  ctx.font = "34px Segoe UI, Arial, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.fillText(`Vivos: ${players.length}`, 22, 48);

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
// startGame() debe ser llamado con la configuración lista.
