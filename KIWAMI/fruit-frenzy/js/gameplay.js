export function createGameplay({ THREE, scene, camera, renderer }) {
  const clockNow = () => performance.now();
  const fruitGeometry = new THREE.SphereGeometry(1, 28, 22);
  const particleGeometry = new THREE.SphereGeometry(0.045, 8, 6);
  const bladeMaterial = new THREE.LineBasicMaterial({ color: 0xffd5b4, transparent: true, opacity: 0.95 });
  const bladeGlowMaterial = new THREE.LineBasicMaterial({ color: 0xff7138, transparent: true, opacity: 0.3 });
  const bladeGeometry = new THREE.BufferGeometry();
  const bladeGlowGeometry = new THREE.BufferGeometry();
  const blade = new THREE.Line(bladeGeometry, bladeMaterial);
  const bladeGlow = new THREE.Line(bladeGlowGeometry, bladeGlowMaterial);
  blade.frustumCulled = false;
  bladeGlow.frustumCulled = false;
  scene.add(bladeGlow, blade);

  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.25);
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const intersection = new THREE.Vector3();
  const fruits = [];
  const fragments = [];
  const particles = [];
  const trail = [];
  const palette = [
    { name: "APPLE", color: 0xe83c43, leaf: 0x58b85a, radius: 0.52 },
    { name: "ORANGE", color: 0xff9b28, leaf: 0x5bb34e, radius: 0.48 },
    { name: "KIWI", color: 0x8bc34a, leaf: 0x3d8e48, radius: 0.5 },
    { name: "PLUM", color: 0x9b63cf, leaf: 0x5c9e54, radius: 0.46 },
    { name: "WATERMELON", color: 0x2eae68, leaf: 0x23824f, radius: 0.58 }
  ];

  let state = "menu";
  let score = 0;
  let lives = 3;
  let combo = 0;
  let best = Number(localStorage.getItem("ff-classic-best") || 0);
  let elapsed = 0;
  let spawnClock = 0;
  let lastSliceAt = 0;
  let lastPointer = null;
  let lastPointerAt = 0;
  let lastHudAt = 0;
  let gameOverReason = "";
  let shake = 0;
  let hud;

  function makeUI() {
    hud = document.createElement("section");
    hud.className = "game-hud";
    hud.id = "classicHud";
    hud.innerHTML = '<div class="game-hud-top"><div class="hud-stat"><small>SCORE</small><strong id="ffScore">000000</strong></div><div class="hud-stat hud-lives"><small>LIVES</small><strong id="ffLives">♥ ♥ ♥</strong></div><div class="hud-stat"><small>BEST</small><strong id="ffBest">000000</strong></div><button class="game-pause" id="ffPause" type="button" aria-label="Pause game">Ⅱ</button></div><div class="game-hud-bottom"><span id="ffCombo">READY YOUR BLADE</span><span id="ffTime">00:00</span></div><div class="game-center-message" id="ffMessage" aria-live="polite"></div><div class="game-overlay" id="ffOverlay" hidden><div class="game-dialog"><div class="game-dialog-kicker" id="ffDialogKicker">CLASSIC MODE</div><h2 id="ffDialogTitle">PAUSED</h2><p id="ffDialogText">Take a breath. The frenzy is waiting.</p><div class="game-dialog-actions"><button id="ffResume" type="button">RESUME</button><button id="ffRestart" type="button">RESTART</button><button id="ffMenu" type="button" class="secondary">MAIN MENU</button></div></div></div>';
    document.body.appendChild(hud);
    hud.querySelector("#ffPause").addEventListener("click", () => state === "playing" ? pause() : resume());
    hud.querySelector("#ffResume").addEventListener("click", resume);
    hud.querySelector("#ffRestart").addEventListener("click", start);
    hud.querySelector("#ffMenu").addEventListener("click", returnToMenu);
    addEventListener("pointermove", (event) => {
      if (state === "playing" && event.pointerType !== "touch") setPointer(event.clientX, event.clientY, clockNow());
    }, { passive: true });
    addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state === "playing") pause();
      else if (event.key === "Escape" && state === "paused") resume();
    });
  }

  function updateHud(force = false) {
    const now = clockNow();
    if (!force && now - lastHudAt < 90) return;
    lastHudAt = now;
    if (!hud) return;
    hud.querySelector("#ffScore").textContent = String(score).padStart(6, "0");
    hud.querySelector("#ffBest").textContent = String(best).padStart(6, "0");
    hud.querySelector("#ffLives").textContent = Array.from({ length: 3 }, (_, i) => i < lives ? "♥" : "♡").join(" ");
    hud.querySelector("#ffTime").textContent = formatTime(elapsed);
    hud.querySelector("#ffCombo").textContent = combo >= 2 ? "COMBO ×" + multiplier() + "  ·  " + combo + " SLICES" : "FOLLOW THE FRUIT";
  }

  function formatTime(seconds) {
    const whole = Math.floor(seconds);
    return String(Math.floor(whole / 60)).padStart(2, "0") + ":" + String(whole % 60).padStart(2, "0");
  }

  function showOverlay(kicker, title, message, resumeVisible) {
    const overlay = hud.querySelector("#ffOverlay");
    hud.querySelector("#ffDialogKicker").textContent = kicker;
    hud.querySelector("#ffDialogTitle").textContent = title;
    hud.querySelector("#ffDialogText").textContent = message;
    hud.querySelector("#ffResume").hidden = !resumeVisible;
    overlay.hidden = false;
  }

  function hideOverlay() { hud.querySelector("#ffOverlay").hidden = true; }

  function clearObjects() {
    for (const item of fruits) scene.remove(item.mesh);
    for (const item of fragments) scene.remove(item.mesh);
    for (const item of particles) scene.remove(item.mesh);
    fruits.length = 0;
    fragments.length = 0;
    particles.length = 0;
    trail.length = 0;
    bladeGeometry.setFromPoints([]);
    bladeGlowGeometry.setFromPoints([]);
  }

  function start() {
    clearObjects();
    score = 0;
    lives = 3;
    combo = 0;
    elapsed = 0;
    spawnClock = 0.7;
    lastSliceAt = 0;
    lastPointer = null;
    gameOverReason = "";
    state = "playing";
    document.body.classList.add("is-playing");
    document.body.dataset.playMode = "true";
    hideOverlay();
    updateHud(true);
    spawnWave();
    showMessage("SLICE FRUIT · AVOID THE BOMBS", 1900);
  }

  function pause() {
    if (state !== "playing") return;
    state = "paused";
    document.body.dataset.playMode = "false";
    showOverlay("CLASSIC MODE", "PAUSED", "Your run is on hold. Resume when you're ready.", true);
  }

  function resume() {
    if (state !== "paused") return;
    state = "playing";
    document.body.dataset.playMode = "true";
    hideOverlay();
    lastPointer = null;
  }

  function returnToMenu() {
    state = "menu";
    document.body.classList.remove("is-playing");
    document.body.dataset.playMode = "false";
    hideOverlay();
    clearObjects();
    updateHud(true);
  }

  function endGame(reason) {
    if (state !== "playing") return;
    state = "gameover";
    document.body.dataset.playMode = "false";
    gameOverReason = reason || "The run is over.";
    if (score > best) {
      best = score;
      try { localStorage.setItem("ff-classic-best", String(best)); } catch (_) {}
    }
    updateHud(true);
    showOverlay("RUN COMPLETE", "GAME OVER", gameOverReason + "  Final score: " + score + ".", false);
  }

  function loseLife(reason) {
    if (state !== "playing") return;
    lives = Math.max(0, lives - 1);
    combo = 0;
    shake = 0.24;
    updateHud(true);
    showMessage(reason || "LIFE LOST", 900);
    if (lives <= 0) endGame("All three lives have been used.");
  }

  function showMessage(text, duration) {
    const node = hud.querySelector("#ffMessage");
    node.textContent = text;
    node.classList.add("visible");
    clearTimeout(showMessage.timer);
    showMessage.timer = setTimeout(() => node.classList.remove("visible"), duration || 900);
  }

  function spawnWave() {
    if (state !== "playing") return;
    const difficulty = Math.min(1.8, elapsed / 65);
    const count = 2 + Math.floor(Math.random() * 2) + (difficulty > 0.8 && Math.random() > 0.55 ? 1 : 0);
    const bombInWave = Math.random() < 0.13 + difficulty * 0.05;
    const positions = [];
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 8.4;
      positions.push(x);
    }
    positions.forEach((x, i) => {
      const delay = i * (0.12 + Math.random() * 0.1);
      setTimeout(() => {
        if (state !== "playing") return;
        if (bombInWave && i === count - 1) createBomb(x);
        else createFruit(x);
      }, delay * 1000);
    });
  }

  function createFruit(x) {
    const type = palette[Math.floor(Math.random() * palette.length)];
    const radius = type.radius * (0.9 + Math.random() * 0.22);
    const material = new THREE.MeshPhysicalMaterial({
      color: type.color, roughness: 0.24, metalness: 0.01,
      clearcoat: 0.82, clearcoatRoughness: 0.16
    });
    const mesh = new THREE.Mesh(fruitGeometry, material);
    mesh.scale.set(radius * 0.94, radius, radius * 0.92);
    mesh.position.set(x, -4.9, 0.25);
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, 0.16, 7),
      new THREE.MeshStandardMaterial({ color: 0x63412b, roughness: 0.8 })
    );
    stem.position.y = radius * 0.9;
    mesh.add(stem);
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 7),
      new THREE.MeshStandardMaterial({ color: type.leaf, roughness: 0.58 })
    );
    leaf.scale.set(1.4, 0.25, 0.7);
    leaf.position.set(0.12, radius * 0.94, 0);
    leaf.rotation.z = -0.45;
    mesh.add(leaf);
    scene.add(mesh);
    const horizontal = (Math.random() - 0.5) * 2.4;
    fruits.push({
      mesh, type: "fruit", name: type.name, radius,
      velocity: new THREE.Vector3(horizontal, 7.3 + Math.random() * 1.5, (Math.random() - 0.5) * 0.25),
      spin: (Math.random() - 0.5) * 2.8, age: 0
    });
  }

  function createBomb(x) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 24, 18),
      new THREE.MeshStandardMaterial({ color: 0x24232a, roughness: 0.34, metalness: 0.48 })
    );
    group.add(body);
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.49, 0.035, 8, 32),
      new THREE.MeshStandardMaterial({ color: 0xff7144, emissive: 0x7a1c0c, emissiveIntensity: 1.2 })
    );
    band.rotation.x = Math.PI / 2;
    group.add(band);
    const fuse = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 0.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xc6a27c })
    );
    fuse.position.set(0.08, 0.48, 0);
    fuse.rotation.z = -0.45;
    group.add(fuse);
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffc45b })
    );
    spark.position.set(0.13, 0.59, 0);
    group.add(spark);
    group.position.set(x, -4.9, 0.3);
    scene.add(group);
    fruits.push({
      mesh: group, type: "bomb", name: "BOMB", radius: 0.55,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 2, 7.1 + Math.random() * 1.2, 0),
      spin: (Math.random() - 0.5) * 2, age: 0
    });
  }

  function screenToWorld(x, y) {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(plane, intersection) ? intersection.clone() : null;
  }

  function setPointer(x, y, now = clockNow()) {
    if (state !== "playing") return;
    const point = screenToWorld(x, y);
    if (!point) return;
    if (lastPointer) {
      const dx = point.x - lastPointer.x;
      const dy = point.y - lastPointer.y;
      const distance = Math.hypot(dx, dy);
      const dt = Math.max(0.008, (now - lastPointerAt) / 1000);
      const speed = distance / dt;
      if (distance > 0.018 && speed > 0.72) {
        trail.push({ point: point.clone(), time: now });
        if (trail.length > 18) trail.shift();
        cutAlong(lastPointer, point);
      }
    } else {
      trail.push({ point: point.clone(), time: now });
    }
    lastPointer = point.clone();
    lastPointerAt = now;
  }

  function distanceToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function cutAlong(a, b) {
    if (state !== "playing") return;
    for (let i = fruits.length - 1; i >= 0; i--) {
      const item = fruits[i];
      const p = item.mesh.position;
      if (distanceToSegment(p.x, p.y, a.x, a.y, b.x, b.y) <= item.radius * 0.92) {
        fruits.splice(i, 1);
        scene.remove(item.mesh);
        if (item.type === "bomb") {
          burst(p, 0xff7548, 24);
          loseLife("BOMB HIT · LIFE LOST");
        } else {
          scoreFruit(item, p);
          splitFruit(item, p);
          burst(p, item.mesh.material?.color?.getHex?.() || 0xff9b28, 15);
        }
      }
    }
  }

  function multiplier() {
    return Math.min(5, 1 + Math.floor(Math.max(0, combo - 1) / 3));
  }

  function scoreFruit(item, point) {
    const now = clockNow();
    combo = now - lastSliceAt < 1050 ? combo + 1 : 1;
    lastSliceAt = now;
    const mult = multiplier();
    score += 10 * mult;
    if (combo >= 2) showMessage("COMBO ×" + mult, 650);
    updateHud(true);
  }

  function splitFruit(item, point) {
    const color = item.mesh.material.color.clone();
    const radius = item.radius;
    const material = new THREE.MeshPhysicalMaterial({
      color, roughness: 0.3, clearcoat: 0.7, side: THREE.DoubleSide
    });
    for (let side = 0; side < 2; side++) {
      const geometry = new THREE.SphereGeometry(radius, 24, 18, side * Math.PI, Math.PI, 0, Math.PI * 2);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(point);
      mesh.position.x += side === 0 ? -0.07 : 0.07;
      mesh.rotation.set(Math.random() * 0.5, Math.random() * 0.5, Math.random() * 0.5);
      scene.add(mesh);
      fragments.push({
        mesh,
        velocity: new THREE.Vector3((side === 0 ? -1 : 1) * (1.2 + Math.random()), 1.4 + Math.random(), (side === 0 ? -1 : 1) * 0.5),
        spin: (side === 0 ? -1 : 1) * (2 + Math.random() * 3),
        life: 0.72
      });
    }
  }

  function burst(point, color, count) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(particleGeometry, material);
      mesh.position.copy(point);
      const velocity = new THREE.Vector3((Math.random() - 0.5) * 7, Math.random() * 6, (Math.random() - 0.5) * 2);
      scene.add(mesh);
      particles.push({ mesh, velocity, life: 0.45 + Math.random() * 0.4 });
    }
  }

  function update(delta, time) {
    if (state === "playing") {
      elapsed += delta;
      spawnClock -= delta;
      if (spawnClock <= 0) {
        spawnWave();
        spawnClock = Math.max(0.78, 1.38 - elapsed * 0.004);
      }
      for (let i = fruits.length - 1; i >= 0; i--) {
        const item = fruits[i];
        item.age += delta;
        item.velocity.y -= 8.7 * delta;
        item.mesh.position.addScaledVector(item.velocity, delta);
        item.mesh.rotation.x += delta * item.spin;
        item.mesh.rotation.y += delta * item.spin * 0.42;
        if (item.mesh.position.y < -5.15 && item.velocity.y < 0) {
          fruits.splice(i, 1);
          scene.remove(item.mesh);
          if (item.type === "fruit") loseLife("FRUIT MISSED · LIFE LOST");
        }
      }
      updateBlade();
      updateHud();
    }
    for (let i = fragments.length - 1; i >= 0; i--) {
      const part = fragments[i];
      part.life -= delta;
      part.velocity.y -= 8.7 * delta;
      part.mesh.position.addScaledVector(part.velocity, delta);
      part.mesh.rotation.x += delta * part.spin;
      part.mesh.rotation.z += delta * part.spin * 0.6;
      part.mesh.scale.setScalar(Math.max(0.01, part.life / 0.72));
      if (part.life <= 0) {
        scene.remove(part.mesh);
        fragments.splice(i, 1);
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.life -= delta;
      particle.velocity.y -= 5.5 * delta;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.mesh.scale.setScalar(Math.max(0.01, particle.life));
      if (particle.life <= 0) {
        scene.remove(particle.mesh);
        particles.splice(i, 1);
      }
    }
    if (shake > 0) shake = Math.max(0, shake - delta);
  }

  function updateBlade() {
    const now = clockNow();
    while (trail.length && now - trail[0].time > 170) trail.shift();
    const points = trail.map(item => item.point);
    blade.visible = points.length > 1;
    bladeGlow.visible = points.length > 1;
    if (points.length > 1) {
      bladeGeometry.setFromPoints(points);
      bladeGlowGeometry.setFromPoints(points);
      bladeMaterial.opacity = Math.max(0.12, Math.min(1, (now - trail[trail.length - 1].time) / -170 + 1));
      bladeGlowMaterial.opacity = bladeMaterial.opacity * 0.32;
    }
  }

  makeUI();
  updateHud(true);

  return {
    start,
    pause,
    resume,
    returnToMenu,
    update,
    setPointer,
    isPlaying: () => state === "playing",
    get state() { return state; },
    get score() { return score; }
  };
}
