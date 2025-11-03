function update(){
  frame++;
  if(running && !paused && !gameOver){
    // aceleração suave e “andar” do avestruz
    speed = Math.min(baseSpeed + 1.4, speed + .003);
    const targetX = CL(W * (0.26 + (level-1)*0.02), 60, W*0.45);
    player.x = LERP(player.x, targetX, 0.025 + (level-1)*0.003);

    // processa pulo imediatamente para reduzir latência de input (antes da física)
    if (jumpQueued) {
      if (tryConsumeJump()) jumpQueued = false;
    }

    // física
    player.vy += player.gravity;
    player.y += player.vy;

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
      // se estava no chão e saiu agora, registra tempo
      if (player.onGround) lastGroundedAt = performance.now();
      player.onGround = false;
    }

    // processa fila de pulo (jump buffer + coyote)
    if (jumpQueued) {
      if (tryConsumeJump()) jumpQueued = false;
      else {
        // mantém na fila por alguns ms (buffer)
        if (performance.now() - lastJumpPressedAt > JUMP_BUFFER_MS) jumpQueued = false;
      }
    }

    // pulo duplo contextual
    const n = nearObs();
    if(n){
      const tall = (n.type==="cactus" && n.h>=60) || (n.type==="barbed" && n.h>=34);
      const d = n.x - (player.x + player.w);
      player.maxJumps = (tall && d < Math.max(180, W * .25)) ? 2 : 1;
    } else {
      player.maxJumps = 1;
    }

    // spawns
    if(++tObs >= spawnInt){ tObs=0; spObstacle(); }
    if(++tCloud >= 120){ tCloud=0; if(Math.random()<.9) spCloud(); }
    if(++tEgg >= Math.max(300,360-level*10)){ tEgg=0; if(Math.random()<.85) spEgg(); }
    if(++tMark >= 12){ tMark=0; if(Math.random()<.7) spGroundMark(); }

    for(let i=obs.length-1;i>=0;i--){
      const o=obs[i];
      o.x -= speed;
      if(o.type==="barbed") o.rot=(o.rot||0)+.09;
      if(hit(player,o)){
        running=false;
        gameOver=true;
        stopMusic();
        if(score>best){
          best=score;
          localStorage.setItem("runner_highscore",best);
          ELbest.textContent=`🏆 High: ${best}`;
        }
      }
      if(o.x+o.w<0){
        obs.splice(i,1);
        score++;
        obstaclesCleared++;
        ELscore.textContent=`Score: ${score}`;
        setLevel();
      }
    }

    for(let i=eggs.length-1;i>=0;i--){
      const e=eggs[i];
      e.x -= speed;
      if(!e.got && hit(player,e)){
        e.got=true;
        score+=5;
        ELscore.textContent=`Score: ${score}`;
        for(let p=0;p<20;p++)
          parts.push({x:e.x+e.w/2,y:e.y,vx:R(-1.5,1.5),vy:R(-2,-1),life:R(20,40),c:"#fff176"});
      }
      if(e.x+e.w<0 || e.got) eggs.splice(i,1);
    }

    for(let i=clouds.length-1;i>=0;i--){
      const c=clouds[i];
      c.x -= c.spd;
      if(c.x+80<0) clouds.splice(i,1);
    }

    for(let i=parts.length-1;i>=0;i--){
      const p=parts[i];
      p.x+=p.vx; p.y+=p.vy; p.life--;
      if(p.life<=0) parts.splice(i,1);
    }

    for(let i=groundMarks.length-1;i>=0;i--){
      const g=groundMarks[i];
      g.x -= speed;
      if(g.x+g.w<0) groundMarks.splice(i,1);
    }

    // desenhar
    drawBG();
    for(const e of eggs) drawEgg(e);
    for(const o of obs) drawObstacle(o);
    drawOstrich();
    drawParticles();
    drawOverlays();

    requestAnimationFrame(update);
  }
}
