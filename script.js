(() => {
  // ====== CONFIGURAÇÃO DO JOGO ======
  const C = document.getElementById("game"), X = C.getContext("2d");
  const ELscore = document.getElementById("score");
  const ELlevel = document.getElementById("level");
  const ELbest  = document.getElementById("best");
  const BStart  = document.getElementById("btnStart");
  const BPause  = document.getElementById("btnPause");
  const BMute   = document.getElementById("btnMute");
  const BFS     = document.getElementById("btnFS");
  const BJump   = document.getElementById("btnJump");

  const W = C.width, H = C.height;
  const GY = H - 40;

  let running = false, paused = false, gameOver = false;
  let score = 0, best = Number(localStorage.getItem("runner_highscore")||0);
  let obstaclesCleared = 0, level = 1;
  let frame = 0, baseSpeed = 3.6, speed = baseSpeed, night = false;
  ELbest.textContent = `🏆 High: ${best}`;

  // ====== ENTIDADES ======
  const player = { x:60, y:GY-42, w:46, h:42, vy:0, gravity:.9, jump:15.4,
    onGround:true, jumps:0, maxJumps:1, leg:0, wing:0, neck:0 };
  const obs = [], clouds = [], eggs = [], parts = [], groundMarks = [];

  // ====== VARIÁVEIS ======
  let tObs=0,tCloud=0,tEgg=0,tMark=0,spawnInt=100;
  const COYOTE_MS=120, JUMP_BUFFER_MS=120, JUMP_MIN_INTERVAL_MS=120;
  let lastGroundedAt=0, lastJumpPressedAt=-Infinity, lastJumpDoneAt=-Infinity, jumpQueued=false;

  // ====== ÁUDIO ======
  let actx=null, gMusic=null, gSfx=null, musicOn=false, muted=false, musicTimer=null;
  function initAudio(){
    if(actx) return;
    actx=new(window.AudioContext||window.webkitAudioContext)();
    gMusic=actx.createGain(); gSfx=actx.createGain();
    gMusic.connect(actx.destination); gSfx.connect(actx.destination);
    gMusic.gain.value=.9; gSfx.gain.value=.7;
  }
  function note(freq,dur=160,vol=.06){
    if(!actx||!musicOn||muted)return;
    const o=actx.createOscillator(),g=actx.createGain();
    o.type="square";o.frequency.value=freq;
    g.gain.setValueAtTime(vol,actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+dur/1000);
    o.connect(g).connect(gMusic);o.start();o.stop(actx.currentTime+dur/1000+.02);
  }
  const THEME=[[220,160,40],[262,160,40],[330,200,60],[392,160,40],[349,160,40],[330,200,80],[294,160,40],[262,220,120]];
  function startMusic(){
    if(!actx)return;stopMusic();musicOn=true;let i=0;
    const tick=()=>{if(!running||paused||gameOver||muted){musicTimer=setTimeout(tick,120);return;}
      const[f,d,g]=THEME[i%THEME.length];note(f,d,.06);i++;musicTimer=setTimeout(tick,d+g);};
    musicTimer=setTimeout(tick,0);
  }
  function stopMusic(){musicOn=false;if(musicTimer){clearTimeout(musicTimer);musicTimer=null;}}
  function pauseMusic(){if(actx&&actx.state==="running")actx.suspend().catch(()=>{});}
  function resumeMusic(){if(actx&&actx.state==="suspended")actx.resume().catch(()=>{});}
  function toggleMute(){muted=!muted;BMute.textContent=muted?"🔇 Mudo":"🔊 Som";if(gMusic)gMusic.gain.value=muted?0:.9;}
  function sfxJump(){
    if(!actx)return;const o=actx.createOscillator(),g=actx.createGain();
    o.type="square";o.frequency.value=440;g.gain.value=.12;
    g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+.12);
    o.connect(g).connect(gSfx);o.start();o.stop(actx.currentTime+.12);
  }

  // ====== INPUT ======
  function queueJump(){
    const now=performance.now();
    if(now-lastJumpPressedAt<40)return;
    lastJumpPressedAt=now;jumpQueued=true;
    if(navigator.vibrate)navigator.vibrate(8);
  }
  function doJumpImpulse(){
    player.vy=-player.jump;player.onGround=false;player.jumps++;lastJumpDoneAt=performance.now();sfxJump();
  }
  function tryConsumeJump(){
    const now=performance.now();
    if(now-lastJumpDoneAt<JUMP_MIN_INTERVAL_MS)return false;
    const onGroundNow=player.onGround,coyoteOk=(now-lastGroundedAt)<=COYOTE_MS,bufferOk=(now-lastJumpPressedAt)<=JUMP_BUFFER_MS;
    if((onGroundNow||coyoteOk)&&bufferOk){doJumpImpulse();return true;}
    if(!onGroundNow&&player.jumps<player.maxJumps&&bufferOk){doJumpImpulse();return true;}
    return false;
  }

  // ====== LÓGICA ======
  function update(){
    frame++;
    if(running&&!paused&&!gameOver){
      speed=Math.min(baseSpeed+1.4,speed+.003);
      const targetX=CL(W*(0.26+(level-1)*0.02),60,W*0.45);
      player.x=LERP(player.x,targetX,0.025+(level-1)*0.003);

      // 💥 PULO MAIS RÁPIDO (LATÊNCIA ZERO)
      if(jumpQueued){if(tryConsumeJump())jumpQueued=false;}

      // física
      player.vy+=player.gravity;player.y+=player.vy;

      // aterrissagem
      if(player.y+player.h>=GY){
        if(!player.onGround){for(let i=0;i<10;i++)parts.push({x:player.x+player.w/2,y:GY-2,vx:R(-2,2),vy:R(-3,-1),life:R(20,40),c:"#d7b46a"});}
        player.y=GY-player.h;player.vy=0;player.onGround=true;player.jumps=0;lastGroundedAt=performance.now();
      }else{
        if(player.onGround)lastGroundedAt=performance.now();player.onGround=false;
      }

      // fila de pulo (jump buffer)
      if(jumpQueued){if(tryConsumeJump())jumpQueued=false;
        else if(performance.now()-lastJumpPressedAt>JUMP_BUFFER_MS)jumpQueued=false;}

      // pulo duplo contextual
      const n=nearObs();
      if(n){const tall=(n.type==="cactus"&&n.h>=60)||(n.type==="barbed"&&n.h>=34);
        const d=n.x-(player.x+player.w);player.maxJumps=(tall&&d<Math.max(180,W*.25))?2:1;}else player.maxJumps=1;

      // spawns e movimento
      if(++tObs>=spawnInt){tObs=0;spObstacle();}
      if(++tCloud>=120){tCloud=0;if(Math.random()<.9)spCloud();}
      if(++tEgg>=Math.max(300,360-level*10)){tEgg=0;if(Math.random()<.85)spEgg();}
      if(++tMark>=12){tMark=0;if(Math.random()<.7)spGroundMark();}

      // colisões e pontuação
      for(let i=obs.length-1;i>=0;i--){
        const o=obs[i];o.x-=speed;if(o.type==="barbed")o.rot=(o.rot||0)+.09;
        if(hit(player,o)){running=false;gameOver=true;stopMusic();
          if(score>best){best=score;localStorage.setItem("runner_highscore",best);ELbest.textContent=`🏆 High: ${best}`;}
        }
        if(o.x+o.w<0){obs.splice(i,1);score++;obstaclesCleared++;ELscore.textContent=`Score: ${score}`;setLevel();}
      }

      drawBG();for(const e of eggs)drawEgg(e);for(const o of obs)drawObstacle(o);
      drawOstrich();drawParticles();drawOverlays();
      requestAnimationFrame(update);
    }
  }

  // ====== DESENHO (IDÊNTICO AO ORIGINAL) ======
  const R=(a,b)=>Math.random()*(b-a)+a,CL=(v,a,b)=>Math.max(a,Math.min(b,v)),LERP=(a,b,t)=>a+(b-a)*t;
  function drawBG(){const gd=X.createLinearGradient(0,0,0,H);
    gd.addColorStop(0,"#87CEEB");gd.addColorStop(1,"#fceabb");
    X.fillStyle=gd;X.fillRect(0,0,W,H);
    X.fillStyle="#d7b46a";X.fillRect(0,GY,W,H-GY);}
  function drawOstrich(){
    const{x,y,w,h}=player;player.leg+=speed*.2;player.wing+=.3;player.neck+=.1;
    const wing=Math.sin(player.wing)*6,neck=Math.sin(player.neck)*2;
    X.save();X.translate(x,y);X.fillStyle="#444";
    X.beginPath();X.ellipse(w*.42,h*.55,w*.32,h*.28,0,0,Math.PI*2);X.fill();
    X.save();X.translate(w*.55+neck,h*.10);X.fillRect(0,0,w*.08,h*.40);X.restore();
    X.beginPath();X.arc(w*.63+neck,h*.10,w*.10,0,Math.PI*2);X.fill();
    X.fillRect(w*.70+neck,h*.10-3,w*.16,6);
    X.fillStyle="#fff";X.fillRect(w*.61+neck,h*.06,3,3);
    X.fillStyle="#111";X.fillRect(w*.62+neck,h*.07,1.5,1.5);
    X.save();X.translate(w*.30,h*.40);X.rotate(wing*Math.PI/180);
    X.beginPath();X.ellipse(0,0,w*.30,h*.15,0,0,Math.PI*2);X.fill();X.restore();
    const a=Math.sin(player.leg)*6;
    X.save();X.translate(w*.38,h*.70);X.rotate(a*Math.PI/180);X.fillRect(-2,0,4,h*.30);X.restore();
    X.save();X.translate(w*.48,h*.70);X.rotate(-a*Math.PI/180);X.fillRect(-2,0,4,h*.30);X.restore();X.restore();
  }
  function drawObstacle(o){
    if(o.type==="cactus"){X.fillStyle="#388e3c";X.fillRect(o.x,o.y,o.w,o.h);
      X.fillRect(o.x-4,o.y+10,4,o.h-10);X.fillRect(o.x+o.w,o.y+14,4,o.h-14);}
    else{X.save();X.translate(o.x+o.w/2,o.y+o.h/2);X.rotate(o.rot||0);
      X.strokeStyle="#222";X.fillStyle="#555";X.beginPath();X.arc(0,0,o.w/2-3,0,Math.PI*2);X.fill();X.restore();}
  }
  function drawEgg(e){X.fillStyle="#fff176";X.beginPath();X.ellipse(e.x+e.w/2,e.y+e.h/2,10,13,0,0,Math.PI*2);X.fill();}
  function drawParticles(){for(const p of parts){X.fillStyle=p.c;X.fillRect(p.x,p.y,2,2);}}
  function drawOverlays(){
    if(paused&&running&&!gameOver){X.fillStyle="rgba(0,0,0,.4)";X.fillRect(0,0,W,H);X.fillStyle="#fff";
      X.font="bold 28px system-ui";X.textAlign="center";X.fillText("PAUSADO",W/2,H/2-8);}
    if(gameOver){X.fillStyle="rgba(0,0,0,.6)";X.fillRect(0,0,W,H);X.fillStyle="#fff";
      X.font="bold 28px system-ui";X.textAlign="center";X.fillText("Game Over",W/2,H/2);}
  }

  function hit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
  function nearObs(){let n=null;for(const o of obs){if(o.x+o.w<player.x)continue;if(!n||o.x<n.x)n=o;}return n;}
  function spObstacle(){if(Math.random()<.6){const h=R(32,88),w=R(18,26);obs.push({type:"cactus",x:W+20,y:GY-h,w,h});}
    else{const s=R(24,40);obs.push({type:"barbed",x:W+20,y:GY-s,w:s,h:s,rot:0});}}
  function spCloud(){}
  function spEgg(){}
  function spGroundMark(){}
  function setLevel(){level=Math.floor(obstaclesCleared/5)+1;baseSpeed=3.6+(level-1)*1.0;speed=baseSpeed;spawnInt=Math.max(52,100-(level-1)*6);
    ELlevel.textContent=`Nível: ${level} (${night?"Noite":"Dia"})`;}

  document.addEventListener("keydown",e=>{if(e.code==="Space"){e.preventDefault();(gameOver||!running)?reset():queueJump();}
    else if(e.code==="KeyP"){paused=!paused;paused?pauseMusic():resumeMusic();}});
  C.addEventListener("pointerdown",e=>{e.preventDefault();(gameOver||!running)?reset():queueJump();});

  function reset(){obs.length=0;parts.length=0;clouds.length=0;eggs.length=0;groundMarks.length=0;
    running=true;paused=false;gameOver=false;score=0;obstaclesCleared=0;level=1;baseSpeed=3.6;speed=baseSpeed;
    player.x=60;player.y=GY-player.h;player.vy=0;player.onGround=true;player.jumps=0;
    ELscore.textContent=`Score: ${score}`;setLevel();initAudio();resumeMusic();startMusic();}
  reset();requestAnimationFrame(update);
})();
