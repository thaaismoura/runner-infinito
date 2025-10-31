(() => {
  // ====== Elementos e HUD ======
  const CANVAS = document.getElementById("game");
  const CTX = CANVAS.getContext("2d");
  const SCORE_EL = document.getElementById("score");
  const LEVEL_EL = document.getElementById("level");
  const BEST_EL = document.getElementById("best");
  const BTN_START = document.getElementById("btnStart");
  const BTN_PAUSE = document.getElementById("btnPause");

  // ====== Constantes ======
  const W = CANVAS.width;     // 800
  const H = CANVAS.height;    // 300
  const GROUND_Y = H - 40;    // linha do chão

  // ====== Áudio (beep retrô p/ pulo) ======
  let actx;
  function jumpSound() {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
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

  // ====== Estado do jogador (Avestruz) ======
  const player = {
    x: 80, y: GROUND_Y - 42, w: 46, h: 42,
    vy: 0, gravity: 0.9, jumpForce: 14,
    onGround: true,
    jumps: 0,
    maxJumps: 1,            // aumenta para 2 quando obstáculo alto se aproxima
    legPhase: 0,            // animação de pernas
    color: "#111"
  };

  // ====== Obstáculos ======
  const obstacles = [];      // {type, x, y, w, h, ...}
  let spawnTimer = 0;
  let spawnInterval = 90;    // diminui com níveis

  // ====== Nuvens ======
  const clouds = [];         // {x, y, scale, speed}
  let cloudTimer = 0;

  // ====== Estado do jogo ======
  let running = false;
  let paused = false;
  let gameOver = false;
  let score = 0;
  let level = 1;
  let baseSpeed = 5.6;
  let speed = baseSpeed;
  let frame = 0;
  let isNight = false;       // Dia/Noite alterna por nível
  let best = Number(localStorage.getItem("runner_highscore") || 0);
  BEST_EL.textContent = `🏆 High: ${best}`;

  // ====== Utilidades ======
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hitbox(r, inset = 3) { return { x: r.x + inset, y: r.y + inset, w: r.w - inset*2, h: r.h - inset*2 }; }
  function collide(a, b) {
    const A = hitbox(a, 5), B = hitbox(b, b.type === "barbed" ? 4 : 2);
    return (A.x < B.x + B.w && A.x + A.w > B.x && A.y < B.y + B.h && A.y + A.h > B.y);
  }
  function rng(min, max) { return Math.random() * (max - min) + min; }

  function resetGame() {
    obstacles.length = 0;
    clouds.length = 0;
    spawnTimer = 0;
    cloudTimer = 0;
    spawnInterval = 90;
    running = true;
    paused = false;
    gameOver = false;
    score = 0;
    level = 1;
    isNight = false;
    baseSpeed = 5.6;
    speed = baseSpeed;
    frame = 0;

    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
    player.jumps = 0;
    player.maxJumps = 1;

    SCORE_EL.textContent = `Score: ${score}`;
    LEVEL_EL.textContent  = `Nível: ${level} (Dia)`;
    BTN_PAUSE.textContent = "Pausar (P)";
    BTN_PAUSE.setAttribute("aria-pressed", "false");
  }

  // ====== Entradas ======
  function doJump() {
    if (!running || paused) return;
    if (player.onGround || player.jumps < player.maxJumps) {
      player.vy = -player.jumpForce;
      player.onGround = false;
      player.jumps++;
      jumpSound();
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      if (gameOver) resetGame();
      else if (!running) resetGame();
      else doJump();
      e.preventDefault();
    } else if (e.code === "KeyP") {
      togglePause();
    }
  });

  CANVAS.addEventListener("pointerdown", () => {
    if (gameOver) resetGame();
    else if (!running) resetGame();
    else doJump();
  });

  BTN_START.addEventListener("click", () => { if (!running || gameOver) resetGame(); });
  BTN_PAUSE.addEventListener("click", togglePause);

  function togglePause() {
    if (!running || gameOver) return;
    paused = !paused;
    BTN_PAUSE.textContent = paused ? "Retomar (P)" : "Pausar (P)";
    BTN_PAUSE.setAttribute("aria-pressed", paused ? "true" : "false");
  }

  // ====== Spawners ======
  function spawnObstacle() {
    // Alterna 60% árvore (alta/baixa), 40% bola de arame farpado
    const r = Math.random();
    if (r < 0.6) {
      const tall = Math.random() < 0.45;                // algumas árvores altas
      const h = tall ? rng(60, 88) : rng(32, 58);
      const w = rng(18, 26);
      obstacles.push({
        type: "tree",
        x: W + 20, y: GROUND_Y - h, w, h,
        color: "#2e7d32", tall: tall
      });
    } else {
      const s = rng(24, 40);                            // diâmetro
      obstacles.push({
        type: "barbed",
        x: W + 20, y: GROUND_Y - s, w: s, h: s,
        rot: 0, color: "#444"
      });
    }
  }

  function spawnCloud() {
    const scale = rng(0.6, 1.2);
    clouds.push({
      x: W + 30,
      y: rng(30, 120),
      scale,
      speed: rng(0.4, 0.9)
    });
  }

  // ====== Lógica de nível / dificuldade ======
  function computeLevel() {
    // novo nível a cada 10 pontos
    const newLevel = Math.floor(score / 10) + 1;
    if (newLevel !== level) {
      level = newLevel;
      isNight = (level % 2 === 0); // alterna entre Dia (ímpar) e Noite (par)
      // acelera gradualmente e reduz intervalo de spawn
      baseSpeed = 5.6 + (level - 1) * 0.8;
      speed = baseSpeed;
      spawnInterval = Math.max(52, 90 - (level - 1) * 4);
      LEVEL_EL.textContent = `Nível: ${level} (${isNight ? "Noite" : "Dia"})`;
    }
  }

  function nearestObstacle() {
    let nearest = null;
    for (const o of obstacles) {
      if (o.x + o.w < player.x) continue;
      if (!nearest || o.x < nearest.x) nearest = o;
    }
    return nearest;
  }

  // ====== Loop principal ======
  function update() {
    frame++;

    if (running && !paused && !gameOver) {
      // Ajuste fino de velocidade (ligeira aceleração dentro do nível)
      speed = clamp(speed + 0.0025, baseSpeed, baseSpeed + 1.2);

      // Física do jogador
      player.vy += player.gravity;
      player.y += player.vy;
      if (player.y + player.h >= GROUND_Y) {
        player.y = GROUND_Y - player.h;
        player.vy = 0;
        if (!player.onGround) {
          player.onGround = true;
          player.jumps = 0;           // reseta pulo(s)
        }
      }

      // Verifica obstáculo mais próximo e decide pulo duplo contextual
      const near = nearestObstacle();
      if (near) {
        // Se obstáculo alto e ainda à frente, habilita 2 pulos, senão 1
        const isTall = (near.type === "tree" && near.h >= 60) || (near.type === "barbed" && near.h >= 34);
        const dist = near.x - (player.x + player.w);
        player.maxJumps = (isTall && dist < 240) ? 2 : 1;
      } else {
        player.maxJumps = 1;
      }

      // Spawner de obstáculos
      spawnTimer++;
      if (spawnTimer >= spawnInterval) {
        spawnTimer = 0;
        spawnObstacle();
      }

      // Nuvens
      cloudTimer++;
      if (cloudTimer >= 120) {
        cloudTimer = 0;
        if (Math.random() < 0.9) spawnCloud();
      }

      // Move e verifica colisões
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x -= speed;

        if (o.type === "barbed") o.rot += 0.08; // "gira" a bola farpada

        if (collide(player, o)) {
          running = false;
          gameOver = true;
          if (score > best) {
            best = score;
            localStorage.setItem("runner_highscore", String(best));
            BEST_EL.textContent = `🏆 High: ${best}`;
          }
        }

        if (o.x + o.w < 0) {
          obstacles.splice(i, 1);
          score++;
          SCORE_EL.textContent = `Score: ${score}`;
          computeLevel();
        }
      }

      // Move nuvens
      for (let i = clouds.length - 1; i >= 0; i--) {
        const c = clouds[i];
        c.x -= c.speed; // paralaxe mais lenta
        if (c.x < -120) clouds.splice(i, 1);
      }
    }

    draw();
    requestAnimationFrame(update);
  }

  // ====== Desenho ======
  function drawBackground() {
    // céu dia/noite
    const skyDay = "#ffffff";
    const skyNight = "#0c1230";
    CTX.fillStyle = isNight ? skyNight : skyDay;
    CTX.fillRect(0, 0, W, H);

    // estrelas (noite)
    if (isNight) {
      CTX.fillStyle = "rgba(255,255,255,0.8)";
      for (let i = 0; i < 40; i++) {
        const x = (i * 19 + (frame % 19) * 3) % W;
        const y = (i * 7) % 120;
        CTX.fillRect(x, y, 1, 1);
      }
      // lua
      CTX.fillStyle = "#f5f3ce";
      CTX.beginPath();
      CTX.arc(W - 80, 60, 16, 0, Math.PI * 2);
      CTX.fill();
    }

    // nuvens
    for (const c of clouds) drawCloud(c);

    // chão
    CTX.strokeStyle = isNight ? "#eee" : "#111";
    CTX.lineWidth = 2;
    CTX.beginPath();
    CTX.moveTo(0, GROUND_Y + 0.5);
    CTX.lineTo(W, GROUND_Y + 0.5);
    CTX.stroke();

    // marcas de solo (paralaxe leve)
    CTX.strokeStyle = isNight ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
    CTX.beginPath();
    const base = (frame * (speed * 0.3)) % 40;
    for (let x = base; x < W; x += 40) {
      CTX.moveTo(x, GROUND_Y - 60);
      CTX.lineTo(x - 6, GROUND_Y - 58);
    }
    CTX.stroke();
  }

  function drawCloud(c) {
    CTX.save();
    CTX.translate(c.x, c.y);
    CTX.scale(c.scale, c.scale);
    CTX.fillStyle = isNight ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.08)";
    // nuvem simples com 3 bolhas
    CTX.beginPath();
    CTX.arc(0,   0, 16, 0, Math.PI * 2);
    CTX.arc(16, -6, 20, 0, Math.PI * 2);
    CTX.arc(34,  0, 16, 0, Math.PI * 2);
    CTX.fill();
    CTX.restore();
  }

  function drawOstrich() {
    // avestruz estilizado em silhueta
    CTX.fillStyle = isNight ? "#eee" : player.color;

    const x = player.x, y = player.y, w = player.w, h = player.h;

    // corpo
    CTX.beginPath();
    CTX.ellipse(x + w*0.42, y + h*0.55, w*0.32, h*0.28, 0, 0, Math.PI*2);
    CTX.fill();

    // cauda
    CTX.beginPath();
    CTX.moveTo(x + w*0.15, y + h*0.50);
    CTX.lineTo(x + w*0.05, y + h*0.45);
    CTX.lineTo(x + w*0.12, y + h*0.60);
    CTX.fill();

    // pescoço
    CTX.fillRect(x + w*0.55, y + h*0.10, w*0.08, h*0.40);

    // cabeça
    CTX.beginPath();
    CTX.arc(x + w*0.63, y + h*0.10, w*0.10, 0, Math.PI*2);
    CTX.fill();

    // bico
    CTX.fillRect(x + w*0.70, y + h*0.10 - 3, w*0.16, 6);

    // olho
    CTX.fillStyle = isNight ? "#0c1230" : "#fff";
    CTX.fillRect(x + w*0.61, y + h*0.06, 3, 3);
    CTX.fillStyle = isNight ? "#0c1230" : "#111";
    CTX.fillRect(x + w*0.62, y + h*0.07, 1.5, 1.5);

    // pernas (animação simples)
    player.legPhase += (player.onGround ? speed * 0.18 : 0.06);
    const a = Math.sin(player.legPhase) * 6;
    CTX.fillStyle = isNight ? "#eee" : player.color;
    // perna 1
    CTX.save();
    CTX.translate(x + w*0.38, y + h*0.70);
    CTX.rotate(a * Math.PI/180);
    CTX.fillRect(-2, 0, 4, h*0.30);
    CTX.restore();
    // perna 2
    CTX.save();
    CTX.translate(x + w*0.48, y + h*0.70);
    CTX.rotate(-a * Math.PI/180);
    CTX.fillRect(-2, 0, 4, h*0.30);
    CTX.restore();
  }

  function drawObstacle(o) {
    if (o.type === "tree") {
      // tronco
      CTX.fillStyle = "#5d4037";
      CTX.fillRect(o.x + o.w*0.4, o.y + o.h*0.35, o.w*0.2, o.h*0.65);
      // copa
      CTX.fillStyle = o.color;
      CTX.beginPath();
      CTX.ellipse(o.x + o.w*0.5, o.y + o.h*0.35, o.w*0.9, o.h*0.45, 0, 0, Math.PI*2);
      CTX.fill();
    } else {
      // bola de arame farpado (círculo com espinhos)
      CTX.save();
      CTX.translate(o.x + o.w/2, o.y + o.h/2);
      CTX.rotate(o.rot || 0);
      CTX.strokeStyle = "#222";
      CTX.fillStyle = o.color;
      CTX.beginPath();
      CTX.arc(0, 0, o.w/2 - 3, 0, Math.PI*2);
      CTX.fill();
      // espinhos
      CTX.beginPath();
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2;
        const r1 = o.w/2 - 2;
        const r2 = o.w/2 + 6;
        CTX.moveTo(Math.cos(ang)*r1, Math.sin(ang)*r1);
        CTX.lineTo(Math.cos(ang)*r2, Math.sin(ang)*r2);
      }
      CTX.stroke();
      CTX.restore();
    }
  }

  function drawOverlays() {
    if (paused && running && !gameOver) {
      CTX.fillStyle = "rgba(0,0,0,0.45)";
      CTX.fillRect(0, 0, W, H);
      CTX.fillStyle = "#fff";
      CTX.font = "bold 28px system-ui, sans-serif";
      CTX.textAlign = "center";
      CTX.fillText("PAUSADO", W / 2, H / 2 - 8);
      CTX.font = "16px system-ui, sans-serif";
      CTX.fillText("Pressione P para retomar", W / 2, H / 2 + 24);
    }

    if (gameOver) {
      CTX.fillStyle = "rgba(0,0,0,0.6)";
      CTX.fillRect(0, 0, W, H);
      CTX.fillStyle = "#fff";
      CTX.font = "bold 28px system-ui, sans-serif";
      CTX.textAlign = "center";
      CTX.fillText("Game Over", W / 2, H / 2 - 8);
      CTX.font = "16px system-ui, sans-serif";
      CTX.fillText("Espaço/Toque para Reiniciar", W / 2, H / 2 + 24);
    }

    if (!running && !gameOver) {
      CTX.fillStyle = isNight ? "#fff" : "#111";
      CTX.font = "16px system-ui, sans-serif";
      CTX.textAlign = "left";
      CTX.fillText("Pressione Espaço ou Clique para começar", 16, 28);
    }
  }

  function draw() {
    drawBackground();

    // jogador e obstáculos
    drawOstrich();
    for (const o of obstacles) drawObstacle(o);

    drawOverlays();
  }

  // ====== Início ======
  // Desenha uma tela estática e entra no loop
  draw();
  requestAnimationFrame(update);
})();
