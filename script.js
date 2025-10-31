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

  // ====== DIMENSÕES RESPONSIVAS ======
  let W = 800, H = 300, GROUND_Y = H - 40;
  function resizeCanvas() {
    const wrap = CANVAS.parentElement;
    const cssWidth = wrap.clientWidth;
    const cssHeight = wrap.clientHeight;
    const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    CANVAS.width = Math.floor(cssWidth * dpr);
    CANVAS.height = Math.floor(cssHeight * dpr);
    CANVAS.style.width = cssWidth + "px";
    CANVAS.style.height = cssHeight + "px";
    CTX.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = cssWidth;
    H = cssHeight;
    GROUND_Y = H - 40;
    if (player && player.y + player.h > GROUND_Y) {
      player.y = GROUND_Y - player.h;
      player.vy = 0;
      player.onGround = true;
    }
  }

  // ====== ÁUDIO ======
  let actx, musicGain, sfxGain;
  let musicMuted = false;
  let musicTimer = null;
  let musicPlaying = false;

  function initAudio() {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      musicGain = actx.createGain();
      musicGain.gain.value = 0.9;
      sfxGain = actx.createGain();
      sfxGain.gain.value = 1.0;
      musicGain.connect(actx.destination);
      sfxGain.connect(actx.destination);
    }
  }

  // nota curta 8-bit
  function playNote(freq = 330, durMs = 160, vol = 0.06) {
    if (!actx || !musicPlaying || musicMuted) return;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(freq, actx.currentTime);
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + durMs / 1000);
    o.connect(g).connect(musicGain);
    o.start();
    o.stop(actx.currentTime + durMs / 1000 + 0.02);
  }

  // melodia “aventura no deserto”
  const DESERT_MELODY = [
    [220, 160, 40], [262, 160, 40], [330, 200, 60], [392, 160, 40],
    [349, 160, 40], [330, 200, 80], [294, 160, 40], [262, 220, 120],
    [196, 160, 40], [220, 160, 40], [262, 200, 60], [294, 160, 40],
    [330, 160, 40], [392, 200, 80], [349, 160, 40], [330, 240, 160],
  ];

  function startMusicLoop() {
    if (!actx) return;
    if (musicTimer) clearTimeout(musicTimer);
    musicPlaying = true;
    let i = 0;
    const tick = () => {
      if (!running || paused || gameOver || musicMuted) {
        musicTimer = setTimeout(tick, 120);
        return;
      }
      const [f, d, gap] = DESERT_MELODY[i % DESERT_MELODY.length];
      playNote(f, d, 0.06);
      i++;
      musicTimer = setTimeout(tick, d + gap);
    };
    musicTimer = setTimeout(tick, 0);
  }

  function pauseMusic() {
    if (actx && actx.state === "running") actx.suspend().catch(() => {});
  }
  function resumeMusic() {
    if (actx && actx.state === "suspended") actx.resume().catch(() => {});
  }
  function stopMusic() {
    musicPlaying = false;
    if (musicTimer) clearTimeout(musicTimer);
  }
  function toggleMute() {
    musicMuted = !musicMuted;
    BTN_MUTE.textContent = musicMuted ? "🔇 Mudo" : "🔊 Som";
    if (musicGain) musicGain.gain.value = musicMuted ? 0 : 0.9;
  }

  function jumpSound() {
    if (!actx) return;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(440, actx.currentTime);
    g.gain.setValueAtTime(0.12, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.12);
    o.connect(g).connect(sfxGain);
    o.start();
    o.stop(actx.currentTime + 0.12);
  }

  // ====== ENTIDADES ======
  const player = { x: 80, y: GROUND_Y - 42, w: 46, h: 42, vy: 0, gravity: 0.9, jumpForce: 14,
    onGround: true, jumps: 0, maxJumps: 1, legPhase: 0, wingPhase: 0, neckPhase: 0 };
  const obstacles = [], clouds = [], eggs = [], particles = [];

  // ====== ESTADO ======
  let spawnTimer = 0, cloudTimer = 0, eggTimer = 0;
  let spawnInterval = 90;
  let running = false, paused = false, gameOver = false;
  let score = 0, level = 1;
  let baseSpeed = 4.2, speed = baseSpeed;
  let frame = 0, isNight = false;
  let best = Number(localStorage.getItem("runner_highscore") || 0);
  BEST_EL.textContent = `🏆 High: ${best}`;

  const rng = (a,b)=>Math.random()*(b-a)+a;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const collide=(a,b)=>a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;

  function resetGame() {
    obstacles.length=clouds.length=eggs.length=particles.length=0;
    spawnTimer=cloudTimer=eggTimer=0; spawnInterval=90;
    running=true; paused=false; gameOver=false;
    score=0; level=1; baseSpeed=4.2; speed=baseSpeed; frame=0; isNight=false;
    player.y=GROUND_Y-player.h; player.vy=0; player.onGround=true; player.jumps=0;
    SCORE_EL.textContent=`Score: ${score}`; LEVEL_EL.textContent=`Nível: ${level} (Dia)`;
    BTN_PAUSE.textContent="Pausar (P)";
    initAudio(); resumeMusic(); startMusicLoop();
  }

  function doJump() {
    if(!running||paused)return;
    if(player.onGround||player.jumps<player.maxJumps){
      player.vy=-player.jumpForce; player.onGround=false; player.jumps++;
      jumpSound();
    }
  }

  document.addEventListener("keydown", e=>{
    if(e.code==="Space"){ e.preventDefault();
      if(gameOver||!running) resetGame(); else doJump();
    } else if(e.code==="KeyP") togglePause();
  });
  CANVAS.addEventListener("pointerdown", ()=> gameOver||!running ? resetGame() : doJump());
  BTN_START.addEventListener("click", ()=> gameOver||!running ? resetGame() : null);
  BTN_PAUSE.addEventListener("click", togglePause);
  BTN_MUTE.addEventListener("click", toggleMute);

  function togglePause() {
    if(!running||gameOver)return;
    paused=!paused;
    BTN_PAUSE.textContent=paused?"Retomar (P)":"Pausar (P)";
    if(paused) pauseMusic(); else resumeMusic();
  }

  // ====== SPAWNERS ======
  function spawnObstacle(){
    const r=Math.random();
    if(r<0.6){
      const h=rng(32,88),w=rng(18,26);
      obstacles.push({type:"cactus",x:W+20,y:GROUND_Y-h,w,h});
    } else {
      const s=rng(24,40);
      obstacles.push({type:"barbed",x:W+20,y:GROUND_Y-s,w:s,h:s,rot:0});
    }
  }
  function spawnCloud(){
    const s=rng(0.6,1.2);
    clouds.push({x:W+30,y:rng(30,120),scale:s,speed:rng(0.4,0.9)});
  }
  function spawnEgg(){ eggs.push({x:W+20,y:GROUND_Y-60,w:20,h:26,collected:false}); }

  // ====== NÍVEIS ======
  function computeLevel(){
    const newLevel=Math.floor(score/10)+1;
    if(newLevel!==level){
      level=newLevel; isNight=(level%2===0);
      baseSpeed=4.2+(level-1)*0.9; speed=baseSpeed;
      spawnInterval=Math.max(52,90-(level-1)*4);
      LEVEL_EL.textContent=`Nível: ${level} (${isNight?"Noite":"Dia"})`;
      for(let i=0;i<40;i++)
        particles.push({x:rng(0,W),y:rng(0,H/2),vx:rng(-1,1),vy:rng(-1,1),life:rng(30,60),color:isNight?"#fff":"#ffeb3b"});
    }
  }

  // ====== LOOP ======
  function update(){
    frame++;
    if(running&&!paused&&!gameOver){
      speed=clamp(speed+0.0025,baseSpeed,baseSpeed+1.2);
      player.vy+=player.gravity; player.y+=player.vy;
      if(player.y+player.h>=GROUND_Y){
        if(!player.onGround)
          for(let i=0;i<10;i++)
            particles.push({x:player.x+player.w/2,y:GROUND_Y-2,vx:rng(-2,2),vy:rng(-3,-1),life:rng(20,40),color:"#d7b46a"});
        player.y=GROUND_Y-player.h; player.vy=0; player.onGround=true; player.jumps=0;
      }

      if(++spawnTimer>=spawnInterval){spawnTimer=0;spawnObstacle();}
      if(++cloudTimer>=120){cloudTimer=0;if(Math.random()<0.9)spawnCloud();}
      if(++eggTimer>=Math.max(300,360-level*10)){eggTimer=0;if(Math.random()<0.85)spawnEgg();}

      for(let i=obstacles.length-1;i>=0;i--){
        const o=obstacles[i]; o.x-=speed; if(o.type==="barbed")o.rot=(o.rot||0)+0.08;
        if(collide(player,o)){
          running=false;gameOver=true;stopMusic();
          if(score>best){best=score;localStorage.setItem("runner_highscore",best);BEST_EL.textContent=`🏆 High: ${best}`;}
        }
        if(o.x+o.w<0){obstacles.splice(i,1);score++;SCORE_EL.textContent=`Score: ${score}`;computeLevel();}
      }

      for(let i=eggs.length-1;i>=0;i--){
        const e=eggs[i]; e.x-=speed;
        if(!e.collected&&collide(player,e)){
          e.collected=true; score+=5; SCORE_EL.textContent=`Score: ${score}`;
          for(let p=0;p<20;p++)
            particles.push({x:e.x+e.w/2,y:e.y,vx:rng(-1.5,1.5),vy:rng(-2,-1),life:rng(20,50),color:"#fff176"});
        }
        if(e.x+e.w<0||e.collected)eggs.splice(i,1);
      }

      clouds.forEach((c,i)=>{c.x-=c.speed;if(c.x<-120)clouds.splice(i,1);});
      particles.forEach((p,i)=>{p.x+=p.vx;p.y+=p.vy;p.life--;if(p.life<=0)particles.splice(i,1);});
    }

    draw();
    requestAnimationFrame(update);
  }

  // ====== DESENHO ======
  function drawBackground(){
    const dayGrad=CTX.createLinearGradient(0,0,0,H);
    dayGrad.addColorStop(0,"#87CEEB");dayGrad.addColorStop(1,"#fceabb");
    const nightGrad=CTX.createLinearGradient(0,0,0,H);
    nightGrad.addColorStop(0,"#20053d");nightGrad.addColorStop(1,"#301860");
    CTX.fillStyle=isNight?nightGrad:dayGrad;CTX.fillRect(0,0,W,H);
    if(isNight){CTX.fillStyle="#fff";
      for(let i=0;i<40;i++){const x=(i*37+(frame%37)*3)%W,y=(i*11)%Math.max(80,H*0.35);CTX.fillRect(x,y,1,1);}
      CTX.beginPath();CTX.arc(W-80,60,16,0,Math.PI*2);CTX.fillStyle="#f5f3ce";CTX.fill();}
    clouds.forEach(drawCloud);
    CTX.fillStyle="#d7b46a";CTX.fillRect(0,GROUND_Y,W,H-GROUND_Y);
  }

  function drawCloud(c){
    CTX.save();CTX.translate(c.x,c.y);CTX.scale(c.scale,c.scale);
    CTX.fillStyle="rgba(255,255,255,0.85)";
    CTX.beginPath();CTX.arc(0,0,16,0,Math.PI*2);CTX.arc(16,-6,20,0,Math.PI*2);CTX.arc(34,0,16,0,Math.PI*2);CTX.fill();CTX.restore();
  }

  function drawOstrich(){
    const x=player.x,y=player.y,w=player.w,h=player.h;
    player.legPhase+=player.onGround?speed*0.18:0.06;player.wingPhase+=0.3;player.neckPhase+=0.1;
    const wing=Math.sin(player.wingPhase)*6,neck=Math.sin(player.neckPhase)*2;
    CTX.save();CTX.translate(x,y);CTX.fillStyle=isNight?"#eee":"#444";
    CTX.beginPath();CTX.ellipse(w*0.42,h*0.55,w*0.32,h*0.28,0,0,Math.PI*2);CTX.fill();
    CTX.save();CTX.translate(w*0.55+neck,h*0.10);CTX.fillRect(0,0,w*0.08,h*0.40);CTX.restore();
    CTX.beginPath();CTX.arc(w*0.63+neck,h*0.10,w*0.10,0,Math.PI*2);CTX.fill();
    CTX.fillRect(w*0.70+neck,h*0.10-3,w*0.16,6);
    CTX.fillStyle=isNight?"#0c1230":"#fff";CTX.fillRect(w*0.61+neck,h*0.06,3,3);
    CTX.fillStyle=isNight?"#0c1230":"#111";CTX.fillRect(w*0.62+neck,h*0.07,1.5,1.5);
    CTX.save();CTX.translate(w*0.3,h*0.4);CTX.rotate(wing*Math.PI/180);
    CTX.beginPath();CTX.ellipse(0,0,w*0.3,h*0.15,0,0,Math.PI*2);CTX.fill();CTX.restore();
    const a=Math.sin(player.legPhase)*6;
    CTX.save();CTX.translate(w*0.38,h*0.70);CTX.rotate(a*Math.PI/180);CTX.fillRect(-2,0,4,h*0.30);CTX.restore();
    CTX.save();CTX.translate(w*0.48,h*0.70);CTX.rotate(-a*Math.PI/180);CTX.fillRect(-2,0,4,h*0.30);CTX.restore();
    CTX.restore();
  }

  function drawObstacle(o){
    if(o.type==="cactus"){
      CTX.fillStyle="#388e3c";CTX.fillRect(o.x,o.y,o.w,o.h);
      CTX.fillRect(o.x-4,o.y+10,4,o.h-10);CTX.fillRect(o.x+o.w,o.y+14,4,o.h-14);
    }else{
      CTX.save();CTX.translate(o.x+o.w/2,o.y+o.h/2);CTX
