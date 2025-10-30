(() => {
  const CANVAS = document.getElementById("game");
  const CTX = CANVAS.getContext("2d");
  const SCORE_EL = document.getElementById("score");
  const BTN_START = document.getElementById("btnStart");

  const W = CANVAS.width;
  const H = CANVAS.height;
  const GROUND_Y = H - 40;

  const player = {
    x: 60, y: GROUND_Y - 40, w: 32, h: 40,
    vy: 0, gravity: 0.9, jumpForce: 14, isOnGround: true,
    color: "#111"
  };

  const obstacles = [];
  let spawnTimer = 0;
  let spawnInterval = 90;

  let running = false;
  let gameOver = false;
  let score = 0;
  let speed = 6;
  let frame = 0;

  function rectsCollide(a, b) {
    return (a.x < b.x + b.w && a.x + a.w > b.x &&
            a.y < b.y + b.h && a.y + a.h > b.y);
  }

  function resetGame() {
    obstacles.length = 0;
    spawnTimer = 0;
    spawnInterval = 90;
    running = true;
    gameOver = false;
    score = 0;
    speed = 6;
    frame = 0;
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.isOnGround = true;
    SCORE_EL.textContent = `Score: ${score}`;
  }

  function jump() {
    if (!running) return;
    if (player.isOnGround) {
      player.vy = -player.jumpForce;
      player.isOnGround = false;
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      if (gameOver) resetGame();
      else { if (!running) resetGame(); else jump(); }
      e.preventDefault();
    }
  });

  CANVAS.addEventListener("pointerdown", () => {
    if (gameOver) resetGame();
    else { if (!running) resetGame(); else jump(); }
  });

  BTN_START.addEventListener("click", () => {
    if (!running || gameOver) resetGame();
  });

  function update() {
    if (!running) { drawStatic(); requestAnimationFrame(update); return; }
    frame++;

    if (frame % 240 === 0) {
      speed += 0.5;
      spawnInterval = Math.max(55, spawnInterval - 2);
    }

    player.vy += player.gravity;
    player.y += player.vy;
    if (player.y + player.h >= GROUND_Y) {
      player.y = GROUND_Y - player.h;
      player.vy = 0;
      player.isOnGround = true;
    }

    spawnTimer++;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      const height = 20 + Math.floor(Math.random() * 40);
      const width = 16 + Math.floor(Math.random() * 20);
      obstacles.push({ x: W + 20, y: GROUND_Y - height, w: width, h: height, color: "#2b8a3e" });
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speed;

      if (rectsCollide(player, o)) { running = false; gameOver = true; }
      if (o.x + o.w < 0) {
        obstacles.splice(i, 1);
        score++;
        SCORE_EL.textContent = `Score: ${score}`;
      }
    }

    draw();
    requestAnimationFrame(update);
  }

  function drawBackground() {
    CTX.fillStyle = "#ffffff"; CTX.fillRect(0, 0, W, H);
    CTX.strokeStyle = "#111"; CTX.lineWidth = 2;
    CTX.beginPath(); CTX.moveTo(0, GROUND_Y + 0.5); CTX.lineTo(W, GROUND_Y + 0.5); CTX.stroke();

    CTX.strokeStyle = "rgba(0,0,0,0.07)";
    CTX.beginPath();
    for (let x = (frame * (speed * 0.3)) % 40; x < W; x += 40) {
      CTX.moveTo(x, GROUND_Y - 60);
      CTX.lineTo(x - 6, GROUND_Y - 58);
    }
    CTX.stroke();
  }

  function drawPlayer() {
    CTX.fillStyle = player.color;
    CTX.fillRect(player.x, player.y, player.w, player.h);
    CTX.fillStyle = "#fff"; CTX.fillRect(player.x + player.w - 10, player.y + 8, 6, 6);
    CTX.fillStyle = "#111"; CTX.fillRect(player.x + player.w - 8, player.y + 10, 2, 2);
  }

  function drawObstacles() {
    for (const o of obstacles) {
      CTX.fillStyle = o.color; CTX.fillRect(o.x, o.y, o.w, o.h);
      CTX.fillStyle = "rgba(0,0,0,0.1)";
      CTX.fillRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4);
    }
  }

  function drawHUD() {
    if (gameOver) {
      CTX.fillStyle = "rgba(0,0,0,0.6)"; CTX.fillRect(0, 0, W, H);
      CTX.fillStyle = "#fff"; CTX.font = "bold 28px system-ui, sans-serif";
      CTX.textAlign = "center"; CTX.fillText("Game Over", W / 2, H / 2 - 8);
      CTX.font = "16px system-ui, sans-serif";
      CTX.fillText("Pressione Espaço ou Clique para Reiniciar", W / 2, H / 2 + 24);
    }
  }

  function draw() { drawBackground(); drawPlayer(); drawObstacles(); drawHUD(); }

  function drawStatic() {
    drawBackground(); drawPlayer(); drawObstacles();
    CTX.fillStyle = "#111"; CTX.font = "16px system-ui, sans-serif"; CTX.textAlign = "left";
    CTX.fillText("Pressione Espaço ou Clique para começar", 16, 28);
  }

  update();
})();
