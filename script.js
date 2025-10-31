(() => {
  // ====== ELEMENTOS / HUD ======
  const C = document.getElementById("game"), X = C.getContext("2d");
  const ELscore = document.getElementById("score");
  const ELlevel = document.getElementById("level");
  const ELbest  = document.getElementById("best");
  const BStart  = document.getElementById("btnStart");
  const BPause  = document.getElementById("btnPause");
  const BMute   = document.getElementById("btnMute");

  // ====== DIMENSÕES (responsivo c/ HiDPI) ======
  let W = 800, H = 300, GY = H - 40;
  function resize() {
    const wrap = C.parentElement;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    C.width = Math.floor(w * dpr); C.height = Math.floor(h * dpr);
    C.style.width = w + "px"; C.style.height = h + "px";
    X.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = w; H = h; GY = H - 40;
    if (player && player.y + player.h > GY) { player.y = GY - player.h; player.vy = 0; player.onGround = true; }
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);

  // ====== ÁUDIO ======
  let actx, gMusic, gSfx, muted = false, musicTimer = null, musicOn = false;
  function initAudio() {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
    gMusic = actx.createGain(); gMusic.gain.value = 0.9; gMusic.connect(actx.destination);
    gSfx   = actx.createGain(); gSfx.gain.value   = 1.0; gSfx.connect(actx.destination);
  }
  // toca nota curta 8-bit
  function note(freq, dur = 160, vol = .06) {
    if (!actx || !musicOn || muted) return;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = "square"; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur / 1000);
    o.connect(g).connect(gMusic); o.start(); o.stop(actx.currentTime + dur / 1000 + .02);
  }
  // melodia 8-bit “aventura no deserto”
  const THEME = [
    [220,160,40],[262,160,40],[330,200,60],[392,160,40],
    [349,160,40],[330,200,80],[294,160,40],[262,220,120],
    [196,160,40],[220,160,40],[262,200,60],[294,160,40],
    [330,160,40],[392,200,80],[349,160,40],[330,240,160],
  ];
  function startMusic() {
    if (!actx) return;
    stopMusic(); musicOn = true; let i = 0;
    const tick = () => {
      if (!running || paused || gameOver || muted) { musicTimer = setTimeout(tick, 120); return; }
      const [f,d,g] = THEME[i % THEME.length]; note(f,d,.06); i++; musicTimer = setTimeout(tick, d + g);
    };
    musicTimer = setTimeout(tick, 0);
  }
  function stopMusic(){ musicOn = false; if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; } }
  function pauseMusic(){ if (actx && actx.state === "running") actx.suspend().catch(()=>{}); }
  function resumeMusic(){ if (actx && actx.state === "suspended") actx.resume().catch(()=>{}); }
  function toggleMute(){ muted = !muted; BMute.textContent = muted ? "🔇 Mudo" : "🔊 Som"; if (gMusic) gMusic.gain.value = muted ? 0 : .9; }
  // SFX pulo
  function sfxJump(){
    if (!actx) return;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type="square"; o.frequency.value=440; g.gain.value=.12;
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + .12);
    o.connect(g).connect(gSfx); o.start(); o.stop(actx.currentTime + .12);
  }

  // ====== ENTIDADES ======
  const player = { x:80, y:GY-42, w:46, h:42, vy:0, gravity:.9, jump:14, onGround:true, jumps:0, maxJumps:1, leg:0, wing:0, neck:0 };
  const obs = [], clouds = [], eggs = [], parts = [];

  // ====== ESTADO ======
  let tObs=0, tCloud=0, tEgg=0, spawnInt=90;
  let running=false, paused=false, gameOver=false;
  let score=0, level=1, baseSpeed=4.2, speed=baseSpeed, frame=0, night=false;
  let best = Number(localStorage.getItem("runner_highscore")||0); ELbest.textContent = `🏆 High: ${best}`;

  // ====== UTILS ======
  const R=(a,b)=>Math.random()*(b-a)+a, CL=(v,a,b)=>Math.max(a,Math.min(b,v));
  const hit=(a,b)=>a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;

  // ====== RESET ======
  function reset(){
    obs.length=clouds.length=eggs.length=parts.length=0;
    tObs=tCloud=tEgg=0; spawnInt=90;
    running=true; paused=false; gameOver=false;
    score=0; level=1; baseSpeed=4.2; speed=baseSpeed; frame=0; night=false;
    player.y=GY-player.h; player.vy=0; player.onGround=true; player.jumps=0; player.maxJumps=1;
    ELscore.textContent=`Score: ${score}`; ELlevel.textContent=`Nível: ${level} (Dia)`; BPause.textContent="Pausar (P)";
    initAudio(); resumeMusic(); startMusic();
  }

  // ====== INPUT ======
  function doJump(){ if(!running||paused) return; if(player.onGround || player.jumps<player.maxJumps){ player.vy=-player.jump; player.onGround=false; player.jumps++; sfxJump(); } }
  document.addEventListener("keydown",e=>{
    if(e.code==="Space"){ e.preventDefault(); (gameOver||!running)?reset():doJump(); }
    else if(e.code==="KeyP"){ togglePause(); }
  });
  C.addEventListener("pointerdown",()=> (gameOver||!running)?reset():doJump());
  BStart.addEventListener("click",()=> (gameOver||!running)?reset():null);
  BPause.addEventListener("click",togglePause);
  BMute .addEventListener("click",toggleMute);

  function togglePause(){
    if(!running||gameOver) return;
    paused = !paused; BPause.textContent = paused ? "Retomar (P)" : "Pausar (P)";
    if (paused) pauseMusic(); else resumeMusic();
  }

  // ====== SPAWN ======
  function spObstacle(){
    if (Math.random()<.6){ const h=R(32,88), w=R(18,26); obs.push({type:"cactus",x:W+20,y:GY-h,w,h}); }
    else { const s=R(24,40); obs.push({type:"barbed",x:W+20,y:GY-s,w:s,h:s,rot:0}); }
  }
  function spCloud(){ const s=R(.6,1.2); clouds.push({x:W+30,y:R(30,120),s,spd:R(.4,.9)}); }
  function spEgg(){ eggs.push({x:W+20,y:GY-60,w:20,h:26,got:false}); }

  // ====== NÍVEIS ======
  function setLevel(){
    const nl = Math.floor(score/10)+1;
    if (nl!==level){
      level=nl; night = level%2===0;
      baseSpeed = 4.2 + (level-1)*0.9; speed = baseSpeed;
      spawnInt = Math.max(52, 90 - (level-1)*4);
      ELlevel.textContent = `Nível: ${level} (${night?"Noite":"Dia"})`;
      // partículas celebração
      for(let i=0;i<40;i++) parts.push({x:R(0,W),y:R(0,H/2),vx:R(-1,1),vy:R(-1,1),life:R(30,60),c:night?"#fff":"#ffeb3b"});
    }
  }

  function nearestObs(){
    let n=null; for(const o of obs){ if(o.x+o.w<player.x) continue; if(!n || o.x<n.x) n=o; } return n;
  }

  // ====== LOOP ======
  function update(){
    frame++;
    if(running && !paused && !gameOver){
      speed = CL(speed + 0.0025, baseSpeed, baseSpeed + 1.2);

      // física player
      player.vy += player.gravity; player.y += player.vy;
      if (player.y + player.h >= GY){
        if(!player.onGround){
          for(let i=0;i<10;i++) parts.push({x:player.x+player.w/2,y:GY-2,vx:R(-2,2),vy:R(-3,-1),life:R(20,40),c:"#d7b46a"});
        }
        player.y = GY - player.h; player.vy=0; player.onGround=true; player.jumps=0;
      }

      // pulo duplo contextual
      const n = nearestObs();
      if (n){ const tall=(n.type==="cactus"&&n.h>=60)||(n.type==="barbed"&&n.h>=34); const d=n.x-(player.x+player.w); player.maxJumps=(tall&&d<Math.max(180,W*.25))?2:1; } else player.maxJumps=1;

      // spawners
      if(++tObs>=spawnInt){tObs=0;spObstacle();}
      if(++tCloud>=120){tCloud=0;if(Math.random()<.9) spCloud();}
      if(++tEgg>=Math.max(300,360-level*10)){tEgg=0;if(Math.random()<.85) spEgg();}

      // mover obstáculos
      for (let i=obs.length-1; i>=0; i--){
        const o=obs[i]; o.x -= speed; if(o.type==="barbed") o.rot += .08;
        if (hit(player,o)){
          running=false; gameOver=true; stopMusic();
          if (score>best){ best=score; localStorage.setItem("runner_highscore",best); ELbest.textContent=`🏆 High: ${best}`; }
        }
        if (o.x + o.w < 0){ obs.splice(i,1); score++; ELscore.textContent=`Score: ${score}`; setLevel(); }
      }
      // ovos
      for (let i=eggs.length-1; i>=0; i--){
        const e=eggs[i]; e.x -= speed;
        if (!e.got && hit(player,e)){
          e.got=true; score+=5; ELscore.textContent=`Score: ${score}`;
          for(let p=0;p<20;p++) parts.push({x:e.x+e.w/2,y:e.y,vx:R(-1.5,1.5),vy:R(-2,-1),life:R(20,50),c:"#fff176"});
        }
        if (e.x+e.w<0 || e.got) eggs.splice(i,1);
      }
      // nuvens
      for (let i=clouds.length-1; i>=0; i--){ const c=clouds[i]; c.x -= c.spd; if (c.x < -120) clouds.splice(i,1); }
      // partículas
      for (let i=parts.length-1; i>=0; i--){ const p=parts[i]; p.x+=p.vx; p.y+=p.vy; if(--p.life<=0) parts.splice(i,1); }
    }
    draw(); requestAnimationFrame(update);
  }

  // ====== DESENHO ======
  function bg(){
    const gd = X.createLinearGradient(0,0,0,H); gd.addColorStop(0,"#87CEEB"); gd.addColorStop(1,"#fceabb");
    const gn = X.createLinearGradient(0,0,0,H); gn.addColorStop(0,"#20053d"); gn.addColorStop(1,"#301860");
    X.fillStyle = night ? gn : gd; X.fillRect(0,0,W,H);
    if (night){
      X.fillStyle="#fff"; for(let i=0;i<40;i++){ const x=(i*37+(frame%37)*3)%W, y=(i*11)%Math.max(80,H*.35); X.fillRect(x,y,1,1); }
      X.beginPath(); X.arc(W-80,60,16,0,Math.PI*2); X.fillStyle="#f5f3ce"; X.fill();
    }
    // nuvens
    for (const c of clouds) cloud(c);
    // areia
    X.fillStyle="#d7b46a"; X.fillRect(0,GY,W,H-GY);
    X.strokeStyle = night ? "#eee" : "#111"; X.lineWidth = 2;
    X.beginPath(); X.moveTo(0,GY+.5); X.lineTo(W,GY+.5); X.stroke();
  }
  function cloud(c){
    X.save(); X.translate(c.x,c.y); X.scale(c.s,c.s);
    X.fillStyle="rgba(255,255,255,0.85)";
    X.beginPath(); X.arc(0,0,16,0,Math.PI*2); X.arc(16,-6,20,0,Math.PI*2); X.arc(34,0,16,0,Math.PI*2); X.fill();
    X.restore();
  }
  function ostrich(){
    const x=player.x,y=player.y,w=player.w,h=player.h;
    player.leg+=player.onGround?speed*.18:.06; player.wing+=.3; player.neck+=.1;
    const wing=Math.sin(player.wing)*6, neck=Math.sin(player.neck)*2;
    X.save(); X.translate(x,y); X.fillStyle = night ? "#eee" : "#444";
    // corpo
    X.beginPath(); X.ellipse(w*.42,h*.55,w*.32,h*.28,0,0,Math.PI*2); X.fill();
    // pescoço
    X.save(); X.translate(w*.55+neck,h*.10); X.fillRect(0,0,w*.08,h*.40); X.restore();
    // cabeça+bico
    X.beginPath(); X.arc(w*.63+neck,h*.10,w*.10,0,Math.PI*2); X.fill();
    X.fillRect(w*.70+neck,h*.10-3,w*.16,6);
    // olho
    X.fillStyle = night ? "#0c1230" : "#fff"; X.fillRect(w*.61+neck,h*.06,3,3);
    X.fillStyle = night ? "#0c1230" : "#111"; X.fillRect(w*.62+neck,h*.07,1.5,1.5);
    // asa
    X.fillStyle = night ? "#eee" : "#444"; X.save(); X.translate(w*.30,h*.40); X.rotate(wing*Math.PI/180);
    X.beginPath(); X.ellipse(0,0,w*.30,h*.15,0,0,Math.PI*2); X.fill(); X.restore();
    // pernas
    const a=Math.sin(player.leg)*6;
    X.save(); X.translate(w*.38,h*.70); X.rotate(a*Math.PI/180); X.fillRect(-2,0,4,h*.30); X.restore();
    X.save(); X.translate(w*.48,h*.70); X.rotate(-a*Math.PI/180); X.fillRect(-2,0,4,h*.30); X.restore();
    X.restore();
  }
  function drawObstacle(o){
    if (o.type==="cactus"){
      X.fillStyle="#388e3c"; X.fillRect(o.x,o.y,o.w,o.h);
      X.fillRect(o.x-4,o.y+10,4,o.h-10); X.fillRect(o.x+o.w,o.y+14,4,o.h-14);
    } else {
      X.save(); X.translate(o.x+o.w/2,o.y+o.h/2); X.rotate(o.rot||0);
      X.strokeStyle="#222"; X.fillStyle="#555";
      X.beginPath(); X.arc(0,0,o.w/2-3,0,Math.PI*2); X.fill();
      X.beginPath(); for(let i=0;i<10;i++){ const ang=i/10*Math.PI*2, r1=o.w/2-2, r2=o.w/2+6; X.moveTo(Math.cos(ang)*r1,Math.sin(ang)*r1); X.lineTo(Math.cos(ang)*r2,Math.sin(ang)*r2); }
      X.stroke(); X.restore();
    }
  }
  function egg(e){ X.fillStyle="#fff176"; X.beginPath(); X.ellipse(e.x+e.w/2,e.y+e.h/2,10,13,0,0,Math.PI*2); X.fill(); }
  function particles(){ for(const p of parts){ X.fillStyle=p.c; X.fillRect(p.x,p.y,2,2); } }
  function overlays(){
    if(paused&&running&&!gameOver){ X.fillStyle="rgba(0,0,0,.4)"; X.fillRect(0,0,W,H); X.fillStyle="#fff"; X.font="bold 28px system-ui"; X.textAlign="center"; X.fillText("PAUSADO",W/2,H/2-8); X.font="16px system-ui"; X.fillText("Pressione P para retomar",W/2,H/2+24); }
    if(gameOver){ X.fillStyle="rgba(0,0,0,.6)"; X.fillRect(0,0,W,H); X.fillStyle="#fff"; X.font="bold 28px system-ui"; X.textAlign="center"; X.fillText("Game Over",W/2,H/2-8); X.font="16px system-ui"; X.fillText("Espaço/Toque para Reiniciar",W/2,H/2+24); }
    if(!running&&!gameOver){ X.fillStyle=night?"#fff":"#111"; X.font="16px system-ui"; X.textAlign="left"; X.fillText("Pressione Espaço ou Clique para começar",16,28); }
  }
  function draw(){
    bg();
    for (const e of eggs) egg(e);
    for (const o of obs) drawObstacle(o);
    ostrich(); particles(); overlays();
  }

  // ====== START ======
  resize(); draw(); requestAnimationFrame(update);
})();
