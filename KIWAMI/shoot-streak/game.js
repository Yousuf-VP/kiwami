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
const CAREER_STATS_KEY = "dodgeCoreCareerStats";
const emptyCareerStats = () => ({
  totalGamesPlayed: 0,
  totalSurvivalSeconds: 0,
  bestScore: 0,
  difficultyCounts: { easy: 0, medium: 0, hard: 0, extreme: 0, master: 0 }
});
let careerStats = emptyCareerStats();
const keys = new Set();
const touchDirections = new Set();
let touchMoveX = 0, touchMoveY = 0, joystickPointerId = null;
const clock = new THREE.Clock();

try {
  const storedStats = JSON.parse(localStorage.getItem(CAREER_STATS_KEY) || "null");
  if (storedStats && typeof storedStats === "object") {
    careerStats.totalGamesPlayed = Math.max(0, Number(storedStats.totalGamesPlayed) || 0);
    careerStats.totalSurvivalSeconds = Math.max(0, Number(storedStats.totalSurvivalSeconds) || 0);
    careerStats.bestScore = Math.max(0, Number(storedStats.bestScore) || 0);
    for (const level of Object.keys(careerStats.difficultyCounts)) {
      careerStats.difficultyCounts[level] = Math.max(0, Number(storedStats.difficultyCounts?.[level]) || 0);
    }
  }
  best = Math.max(careerStats.bestScore, Number(localStorage.getItem("ssDodgeBest") || 0));
} catch {}
careerStats.bestScore = Math.max(careerStats.bestScore, best);
bestValue.textContent = String(best).padStart(4, "0");

function saveCareerStats() {
  try {
    localStorage.setItem(CAREER_STATS_KEY, JSON.stringify(careerStats));
    localStorage.setItem("ssDodgeBest", String(careerStats.bestScore));
  } catch {}
}
function formatCareerTime(totalSeconds) {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) return hours + "h " + minutes + "m";
  if (minutes) return minutes + "m " + seconds + "s";
  return seconds + "s";
}
function getFavouriteDifficulty() {
  const entries = Object.entries(careerStats.difficultyCounts);
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0] && entries[0][1] > 0 ? DIFFICULTIES[entries[0][0]].label : "—";
}
function renderCareerStats() {
  const values = {
    "career-games": String(careerStats.totalGamesPlayed),
    "career-time": formatCareerTime(careerStats.totalSurvivalSeconds),
    "career-best": String(careerStats.bestScore).padStart(4, "0"),
    "career-favourite": getFavouriteDifficulty()
  };
  for (const [id, value] of Object.entries(values)) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }
}
renderCareerStats();

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
  cameraPitch = THREE.MathUtils.clamp(cameraPitch - event.movementY * lookSensitivity, -1.25, 1.25);
});

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (state !== "playing" || event.pointerType !== "touch" || event.clientX < window.innerWidth * 0.38) return;
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
  cameraYaw -= dx * lookSensitivity * 1.6;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch - dy * lookSensitivity * 1.6, -1.25, 1.25);
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
  // Classic avatar-style arms: one consistent light neutral material, like the reference.

};

const themeTrimMeshes = [];
function box(w, h, d, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  if (mat === mats.trim) themeTrimMeshes.push(mesh);
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

// SCORE-BASED ARENA COLOUR EVOLUTION
// Ordered as a cool-to-warm colour journey, with white as the neutral finale.
const arenaThemes = [
  { name:"GREEN", hex:0x39d98a, glow:0x16b96d, dark:0x071b12, ground:0x07140d },
  { name:"LIGHT BLUE", hex:0x55dcff, glow:0x21bfff, dark:0x071a25, ground:0x07131c },
  { name:"BLUE", hex:0x397dff, glow:0x185dff, dark:0x07152b, ground:0x07101f },
  { name:"PURPLE", hex:0xa879ff, glow:0x813cff, dark:0x160d28, ground:0x10091c },
  { name:"PINK", hex:0xff5aa9, glow:0xff278b, dark:0x210b19, ground:0x180812 },
  { name:"WHITE", hex:0xf2f5ff, glow:0xcbd8ff, dark:0x171a24, ground:0x10131b }
];
const themeCurrent = {
  ball: mats.ball.color.clone(), ballEmissive: mats.ball.emissive.clone(),
  aura: ballAura.material.color.clone(), ballLight: ballLight.color.clone(),
  roomGlow: redRoomGlow.color.clone(), playerFill: playerFillLight.color.clone(), ambientSky: ambient.color.clone(),
  ambientGround: ambient.groundColor.clone(), ceiling: ceilingLight.color.clone(),
  wall: mats.wall.color.clone(), floor: mats.floor.color.clone(),
  trim: mats.trim.color.clone(), background: scene.background.clone(),
  fog: scene.fog.color.clone()
};
const themeTarget = {};
let themeTransitionActive = false;
let lastThemeMilestone = 0;
let currentThemeName = "RED";
const themeBanner = document.getElementById("theme-banner");
const themeDefault = {
  ball: new THREE.Color(0xff2447), ballEmissive: new THREE.Color(0xff002b),
  aura: new THREE.Color(0xff123c), ballLight: new THREE.Color(0xff123c),
  roomGlow: new THREE.Color(0xff153d), playerFill: new THREE.Color(0xd8dce6), ambientSky: new THREE.Color(0xd8dce6),
  ambientGround: new THREE.Color(0x17151a), ceiling: new THREE.Color(0xffffff),
  wall: new THREE.Color(0x202229), floor: new THREE.Color(0x17191f),
  trim: new THREE.Color(0x9d172d), background: new THREE.Color(0x08090d),
  fog: new THREE.Color(0x08090d)
};
function applyThemeTargets(palette) {
  const accent = new THREE.Color(palette.hex);
  const glow = new THREE.Color(palette.glow);
  const dark = new THREE.Color(palette.dark);
  const ground = new THREE.Color(palette.ground);
  themeTarget.ball = accent.clone();
  themeTarget.ballEmissive = glow.clone();
  themeTarget.aura = glow.clone();
  themeTarget.ballLight = glow.clone();
  themeTarget.roomGlow = glow.clone();
  themeTarget.playerFill = accent.clone().lerp(new THREE.Color(0xd8dce6), 0.68);
  themeTarget.ambientSky = accent.clone().lerp(new THREE.Color(0xd8dce6), 0.62);
  themeTarget.ambientGround = ground.clone();
  themeTarget.ceiling = accent.clone().lerp(new THREE.Color(0xffffff), 0.82);
  themeTarget.wall = new THREE.Color(0x202229).lerp(dark, 0.36);
  themeTarget.floor = new THREE.Color(0x17191f).lerp(dark, 0.22);
  themeTarget.trim = accent.clone();
  themeTarget.background = new THREE.Color(0x08090d).lerp(dark, 0.32);
  themeTarget.fog = new THREE.Color(0x08090d).lerp(dark, 0.46);
  currentThemeName = palette.name;
}
function triggerArenaTheme(milestone) {
  const palette = arenaThemes[(milestone - 1) % arenaThemes.length];
  applyThemeTargets(palette);
  themeTransitionActive = true;
  document.documentElement.style.setProperty("--theme-accent", "#" + new THREE.Color(palette.hex).getHexString());
  document.documentElement.style.setProperty("--theme-glow", "#" + new THREE.Color(palette.glow).getHexString());
  document.documentElement.style.setProperty("--theme-accent-rgb", [
    (palette.hex >> 16) & 255, (palette.hex >> 8) & 255, palette.hex & 255
  ].join(","));
  if (themeBanner) {
    themeBanner.textContent = "+" + (milestone * 100).toLocaleString() + "  /  " + palette.name + " PHASE";
    themeBanner.classList.remove("theme-banner-show");
    void themeBanner.offsetWidth;
    themeBanner.classList.add("theme-banner-show");
  }
}
function updateArenaTheme(delta) {
  if (!themeTransitionActive) return;
  const amount = 1 - Math.exp(-delta * 2.5);
  const pairs = [
    [mats.ball.color, themeTarget.ball], [mats.ball.emissive, themeTarget.ballEmissive],
    [ballAura.material.color, themeTarget.aura], [ballLight.color, themeTarget.ballLight],
    [redRoomGlow.color, themeTarget.roomGlow], [playerFillLight.color, themeTarget.playerFill], [ambient.color, themeTarget.ambientSky],
    [ambient.groundColor, themeTarget.ambientGround], [ceilingLight.color, themeTarget.ceiling],
    [mats.wall.color, themeTarget.wall], [mats.floor.color, themeTarget.floor],
    [mats.trim.color, themeTarget.trim], [scene.background, themeTarget.background],
    [scene.fog.color, themeTarget.fog]
  ];
  for (const [current, target] of pairs) current.lerp(target, amount);
  if (pairs.every(([current, target]) => Math.max(Math.abs(current.r-target.r),Math.abs(current.g-target.g),Math.abs(current.b-target.b)) < 0.006)) {
    pairs.forEach(([current, target]) => current.copy(target));
    themeTransitionActive = false;
  }
}
function resetArenaTheme() {
  lastThemeMilestone = 0;
  currentThemeName = "RED";
  Object.keys(themeDefault).forEach(key => themeCurrent[key].copy(themeDefault[key]));
  mats.ball.color.copy(themeDefault.ball);
  mats.ball.emissive.copy(themeDefault.ballEmissive);
  ballAura.material.color.copy(themeDefault.aura);
  ballLight.color.copy(themeDefault.ballLight);
  redRoomGlow.color.copy(themeDefault.roomGlow);
  playerFillLight.color.copy(themeDefault.playerFill);
  ambient.color.copy(themeDefault.ambientSky);
  ambient.groundColor.copy(themeDefault.ambientGround);
  ceilingLight.color.copy(themeDefault.ceiling);
  mats.wall.color.copy(themeDefault.wall);
  mats.floor.color.copy(themeDefault.floor);
  mats.trim.color.copy(themeDefault.trim);
  scene.background.copy(themeDefault.background);
  scene.fog.color.copy(themeDefault.fog);
  themeTransitionActive = false;
  document.documentElement.style.setProperty("--theme-accent", "#ff183d");
  document.documentElement.style.setProperty("--theme-glow", "#ff536b");
  document.documentElement.style.setProperty("--theme-accent-rgb", "255,24,61");
  if (themeBanner) themeBanner.classList.remove("theme-banner-show");
}

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
  document.querySelectorAll('[data-panel-summary="difficulty"]').forEach(label=>label.textContent=DIFFICULTIES[level].label);
}

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => selectDifficulty(button.dataset.difficulty));
});

document.querySelectorAll("[data-panel-toggle]").forEach(button=>{
  button.addEventListener("click",()=>{
    const panel=document.getElementById(button.dataset.panelToggle);
    if(!panel)return;
    const opening=panel.classList.contains("hidden");
    panel.classList.toggle("hidden",!opening);
    button.setAttribute("aria-expanded",String(opening));
    const icon=button.querySelector("i");
    if(icon)icon.textContent=opening?"−":"+";
  });
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
  landingKick = 0;
  ball.position.set(1.5, 2.1, -5.5);
  const difficulty = DIFFICULTIES[selectedDifficulty];
  const startAngle = Math.random() * Math.PI * 2;
  const startSpeed = CONFIG.ball.speed * difficulty.speed;
  ballVelocity.set(Math.cos(startAngle) * startSpeed, 0, Math.sin(startAngle) * startSpeed);
  ballVerticalVelocity = 2.2 + Math.random() * 1.2;
  courseChangeTimer = 0;
  nextCourseChange = 1.1 + Math.random() * 1.5;
  scoreValue.textContent = "0000";
  resetArenaTheme();
  timeValue.textContent = "0.0s";
  keys.clear();
  touchDirections.clear();
  resetJoystick();
}

function startRun() {
  resetRun();
  careerStats.totalGamesPlayed += 1;
  saveCareerStats();
  renderCareerStats();
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
  const survived = Math.max(0, elapsed);
  const newRecord = final > best;
  finalScore.textContent = String(final).padStart(4, "0");
  if (newRecord) {
    best = final;
    bestValue.textContent = String(best).padStart(4, "0");
  }
  careerStats.totalSurvivalSeconds += survived;
  careerStats.bestScore = Math.max(careerStats.bestScore, final, best);
  careerStats.difficultyCounts[selectedDifficulty] = (careerStats.difficultyCounts[selectedDifficulty] || 0) + 1;
  saveCareerStats();
  renderCareerStats();

  const runBest = document.getElementById("run-best-value");
  const runTime = document.getElementById("run-time-value");
  const runDifficulty = document.getElementById("run-difficulty-value");
  const recordBadge = document.getElementById("new-record-badge");
  const recordStatus = document.getElementById("record-status");
  if (runBest) runBest.textContent = String(best).padStart(4, "0");
  if (runTime) runTime.textContent = survived.toFixed(1) + "s";
  if (runDifficulty) runDifficulty.textContent = DIFFICULTIES[selectedDifficulty].label;
  if (recordBadge) recordBadge.classList.toggle("hidden", !newRecord);
  if (recordStatus) recordStatus.textContent = newRecord ? "NEW PERSONAL BEST" : "PERSONAL BEST  /  " + String(best).padStart(4, "0");
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
  event.stopPropagation();
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
joystickBase.addEventListener("pointerdown",e=>{if(state!=="playing")return;e.preventDefault();e.stopPropagation();joystickPointerId=e.pointerId;joystickBase.setPointerCapture(e.pointerId);updateJoystick(e);});
joystickBase.addEventListener("pointermove",e=>{if(e.pointerId===joystickPointerId){e.preventDefault();e.stopPropagation();updateJoystick(e);}});
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
      const landedFromHeight = jumpHeight < 0;
      jumpHeight = 0;
      jumpVelocity = 0;
      grounded = true;
      if (landedFromHeight) landingKick = Math.min(0.16, Math.abs(jumpVelocity) * 0.012 + 0.09);
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
let landingKick = 0;
function updateCamera(delta = 0) {
  // Athletic parkour-style movement: stronger stride bob, directional lean,
  // forward momentum pitch and a brief cushioned landing response.
  const speed = Math.hypot(playerVelocity.x, playerVelocity.z);
  const moveAmount = Math.min(1, speed / CONFIG.player.speed);
  const forwardX = -Math.sin(cameraYaw);
  const forwardZ = -Math.cos(cameraYaw);
  const rightX = Math.cos(cameraYaw);
  const rightZ = -Math.sin(cameraYaw);
  const localForward = (playerVelocity.x * forwardX + playerVelocity.z * forwardZ) / CONFIG.player.speed;
  const localStrafe = (playerVelocity.x * rightX + playerVelocity.z * rightZ) / CONFIG.player.speed;

  cameraMotionTime += delta * (moveAmount > 0.04 ? 13 : 2.2);
  landingKick = THREE.MathUtils.damp(landingKick, 0, 10, delta);
  const strideBob = Math.abs(Math.sin(cameraMotionTime)) * 0.075 * moveAmount;
  const verticalBounce = Math.sin(cameraMotionTime * 2) * 0.018 * moveAmount;
  const lateralSway = Math.sin(cameraMotionTime) * 0.045 * moveAmount;
  const forwardDip = -Math.max(0, localForward) * 0.045;
  const strafeLean = -localStrafe * 0.075;
  const strideRoll = Math.sin(cameraMotionTime) * 0.012 * moveAmount;

  camera.position.set(
    player.position.x + rightX * lateralSway,
    1.65 + jumpHeight - strideBob + verticalBounce - landingKick + forwardDip * 0.18,
    player.position.z + rightZ * lateralSway
  );
  camera.rotation.order = "YXZ";
  camera.rotation.set(
    cameraPitch + Math.max(0, localForward) * 0.025 + landingKick * 0.22,
    cameraYaw,
    strafeLean + strideRoll
  );
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
    const reachedMilestone = Math.floor(score / 100);
    if (reachedMilestone > lastThemeMilestone) {
      lastThemeMilestone = reachedMilestone;
      triggerArenaTheme(reachedMilestone);
    }
    updateArenaTheme(delta);
    scoreValue.textContent = String(Math.floor(score)).padStart(4, "0");
    timeValue.textContent = elapsed.toFixed(1) + "s";
    ball.rotation.x += delta * 0.8;
    ball.rotation.z += delta * 1.1;
    ballAura.rotation.y -= delta * 0.4;
  } else {
    updateArenaTheme(delta);
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
