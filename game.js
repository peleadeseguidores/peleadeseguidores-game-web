const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let players = [];
let running = false;
let lastTime = 0;
const PLAYER_COUNT = 1000; // Cambia aquí para miles de jugadores
const AREA_W = canvas.width;
const AREA_H = canvas.height;

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.baseSize = 28 + Math.random() * 36;
    this.size = this.baseSize * 0.18;
    this.targetSize = this.baseSize;
    this.growSpeed = 2 + Math.random() * 2;
    this.vx = (Math.random()-0.5) * 1.8;
    this.vy = (Math.random()-0.5) * 1.8;
    this.health = 8;
    this.alive = true;
    this.color = `hsl(${Math.floor(Math.random()*360)},80%,60%)`;
    this.name = "Jugador" + Math.floor(Math.random()*99999);
  }
  grow(dt){
    if(this.size < this.targetSize){
      this.size += this.growSpeed * dt/16;
      if(this.size > this.targetSize) this.size = this.targetSize;
    }
  }
  move(){
    this.x += this.vx;
    this.y += this.vy;
    // Limites de pantalla
    if(this.x-this.size/2 < 0){ this.x = this.size/2; this.vx *= -1; }
    if(this.x+this.size/2 > AREA_W){ this.x = AREA_W-this.size/2; this.vx *= -1; }
    if(this.y-this.size/2 < 0){ this.y = this.size/2; this.vy *= -1; }
    if(this.y+this.size/2 > AREA_H){ this.y = AREA_H-this.size/2; this.vy *= -1; }
  }
  draw(ctx){
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size/2, 0, 2*Math.PI);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function startGame(){
  players = [];
  running = true;
  for(let i=0; i<PLAYER_COUNT; i++){
    let x = Math.random()*(AREA_W-120)+60;
    let y = Math.random()*(AREA_H-120)+60;
    players.push(new Player(x,y));
  }
  document.getElementById("count").innerText = "Vivos: "+players.length;
  requestAnimationFrame(gameLoop);
}

function gameLoop(ts){
  let dt = ts - lastTime;
  lastTime = ts;
  ctx.clearRect(0,0,AREA_W,AREA_H);

  // Animación y movimiento
  for(let p of players){
    p.grow(dt);
    p.move();
    p.draw(ctx);
  }

  // Colisiones (simple, solo reduce salud)
  for(let i=0; i<players.length; i++){
    for(let j=i+1; j<players.length; j++){
      let p1 = players[i], p2 = players[j];
      let dx = p1.x-p2.x, dy = p1.y-p2.y;
      let dist = Math.hypot(dx, dy);
      if(dist < (p1.size+p2.size)/2){
        // Se chocan, rebotan y pierden vida
        let nx = dx/dist, ny = dy/dist;
        p1.vx -= nx*0.1; p1.vy -= ny*0.1;
        p2.vx += nx*0.1; p2.vy += ny*0.1;
        p1.health -= 0.01; p2.health -= 0.01;
      }
    }
  }
  // Eliminar muertos
  players = players.filter(p=>p.health>0);

  document.getElementById("count").innerText = "Vivos: "+players.length;

  if(running && players.length>1){
    requestAnimationFrame(gameLoop);
  }else if(players.length==1){
    showWinner(players[0]);
  }
}

function showWinner(winner){
  ctx.clearRect(0,0,AREA_W,AREA_H);
  ctx.save();
  ctx.translate(AREA_W/2, AREA_H/2);
  ctx.beginPath();
  ctx.arc(0,0,180,0,2*Math.PI);
  ctx.fillStyle = winner.color;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#FFD700";
  ctx.stroke();
  ctx.restore();

  ctx.font = "48px sans-serif";
  ctx.fillStyle = "#FFD700";
  ctx.textAlign = "center";
  ctx.fillText("¡Ganador!", AREA_W/2, AREA_H/2-150);
  ctx.fillStyle = "#fff";
  ctx.font = "36px sans-serif";
  ctx.fillText(winner.name, AREA_W/2, AREA_H/2+210);
  ctx.font = "28px sans-serif";
  ctx.fillText("@peleadeseguidores", AREA_W/2, AREA_H/2+270);
}
