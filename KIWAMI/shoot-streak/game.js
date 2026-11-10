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
const gameplayPauseButton = document.getElementById("gameplay-pause-button");
const sensitivityInputs = ["menu-sensitivity","pause-sensitivity","mobile-sensitivity"].map(id=>document.getElementById(id));
const fovInputs = ["menu-fov","pause-fov","mobile-fov"].map(id=>document.getElementById(id));
const sensitivityOutputs = ["menu-sensitivity-value","pause-sensitivity-value","mobile-sensitivity-value"].map(id=>document.getElementById(id));
const fovOutputs = ["menu-fov-value","pause-fov-value","mobile-fov-value"].map(id=>document.getElementById(id));
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
const introScreen = document.getElementById("studio-intro");
const joystickBase = document.getElementById("move-joystick");
const joystickThumb = document.getElementById("joystick-thumb");

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
let touchMoveX = 0, touchMoveY = 0, joystickPointerId = null;
const clock = new THREE.Clock();

try { best = Number(localStorage.getItem("ssDodgeBest") || 0); } catch {}
bestValue.textContent = String(best).padStart(4, "0");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08090d);
scene.fog = new THREE.Fog(0x08090d, 18, 34);

const camera = new THREE.PerspectiveCamera(76, 1, 0.05, 90);
scene.add(camera); // Camera-attached avatar arms are rendered with the scene.
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
  cameraYaw -= event.movementX * lookSensitivity;
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
  ball: new THREE.MeshStandardMaterial({ color: 0xff2447, emissive: 0xff002b, emissiveIntensity: 3.2, roughness: 0.22, metalness: 0.05 }),
  firstPersonSleeve: new THREE.MeshStandardMaterial({ color: 0x252832, roughness: 0.86 }),
  firstPersonCuff: new THREE.MeshStandardMaterial({ color: 0x8f1028, emissive: 0x260008, emissiveIntensity: 0.55, roughness: 0.7 }),
  firstPersonSkin: new THREE.MeshStandardMaterial({ color: 0xc99573, roughness: 0.88 })
};

// Simple blocky first-person arms, inspired by classic avatar proportions.
// They are purely cosmetic: no tools or weapons are attached.
const firstPersonHands = new THREE.Group();
firstPersonHands.name = "FirstPersonAvatarArms";
camera.add(firstPersonHands);
firstPersonHands.visible = false;
const firstPersonArms = [];
function createBlockyArm(side) {
  const arm = new THREE.Group();
  arm.position.set(side * 0.34, -0.39, -0.78);
  arm.rotation.z = side * -0.08;
  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.43, 0.24), mats.firstPersonSleeve);
  sleeve.position.y = -0.025;
  const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.225, 0.085, 0.245), mats.firstPersonCuff);
  cuff.position.y = -0.265;
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.19, 0.235), mats.firstPersonSkin);
  palm.position.y = -0.39;
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.12, 0.13), mats.firstPersonSkin);
  thumb.position.set(-side * 0.115, -0.365, -0.035);
  arm.add(sleeve, cuff, palm, thumb);
  firstPersonHands.add(arm);
  firstPersonArms.push(arm);
}
createBlockyArm(-1);
createBlockyArm(1);

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
let lookSensitivity = 0.0035;
let savedFov = 76;
try {
  lookSensitivity = THREE.MathUtils.clamp(Number(localStorage.getItem("dodgeCoreSensitivity")) || 0.0035, 0.001, 0.01);
  savedFov = THREE.MathUtils.clamp(Number(localStorage.getItem("dodgeCoreFov")) || 76, 60, 100);
} catch {}
camera.fov = savedFov;
camera.updateProjectionMatrix();
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


function applySettings() {
  sensitivityInputs.forEach(input=>{ if(input) input.value=String(lookSensitivity); });
  fovInputs.forEach(input=>{ if(input) input.value=String(savedFov); });
  sensitivityOutputs.forEach(output=>{ if(output) output.textContent=lookSensitivity.toFixed(4); });
  fovOutputs.forEach(output=>{ if(output) output.textContent=savedFov+"°"; });
  camera.fov=savedFov;
  camera.updateProjectionMatrix();
}
sensitivityInputs.forEach(input=>input?.addEventListener("input",()=>{
  lookSensitivity=Number(input.value);
  try{localStorage.setItem("dodgeCoreSensitivity",String(lookSensitivity));}catch{}
  applySettings();
}));
fovInputs.forEach(input=>input?.addEventListener("input",()=>{
  savedFov=Number(input.value);
  try{localStorage.setItem("dodgeCoreFov",String(savedFov));}catch{}
  applySettings();
}));
applySettings();

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


/* Mobile fullscreen: Chrome/Android supports immersive fullscreen after a user gesture.
   iOS Safari may require adding the game to the Home Screen instead. */
const fullscreenButtons = [...document.querySelectorAll("[data-fullscreen-toggle]")];
const fullscreenLabels = [...document.querySelectorAll("[data-fullscreen-label]")];
const fullscreenStatuses = ["mobile-fullscreen-status","pause-fullscreen-status"]
  .map(id => document.getElementById(id)).filter(Boolean);
function isGameFullscreen() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}
function syncFullscreenUI() {
  const active = isGameFullscreen();
  fullscreenLabels.forEach(label => { label.textContent = active ? "EXIT FULLSCREEN" : "FULLSCREEN"; });
  fullscreenButtons.forEach(button => {
    button.setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen");
    button.classList.toggle("is-fullscreen", active);
  });
}
async function toggleGameFullscreen() {
  if (isGameFullscreen()) {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch {}
    return;
  }
  const target = document.documentElement;
  try {
    if (target.requestFullscreen) {
      await target.requestFullscreen({ navigationUI: "hide" });
    } else if (target.webkitRequestFullscreen) {
      target.webkitRequestFullscreen();
    } else {
      fullscreenStatuses.forEach(status => {
        status.textContent = "This browser cannot hide its address bar here. On iPhone, use Share → Add to Home Screen, then launch the game from its icon.";
      });
      return;
    }
    fullscreenStatuses.forEach(status => { status.textContent = ""; });
  } catch {
    fullscreenStatuses.forEach(status => {
      status.textContent = "Fullscreen was blocked by the browser. Tap FULLSCREEN again, or use Add to Home Screen if your browser requires it.";
    });
  }
  syncFullscreenUI();
}
fullscreenButtons.forEach(button => button.addEventListener("click", toggleGameFullscreen));
document.addEventListener("fullscreenchange", syncFullscreenUI);
document.addEventListener("webkitfullscreenchange", syncFullscreenUI);
window.addEventListener("orientationchange", () => window.setTimeout(resize, 180));
syncFullscreenUI();

function setScreen(active) {
  shell.classList.toggle("is-playing", active === "playing");
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
  cameraMotionTime = 0;
  firstPersonHands.visible = false;
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
  resetJoystick();
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
  resetJoystick();
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
document.getElementById("mobile-start-button")?.addEventListener("click", startRun);
restartButton.addEventListener("click", startRun);
pauseButton.addEventListener("click", pauseRun);
gameplayPauseButton.addEventListener("click", pauseRun);
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
window.addEventListener("blur", () => { keys.clear(); touchDirections.clear(); resetJoystick(); });

function updateJoystick(event) {
  const rect=joystickBase.getBoundingClientRect(), cx=rect.left+rect.width/2, cy=rect.top+rect.height/2, max=rect.width*.34;
  let dx=event.clientX-cx, dy=event.clientY-cy, d=Math.hypot(dx,dy);
  if(d>max){const s=max/d;dx*=s;dy*=s;}
  touchMoveX=THREE.MathUtils.clamp(dx/max,-1,1); touchMoveY=THREE.MathUtils.clamp(dy/max,-1,1);
  joystickThumb.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
}
function resetJoystick(){joystickPointerId=null;touchMoveX=0;touchMoveY=0;joystickThumb.style.transform="translate(-50%,-50%)";}
joystickBase.addEventListener("pointerdown",e=>{if(state!=="playing")return;e.preventDefault();joystickPointerId=e.pointerId;joystickBase.setPointerCapture(e.pointerId);updateJoystick(e);});
joystickBase.addEventListener("pointermove",e=>{if(e.pointerId===joystickPointerId)updateJoystick(e);});
for(const type of ["pointerup","pointercancel","lostpointercapture"])joystickBase.addEventListener(type,e=>{if(e.pointerId===joystickPointerId)resetJoystick();});

function isDown(...names) {
  return names.some((name) => keys.has(name) || touchDirections.has(name));
}

function jumpPlayer() {
  if (state !== "playing" || !grounded) return;
  jumpVelocity = CONFIG.player.jumpSpeed;
  grounded = false;
}

function updatePlayer(delta) {
  let side = touchMoveX;
  let forward = -touchMoveY;
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
  } else if (ball.position.x < -roomBounds.x) {
    ball.position.x = -roomBounds.x;
    ballVelocity.x = Math.abs(ballVelocity.x) * wallBounce;
    turnBallRandomly(0.16 + difficulty.chaos * 0.13);
    aimBallAtPlayer(difficulty);
  }
  if (ball.position.z > roomBounds.z) {
    ball.position.z = roomBounds.z;
    ballVelocity.z = -Math.abs(ballVelocity.z) * wallBounce;
    turnBallRandomly(0.16 + difficulty.chaos * 0.13);
    aimBallAtPlayer(difficulty);
  } else if (ball.position.z < -roomBounds.z) {
    ball.position.z = -roomBounds.z;
    ballVelocity.z = Math.abs(ballVelocity.z) * wallBounce;
    turnBallRandomly(0.16 + difficulty.chaos * 0.13);
    aimBallAtPlayer(difficulty);
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

let cameraMotionTime = 0;
function updateCamera(delta = 0) {
  // Subtle FPS locomotion: soft vertical bob, lateral sway and a restrained lean.
  const eyeHeight = 1.65 + jumpHeight;
  const moveAmount = Math.min(1, Math.hypot(playerVelocity.x, playerVelocity.z) / CONFIG.player.speed);
  cameraMotionTime += delta * (moveAmount > 0.04 ? 10 : 2);
  const bob = Math.sin(cameraMotionTime * 2) * 0.035 * moveAmount;
  const lateralSway = Math.sin(cameraMotionTime) * 0.018 * moveAmount;
  const movementLean = -playerVelocity.x / CONFIG.player.speed * 0.018;
  camera.position.set(player.position.x + lateralSway, eyeHeight + bob, player.position.z);
  camera.rotation.order = "YXZ";
  camera.rotation.set(cameraPitch, cameraYaw, movementLean + Math.sin(cameraMotionTime * 2) * 0.004 * moveAmount);
  firstPersonHands.visible = state === "playing" || state === "paused";
  firstPersonHands.position.set(
    -playerVelocity.x / CONFIG.player.speed * 0.022,
    -0.015 + Math.sin(cameraMotionTime * 2) * 0.018 * moveAmount,
    0
  );
  firstPersonHands.rotation.set(0, 0, -playerVelocity.x / CONFIG.player.speed * 0.035);
  firstPersonArms.forEach((arm, index) => {
    arm.rotation.x = Math.sin(cameraMotionTime * 2 + index * Math.PI) * 0.025 * moveAmount;
  });
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
requestAnimationFrame(()=>requestAnimationFrame(()=>window.setTimeout(()=>{
  introScreen.classList.add("intro-exit");
  introScreen.addEventListener("transitionend",()=>introScreen.remove(),{once:true});
},3200)));
