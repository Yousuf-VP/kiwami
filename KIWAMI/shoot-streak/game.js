
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

/* ==========================================
   SHOOT-STREAK — THREE.JS GAME ENGINE
   KIWAMI ARCADE
========================================== */

/* ---------- GAME CONFIGURATION ---------- */

const CONFIG = {
    arena: {
        width: 11,
        depth: 19,
        height: 5,
        frontZ: 9,
        backZ: -10
    },

    player: {
        speed: 6.5,
        startX: 0,
        startZ: 7.1,
        eyeHeight: 1.65,
        jumpSpeed: 8.4,
        jumpGravity: 30,
        jumpCooldown: 1.15,
        jumpClearance: 0.82
    },

    ball: {
        radius: 0.42,
        gravity: 17,
        initialSpeed: 14.5,
        slopeGravity: 2.6,
        wallBounce: 0.97,
        knockback: 30
    },

    weapon: {
        maxAmmo: 2,
        reloadTime: 2.4,
        fireCooldown: 0.32,
        range: 35,
        aimAssistAngle: 0.13,
        aimAssistStrength: 0.94
    }
};

/* ---------- DOM ---------- */

const shell = document.getElementById("game-shell");

const startScreen = document.getElementById("start-screen");
const pauseScreen = document.getElementById("pause-screen");
const gameOverScreen = document.getElementById("game-over-screen");

const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const resumeButton = document.getElementById("resume-button");
const restartButton = document.getElementById("restart-button");

const scoreValue = document.getElementById("score-value");
const ballStatus = document.getElementById("ball-status");
const ammoValue = document.getElementById("ammo-value");
const ammoFill = document.getElementById("ammo-fill");
const reloadLabel = document.getElementById("reload-label");
const finalScore = document.getElementById("final-score");
const toast = document.getElementById("toast");

if (
    !shell ||
    !startScreen ||
    !pauseScreen ||
    !gameOverScreen ||
    !startButton ||
    !pauseButton ||
    !resumeButton ||
    !restartButton
) {
    throw new Error("SHOOT-STREAK: Required HTML elements are missing. Check your index.html IDs.");
}

/* ---------- THREE.JS SETUP ---------- */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07101e);
scene.fog = new THREE.Fog(0x07101e, 17, 36);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);

camera.rotation.order = "YXZ";
camera.position.set(
    CONFIG.player.startX,
    CONFIG.player.eyeHeight,
    CONFIG.player.startZ
);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

renderer.domElement.id = "game-canvas";
shell.prepend(renderer.domElement);

/* ---------- LIGHTING ---------- */

const ambientLight = new THREE.HemisphereLight(0x9edfff, 0x10152a, 1.5);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xb9e8ff, 2.2);
mainLight.position.set(-4, 9, 5);
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(1024, 1024);
mainLight.shadow.camera.left = -12;
mainLight.shadow.camera.right = 12;
mainLight.shadow.camera.top = 12;
mainLight.shadow.camera.bottom = -12;
scene.add(mainLight);

const backLight = new THREE.PointLight(0x087dff, 30, 18);
backLight.position.set(0, 3, -8);
scene.add(backLight);

const redAmbient = new THREE.PointLight(0xff123d, 20, 8);
scene.add(redAmbient);

/* ---------- MATERIALS ---------- */

const materials = {
    floor: new THREE.MeshStandardMaterial({
        color: 0x101d32,
        roughness: 0.72,
        metalness: 0.35
    }),

    wall: new THREE.MeshStandardMaterial({
        color: 0x14243b,
        roughness: 0.48,
        metalness: 0.48
    }),

    dark: new THREE.MeshStandardMaterial({
        color: 0x070d19,
        roughness: 0.65,
        metalness: 0.25
    }),

    cyan: new THREE.MeshStandardMaterial({
        color: 0x00dfff,
        emissive: 0x007caa,
        emissiveIntensity: 2
    }),

    blue: new THREE.MeshStandardMaterial({
        color: 0x286bff,
        emissive: 0x123baf,
        emissiveIntensity: 1.4
    }),

    red: new THREE.MeshStandardMaterial({
        color: 0xff193e,
        emissive: 0xff002b,
        emissiveIntensity: 3.8,
        roughness: 0.2,
        metalness: 0.1
    }),

    hand: new THREE.MeshStandardMaterial({
        color: 0xd69b79,
        roughness: 0.82
    }),

    glove: new THREE.MeshStandardMaterial({
        color: 0x172c48,
        roughness: 0.7
    }),

    weapon: new THREE.MeshStandardMaterial({
        color: 0x24334b,
        roughness: 0.35,
        metalness: 0.72
    })
};

/* ---------- ARENA ---------- */

const arena = new THREE.Group();
scene.add(arena);

function addBox(parent, width, height, depth, material, x, y, z) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        material
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    parent.add(mesh);
    return mesh;
}

// Main floor
addBox(
    arena,
    CONFIG.arena.width,
    0.5,
    CONFIG.arena.depth,
    materials.floor,
    0,
    -0.3,
    -0.5
);

// Tilted side walls
const leftWall = addBox(
    arena, 0.45, CONFIG.arena.height, CONFIG.arena.depth,
    materials.wall, -5.65, 2.15, -0.5
);
leftWall.rotation.z = -0.045;

const rightWall = addBox(
    arena, 0.45, CONFIG.arena.height, CONFIG.arena.depth,
    materials.wall, 5.65, 2.15, -0.5
);
rightWall.rotation.z = 0.045;

// Rear wall
addBox(
    arena,
    CONFIG.arena.width,
    CONFIG.arena.height,
    0.5,
    materials.wall,
    0,
    2.15,
    -10
);

// PLAYER-SIDE ENERGY REBOUND WALL
const frontReboundWallZ = 9.5;
addBox(
    arena,
    CONFIG.arena.width,
    CONFIG.arena.height,
    0.5,
    materials.wall,
    0,
    2.15,
    frontReboundWallZ
);

// Layered wall face and luminous frame.
addBox(arena, 10.35, 3.9, 0.12, materials.dark, 0, 2.15, 9.20);
addBox(arena, 10.45, 0.10, 0.10, materials.cyan, 0, 4.12, 9.10);
addBox(arena, 10.45, 0.10, 0.10, materials.blue, 0, 0.18, 9.10);
addBox(arena, 0.10, 3.95, 0.10, materials.cyan, -5.12, 2.15, 9.10);
addBox(arena, 0.10, 3.95, 0.10, materials.cyan, 5.12, 2.15, 9.10);

// Repeating energy ribs
for (let i = 0; i < 9; i++) {
    const x = -4 + i;
    addBox(
        arena, 0.045, 3.25, 0.07,
        i % 2 === 0 ? materials.cyan : materials.blue,
        x, 2.15, 9.08
    );
}

// Central energy rings
const wallCore = new THREE.Group();
wallCore.position.set(0, 2.15, 9.02);
arena.add(wallCore);

const wallRingMaterial = new THREE.MeshStandardMaterial({
    color: 0x00eaff,
    emissive: 0x00aaff,
    emissiveIntensity: 2.8,
    metalness: 0.45,
    roughness: 0.25
});

const wallOuterRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.18, 0.055, 10, 64),
    wallRingMaterial
);
wallCore.add(wallOuterRing);

const wallInnerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.78, 0.035, 8, 48),
    materials.blue
);
wallCore.add(wallInnerRing);

const wallCoreLight = new THREE.PointLight(0x00dfff, 18, 8);
wallCoreLight.position.set(0, 0, -0.25);
wallCore.add(wallCoreLight);

// Short horizontal energy bars
for (let i = -2; i <= 2; i++) {
    addBox(arena, 2.5, 0.035, 0.045, materials.cyan, 0, 2.15 + i * 0.42, 9.00);
}

// Cyan arena edges
addBox(arena, 0.055, 0.055, 19, materials.cyan, -5.35, 0.02, -0.5);
addBox(arena, 0.055, 0.055, 19, materials.cyan, 5.35, 0.02, -0.5);
addBox(arena, 11, 0.055, 0.055, materials.cyan, 0, 0.02, -9.65);

// Rear wall light strips
for (let i = 0; i < 5; i++) {
    addBox(
        arena, 0.06, 3.4, 0.06,
        materials.blue, -4 + i * 2, 2.1, -9.68
    );
}

// Decorative floor grid
const grid = new THREE.GridHelper(10.5, 22, 0x087eaa, 0x18304d);
grid.position.set(0, -0.035, -0.5);
arena.add(grid);

// Decorative side lights
for (let z = -8; z <= 7; z += 3) {
    addBox(arena, 0.08, 0.08, 0.7, materials.cyan, -5.35, 1.5, z);
    addBox(arena, 0.08, 0.08, 0.7, materials.cyan, 5.35, 1.5, z);
}

/* ---------- CORNER BOUNCERS ---------- */

const bouncers = [];

const bouncerPositions = [
    { x: -4.25, z: 7.15 },
    { x: 4.25, z: 7.15 }
];

const bouncerTopY = 0.34;

const bouncerBaseMaterial = new THREE.MeshStandardMaterial({
    color: 0x101c32,
    metalness: 0.82,
    roughness: 0.28
});

const bouncerTopMaterial = new THREE.MeshStandardMaterial({
    color: 0x173b59,
    emissive: 0x006b9b,
    emissiveIntensity: 2.0,
    metalness: 0.65,
    roughness: 0.24
});

for (const position of bouncerPositions) {
    const group = new THREE.Group();
    group.position.set(position.x, 0, position.z);
    arena.add(group);

    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.88, 1.0, 0.28, 32),
        bouncerBaseMaterial
    );
    base.position.y = 0.14;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const topMaterial = bouncerTopMaterial.clone();
    const top = new THREE.Mesh(
        new THREE.CylinderGeometry(0.76, 0.82, 0.12, 32),
        topMaterial
    );
    top.position.y = bouncerTopY - 0.06;
    top.castShadow = true;
    group.add(top);

    const ringMaterial = materials.cyan.clone();
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.77, 0.045, 8, 40),
        ringMaterial
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = bouncerTopY + 0.005;
    group.add(ring);

    // Four illuminated markers
    for (let i = 0; i < 4; i++) {
        const marker = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.035, 0.28),
            materials.cyan
        );
        const angle = (i / 4) * Math.PI * 2;
        marker.position.set(
            Math.cos(angle) * 0.48,
            bouncerTopY + 0.012,
            Math.sin(angle) * 0.48
        );
        marker.rotation.y = -angle;
        group.add(marker);
    }

    const light = new THREE.PointLight(0x00dfff, 4.5, 4.2);
    light.position.y = 0.75;
    group.add(light);

    bouncers.push({
        group,
        x: position.x,
        z: position.z,
        radius: 0.92,
        topY: bouncerTopY,
        cooldown: 0,
        pulseOffset: Math.random() * Math.PI * 2,
        topMaterial,
        ringMaterial,
        light
    });
}

/* ---------- RED ENERGY BALL ---------- */

const ball = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.ball.radius, 32, 24),
    materials.red
);

ball.castShadow = true;
ball.position.set(0, 1.3, -7.1);
scene.add(ball);

const ballLight = new THREE.PointLight(0xff153d, 32, 8);
scene.add(ballLight);

const ballHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.58, 24, 16),
    new THREE.MeshBasicMaterial({
        color: 0xff173f,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
    })
);
scene.add(ballHalo);

// Soft outer aura makes the red energy ball visibly glow against the arena.
const ballOuterAura = new THREE.Mesh(
    new THREE.SphereGeometry(0.78, 24, 16),
    new THREE.MeshBasicMaterial({
        color: 0xff1744,
        transparent: true,
        opacity: 0.075,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        toneMapped: false
    })
);
scene.add(ballOuterAura);

/* ---------- FIRST-PERSON VIEWMODEL ---------- */

const viewModel = new THREE.Group();
camera.add(viewModel);
scene.add(camera);

const gunGroup = new THREE.Group();
viewModel.add(gunGroup);

// Main blaster body
const gunBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.23, 0.2, 0.72),
    materials.weapon
);
gunBody.position.set(0.28, -0.28, -0.62);
gunBody.castShadow = true;
gunGroup.add(gunBody);

// Upper barrel
const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.08, 0.48, 16),
    materials.dark
);
barrel.rotation.x = Math.PI / 2;
barrel.position.set(0.28, -0.2, -1.02);
gunGroup.add(barrel);

// Cyan barrel ring
const barrelRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.075, 0.015, 8, 20),
    materials.cyan
);
barrelRing.position.set(0.28, -0.2, -1.25);
gunGroup.add(barrelRing);

// Energy chamber
const energyChamber = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.1, 0.28),
    materials.cyan
);
energyChamber.position.set(0.28, -0.15, -0.7);
gunGroup.add(energyChamber);

// Grip
const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.29, 0.17),
    materials.dark
);
grip.position.set(0.28, -0.49, -0.52);
grip.rotation.x = -0.22;
gunGroup.add(grip);

// Blocky first-person arms and hands, styled like a classic Roblox avatar.
// Both arms visibly support the shotgun: the right hand holds the grip,
// while the left hand supports the front of the weapon.
const leftArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.19, 0.19, 0.62),
    materials.glove
);
leftArm.position.set(0.15, -0.48, -0.66);
leftArm.rotation.x = -0.18;
leftArm.rotation.y = 0.02;
viewModel.add(leftArm);

const leftHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.18, 0.20),
    materials.hand
);
leftHand.position.set(0.24, -0.34, -0.96);
leftHand.rotation.x = -0.12;
viewModel.add(leftHand);

const rightArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 0.20, 0.62),
    materials.glove
);
rightArm.position.set(0.34, -0.52, -0.38);
rightArm.rotation.x = -0.12;
rightArm.rotation.y = -0.08;
viewModel.add(rightArm);

const rightHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.19, 0.20),
    materials.hand
);
rightHand.position.set(0.30, -0.39, -0.62);
rightHand.rotation.x = -0.08;
viewModel.add(rightHand);

// Viewmodel lighting
const viewLight = new THREE.PointLight(0x62dfff, 0.8, 2);
viewLight.position.set(0, 0.1, -0.5);
viewModel.add(viewLight);

/* ---------- GAME STATE ---------- */

let gameStarted = false;
let gamePaused = false;
let gameOver = false;
let pointerLocked = false;
let hasHadPointerLock = false;

let score = 0;
let lastSpeedTier = 0;
let ammo = CONFIG.weapon.maxAmmo;

let isReloading = false;
let lastShotTime = 0;
let reloadTimer = null;

let ballVelocity = new THREE.Vector3();
let hitCooldown = 0;

let playerX = CONFIG.player.startX;
let playerZ = CONFIG.player.startZ;
let jumpHeight = 0;
let jumpVelocity = 0;
let jumpCooldown = 0;

let yaw = 0;
let pitch = 0;
let targetYaw = 0;
let targetPitch = 0;
let screenShake = 0;
let landingImpact = 0;

// LEFT / RIGHT CAMERA TILT
let movementTilt = 0;

let recoil = 0;
let weaponBob = 0;

const keys = {};
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const mouseCenter = new THREE.Vector2(0, 0);
const playerPosition = new THREE.Vector3();

/* ---------- PLAYER SETTINGS ---------- */

const SETTINGS_DEFAULTS = {
    sensitivity: 0.0045,
    fov: 75,
    crosshair: "cross"
};

let playerSettings = { ...SETTINGS_DEFAULTS };

try {
    const saved = JSON.parse(localStorage.getItem("shootStreakSettings") || "null");
    if (saved && typeof saved === "object") {
        playerSettings.sensitivity = THREE.MathUtils.clamp(
            Number(saved.sensitivity) || SETTINGS_DEFAULTS.sensitivity,
            0.0005,
            0.025
        );
        playerSettings.fov = THREE.MathUtils.clamp(
            Number(saved.fov) || SETTINGS_DEFAULTS.fov,
            60,
            110
        );
        playerSettings.crosshair = ["cross", "dot", "circle", "off"].includes(saved.crosshair)
            ? saved.crosshair
            : SETTINGS_DEFAULTS.crosshair;
    }
} catch (error) {
    console.warn("SHOOT-STREAK: Could not load saved settings.", error);
}

const settingsStyle = document.createElement("style");
settingsStyle.textContent = `
#settings-open-button{position:relative;z-index:35;flex-shrink:0;margin-left:8px;padding:10px 15px;border:1px solid rgba(116,220,255,.3);border-radius:999px;color:#e9faff;background:rgba(8,19,35,.78);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);font:700 10px 'Orbitron',sans-serif;letter-spacing:1px;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.08);transition:.2s ease}
#settings-open-button:hover{border-color:#00eaff;box-shadow:0 0 22px rgba(0,234,255,.2);transform:translateY(-1px)}
#settings-panel{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:18px;background:rgba(2,7,15,.8);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
#settings-panel[hidden]{display:none!important}
.ss-settings-card{width:min(440px,100%);max-height:90vh;overflow-y:auto;padding:25px;border:1px solid rgba(93,215,255,.27);border-radius:22px;color:#eafaff;background:linear-gradient(145deg,rgba(13,28,49,.98),rgba(5,11,23,.99));box-shadow:0 24px 90px rgba(0,0,0,.58),0 0 38px rgba(0,210,255,.09);font-family:'Space Grotesk',sans-serif}
.ss-settings-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:20px}
.ss-settings-title{margin:0;font:700 18px 'Orbitron',sans-serif;letter-spacing:1.3px}
.ss-settings-subtitle{margin:6px 0 0;color:#8faabd;font-size:12px}
#settings-close-button{width:35px;height:35px;border-radius:50%;border:1px solid rgba(150,220,255,.2);color:#dffaff;background:rgba(255,255,255,.06);font-size:20px;cursor:pointer}
.ss-setting-row{padding:16px 0;border-top:1px solid rgba(150,220,255,.11)}
.ss-setting-label{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;color:#e7f8ff;font-size:13px;font-weight:600}
.ss-setting-value{color:#00eaff;font:700 11px 'Orbitron',sans-serif}
.ss-setting-range{width:100%;accent-color:#00dff5;cursor:pointer}
.ss-setting-help{margin:8px 0 0;color:#8099aa;font-size:11px;line-height:1.5}
.ss-crosshair-options{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.ss-crosshair-option{min-height:62px;border:1px solid rgba(150,220,255,.17);border-radius:12px;color:#b9d5e2;background:rgba(255,255,255,.035);cursor:pointer;font:600 10px 'Space Grotesk',sans-serif}
.ss-crosshair-option[aria-pressed="true"]{color:#eaffff;border-color:#00dff5;background:rgba(0,223,245,.1);box-shadow:inset 0 0 18px rgba(0,223,245,.07)}
.ss-crosshair-preview{display:block;position:relative;width:20px;height:20px;margin:0 auto 6px}
.ss-crosshair-preview.cross:before,.ss-crosshair-preview.cross:after{content:'';position:absolute;background:#00eaff}
.ss-crosshair-preview.cross:before{width:2px;height:20px;left:9px;top:0}
.ss-crosshair-preview.cross:after{height:2px;width:20px;top:9px;left:0}
.ss-crosshair-preview.dot:after{content:'';position:absolute;width:5px;height:5px;border-radius:50%;background:#00eaff;left:7.5px;top:7.5px}
.ss-crosshair-preview.circle{border:2px solid #00eaff;border-radius:50%}
.ss-crosshair-preview.off:after{content:'×';position:absolute;inset:-2px 0 0;text-align:center;color:#00eaff;font-size:20px}
#settings-reset-button{margin-top:18px;width:100%;padding:12px;border:1px solid rgba(0,234,255,.28);border-radius:12px;color:#dffaff;background:rgba(0,234,255,.08);cursor:pointer;font:700 10px 'Orbitron',sans-serif;letter-spacing:1px}
#settings-reset-button:hover{background:rgba(0,234,255,.15)}
#crosshair[data-crosshair="off"]{display:none!important}
#crosshair[data-crosshair="dot"]{width:5px!important;height:5px!important;border:0!important;border-radius:50%!important;background:#00efff!important;box-shadow:0 0 8px #00efff!important}
#crosshair[data-crosshair="dot"]:before,#crosshair[data-crosshair="dot"]:after{display:none!important}
#crosshair[data-crosshair="circle"]{width:22px!important;height:22px!important;border:2px solid #00efff!important;border-radius:50%!important;background:transparent!important;box-shadow:0 0 8px rgba(0,239,255,.65)!important}
#crosshair[data-crosshair="circle"]:before,#crosshair[data-crosshair="circle"]:after{display:none!important}
#crosshair[data-crosshair="cross"]{width:18px!important;height:18px!important;border:0!important;background:transparent!important}
#crosshair[data-crosshair="cross"]:before,#crosshair[data-crosshair="cross"]:after{content:''!important;display:block!important;position:absolute!important;background:#00efff!important;box-shadow:0 0 7px #00efff!important}
#crosshair[data-crosshair="cross"]:before{width:2px!important;height:18px!important;left:8px!important;top:0!important}
#crosshair[data-crosshair="cross"]:after{width:18px!important;height:2px!important;left:0!important;top:8px!important}
#crosshair{position:fixed!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;pointer-events:none!important;z-index:8!important}
/* FROSTED PAUSE SCREEN */
#game-shell.ss-paused #game-canvas{filter:blur(3px) brightness(.58) saturate(.78);transform:scale(1.012);transition:filter .22s ease,transform .22s ease}
#game-shell #game-canvas{transition:filter .22s ease,transform .22s ease}
#game-shell.ss-paused:after{content:"";position:fixed;inset:0;z-index:18;pointer-events:none;background:linear-gradient(135deg,rgba(167,224,255,.055),rgba(8,21,43,.18));backdrop-filter:blur(1.5px);-webkit-backdrop-filter:blur(1.5px)}
#pause-screen{z-index:25!important;backdrop-filter:blur(8px)!important;-webkit-backdrop-filter:blur(8px)!important}
#pause-screen:not(.hidden){display:flex!important;align-items:center;justify-content:center;flex-direction:column;gap:14px;padding:24px;background:rgba(4,12,25,.24)!important}
#pause-screen .ss-pause-title{display:block;margin:0 0 8px;color:#f0fbff;font:800 clamp(24px,4vw,38px) 'Orbitron',sans-serif;letter-spacing:4px;text-align:center;text-shadow:0 0 24px rgba(0,224,255,.34)}
#pause-screen .ss-pause-subtitle{margin:-5px 0 8px;color:#a8c7d8;font:500 11px 'Space Grotesk',sans-serif;letter-spacing:2px;text-align:center}
#pause-settings-button{min-width:180px;padding:12px 18px;border:1px solid rgba(122,225,255,.38);border-radius:999px;color:#e9fbff;background:rgba(140,205,235,.10);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);font:700 10px 'Orbitron',sans-serif;letter-spacing:1.4px;cursor:pointer;box-shadow:inset 0 1px rgba(255,255,255,.12),0 8px 30px rgba(0,0,0,.22);transition:.2s ease}
#pause-settings-button:hover{background:rgba(0,220,255,.16);border-color:#00eaff;box-shadow:0 0 24px rgba(0,220,255,.2)}
#settings-open-button{position:relative;z-index:35}
@media(max-width:600px){#settings-open-button{padding:9px 11px;font-size:9px}.ss-settings-card{padding:19px}#pause-screen{padding:16px}}
`;
document.head.appendChild(settingsStyle);

let crosshairElement = document.getElementById("crosshair");
if (!crosshairElement) {
    crosshairElement = document.createElement("div");
    crosshairElement.id = "crosshair";
    shell.appendChild(crosshairElement);
}

// Add a clear PAUSED label and a dedicated settings control to the pause overlay.
// Existing Resume/Restart controls remain untouched.
if (!pauseScreen.querySelector(".ss-pause-title")) {
    const pauseTitle = document.createElement("h2");
    pauseTitle.className = "ss-pause-title";
    pauseTitle.textContent = "PAUSED";
    pauseScreen.prepend(pauseTitle);
}

if (!pauseScreen.querySelector(".ss-pause-subtitle")) {
    const pauseSubtitle = document.createElement("p");
    pauseSubtitle.className = "ss-pause-subtitle";
    pauseSubtitle.textContent = "YOUR RUN IS ON HOLD";
    const title = pauseScreen.querySelector(".ss-pause-title");
    title.insertAdjacentElement("afterend", pauseSubtitle);
}

let pauseSettingsButton = pauseScreen.querySelector("#pause-settings-button");
if (!pauseSettingsButton) {
    pauseSettingsButton = document.createElement("button");
    pauseSettingsButton.id = "pause-settings-button";
    pauseSettingsButton.type = "button";
    pauseSettingsButton.textContent = "⚙ GAME SETTINGS";
    pauseScreen.appendChild(pauseSettingsButton);
}

const settingsButton = document.createElement("button");
settingsButton.id = "settings-open-button";
settingsButton.type = "button";
settingsButton.textContent = "⚙ SETTINGS";
const topbar = document.getElementById("topbar");
(topbar || shell).appendChild(settingsButton);

const settingsPanel = document.createElement("div");
settingsPanel.id = "settings-panel";
settingsPanel.hidden = true;
settingsPanel.innerHTML = `
<section class="ss-settings-card" role="dialog" aria-modal="true" aria-labelledby="ss-settings-title">
  <div class="ss-settings-head"><div><h2 class="ss-settings-title" id="ss-settings-title">GAME SETTINGS</h2><p class="ss-settings-subtitle">Tune your controls and visibility.</p></div><button id="settings-close-button" type="button" aria-label="Close settings">×</button></div>
  <div class="ss-setting-row"><label class="ss-setting-label" for="ss-sensitivity"><span>Mouse sensitivity</span><output class="ss-setting-value" id="ss-sensitivity-value">1.00×</output></label><input class="ss-setting-range" id="ss-sensitivity" type="range" min="0.0005" max="0.025" step="0.0001"><p class="ss-setting-help">Controls how quickly your view moves. The maximum is much faster; start low and increase gradually.</p></div>
  <div class="ss-setting-row"><label class="ss-setting-label" for="ss-fov"><span>Field of view (FOV)</span><output class="ss-setting-value" id="ss-fov-value">75°</output></label><input class="ss-setting-range" id="ss-fov" type="range" min="60" max="110" step="1"><p class="ss-setting-help">Higher FOV shows more of the arena; lower FOV gives a zoomed-in view.</p></div>
  <div class="ss-setting-row"><div class="ss-setting-label"><span>Crosshair type</span><span class="ss-setting-value" id="ss-crosshair-value">CROSS</span></div><div class="ss-crosshair-options">
    <button class="ss-crosshair-option" type="button" data-crosshair-choice="cross" aria-pressed="true"><span class="ss-crosshair-preview cross"></span>Cross</button>
    <button class="ss-crosshair-option" type="button" data-crosshair-choice="dot" aria-pressed="false"><span class="ss-crosshair-preview dot"></span>Dot</button>
    <button class="ss-crosshair-option" type="button" data-crosshair-choice="circle" aria-pressed="false"><span class="ss-crosshair-preview circle"></span>Circle</button>
    <button class="ss-crosshair-option" type="button" data-crosshair-choice="off" aria-pressed="false"><span class="ss-crosshair-preview off"></span>Off</button>
  </div></div>
  <button id="settings-reset-button" type="button">RESET TO DEFAULTS</button>
</section>`;
shell.appendChild(settingsPanel);

const sensitivityInput = settingsPanel.querySelector("#ss-sensitivity");
const sensitivityValue = settingsPanel.querySelector("#ss-sensitivity-value");
const fovInput = settingsPanel.querySelector("#ss-fov");
const fovValue = settingsPanel.querySelector("#ss-fov-value");
const crosshairValue = settingsPanel.querySelector("#ss-crosshair-value");
const settingsCloseButton = settingsPanel.querySelector("#settings-close-button");
const settingsResetButton = settingsPanel.querySelector("#settings-reset-button");

function savePlayerSettings() {
    try {
        localStorage.setItem("shootStreakSettings", JSON.stringify(playerSettings));
    } catch (error) {
        console.warn("SHOOT-STREAK: Could not save settings.", error);
    }
}

function applyPlayerSettings() {
    camera.fov = playerSettings.fov;
    camera.updateProjectionMatrix();
    sensitivityInput.value = String(playerSettings.sensitivity);
    sensitivityValue.textContent = `${(playerSettings.sensitivity / SETTINGS_DEFAULTS.sensitivity).toFixed(2)}×`;
    fovInput.value = String(playerSettings.fov);
    fovValue.textContent = `${playerSettings.fov}°`;
    crosshairElement.dataset.crosshair = playerSettings.crosshair;
    crosshairValue.textContent = playerSettings.crosshair.toUpperCase();
    settingsPanel.querySelectorAll("[data-crosshair-choice]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.crosshairChoice === playerSettings.crosshair));
    });
    savePlayerSettings();
}

function openSettings() {
    settingsPanel.hidden = false;
    if (document.pointerLockElement) document.exitPointerLock();
    if (gameStarted && !gameOver) {
        gamePaused = true;
        shell.classList.add("ss-paused");
        pauseScreen.classList.add("hidden");
    }
}

function closeSettings() {
    settingsPanel.hidden = true;
    if (gameStarted && !gameOver) {
        gamePaused = true;
        shell.classList.add("ss-paused");
        pauseScreen.classList.remove("hidden");
    }
}

settingsButton.addEventListener("click", openSettings);
pauseSettingsButton.addEventListener("click", openSettings);
settingsCloseButton.addEventListener("click", closeSettings);
settingsPanel.addEventListener("click", (event) => {
    if (event.target === settingsPanel) closeSettings();
});
sensitivityInput.addEventListener("input", () => {
    playerSettings.sensitivity = Number(sensitivityInput.value);
    applyPlayerSettings();
});
fovInput.addEventListener("input", () => {
    playerSettings.fov = Number(fovInput.value);
    applyPlayerSettings();
});
settingsPanel.querySelectorAll("[data-crosshair-choice]").forEach((button) => {
    button.addEventListener("click", () => {
        playerSettings.crosshair = button.dataset.crosshairChoice;
        applyPlayerSettings();
    });
});
settingsResetButton.addEventListener("click", () => {
    playerSettings = { ...SETTINGS_DEFAULTS };
    applyPlayerSettings();
});
applyPlayerSettings();

/* ---------- EFFECTS ---------- */

const effects = [];

function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timeout);

    showToast.timeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 1300);
}

function addImpactEffect(position) {
    const material = new THREE.MeshBasicMaterial({
        color: 0x00eaff,
        transparent: true,
        opacity: 0.9
    });

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.035, 8, 24),
        material
    );

    ring.position.copy(position);
    ring.lookAt(camera.position);
    scene.add(ring);

    effects.push({
        object: ring,
        life: 0.35,
        maxLife: 0.35
    });
}

function addShotTrail(start, end) {
    // Three additive layers create a warm orange/yellow energy streak.
    // Each layer fades independently and disappears after exactly 0.3 seconds.
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    if (length < 0.05) return;

    const curve = new THREE.LineCurve3(start.clone(), end.clone());

    const layers = [
        {
            radius: 0.055,
            color: 0xff7a18,
            opacity: 0.22,
            radialSegments: 7
        },
        {
            radius: 0.027,
            color: 0xffb52e,
            opacity: 0.55,
            radialSegments: 6
        },
        {
            radius: 0.010,
            color: 0xfff1a1,
            opacity: 0.95,
            radialSegments: 5
        }
    ];

    for (const layer of layers) {
        const geometry = new THREE.TubeGeometry(
            curve,
            Math.max(2, Math.ceil(length * 2)),
            layer.radius,
            layer.radialSegments,
            false
        );

        const material = new THREE.MeshBasicMaterial({
            color: layer.color,
            transparent: true,
            opacity: layer.opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        });

        const glow = new THREE.Mesh(geometry, material);
        glow.renderOrder = 5;
        scene.add(glow);

        effects.push({
            object: glow,
            life: 0.3,
            maxLife: 0.3,
            initialOpacity: layer.opacity
        });
    }
}

function updateEffects(delta) {
    for (let i = effects.length - 1; i >= 0; i--) {
        const effect = effects[i];

        effect.life -= delta;

        if (effect.object.material.opacity !== undefined) {
            effect.object.material.opacity = Math.max(
                0,
                (effect.initialOpacity ?? 1) * (effect.life / effect.maxLife)
            );
        }

        if (effect.object.geometry.type === "TorusGeometry") {
            effect.object.scale.multiplyScalar(1 + delta * 3);
        }

        if (effect.life <= 0) {
            scene.remove(effect.object);
            effect.object.geometry.dispose();
            effect.object.material.dispose();
            effects.splice(i, 1);
        }
    }
}

/* ---------- HUD ---------- */

function updateHUD() {
    if (scoreValue) {
        scoreValue.textContent = String(score).padStart(4, "0");
    }

    if (ammoValue) ammoValue.textContent = ammo;

    if (ammoFill) {
        ammoFill.style.width =
            `${(ammo / CONFIG.weapon.maxAmmo) * 100}%`;
    }

    if (reloadLabel) {
        if (isReloading) {
            reloadLabel.textContent = "RELOADING...";
        } else if (ammo === 0) {
            reloadLabel.textContent = "RELOADING...";
        } else {
            reloadLabel.textContent = "READY";
        }
    }
}

/* ---------- PLAYER MOVEMENT ---------- */

function updatePlayer(delta) {
    jumpCooldown = Math.max(0, jumpCooldown - delta);

    // Stronger gravity gives jumps a clearer rise, fall and landing.
    if (jumpHeight > 0 || jumpVelocity > 0) {
        const previousHeight = jumpHeight;
        jumpVelocity -= CONFIG.player.jumpGravity * delta;
        jumpHeight += jumpVelocity * delta;

        if (jumpHeight <= 0) {
            jumpHeight = 0;
            jumpVelocity = 0;
            if (previousHeight > 0.08) landingImpact = 1;
        }
    }

    // Smoothly ease the camera toward mouse input instead of snapping to it.
    yaw = THREE.MathUtils.damp(yaw, targetYaw, 18, delta);
    pitch = THREE.MathUtils.damp(pitch, targetPitch, 18, delta);

    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const movement = new THREE.Vector3();

    if (keys.KeyW) movement.add(forward);
    if (keys.KeyS) movement.sub(forward);
    if (keys.KeyD) movement.add(right);
    if (keys.KeyA) movement.sub(right);

    if (movement.lengthSq() > 0) {
        movement.normalize().multiplyScalar(CONFIG.player.speed * delta);
        playerX += movement.x;
        playerZ += movement.z;
    }

    playerX = THREE.MathUtils.clamp(playerX, -4.65, 4.65);
    playerZ = THREE.MathUtils.clamp(playerZ, 4.5, 8.2);

    // CAMERA TILT: ONLY A/D INPUT AFFECTS THE ROLL.
    // W/S movement does not contribute to camera tilt.
    const horizontalInput =
        (keys.KeyD ? 1 : 0) -
        (keys.KeyA ? 1 : 0);

    const targetMovementTilt = horizontalInput * 0.055;

    movementTilt = THREE.MathUtils.damp(
        movementTilt,
        targetMovementTilt,
        7,
        delta
    );

    const moving = movement.lengthSq() > 0;
    const bobTime = performance.now() * 0.012;
    const walkBob = moving ? Math.sin(bobTime) * 0.035 : 0;
    const fallDip = landingImpact * 0.075;
    landingImpact = THREE.MathUtils.damp(landingImpact, 0, 13, delta);

    screenShake = THREE.MathUtils.damp(screenShake, 0, 20, delta);
    const shakeTime = performance.now() * 0.045;
    const shakeX = Math.sin(shakeTime) * 0.022 * screenShake;
    const shakeY = Math.cos(shakeTime * 1.37) * 0.026 * screenShake;
    const shakeRoll = Math.sin(shakeTime * 0.8) * 0.014 * screenShake;

    camera.position.set(
        playerX,
        CONFIG.player.eyeHeight + jumpHeight + walkBob - fallDip,
        playerZ
    );

    camera.rotation.set(
        pitch + shakeX,
        yaw + shakeY,
        movementTilt + shakeRoll,
        "YXZ"
    );

    playerPosition.set(playerX, 0.9, playerZ);
}

function tryJump() {
    if (
        !gameStarted ||
        gamePaused ||
        gameOver ||
        jumpHeight > 0 ||
        jumpCooldown > 0
    ) {
        return;
    }

    jumpVelocity = CONFIG.player.jumpSpeed;
    jumpCooldown = CONFIG.player.jumpCooldown;
    showToast("JUMP!");
}

/* ---------- BALL PHYSICS ---------- */

function resetBall() {
    // Spawn near the far end and launch toward the player-side front wall (+Z)
    // at a random angle so every round begins with a slightly different approach.
    ball.position.set(
        THREE.MathUtils.randFloat(-1.2, 1.2),
        CONFIG.ball.radius + 0.03,
        -7.1
    );

    const launchAngle = THREE.MathUtils.randFloat(-0.58, 0.58);
    const launchSpeed = CONFIG.ball.initialSpeed;

    ballVelocity.set(
        Math.sin(launchAngle) * launchSpeed,
        THREE.MathUtils.randFloat(0.25, 1.1),
        Math.cos(launchAngle) * launchSpeed
    );

    hitCooldown = 0;
    lastSpeedTier = Math.floor(score / 100);
}

function updateBall(delta) {
    if (!gameStarted || gamePaused || gameOver) return;

    hitCooldown = Math.max(0, hitCooldown - delta);

    // Score tiers progressively increase the ball's pace.
    const speedTier = Math.floor(score / 100);
    if (speedTier > lastSpeedTier) {
        const gainedTiers = speedTier - lastSpeedTier;
        ballVelocity.multiplyScalar(Math.pow(1.08, gainedTiers));
        lastSpeedTier = speedTier;
        showToast(`BALL SPEED UP — LEVEL ${speedTier}`);
    }

    // Virtual slope movement
    ballVelocity.z += CONFIG.ball.slopeGravity * delta;

    // Rolling resistance
    ballVelocity.x *= Math.pow(0.999, delta * 60);
    ballVelocity.z *= Math.pow(0.9995, delta * 60);

    // Vertical gravity
    ballVelocity.y -= CONFIG.ball.gravity * delta;
    ball.position.addScaledVector(ballVelocity, delta);

    // Floor contact
    if (ball.position.y < CONFIG.ball.radius) {
        ball.position.y = CONFIG.ball.radius;

        if (ballVelocity.y < 0) {
            ballVelocity.y = Math.abs(ballVelocity.y) * 0.82;
            if (ballVelocity.y < 0.65) ballVelocity.y = 0;
        }

        ballVelocity.x *= 0.997;
        ballVelocity.z *= 0.999;
    }

    // Automatic corner-bouncer collisions
    for (const bouncer of bouncers) {
        bouncer.cooldown = Math.max(0, bouncer.cooldown - delta);

        const dx = ball.position.x - bouncer.x;
        const dz = ball.position.z - bouncer.z;
        const horizontalDistance = Math.hypot(dx, dz);

        const touchingTop =
            ball.position.y <= bouncer.topY + CONFIG.ball.radius + 0.24 &&
            ball.position.y >= bouncer.topY + CONFIG.ball.radius - 0.48;

        if (
            horizontalDistance < bouncer.radius + CONFIG.ball.radius * 0.45 &&
            touchingTop &&
            bouncer.cooldown <= 0
        ) {
            ball.position.y = Math.max(
                ball.position.y,
                bouncer.topY + CONFIG.ball.radius
            );

            // Each pad hit launches the ball in a fresh, random horizontal direction.
            const launchAngle = Math.random() * Math.PI * 2;
            const launchSpeed = THREE.MathUtils.randFloat(11.5, 15.5);
            ballVelocity.x = Math.cos(launchAngle) * launchSpeed;
            ballVelocity.z = Math.sin(launchAngle) * launchSpeed;
            ballVelocity.y = THREE.MathUtils.randFloat(12.5, 15.5);

            bouncer.cooldown = 0.72;

            addImpactEffect(
                new THREE.Vector3(
                    bouncer.x,
                    bouncer.topY + 0.08,
                    bouncer.z
                )
            );

            score += 5;
            updateHUD();
            showToast("CORNER BOUNCER — +5");
            break;
        }
    }

    // Ceiling collision
    if (ball.position.y > 4.35) {
        ball.position.y = 4.35;
        ballVelocity.y = -Math.abs(ballVelocity.y) * 0.72;
    }

    // Side walls
    if (ball.position.x < -5.05) {
        ball.position.x = -5.05;
        ballVelocity.x = Math.abs(ballVelocity.x) * 0.86;
    }

    if (ball.position.x > 5.05) {
        ball.position.x = 5.05;
        ballVelocity.x = -Math.abs(ballVelocity.x) * 0.86;
    }

    // Far end rebound
    if (ball.position.z < -9.35) {
        ball.position.z = -9.35;

        if (ballVelocity.z < 0) {
            ballVelocity.z = Math.max(Math.abs(ballVelocity.z) * 0.96, 10.5);

            addImpactEffect(
                new THREE.Vector3(
                    ball.position.x,
                    ball.position.y,
                    -9.30
                )
            );
        }
    }

    // Player-side energy wall rebound
    const frontWallHitZ =
        frontReboundWallZ - 0.25 - CONFIG.ball.radius;

    if (
        ball.position.z > frontWallHitZ &&
        ballVelocity.z > 0
    ) {
        ball.position.z = frontWallHitZ;

        ballVelocity.z = -Math.max(
            Math.abs(ballVelocity.z) * CONFIG.ball.wallBounce,
            7.2
        );

        ballVelocity.x *= 0.82;

        ballVelocity.x += THREE.MathUtils.clamp(
            -ball.position.x * 0.65,
            -2.0,
            2.0
        );

        addImpactEffect(
            new THREE.Vector3(
                ball.position.x,
                ball.position.y,
                frontWallHitZ
            )
        );

        showToast("ENERGY WALL — BALL REBOUNDED");
    }

    // Gentle centre pull, reduced to let the ball reach corner bouncers.
    const centrePull = -ball.position.x * 0.08;
    ballVelocity.x += centrePull * delta;

    // Limit extreme speeds
    const maxSpeed = Math.min(40, 28 + speedTier * 2.0);

    if (ballVelocity.length() > maxSpeed) {
        ballVelocity.setLength(maxSpeed);
    }

    // Rolling rotation
    ball.rotation.x += ballVelocity.z * delta / CONFIG.ball.radius;
    ball.rotation.z -= ballVelocity.x * delta / CONFIG.ball.radius;

    // Ball light and halo
    ballLight.position.copy(ball.position);
    ballHalo.position.copy(ball.position);
    ballOuterAura.position.copy(ball.position);

    const glowPulse = 1 + Math.sin(performance.now() * 0.006) * 0.08;
    ballHalo.scale.setScalar(glowPulse);
    ballOuterAura.scale.setScalar(glowPulse * 1.04);
    ballLight.intensity = 30 + Math.sin(performance.now() * 0.006) * 4;

    // Player collision
    const distanceToPlayer = Math.sqrt(
        (ball.position.x - playerX) ** 2 +
        (ball.position.z - playerZ) ** 2
    );

    if (
        distanceToPlayer < 0.8 &&
        ball.position.y < 2.2 &&
        jumpHeight < CONFIG.player.jumpClearance &&
        ballVelocity.z > 0 &&
        hitCooldown <= 0
    ) {
        endGame();
    }

    if (ballStatus) {
        ballStatus.textContent =
            ballVelocity.z > 0 ? "ROLLING TOWARD WALL" : "ROLLING UPHILL";

        ballStatus.style.color =
            ballVelocity.z > 0 ? "#ff536a" : "#00eaff";
    }
}

/* ---------- SHOOTING ---------- */

function shoot() {
    if (
        !gameStarted ||
        gamePaused ||
        gameOver ||
        isReloading
    ) {
        return;
    }

    const now = performance.now();

    if (now - lastShotTime < CONFIG.weapon.fireCooldown * 1000) {
        return;
    }

    if (ammo <= 0) {
        showToast("AUTO RELOADING...");
        return;
    }

    lastShotTime = now;
    ammo--;

    recoil = 0.18;
    screenShake = 1.35;

    gunGroup.position.z = 0.13;
    gunGroup.rotation.x = -0.11;
    viewModel.position.z = 0.055;

    updateHUD();

    // Subtle aim assist: gently bends the shot toward the ball only when
    // the player's crosshair is already close to it. The camera and crosshair
    // never move, and there is no aim-assist indicator in the UI.
    const shotDirection = new THREE.Vector3();
    camera.getWorldDirection(shotDirection);

    const toBall = new THREE.Vector3().subVectors(
        ball.position,
        camera.position
    );
    const ballDistance = toBall.length();

    if (ballDistance > 0 && ballDistance <= CONFIG.weapon.range) {
        toBall.normalize();

        const aimAngle = shotDirection.angleTo(toBall);
        const assistAngle = CONFIG.weapon.aimAssistAngle;

        if (aimAngle < assistAngle) {
            const proximity = 1 - aimAngle / assistAngle;
            const assistStrength = CONFIG.weapon.aimAssistStrength *
                Math.sqrt(proximity);

            shotDirection.lerp(toBall, assistStrength).normalize();
        }
    }

    raycaster.set(camera.position, shotDirection);
    raycaster.far = CONFIG.weapon.range;

    const ballHits = raycaster.intersectObject(ball, false);

    const muzzlePosition = new THREE.Vector3();
    barrel.getWorldPosition(muzzlePosition);

    if (ballHits.length > 0) {
        const direction = new THREE.Vector3()
            .subVectors(ball.position, camera.position)
            .normalize();

        // Heavy arcade knockback: a direct hit launches the ball away hard.
        ballVelocity.addScaledVector(
            direction,
            CONFIG.ball.knockback
        );
        ballVelocity.x += direction.x * 7.5;
        ballVelocity.z += direction.z * 7.5;
        ballVelocity.y += 4.8;
        ballVelocity.multiplyScalar(1.08);

        score += 100;
        updateHUD();

        addImpactEffect(ballHits[0].point);
        addShotTrail(muzzlePosition, ballHits[0].point);

        showToast("DIRECT HIT +100");
    } else {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);

        const trailEnd = camera.position.clone()
            .addScaledVector(direction, 12);

        addShotTrail(muzzlePosition, trailEnd);
    }

    if (ammo === 0) {
        reload();
        showToast("AUTO RELOADING...");
    }
}

/* ---------- RELOADING ---------- */

function reload() {
    if (
        !gameStarted ||
        gamePaused ||
        gameOver ||
        isReloading ||
        ammo === CONFIG.weapon.maxAmmo
    ) {
        return;
    }

    isReloading = true;

    updateHUD();
    showToast("RELOADING...");

    gunGroup.rotation.x = 0.18;
    gunGroup.position.y = -0.08;

    clearTimeout(reloadTimer);

    reloadTimer = setTimeout(() => {
        if (gameOver || !gameStarted) return;

        ammo = CONFIG.weapon.maxAmmo;
        isReloading = false;

        gunGroup.rotation.x = 0;
        gunGroup.position.y = 0;

        updateHUD();
        showToast("BLASTER READY");
    }, CONFIG.weapon.reloadTime * 1000);
}

/* ---------- VIEWMODEL ANIMATION ---------- */

function updateViewModel(delta) {
    const moving =
        keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD;

    weaponBob += delta * (moving ? 10 : 2.2);

    const bobAmount = moving ? 0.022 : 0.004;

    viewModel.position.y =
        Math.sin(weaponBob) * bobAmount;

    viewModel.position.x =
        Math.cos(weaponBob * 0.5) * bobAmount;
    viewModel.position.z = THREE.MathUtils.damp(
        viewModel.position.z,
        0,
        16,
        delta
    );

    recoil = THREE.MathUtils.damp(recoil, 0, 12, delta);

    gunGroup.position.z = THREE.MathUtils.damp(
        gunGroup.position.z,
        0,
        14,
        delta
    );

    if (!isReloading) {
        gunGroup.rotation.x = THREE.MathUtils.damp(
            gunGroup.rotation.x,
            0,
            12,
            delta
        );
    }
}

/* ---------- BOUNCER ANIMATION ---------- */

function updateBouncers(delta) {
    const time = performance.now() * 0.002;

    for (const bouncer of bouncers) {
        const pulse =
            1.8 + Math.sin(time + bouncer.pulseOffset) * 0.45;

        bouncer.light.intensity =
            3.8 + Math.sin(time + bouncer.pulseOffset) * 0.7;

        bouncer.topMaterial.emissiveIntensity = pulse;
        bouncer.ringMaterial.emissiveIntensity = pulse + 0.5;
    }
}

/* ---------- POINTER LOCK ---------- */

function requestGamePointerLock() {
    if (!shell || !shell.requestPointerLock) {
        showToast("MOUSE LOOK UNAVAILABLE");
        return;
    }

    try {
        const result = shell.requestPointerLock();

        if (result && typeof result.catch === "function") {
            result.catch(() => {
                showToast("CLICK THE GAME TO ENABLE MOUSE LOOK");
            });
        }
    } catch (error) {
        console.warn("Pointer lock request failed:", error);
        showToast("CLICK THE GAME TO ENABLE MOUSE LOOK");
    }
}

/* ---------- GAME FLOW ---------- */

function startGame() {
    settingsPanel.hidden = true;
    clearTimeout(reloadTimer);

    score = 0;
    ammo = CONFIG.weapon.maxAmmo;

    isReloading = false;
    gameOver = false;
    gamePaused = false;
    gameStarted = true;

    playerX = CONFIG.player.startX;
    playerZ = CONFIG.player.startZ;

    jumpHeight = 0;
    jumpVelocity = 0;
    jumpCooldown = 0;

    // Reset bouncer cooldowns for the new round.
    for (const bouncer of bouncers) {
        bouncer.cooldown = 0;
    }

    yaw = 0;
    pitch = 0;
    targetYaw = 0;
    targetPitch = 0;
    screenShake = 0;
    landingImpact = 0;

    // Reset camera tilt for every new round.
    movementTilt = 0;

    camera.position.set(
        playerX,
        CONFIG.player.eyeHeight,
        playerZ
    );

    camera.rotation.set(0, 0, 0, "YXZ");

    gunGroup.position.set(0, 0, 0);
    gunGroup.rotation.set(0, 0, 0);

    resetBall();
    updateHUD();

    shell.classList.remove("ss-paused");
    startScreen.classList.add("hidden");
    pauseScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");

    requestGamePointerLock();
}

function pauseGame() {
    if (!gameStarted || gameOver || gamePaused) return;

    gamePaused = true;
    shell.classList.add("ss-paused");
    pauseScreen.classList.remove("hidden");

    if (document.pointerLockElement) {
        document.exitPointerLock();
    }
}

function resumeGame() {
    if (!gameStarted || gameOver) return;

    gamePaused = false;
    shell.classList.remove("ss-paused");
    pauseScreen.classList.add("hidden");

    requestGamePointerLock();
}

function endGame() {
    if (gameOver) return;

    gameOver = true;
    gameStarted = false;
    gamePaused = false;
    shell.classList.remove("ss-paused");

    clearTimeout(reloadTimer);
    isReloading = false;

    if (finalScore) {
        finalScore.textContent = String(score).padStart(4, "0");
    }

    gameOverScreen.classList.remove("hidden");

    if (document.pointerLockElement) {
        document.exitPointerLock();
    }
}

/* ---------- INPUT ---------- */

document.addEventListener("keydown", (event) => {
    if (event.code === "Escape" && !settingsPanel.hidden) {
        event.preventDefault();
        closeSettings();
        return;
    }

    const wasAlreadyPressed = keys[event.code] === true;
    keys[event.code] = true;

    if (event.code === "Space" && !wasAlreadyPressed) {
        tryJump();
    }

    if (
        ["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ArrowUp", "ArrowDown"]
            .includes(event.code)
    ) {
        event.preventDefault();
    }

    if (event.code === "KeyR") {
        reload();
    }

    if (event.code === "Escape" && gameStarted && !gamePaused) {
        // Pointer-lock change handles pausing.
    }
});

document.addEventListener("keyup", (event) => {
    keys[event.code] = false;
});

window.addEventListener("blur", () => {
    for (const key in keys) {
        keys[key] = false;
    }
});

document.addEventListener("mousemove", (event) => {
    if (!pointerLocked || gamePaused || gameOver) return;

    targetYaw -= event.movementX * playerSettings.sensitivity;
    targetPitch -= event.movementY * playerSettings.sensitivity;

    targetYaw = THREE.MathUtils.clamp(targetYaw, -1.15, 1.15);
    targetPitch = THREE.MathUtils.clamp(targetPitch, -0.55, 0.55);
});

document.addEventListener("mousedown", (event) => {
    if (event.button === 0) {
        shoot();
    }
});

/* ---------- POINTER LOCK EVENTS ---------- */

document.addEventListener("pointerlockchange", () => {
    const currentlyLocked = document.pointerLockElement === shell;

    pointerLocked = currentlyLocked;

    if (currentlyLocked) {
        hasHadPointerLock = true;

        if (gameStarted && !gameOver) {
            gamePaused = false;
            shell.classList.remove("ss-paused");
            pauseScreen.classList.add("hidden");
        }

        return;
    }

    // Only pause if the player previously had pointer lock.
    if (
        hasHadPointerLock &&
        gameStarted &&
        !gamePaused &&
        !gameOver
    ) {
        gamePaused = true;
        shell.classList.add("ss-paused");
        pauseScreen.classList.remove("hidden");
    }
});

// If pointer lock was denied initially, clicking the game area
// lets the player request it again without restarting.
shell.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;

    if (
        gameStarted &&
        !gamePaused &&
        !gameOver &&
        !pointerLocked
    ) {
        requestGamePointerLock();
    }
});

/* ---------- BUTTONS ---------- */

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", pauseGame);
resumeButton.addEventListener("click", resumeGame);

/* ---------- RESIZE ---------- */

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
});

/* ---------- MAIN LOOP ---------- */

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.035);

    if (gameStarted && !gamePaused && !gameOver) {
        updatePlayer(delta);
        updateBall(delta);
        updateViewModel(delta);
    }

    wallCore.rotation.z += delta * 0.18;
    wallOuterRing.rotation.z =
        Math.sin(performance.now() * 0.0007) * 0.08;
    wallInnerRing.rotation.z -= delta * 0.28;

    updateBouncers(delta);
    updateEffects(delta);

    renderer.render(scene, camera);
}

/* ---------- INITIALIZATION ---------- */

updateHUD();
animate();

console.log("SHOOT-STREAK initialized successfully.");
