(() => {
  // ====== ELEMENTOS / HUD ======
  const C = document.getElementById("game"), X = C.getContext("2d");
  const ELscore = document.getElementById("score");
  const ELlevel = document.getElementById("level");
  const ELbest  = document.getElementById("best");
  const BStart  = document.getElementById("btnStart");
  const BPause  = document.getElementById("btnPause");
  const BMute   = document.getElementById("btnMute");
  const BFS     = document.getElementById("btnFS");
  const BJump   = document.getElementById("btnJump");

  // ... (todo o seu código original até a função update)

  function update(){
    frame++;
    if(running && !paused && !gameOver){
      // aceleração suave e “andar” do avestruz
      speed = Math.min(baseSpeed + 1.4, speed + .003);
      const targetX = CL(W * (0.26 + (level-1)*0.02), 60, W*0.45);
      player.x = LERP(player.x, targetX, 0.025 + (level-1)*0.003);

      // >>> INSERÇÃO para reduzir latência do pulo (não mude mais nada)
      // processa pulo imediatamente para reduzir latência de input (antes da física)
      if (jumpQueued) {
        if (tryConsumeJump()) jumpQueued = false;
      }

      // física
      player.vy += player.gravity; player.y += player.vy;

      // aterrissagem
      if(player.y + player.h >= GY){
        if(!player.onGround){
          for(let i=0;i<10;i++) parts.push({x:player.x+player.w/2,y:GY-2,vx:R(-2,2),vy:R(-3,-1),life:R(20,40),c:"#d7b46a"});
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

      // ... (restante do seu update ORIGINAL: pulo duplo contextual, spawns, colisões, desenho etc.)

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

  // ====== START ======
  function initialDraw(){ drawBG(); drawOverlays(); }
  resize(); initialDraw(); requestAnimationFrame(update);
})();
