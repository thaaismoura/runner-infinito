(() => {
  // ====== ELEMENTOS E HUD ======
  const CANVAS = document.getElementById("game");
  const CTX = CANVAS.getContext("2d");
  const SCORE_EL = document.getElementById("score");
  const LEVEL_EL = document.getElementById("level");
  const BEST_EL = document.getElementById("best");
  const BTN_START = document.getElementById("btnStart");
  const BTN_PAUSE = document.getElementById("btnPause");
  const BTN_MUTE = document.getElementById("btnMute");

  // ====== CONSTANTES ======
  const W = CANVAS.width;
  const H = CANVAS.height;
  const GROUND_Y = H - 40;

  // ====== ÁUDIO ======
  let actx, musicGain, musicNode;
  let musicMuted = false;

  function initAudio() {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      musicGain = actx.createGain();
      musicGain.connect(actx.destination);
      startMusic();
    }
  }

  // música de fundo retrô
  function startMusic() {
    if (musicNode) musicNode.stop();
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    const freqSeq = [220, 330, 440, 392, 330, 220, 262, 196];
    let i = 0;
    const playNote = () => {
      if (!running || paused || musicMuted) return;
      osc.frequency.setValueAtTime(freqSeq[i % freqSeq.length], actx.currentTime);
      i++;
      setTimeout(playNote, 200);
    };
    osc.type = "square";
    gain.gain.value = 0.05;
    osc.connect(gain).connect(musicGain);
    osc.start();
    musicNode = osc;
    playNote();
  }

  function toggleMute() {
    musicMuted = !musicMuted;
    BTN_MUTE.textContent = musicMuted ? "🔇 Mudo" : "🔊 Som";
    if (musicGain) musicGain.gain.value = musicMuted ? 0 : 1;
  }

  function jumpSound() {
    try {
      if (!actx) return;
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(440, actx.currentTime);
      g.gain.setValueAtTime(0.12, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.12);
      o.connect(g).connect(actx.destination);
      o.start();
      o.stop(actx.currentTime + 0.12);
    } catch {}
  }

  // ====== PLAYER ======
  const player = {
    x: 80, y: GROUND_Y - 42, w: 46, h: 42,
    vy: 0, gravity: 0.9, jumpForce: 14,
    onGround: true, jumps: 0, maxJumps: 1,
    legPhase: 0, wingPhase: 0, neckPhase: 0,
    color: "#444"
  };

  // ====== LISTAS ======
  const obstacles = [];
  const clouds = [];
  const eggs = [];
  const particles = [];

  // ====== ESTADO ======
  let spawnTimer = 0, cloudTimer = 0, eggTimer = 0;
  let spawnInterval = 90;
  let running = false, paused = false, gameOver = false;
  let score = 0, level = 1, baseSpeed = 5.6, speed = baseSpeed, frame = 0;
  let isNight = false;
  let best = Number(localStorage.getItem("runner_highscore") || 0);
  BEST_EL.textContent = `🏆 High: ${best}`;

  // ====== FUNÇÕES UTIL ======
  const rng = (a,b)=>Math.random()*(b-a)+a;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const hitbox=(r,i=3)=>({x:r.x+i,y:r.y+i,w:r.w-i*2,h:r.h-i*2});
  const collide=(a,b)=>{const A=hitbox(a,5),B=hitbox(b,2);
    return A.x<A.w+B.x&&A.x+A.w>B.x&&A.y<A.h+B.y&&A.y+A.h>B.y};

  // ====== RESET ======
  function resetGame(){
    obstacles.length=0; clouds.length=0; eggs.length=0; particles.length=0;
    spawnTimer=0; cloudTimer=0; eggTimer=0;
    spawnInterval=90; running=true; paused=false; gameOver=false;
    score=0; level=1; baseSpeed=5.6; speed=baseSpeed; frame=0; isNight=false;
    player.y=GROUND_Y-player.h; player.vy=0; player.onGround=true;
    player.jumps=0; player.maxJumps=1;
    SCORE_EL.textContent=`Score: ${score}`;
    LEVEL_EL.textContent=`Nível: ${level} (Dia)`;
    BTN_PAUSE.textContent="Pausar (P)";
    BTN_PAUSE.setAttribute("aria-pressed","false");
    initAudio();
  }

  // ====== ENTRADAS ======
  function doJump(){
    if(!running||paused)return;
    if(player.onGround||player.jumps<player.maxJumps){
      player.vy=-player.jumpForce;
      player.onGround=false; player.jumps++;
      jumpSound();
    }
  }

  document.addEventListener("keydown",e=>{
    if(e.code==="Space"){if(gameOver)resetGame();
      else if(!running)resetGame();else doJump();e.preventDefault();}
    else if(e.code==="KeyP")togglePause();
  });
  CANVAS.addEventListener("pointerdown",()=>{if(gameOver)resetGame();
    else if(!running)resetGame();else doJump();});
  BTN_START.addEventListener("click",()=>{if(!running||gameOver)resetGame();});
  BTN_PAUSE.addEventListener("click",togglePause);
  BTN_MUTE.addEventListener("click",toggleMute);

  function togglePause(){
    if(!running||gameOver)return;
    paused=!paused;
    BTN_PAUSE.textContent=paused?"Retomar (P)":"Pausar (P)";
    BTN_PAUSE.setAttribute("aria-pressed",paused?"true":"false");
    if(paused&&musicNode)actx.suspend();else actx.resume();
  }

  // ====== SPAWNERS ======
  function spawnObstacle(){
    const r=Math.random();
    if(r<0.6){
      const h=rng(32,88),w=rng(18,26);
      obstacles.push({type:"cactus",x:W+20,y:GROUND_Y-h,w,h,color:"#2e7d32"});
    }else{
      const s=rng(24,40);
      obstacles.push({type:"barbed",x:W+20,y:GROUND_Y-s,w:s,h:s,rot:0,color:"#555"});
    }
  }
  function spawnCloud(){const s=rng(0.6,1.2);
    clouds.push({x:W+30,y:rng(30,120),scale:s,speed:rng(0.4,0.9)});}
  function spawnEgg(){
    eggs.push({x:W+20,y:GROUND_Y-60,w:20,h:26,collected:false});
  }
  // ====== PART 2 ======

  // ====== NÍVEIS ======
  function computeLevel(){
    const newLevel=Math.floor(score/10)+1;
    if(newLevel!==level){
      level=newLevel;
      isNight=(level%2===0);
      baseSpeed=5.6+(level-1)*0.8;
      speed=baseSpeed;
      spawnInterval=Math.max(52,90-(level-1)*4);
      LEVEL_EL.textContent=`Nível: ${level} (${isNight?"Noite":"Dia"})`;
      // partículas ao subir de nível
      for(let i=0;i<40;i++){
        particles.push({
          x:rng(0,W),y:rng(0,H/2),vx:rng(-1,1),
          vy:rng(-1,1),life:rng(30,60),color:isNight?"#fff":"#ffeb3b"
        });
      }
    }
  }

  function nearestObstacle(){
    let near=null;
    for(const o of obstacles){
      if(o.x+o.w<player.x)continue;
      if(!near||o.x<near.x)near=o;
    }
    return near;
  }

  // ====== LOOP ======
  function update(){
    frame++;
    if(running&&!paused&&!gameOver){
      speed=clamp(speed+0.0025,baseSpeed,baseSpeed+1.2);
      player.vy+=player.gravity;
      player.y+=player.vy;
      if(player.y+player.h>=GROUND_Y){
        if(!player.onGround){
          // partículas de areia
          for(let i=0;i<10;i++){
            particles.push({
              x:player.x+player.w/2,y:GROUND_Y-2,
              vx:rng(-2,2),vy:rng(-3,-1),
              life:rng(20,40),color:"#d7b46a"
            });
          }
        }
        player.y=GROUND_Y-player.h;
        player.vy=0;
        player.onGround=true;
        player.jumps=0;
      }

      const near=nearestObstacle();
      if(near){
        const tall=(near.type==="cactus"&&near.h>=60)||(near.type==="barbed"&&near.h>=34);
        const dist=near.x-(player.x+player.w);
        player.maxJumps=(tall&&dist<240)?2:1;
      }else player.maxJumps=1;

      spawnTimer++;
      if(spawnTimer>=spawnInterval){spawnTimer=0;spawnObstacle();}
      cloudTimer++;
      if(cloudTimer>=120){cloudTimer=0;if(Math.random()<0.9)spawnCloud();}
      eggTimer++;
      if(eggTimer>=400){eggTimer=0;if(Math.random()<0.8)spawnEgg();}

      // move obstáculos
      for(let i=obstacles.length-1;i>=0;i--){
        const o=obstacles[i];
        o.x-=speed;if(o.type==="barbed")o.rot+=0.08;
        if(collide(player,o)){
          running=false;gameOver=true;
          if(score>best){
            best=score;
            localStorage.setItem("runner_highscore",String(best));
            BEST_EL.textContent=`🏆 High: ${best}`;
          }
        }
        if(o.x+o.w<0){
          obstacles.splice(i,1);score++;SCORE_EL.textContent=`Score: ${score}`;computeLevel();
        }
      }

      // move ovos
      for(let i=eggs.length-1;i>=0;i--){
        const e=eggs[i];e.x-=speed;
        if(!e.collected&&collide(player,e)){
          e.collected=true;
          score+=5;
          SCORE_EL.textContent=`Score: ${score}`;
          for(let p=0;p<20;p++){
            particles.push({
              x:e.x+e.w/2,y:e.y, vx:rng(-1.5,1.5),vy:rng(-2,-1),
              life:rng(20,50),color:"#fff176"
            });
          }
        }
        if(e.x+e.w<0||e.collected)eggs.splice(i,1);
      }

      // move nuvens
      for(let i=clouds.length-1;i>=0;i--){
        const c=clouds[i];
        c.x-=c.speed;if(c.x<-120)clouds.splice(i,1);
      }

      // partículas
      for(let i=particles.length-1;i>=0;i--){
        const p=particles[i];
        p.x+=p.vx;p.y+=p.vy;p.life--;
        if(p.life<=0)particles.splice(i,1);
      }
    }
    draw();requestAnimationFrame(update);
  }

  // ====== DESENHO ======
  function drawBackground(){
    const dayGrad=CTX.createLinearGradient(0,0,0,H);
    dayGrad.addColorStop(0,"#87CEEB");
    dayGrad.addColorStop(1,"#fceabb");
    const nightGrad=CTX.createLinearGradient(0,0,0,H);
    nightGrad.addColorStop(0,"#20053d");
    nightGrad.addColorStop(1,"#301860");
    CTX.fillStyle=isNight?nightGrad:dayGrad;
    CTX.fillRect(0,0,W,H);
    if(isNight){
      CTX.fillStyle="#fff";
      for(let i=0;i<40;i++){
        const x=(i*37+(frame%37)*3)%W,y=(i*11)%120;
        CTX.fillRect(x,y,1,1);
      }
      CTX.beginPath();
      CTX.arc(W-80,60,16,0,Math.PI*2);
      CTX.fillStyle="#f5f3ce";CTX.fill();
    }
    for(const c of clouds)drawCloud(c);
    CTX.fillStyle="#d7b46a";
    CTX.fillRect(0,GROUND_Y,W,H-GROUND_Y);
  }

  function drawCloud(c){
    CTX.save();CTX.translate(c.x,c.y);CTX.scale(c.scale,c.scale);
    CTX.fillStyle=isNight?"rgba(255,255,255,0.8)":"rgba(255,255,255,0.7)";
    CTX.beginPath();
    CTX.arc(0,0,16,0,Math.PI*2);
    CTX.arc(16,-6,20,0,Math.PI*2);
    CTX.arc(34,0,16,0,Math.PI*2);
    CTX.fill();CTX.restore();
  }

  function drawOstrich(){
    const x=player.x,y=player.y,w=player.w,h=player.h;
    player.legPhase+=player.onGround?speed*0.18:0.06;
    player.wingPhase+=0.3;player.neckPhase+=0.1;
    const wing=Math.sin(player.wingPhase)*6;
    const neck=Math.sin(player.neckPhase)*2;
    CTX.save();CTX.translate(x,y);
    CTX.fillStyle=isNight?"#eee":"#444";
    CTX.beginPath();
    CTX.ellipse(w*0.42,h*0.55,w*0.32,h*0.28,0,0,Math.PI*2);
    CTX.fill();
    // pescoço
    CTX.save();CTX.translate(w*0.55+neck,h*0.10);
    CTX.fillRect(0,0,w*0.08,h*0.40);CTX.restore();
    // cabeça
    CTX.beginPath();CTX.arc(w*0.63+neck,h*0.10,w*0.10,0,Math.PI*2);CTX.fill();
    // bico
    CTX.fillRect(w*0.70+neck,h*0.10-3,w*0.16,6);
    // asas
    CTX.save();CTX.translate(w*0.3,h*0.4);
    CTX.rotate(wing*Math.PI/180);
    CTX.beginPath();CTX.ellipse(0,0,w*0.3,h*0.15,0,0,Math.PI*2);CTX.fill();CTX.restore();
    // pernas
    const a=Math.sin(player.legPhase)*6;
    CTX.save();CTX.translate(w*0.38,h*0.70);CTX.rotate(a*Math.PI/180);
    CTX.fillRect(-2,0,4,h*0.30);CTX.restore();
    CTX.save();CTX.translate(w*0.48,h*0.70);CTX.rotate(-a*Math.PI/180);
    CTX.fillRect(-2,0,4,h*0.30);CTX.restore();
    CTX.restore();
  }

  function drawObstacle(o){
    if(o.type==="cactus"){
      CTX.fillStyle="#388e3c";
      CTX.fillRect(o.x,o.y,o.w,o.h);
      CTX.fillRect(o.x-4,o.y+10,4,o.h-10);
      CTX.fillRect(o.x+o.w,o.y+14,4,o.h-14);
    }else{
      CTX.save();CTX.translate(o.x+o.w/2,o.y+o.h/2);CTX.rotate(o.rot);
      CTX.strokeStyle="#222";CTX.fillStyle=o.color;
      CTX.beginPath();CTX.arc(0,0,o.w/2-3,0,Math.PI*2);CTX.fill();
      CTX.beginPath();
      for(let i=0;i<10;i++){
        const ang=(i/10)*Math.PI*2;
        const r1=o.w/2-2,r2=o.w/2+6;
        CTX.moveTo(Math.cos(ang)*r1,Math.sin(ang)*r1);
        CTX.lineTo(Math.cos(ang)*r2,Math.sin(ang)*r2);
      }
      CTX.stroke();CTX.restore();
    }
  }

  function drawEgg(e){
    CTX.fillStyle="#fff176";
    CTX.beginPath();
    CTX.ellipse(e.x+e.w/2,e.y+e.h/2,10,13,0,0,Math.PI*2);
    CTX.fill();
  }

  function drawParticles(){
    for(const p of particles){
      CTX.fillStyle=p.color;
      CTX.fillRect(p.x,p.y,2,2);
    }
  }

  function drawOverlays(){
    if(paused&&running&&!gameOver){
      CTX.fillStyle="rgba(0,0,0,0.4)";
      CTX.fillRect(0,0,W,H);
      CTX.fillStyle="#fff";CTX.font="bold 28px system-ui";
      CTX.textAlign="center";
      CTX.fillText("PAUSADO",W/2,H/2-8);
      CTX.font="16px system-ui";
      CTX.fillText("Pressione P para retomar",W/2,H/2+24);
    }
    if(gameOver){
      CTX.fillStyle="rgba(0,0,0,0.6)";
      CTX.fillRect(0,0,W,H);
      CTX.fillStyle="#fff";CTX.font="bold 28px system-ui";
      CTX.textAlign="center";
      CTX.fillText("Game Over",W/2,H/2-8);
      CTX.font="16px system-ui";
      CTX.fillText("Espaço/Toque para Reiniciar",W/2,H/2+24);
    }
    if(!running&&!gameOver){
      CTX.fillStyle=isNight?"#fff":"#111";
      CTX.font="16px system-ui";
      CTX.textAlign="left";
      CTX.fillText("Pressione Espaço ou Clique para começar",16,28);
    }
  }

  function draw(){
    drawBackground();
    for(const e of eggs)drawEgg(e);
    for(const o of obstacles)drawObstacle(o);
    drawOstrich();
    drawParticles();
    drawOverlays();
  }

  // ====== START ======
  draw();
  requestAnimationFrame(update);
})();
