import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

/* SHOOT-STREAK — RED BALL SURVIVAL REBUILD
   Lightweight, non-combat arcade game.
*/

const shell = document.getElementById("game-shell");
const startScreen = document.getElementById("start-screen");
const pauseScreen = document.getElementById("pause-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const menuButton = document.getElementById("menu-button");
const pauseMenuButton = document.getElementById("pause-menu-button");
const overMenuButton = document.getElementById("over-menu-button");
const difficultyButtons = [...document.querySelectorAll("[data-difficulty]")];
const modeLabel = document.querySelector(".mode-label");
const resumeButton = document.getElementById("resume-button");
const restartButton = document.getElementById("restart-button");
const scoreValue = document.getElementById("score-value");
const bestValue = document.getElementById("best-value");
const timeValue = document.getElementById("time-value");
const finalScore = document.getElementById("final-score");
const touchControls = document.getElementById("touch-controls");
const jumpButton = document.getElementById("jump-button");

const DIFFICULTIES = {
  easy: { label: "EASY", speed: 1.05, ramp: 0.85, bounce: 0.94, chaos: 0.45, aim: 0.18 },
  medium: { label: "MEDIUM", speed: 1.3, ramp: 1.05, bounce: 0.98, chaos: 0.7, aim: 0.34 },
  hard: { label: "HARD", speed: 1.6, ramp: 1.28, bounce: 1.02, chaos: 1.0, aim: 0.52 },
  extreme: { label: "EXTREME", speed: 1.95, ramp: 1.55, bounce: 1.06, chaos: 1.35, aim: 0.72 },
  master: { label: "MASTER", speed: 2.35, ramp: 1.85, bounce: 1.1, chaos: 1.75, aim: 1.0 }
};
let selectedDifficulty = "medium";

const CONFIG = {
  room: { halfWidth: 7.5, halfDepth: 10, height: 5.5 },
  player: { speed: 7.2, radius: 0.42, startX: 0, startZ: 5.8, jumpSpeed: 7.1, jumpGravity: 18 },
  ball: { radius: 0.62, speed: 8.2, gravity: 12.5, bounce: 0.92, maxSpeed: 25 }
};

let state = "ready";
let elapsed = 0;
let score = 0;
let best = 0;
let lastFrame = 0;
const keys = new Set();
const touchDirections = new Set();
const clock = new THREE.Clock();

try { best = Number(localStorage.getItem("ssDodgeBest") || 0); } catch {}
bestValue.textContent = String(best).padStart(4, "0");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08090d);
scene.fog = new THREE.Fog(0x08090d, 18, 34);

const camera = new THREE.PerspectiveCamera(76, 1, 0.05, 90);
camera.position.set(0, 1.65, CONFIG.player.startZ);
camera.lookAt(0, 1.65, CONFIG.player.startZ - 12);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = false;
renderer.domElement.id = "game-canvas";
renderer.domElement.tabIndex = 0;
shell.prepend(renderer.domElement);

const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
renderer.domElement.addEventListener("click", () => {
  if (state === "playing" && !coarsePointer && document.pointerLockElement !== renderer.domElement) {
    try { renderer.domElement.requestPointerLock(); } catch {}
  }
});

window.addEventListener("mousemove", (event) => {
  if (state !== "playing" || document.pointerLockElement !== renderer.domElement) return;
  cameraYaw -= event.movementX * LOOK_SENSITIVITY;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch - event.movementY * LOOK_SENSITIVITY, -1.25, 1.25);
});

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (state !== "playing" || event.pointerType !== "touch") return;
  activeLookPointer = event.pointerId;
  lastLookX = event.clientX;
  lastLookY = event.clientY;
  renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener("pointermove", (event) => {
  if (state !== "playing" || event.pointerId !== activeLookPointer) return;
  const dx = event.clientX - lastLookX;
  const dy = event.clientY - lastLookY;
  lastLookX = event.clientX;
  lastLookY = event.clientY;
  cameraYaw -= dx * LOOK_SENSITIVITY * 1.35;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch - dy * LOOK_SENSITIVITY * 1.35, -1.25, 1.25);
});
function releaseLookPointer(event) {
  if (event.pointerId === activeLookPointer) activeLookPointer = null;
}
renderer.domElement.addEventListener("pointerup", releaseLookPointer);
renderer.domElement.addEventListener("pointercancel", releaseLookPointer);
renderer.domElement.addEventListener("lostpointercapture", releaseLookPointer);

const ambient = new THREE.HemisphereLight(0xd8dce6, 0x17151a, 1.45);
scene.add(ambient);
const ceilingLight = new THREE.PointLight(0xffffff, 22, 28);
ceilingLight.position.set(0, 4.8, 0);
scene.add(ceilingLight);

const redRoomGlow = new THREE.PointLight(0xff153d, 18, 11);
redRoomGlow.position.set(0, 2.3, -5.5);
scene.add(redRoomGlow);

// Very soft neutral fill follows the player, keeping nearby wall edges readable.
const playerFillLight = new THREE.PointLight(0xd8dce8, 2.4, 9, 2);
playerFillLight.position.set(0, 1.9, CONFIG.player.startZ);
scene.add(playerFillLight);

const mats = {
  floor: new THREE.MeshStandardMaterial({ color: 0x17191f, roughness: 0.82, metalness: 0.12 }),
  wall: new THREE.MeshStandardMaterial({ color: 0x202229, roughness: 0.88, metalness: 0.08 }),
  trim: new THREE.MeshBasicMaterial({ color: 0x9d172d, toneMapped: false }),
  player: new THREE.MeshStandardMaterial({ color: 0xd8dbe2, roughness: 0.65 }),
  playerAccent: new THREE.MeshStandardMaterial({ color: 0xff294b, emissive: 0x5b0718, emissiveIntensity: 1.2 }),
  ball: new THREE.MeshStandardMaterial({ color: 0xff2447, emissive: 0xff002b, emissiveIntensity: 3.2, roughness: 0.22, metalness: 0.05 })
};

function box(w, h, d, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

// Simple enclosed room: flat surfaces, no grids, no patterns, no decorative clutter.
box(15.2, 0.5, 20.2, mats.floor, 0, -0.25, 0);
box(15.2, 0.5, 20.2, mats.wall, 0, CONFIG.room.height + 0.25, 0);
box(0.45, CONFIG.room.height, 20.2, mats.wall, -7.6, CONFIG.room.height / 2, 0);
box(0.45, CONFIG.room.height, 20.2, mats.wall, 7.6, CONFIG.room.height / 2, 0);
box(15.2, CONFIG.room.height, 0.45, mats.wall, 0, CONFIG.room.height / 2, -10.1);
box(15.2, CONFIG.room.height, 0.45, mats.wall, 0, CONFIG.room.height / 2, 10.1);

// A pair of narrow red wall lights are the only room accents.
box(0.045, 0.055, 5.5, mats.trim, -7.34, 4.65, -3.8);
box(0.045, 0.055, 5.5, mats.trim, 7.34, 4.65, -3.8);

const player = new THREE.Group();
scene.add(player);
// The player collision body is invisible in first-person view.
const playerBody = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.35, 12), mats.player);
playerBody.position.y = 0.78;
player.add(playerBody);
const playerHead = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 12), mats.player);
playerHead.position.y = 1.62;
player.add(playerHead);
player.visible = false;
player.position.set(CONFIG.player.startX, 0, CONFIG.player.startZ);

const ball = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.ball.radius, 32, 24), mats.ball);
ball.position.set(1.5, 2.1, -5.5);
scene.add(ball);

const ballAura = new THREE.Mesh(
  new THREE.SphereGeometry(0.9, 20, 16),
  new THREE.MeshBasicMaterial({ color: 0xff123c, transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false })
);
ball.add(ballAura);
const ballLight = new THREE.PointLight(0xff123c, 45, 10);
ball.add(ballLight);

let ballVelocity = new THREE.Vector3(-4.8, 1.6, 6.2);
let ballVerticalVelocity = 1.6;
let courseChangeTimer = 0;
let nextCourseChange = 1.6;
let playerVelocity = new THREE.Vector3();
let jumpHeight = 0;
let jumpVelocity = 0;
let grounded = true;
let cameraYaw = 0;
let cameraPitch = 0;
let activeLookPointer = null;
let lastLookX = 0;
let lastLookY = 0;
const LOOK_SENSITIVITY = 0.0022;
const roomBounds = { x: 6.65, z: 9.05 };
const playerBounds = { x: 6.7, z: 8.95 };

function resize() {
  const width = shell.clientWidth || window.innerWidth;
  const height = shell.clientHeight || window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
window.addEventListener("resize", resize);
resize();

function selectDifficulty(level) {
  if (!DIFFICULTIES[level]) return;
  selectedDifficulty = level;
  difficultyButtons.forEach((button) => {
    const selected = button.dataset.difficulty === level;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  if (modeLabel) modeLabel.innerHTML = '<i></i> ' + DIFFICULTIES[level].label + ' MODE';
}

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => selectDifficulty(button.dataset.difficulty));
});

function setScreen(active) {
  startScreen.classList.toggle("hidden", active !== "ready");
  pauseScreen.classList.toggle("hidden", active !== "paused");
  gameOverScreen.classList.toggle("hidden", active !== "over");
  pauseButton.textContent = active === "paused" ? "PAUSED" : "PAUSE";
  pauseButton.disabled = active === "ready" || active === "over";
}

function resetRun() {
  elapsed = 0;
  score = 0;
  player.position.set(CONFIG.player.startX, 0, CONFIG.player.startZ);
  jumpHeight = 0;
  jumpVelocity = 0;
  grounded = true;
  cameraYaw = 0;
  cameraPitch = 0;
  ball.position.set(1.5, 2.1, -5.5);
  const difficulty = DIFFICULTIES[selectedDifficulty];
  const startAngle = Math.random() * Math.PI * 2;
  const startSpeed = CONFIG.ball.speed * difficulty.speed;
  ballVelocity.set(Math.cos(startAngle) * startSpeed, 0, Math.sin(startAngle) * startSpeed);
  ballVerticalVelocity = 2.2 + Math.random() * 1.2;
  courseChangeTimer = 0;
  nextCourseChange = 1.1 + Math.random() * 1.5;
  scoreValue.textContent = "0000";
  timeValue.textContent = "0.0s";
  keys.clear();
  touchDirections.clear();
}

function startRun() {
  resetRun();
  state = "playing";
  setScreen(state);
  clock.getDelta();
}

function pauseRun() {
  if (state !== "playing") return;
  state = "paused";
  setScreen(state);
}

function resumeRun() {
  if (state !== "paused") return;
  state = "playing";
  setScreen(state);
  clock.getDelta();
}

function showMainMenu() {
  state = "ready";
  keys.clear();
  touchDirections.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  setScreen(state);
}

function endRun() {
  if (state !== "playing") return;
  state = "over";
  const final = Math.floor(score);
  finalScore.textContent = String(final).padStart(4, "0");
  if (final > best) {
    best = final;
    bestValue.textContent = String(best).padStart(4, "0");
    try { localStorage.setItem("ssDodgeBest", String(best)); } catch {}
  }
  setScreen(state);
}

startButton.addEventListener("click", startRun);
restartButton.addEventListener("click", startRun);
pauseButton.addEventListener("click", pauseRun);
resumeButton.addEventListener("click", resumeRun);
menuButton.addEventListener("click", showMainMenu);
pauseMenuButton.addEventListener("click", showMainMenu);
overMenuButton.addEventListener("click", showMainMenu);

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
  keys.add(key);
  if (key === " " && state === "playing" && !event.repeat) jumpPlayer();
  if (key === "escape" && state === "playing") pauseRun();
  else if (key === "escape" && state === "paused") resumeRun();
});
jumpButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  jumpPlayer();
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => { keys.clear(); touchDirections.clear(); });

touchControls.querySelectorAll("button[data-dir]").forEach((button) => {
  const dir = button.dataset.dir;
  const release = () => touchDirections.delete(dir);
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    touchDirections.add(dir);
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});

function isDown(...names) {
  return names.some((name) => keys.has(name) || touchDirections.has(name));
}

function jumpPlayer() {
  if (state !== "playing" || !grounded) return;
  jumpVelocity = CONFIG.player.jumpSpeed;
  grounded = false;
}

function updatePlayer(delta) {
  let side = 0;
  let forward = 0;
  if (isDown("a", "arrowleft", "left")) side -= 1;
  if (isDown("d", "arrowright", "right")) side += 1;
  if (isDown("w", "arrowup", "up")) forward += 1;
  if (isDown("s", "arrowdown", "down")) forward -= 1;

  // Movement stays level with the floor but follows the camera heading, like an FPS.
  const forwardX = -Math.sin(cameraYaw);
  const forwardZ = -Math.cos(cameraYaw);
  const rightX = Math.cos(cameraYaw);
  const rightZ = -Math.sin(cameraYaw);
  let moveX = rightX * side + forwardX * forward;
  let moveZ = rightZ * side + forwardZ * forward;
  const length = Math.hypot(moveX, moveZ) || 1;
  playerVelocity.set((moveX / length) * CONFIG.player.speed, 0, (moveZ / length) * CONFIG.player.speed);
  player.position.x = THREE.MathUtils.clamp(player.position.x + playerVelocity.x * delta, -playerBounds.x, playerBounds.x);
  player.position.z = THREE.MathUtils.clamp(player.position.z + playerVelocity.z * delta, -playerBounds.z, playerBounds.z);
  if (side || forward) player.rotation.y = Math.atan2(playerVelocity.x, playerVelocity.z);

  if (!grounded) {
    jumpVelocity -= CONFIG.player.jumpGravity * delta;
    jumpHeight += jumpVelocity * delta;
    if (jumpHeight <= 0) {
      jumpHeight = 0;
      jumpVelocity = 0;
      grounded = true;
    }
  }
}

function turnBallRandomly(maxAngle) {
  const angle = (Math.random() * 2 - 1) * maxAngle;
  const horizontal = new THREE.Vector2(ballVelocity.x, ballVelocity.z).rotateAround(new THREE.Vector2(), angle);
  ballVelocity.x = horizontal.x;
  ballVelocity.z = horizontal.y;
}

// Aim is applied only at a bounce; the ball never continuously homes in.
function aimBallAtPlayer(difficulty) {
  const toPlayer = new THREE.Vector2(player.position.x - ball.position.x, player.position.z - ball.position.z);
  const currentSpeed = Math.hypot(ballVelocity.x, ballVelocity.z);
  if (toPlayer.lengthSq() < 0.001 || currentSpeed < 0.001) return;
  const direction = new THREE.Vector2(ballVelocity.x, ballVelocity.z).normalize();
  const target = toPlayer.normalize();
  direction.lerp(target, difficulty.aim).normalize();
  const spread = selectedDifficulty === "master" ? 0.025 : 0.11 * difficulty.chaos;
  direction.rotateAround(new THREE.Vector2(), (Math.random() - 0.5) * spread);
  ballVelocity.x = direction.x * currentSpeed;
  ballVelocity.z = direction.y * currentSpeed;
}

function updateBall(delta) {
  const difficulty = DIFFICULTIES[selectedDifficulty];
  const horizontal = new THREE.Vector2(ballVelocity.x, ballVelocity.z);

  // Small, irregular mid-flight course changes stop the ball feeling scripted.
  courseChangeTimer += delta;
  if (courseChangeTimer >= nextCourseChange) {
    courseChangeTimer = 0;
    nextCourseChange = 0.85 + Math.random() * 1.8;
    turnBallRandomly(0.18 + difficulty.chaos * 0.16);
    ballVerticalVelocity += (Math.random() - 0.5) * difficulty.chaos * 2.4;
  }

  ball.position.x += ballVelocity.x * delta;
  ball.position.z += ballVelocity.z * delta;
  ballVerticalVelocity -= CONFIG.ball.gravity * delta;
  ball.position.y += ballVerticalVelocity * delta;

  // Wall impacts preserve more energy at higher difficulties and add a random deflection.
  const wallBounce = CONFIG.ball.bounce * difficulty.bounce;
  if (ball.position.x > roomBounds.x) {
    ball.position.x = roomBounds.x;
    ballVelocity.x = -Math.abs(ballVelocity.x) * wallBounce;
    turnBallRandomly(0.16 + difficulty.chaos * 0.13);
    aimBallAtPlayer(difficulty);
    aimBallAtPlayer(difficulty);
    aimBallAtPlayer(difficulty);
    aimBallAtPlayer(difficulty);
  } else if (ball.position.x < -roomBounds.x) {
    ball.position.x = -roomBounds.x;
    ballVelocity.x = Math.abs(ballVelocity.x) * wallBounce;
    turnBallRandomly(0.16 + difficulty.chaos * 0.13);
  }
  if (ball.position.z > roomBounds.z) {
    ball.position.z = roomBounds.z;
    ballVelocity.z = -Math.abs(ballVelocity.z) * wallBounce;
    turnBallRandomly(0.16 + difficulty.chaos * 0.13);
  } else if (ball.position.z < -roomBounds.z) {
    ball.position.z = -roomBounds.z;
    ballVelocity.z = Math.abs(ballVelocity.z) * wallBounce;
    turnBallRandomly(0.16 + difficulty.chaos * 0.13);
  }

  // Floor and ceiling bounces vary slightly each time, changing the next arc.
  if (ball.position.y < CONFIG.ball.radius) {
    ball.position.y = CONFIG.ball.radius;
    ballVerticalVelocity = Math.abs(ballVerticalVelocity) * (0.86 + difficulty.chaos * 0.035) + 2.0 + Math.random() * (1.1 + difficulty.chaos);
    turnBallRandomly(0.08 + difficulty.chaos * 0.12);
    aimBallAtPlayer(difficulty);
  }
  if (ball.position.y > CONFIG.room.height - CONFIG.ball.radius) {
    ball.position.y = CONFIG.room.height - CONFIG.ball.radius;
    ballVerticalVelocity = -Math.abs(ballVerticalVelocity) * (0.88 + difficulty.chaos * 0.025);
    turnBallRandomly(0.1 + difficulty.chaos * 0.12);
    aimBallAtPlayer(difficulty);
  }

  // Accelerate toward a difficulty-scaled target, with a hard cap for stable physics.
  const targetSpeed = Math.min(
    (CONFIG.ball.speed + Math.min(elapsed * 0.09 * difficulty.ramp, 5.5 * difficulty.ramp)) * difficulty.speed,
    CONFIG.ball.maxSpeed
  );
  const currentSpeed = Math.hypot(ballVelocity.x, ballVelocity.z);
  if (currentSpeed < targetSpeed) {
    const boosted = Math.min(targetSpeed, currentSpeed + delta * (1.1 + difficulty.speed * 0.45));
    const direction = currentSpeed > 0.001
      ? new THREE.Vector2(ballVelocity.x / currentSpeed, ballVelocity.z / currentSpeed)
      : new THREE.Vector2(1, 0);
    ballVelocity.x = direction.x * boosted;
    ballVelocity.z = direction.y * boosted;
  } else if (currentSpeed > CONFIG.ball.maxSpeed) {
    const scale = CONFIG.ball.maxSpeed / currentSpeed;
    ballVelocity.x *= scale;
    ballVelocity.z *= scale;
  }

  // Keep vertical energy bounded so repeated bounces remain playable.
  ballVerticalVelocity = THREE.MathUtils.clamp(ballVerticalVelocity, -13, 13);

  const distance = ball.position.distanceTo(new THREE.Vector3(player.position.x, 0.9 + jumpHeight, player.position.z));
  if (distance < CONFIG.ball.radius + CONFIG.player.radius + 0.22) endRun();
}

function updateCamera() {
  // First-person mouse-look / touch-look with a level, camera-relative movement plane.
  const eyeHeight = 1.65 + jumpHeight;
  camera.position.set(player.position.x, eyeHeight, player.position.z);
  camera.rotation.order = "YXZ";
  camera.rotation.set(cameraPitch, cameraYaw, 0);
  playerFillLight.position.set(player.position.x, 1.9 + jumpHeight, player.position.z);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.04);
  if (state === "playing") {
    elapsed += delta;
    updatePlayer(delta);
    updateBall(delta);
    updateCamera(delta);
    score = elapsed * 10;
    scoreValue.textContent = String(Math.floor(score)).padStart(4, "0");
    timeValue.textContent = elapsed.toFixed(1) + "s";
    ball.rotation.x += delta * 0.8;
    ball.rotation.z += delta * 1.1;
    ballAura.rotation.y -= delta * 0.4;
  } else {
    ball.rotation.x += delta * 0.25;
    ball.rotation.z += delta * 0.32;
  }
  renderer.render(scene, camera);
}

setScreen("ready");
animate();
