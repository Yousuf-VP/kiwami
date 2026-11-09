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
const resumeButton = document.getElementById("resume-button");
const restartButton = document.getElementById("restart-button");
const scoreValue = document.getElementById("score-value");
const bestValue = document.getElementById("best-value");
const timeValue = document.getElementById("time-value");
const finalScore = document.getElementById("final-score");
const touchControls = document.getElementById("touch-controls");

const CONFIG = {
  room: { halfWidth: 7.5, halfDepth: 10, height: 5.5 },
  player: { speed: 7.2, radius: 0.42, startX: 0, startZ: 5.8 },
  ball: { radius: 0.62, speed: 7.8, gravity: 12.5, bounce: 0.92 }
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
shell.prepend(renderer.domElement);

const ambient = new THREE.HemisphereLight(0xd8dce6, 0x17151a, 1.45);
scene.add(ambient);
const ceilingLight = new THREE.PointLight(0xffffff, 22, 28);
ceilingLight.position.set(0, 4.8, 0);
scene.add(ceilingLight);

const redRoomGlow = new THREE.PointLight(0xff153d, 18, 11);
redRoomGlow.position.set(0, 2.3, -5.5);
scene.add(redRoomGlow);

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
let playerVelocity = new THREE.Vector3();
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
  ball.position.set(1.5, 2.1, -5.5);
  ballVelocity.set(-4.8, 1.6, 6.2);
  ballVerticalVelocity = 1.6;
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

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
  keys.add(key);
  if (key === "escape" && state === "playing") pauseRun();
  else if (key === "escape" && state === "paused") resumeRun();
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

function updatePlayer(delta) {
  let x = 0;
  let z = 0;
  if (isDown("a", "arrowleft", "left")) x -= 1;
  if (isDown("d", "arrowright", "right")) x += 1;
  if (isDown("w", "arrowup", "up")) z -= 1;
  if (isDown("s", "arrowdown", "down")) z += 1;
  const length = Math.hypot(x, z) || 1;
  playerVelocity.set((x / length) * CONFIG.player.speed, 0, (z / length) * CONFIG.player.speed);
  player.position.x = THREE.MathUtils.clamp(player.position.x + playerVelocity.x * delta, -playerBounds.x, playerBounds.x);
  player.position.z = THREE.MathUtils.clamp(player.position.z + playerVelocity.z * delta, -playerBounds.z, playerBounds.z);
  if (x || z) player.rotation.y = Math.atan2(x, z);
}

function updateBall(delta) {
  ball.position.x += ballVelocity.x * delta;
  ball.position.z += ballVelocity.z * delta;
  ballVerticalVelocity -= CONFIG.ball.gravity * delta;
  ball.position.y += ballVerticalVelocity * delta;

  if (ball.position.x > roomBounds.x) { ball.position.x = roomBounds.x; ballVelocity.x = -Math.abs(ballVelocity.x) * CONFIG.ball.bounce; }
  if (ball.position.x < -roomBounds.x) { ball.position.x = -roomBounds.x; ballVelocity.x = Math.abs(ballVelocity.x) * CONFIG.ball.bounce; }
  if (ball.position.z > roomBounds.z) { ball.position.z = roomBounds.z; ballVelocity.z = -Math.abs(ballVelocity.z) * CONFIG.ball.bounce; }
  if (ball.position.z < -roomBounds.z) { ball.position.z = -roomBounds.z; ballVelocity.z = Math.abs(ballVelocity.z) * CONFIG.ball.bounce; }

  if (ball.position.y < CONFIG.ball.radius) {
    ball.position.y = CONFIG.ball.radius;
    ballVerticalVelocity = Math.abs(ballVerticalVelocity) * 0.88 + 2.2;
  }
  if (ball.position.y > CONFIG.room.height - CONFIG.ball.radius) {
    ball.position.y = CONFIG.room.height - CONFIG.ball.radius;
    ballVerticalVelocity = -Math.abs(ballVerticalVelocity) * 0.9;
  }

  // Gradually increase the obstacle's pace to keep later rounds challenging.
  const targetSpeed = CONFIG.ball.speed + Math.min(elapsed * 0.055, 3.5);
  const horizontal = new THREE.Vector2(ballVelocity.x, ballVelocity.z);
  if (horizontal.length() < targetSpeed) {
    horizontal.setLength(Math.min(targetSpeed, horizontal.length() + delta * 0.22));
    ballVelocity.x = horizontal.x;
    ballVelocity.z = horizontal.y;
  }

  const distance = ball.position.distanceTo(new THREE.Vector3(player.position.x, 0.9, player.position.z));
  if (distance < CONFIG.ball.radius + CONFIG.player.radius + 0.22) endRun();
}

function updateCamera() {
  // First-person view: camera is at the player's eye height, looking into the room.
  camera.position.set(player.position.x, 1.65, player.position.z);
  camera.lookAt(player.position.x, 1.65, player.position.z - 12);
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
