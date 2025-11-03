/* Runner Infinito – versão simplificada e compatível
   - Canvas puro
   - Pulo com baixa latência (consumo imediato no início do frame)
   - Pequeno boost no jump para sensação mais “viva”
*/
(() => {
  // ===== DOM =====
  const C = document.getElementById('game');
  const X = C.getContext('2d');
  const ELscore = document.getElementById('score');
  const ELlevel = document.getElementById('level');
  const ELbest  = document.getElementById('best');
  const BStart  = document.getElementById('btnStart');
  const BPause  = document.getElementById('btnPause');
  const BFS     = document.getElementById('btnFS');
  const BJump   = document.getElementById('btnJump');

  // ===== Mundo =====
  const W = C.width, H = C.height;
  const GY = Math.round(H * 0.82);      // linha do “chão”
  let running = false, paused = false, gameOver = false;
  let frame = 0, level = 1, baseSpeed = 3.6, speed = baseSpeed;
  let score = 0, best = Number(localStorage.getItem("runner_highscore")||0);
  ELbest.textContent = `🏆 High: ${best}`;

  // Jogador
  const player = {
    x: 120, y: GY-42, w: 46, h: 42,
    vy: 0,
    gravity: 0.9,
    jump: 15.0,           // ↑ levemente maior (mais “vivo”)
    onGround: true,
    jumps: 0,
    maxJumps: 1,
    leg:0, wing:0, neck:0 // (usados para animação simples)
  };

  // Obstáculos / elementos
  const obs = [];
  const clouds = [];
  const parts = [];        // partículas (poeira/pedaços)
  const eggs  = [];        // colecionáveis
  const groundMarks = [];

  // spawn timers
  let tObs=0, tCloud=0, tEgg=0, tMark=0;
  let spawnInt = 65;       // intervalo base para obstáculos
  let obstaclesCleared = 0;

  // ===== Controles de input com “fila”, buffer e coyote =====
  const COYOTE_MS = 120;
  const JUMP_BUFFER_MS = 120;
  const JUMP_MIN_INTERVAL_MS = 120;
  let lastGroundedAt = 0;
  let lastJumpPressedAt = -Infinity;
  let lastJumpDoneAt = -Infinity;
  let jumpQueued = false;
  let lastTapAt = 0;

  function queueJump(){
    const now = performance.now();
    if (now - lastJumpPressedAt < 40) return; // anti-duplo
    lastJumpPressedAt = now;
    jumpQueued = true;
    // vibração sutil (se disponível)
    if (navigator.vibrate) navigator.vibrate(8);
  }
  function doJumpImpulse(){
    player.vy = -player.jump;
    player.onGround = false;
    player.jumps++;
    lastJumpDoneAt = performance.now();
  }
  function tryConsumeJump(){
    const now = performance.now();
    if (now - lastJumpDoneAt < JUMP_MIN_INTERVAL_MS) return false;
    const onGroundNow = player.onGround;
    const coyoteOk = (now - lastGroundedAt) <= COYOTE_MS;
    const bufferOk = (now - lastJumpPressedAt) <= JUMP_BUFFER_MS;

    if ((onGroundNow || coyoteOk) && bufferOk) { doJumpImpulse(); return true; }
    if (!onGroundNow && player.jumps < player.maxJumps && bufferOk) { doJumpImpulse(); return true; }
    return false;
  }

  // ===== Util =====
  const R = (a,b)=>Math.random()*(b-a)+a;
  const CL=(v,a,b)=>Math.max(a,Math.min(b,v));
  const LERP=(a,b,t)=>a+(b-a)*t;

  function hit(a,b){
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  }

  function nearObs(){
    let nearest = null, dMin = Infinity;
    for(const o of obs){
      const d = (o.x - (player.x + player.w));
      if (d >= -40 && d < dMin) { dMin=d; nearest=o; }
    }
    return nearest;
  }

  // ===== Spawns =====
  function spObstacle(){
    const tall = Math.random() < 0.35;
    const type = tall ? "cactus" : "barbed";
    const h = tall ? Math.round(R(54,78)) : Math.round(R(28,38));
    const w = tall ? Math.round(R(24,32)) : Math.round(R(34,42));
    obs.push({type, x: W+20, y: GY-h, w, h, rot: 0});
  }
  function spCloud(){
    clouds.push({x:W+40, y:R(40,H*0.35), spd:R(0.3,0.8)});
  }
  function spEgg(){
    eggs.push({x:W+20, y:R(H*0.35, GY-60), w:18, h:22, got:false});
  }
  function spGroundMark(){
    groundMarks.push({x:W+20, y:GY-6, w:R(20,40), h:4});
  }

  // ===== Desenho =====
  function drawBG(){
    // céu
    X.fillStyle = '#e7f0ff';
    X.fillRect(0,0,W,H);
    // chão
    X.fillStyle = '#d7b46a';
    X.fillRect(0,GY,W,H-GY);
  }
  function drawOstrich(){
    const {x,y,w,h} = player;
    X.save();
    X.translate(x,y);
    X.fillStyle = '#333';
    // corpo
    X.fillRect(0, h*0.25, w*0.6, h*0.5);
    // cabeça/pescoço simples
    X.fillRect(w*0.5, 0, 6, h*0.4);
    X.fillRect(w*0.56, 0, 12, 8);
    // pernas
    const a = Math.sin(frame*0.25)*6;
    X.save(); X.translate(w*0.25,h*0.75); X.rotate(a*Math.PI/180); X.fillRect(-2,0,4,h*0.25); X.restore();
    X.save(); X.translate(w*0.40,h*0.75); X.rotate(-a*Math.PI/180); X.fillRect(-2,0,4,h*0.25); X.restore();
    X.restore();
  }
  function drawObstacle(o){
    if(o.type==="cactus"){
      X.fillStyle="#2e7d32"; X.fillRect(o.x,o.y,o.w,o.h);
      X.fillRect(o.x-4,o.y+10,4,o.h-10); X.fillRect(o.x+o.w,o.y+14,4,o.h-14);
    }else{
      X.save(); X.translate(o.x+o.w/2,o.y+o.h/2); X.rotate(o.rot||0);
      X.fillStyle="#555"; X.beginPath(); X.arc(0,0,o.w/2-2,0,Math.PI*2); X.fill(); X.restore();
    }
  }
  function drawEgg(e){
    X.fillStyle="#fff176";
    X.beginPath(); X.ellipse(e.x+e.w/2,e.y+e.h/2,9,12,0,0,Math.PI*2); X.fill();
  }
  function drawParticles(){
    for(const p of parts){ X.fillStyle=p.c||'#999'; X.fillRect(p.x,p.y,2,2); }
  }
  function drawOverlays(){
    X.fillStyle="#0003"; X.fillRect(0,GY-2,W,2);
  }

  // ===== Lógica principal =====
  function setLevel(){
    level = 1 + Math.floor(obstaclesCleared/10);
    baseSpeed = 3.6 + Math.min(3, level*0.35);
    spawnInt = Math.max(40, 65 - Math.min(20, level*2));
    ELlevel.textContent = `Nível: ${level}`;
  }

  function reset(){
    running = true; paused=false; gameOver=false;
    score = 0; obstaclesCleared=0; level=1; baseSpeed=3.6; speed=baseSpeed; frame=0;
    obs.length=0; clouds.length=0; parts.length=0; eggs.length=0; groundMarks.length=0;
    player.x=120; player.y=GY-42; player.vy=0; player.onGround=true; player.jumps=0; player.maxJumps=1;
    ELscore.textContent = `Score: ${score}`;
    setLevel();
  }

  function update(){
    frame++;
    if(running && !paused && !gameOver){
      // aceleração suave e “andar”
      speed = Math.min(baseSpeed + 1.4, speed + .003);
      const targetX = CL(W * (0.26 + (level-1)*0.02), 60, W*0.45);
      player.x = LERP(player.x, targetX, 0.025 + (level-1)*0.003);

      // >>> pulo com baixa latência: consome logo no começo do frame
      if (jumpQueued) {
        if (tryConsumeJump()) jumpQueued = false;
      }

      // física básica
      player.vy += player.gravity;
      player.y  += player.vy;

      // aterrissagem
      if(player.y + player.h >= GY){
        if(!player.onGround){
          for(let i=0;i<10;i++)
            parts.push({x:player.x+player.w/2,y:GY-2,vx:R(-2,2),vy:R(-3,-1),life:R(20,40),c:"#d7b46a"});
        }
        player.y = GY - player.h;
        player.vy = 0;
        player.onGround = true;
        player.jumps = 0;
        lastGroundedAt = performance.now();
      } else {
        if (player.onGround) lastGroundedAt = performance.now();
        player.onGround = false;
      }

      // mantém jump na fila por alguns ms
      if (jumpQueued) {
        if (tryConsumeJump()) jumpQueued = false;
        else if (performance.now() - lastJumpPressedAt > JUMP_BUFFER_MS) jumpQueued = false;
      }

      // pulo duplo contextual perto de obstáculo alto
      const n = nearObs();
      if(n){
        const tall = (n.type==="cactus" && n.h>=60) || (n.type==="barbed" && n.h>=34);
        const d = n.x - (player.x + player.w);
        player.maxJumps = (tall && d < Math.max(180, W*0.25)) ? 2 : 1;
      } else player.maxJumps = 1;

      // spawns
      if(++tObs>=spawnInt){ tObs=0; spObstacle(); }
      if(++tCloud>=120){ tCloud=0; if(Math.random()<.9) spCloud(); }
      if(++tEgg>=Math.max(300,360-level*10)){ tEgg=0; if(Math.random()<.85) spEgg(); }
      if(++tMark>=12){ tMark=0; if(Math.random()<.7) spGroundMark(); }

      // atualizar objetos
      for(let i=obs.length-1;i>=0;i--){
        const o=obs[i]; o.x -= speed; if(o.type==="barbed") o.rot=(o.rot||0)+.09;
        if(hit(player,o)){
          running=false; gameOver=true;
          if(score>best){ best=score; localStorage.setItem("runner_highscore",best); ELbest.textContent=`🏆 High: ${best}`; }
        }
        if(o.x+o.w<0){ obs.splice(i,1); score++; obstaclesCleared++; ELscore.textContent=`Score: ${score}`; setLevel(); }
      }
      for(let i=eggs.length-1;i>=0;i--){
        const e=eggs[i]; e.x -= speed;
        if(!e.got && hit(player,e)){
          e.got=true; score+=5; ELscore.textContent=`Score: ${score}`;
          for(let p=0;p<20;p++) parts.push({x:e.x+e.w/2,y:e.y,vx:R(-1.5,1.5),vy:R(-2,-1),life:R(20,40),c:"#fff176"});
        }
        if(e.x+e.w<0 || e.got) eggs.splice(i,1);
      }
      for(let i=clouds.length-1;i>=0;i--){
        const c=clouds[i]; c.x -= c.spd; if(c.x+80<0) clouds.splice(i,1);
      }
      for(let i=parts.length-1;i>=0;i--){
        const p=parts[i]; p.x+=p.vx; p.y+=p.vy; p.life--; if(p.life<=0) parts.splice(i,1);
      }
      for(let i=groundMarks.length-1;i>=0;i--){
        const g=groundMarks[i]; g.x -= speed; if(g.x+g.w<0) groundMarks.splice(i,1);
      }
    }

    // desenho
    drawBG();
    for(const c of clouds) X.fillStyle="#cfe3ff", X.fillRect(c.x,c.y,60,18);
    for(const m of groundMarks) X.fillStyle="#caa86a", X.fillRect(m.x,m.y,m.w,m.h);
    for(const e of eggs) drawEgg(e);
    for(const o of obs) drawObstacle(o);
    drawOstrich();
    drawParticles();
    drawOverlays();

    requestAnimationFrame(update);
  }

  function initialDraw(){ drawBG(); drawOverlays(); }

  // ===== Controles / Eventos =====
  document.addEventListener('keydown', (e)=>{
    if(e.code==='Space'){ e.preventDefault(); (gameOver||!running) ? reset() : queueJump(); }
    else if(e.code==='KeyP'){ paused=!paused; }
  }, {passive:false});

  const canvasPointerDown = (ev)=>{
    const now = performance.now();
    if (now - lastTapAt < 250) { ev.preventDefault?.(); return; } // evita double-tap zoom
    lastTapAt = now;
    ev.preventDefault?.();
    (gameOver||!running) ? reset() : queueJump();
  };
  C.addEventListener('pointerdown', canvasPointerDown, {passive:false});
  if (BJump) BJump.addEventListener('pointerdown', canvasPointerDown, {passive:false});

  BStart.addEventListener('click', ()=> reset());
  BPause.addEventListener('click', ()=> paused=!paused);
  BFS.addEventListener('click', ()=>{
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  // ===== Start =====
  initialDraw();
  requestAnimationFrame(update);
})();
