
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import { RoomEnvironment } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/environments/RoomEnvironment.js";

/* ==========================================
   SHOOT-STREAK — THREE.JS GAME ENGINE
   KIWAMI ARCADE
========================================== */

const CONFIG = {
    arena: { width: 11, depth: 19, height: 5, frontZ: 9, backZ: -10 },
    player: {
        speed: 6.5, startX: 0, startZ: 7.1, eyeHeight: 1.65,
        jumpSpeed: 8.4, jumpGravity: 30, jumpCooldown: 1.15,
        jumpClearance: 0.82
    },
    ball: {
        radius: 0.42, gravity: 17, initialSpeed: 14.5,
        slopeGravity: 2.6, wallBounce: 0.97, knockback: 30
    },
    weapon: {
        maxAmmo: 2, reloadTime: 2.4, fireCooldown: 0.32,
        range: 35, aimAssistAngle: 0.13, aimAssistStrength: 0.94
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
const bestScoreValue = document.getElementById("best-score-value");
const eventBanner = document.getElementById("event-banner");
const mobileJoystick = document.getElementById("mobile-joystick");
const mobileJoystickThumb = document.getElementById("mobile-joystick-thumb");
const mobileLookZone = document.getElementById("mobile-look-zone");
const mobileJumpButton = document.getElementById("mobile-jump");

if (
    !shell || !startScreen || !pauseScreen || !gameOverScreen ||
    !startButton || !pauseButton || !resumeButton || !restartButton
) {
    throw new Error("SHOOT-STREAK: Required HTML elements are missing. Check index.html IDs.");
}

/* ---------- THREE.JS SETUP ---------- */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x040914);
scene.fog = new THREE.Fog(0x040914, 15, 34);

const camera = new THREE.PerspectiveCamera(
    75, (shell.clientWidth || window.innerWidth) / (shell.clientHeight || window.innerHeight), 0.1, 100
);
camera.rotation.order = "YXZ";
camera.position.set(CONFIG.player.startX, CONFIG.player.eyeHeight, CONFIG.player.startZ);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(shell.clientWidth || window.innerWidth, shell.clientHeight || window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.96;

renderer.domElement.id = "game-canvas";
shell.prepend(renderer.domElement);

// A room environment gives the metallic floor actual reflected light.
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const environment = new RoomEnvironment();
scene.environment = pmremGenerator.fromScene(environment, 0.04).texture;
environment.dispose();
pmremGenerator.dispose();

/* ---------- LIGHTING ---------- */

const hemisphereLight = new THREE.HemisphereLight(0x83b9dc, 0x080e1b, 0.52);
scene.add(hemisphereLight);

const mainLight = new THREE.DirectionalLight(0x9ac9ed, 0.62);
mainLight.position.set(-4, 9, 5);
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(1024, 1024);
mainLight.shadow.camera.left = -12;
mainLight.shadow.camera.right = 12;
mainLight.shadow.camera.top = 12;
mainLight.shadow.camera.bottom = -12;
scene.add(mainLight);

const backLight = new THREE.PointLight(0x087dff, 12, 18);
backLight.position.set(0, 3, -8);
scene.add(backLight);

const redAmbient = new THREE.PointLight(0xff123d, 4, 8);
scene.add(redAmbient);

/* ---------- MATERIALS ---------- */

const materials = {
    floor: new THREE.MeshPhysicalMaterial({
        color: 0x05080f,
        metalness: 0.58,
        roughness: 0.38,
        clearcoat: 0.82,
        clearcoatRoughness: 0.2,
        envMapIntensity: 0.9
    }),
    wall: new THREE.MeshStandardMaterial({
        color: 0x0d1727, roughness: 0.58, metalness: 0.42
    }),
    dark: new THREE.MeshStandardMaterial({
        color: 0x050a13, roughness: 0.7, metalness: 0.2
    }),
    cyan: new THREE.MeshStandardMaterial({
        color: 0x00dfff, emissive: 0x007caa, emissiveIntensity: 1.55
    }),
    blue: new THREE.MeshStandardMaterial({
        color: 0x286bff, emissive: 0x123baf, emissiveIntensity: 1.05
    }),
    red: new THREE.MeshStandardMaterial({
        color: 0xff193e, emissive: 0xff002b,
        emissiveIntensity: 3.8, roughness: 0.2, metalness: 0.1
    }),
    skin: new THREE.MeshStandardMaterial({
        color: 0xc98d6c, roughness: 0.78
    }),
    sleeve: new THREE.MeshStandardMaterial({
        color: 0x172c48, roughness: 0.75
    }),
    cuff: new THREE.MeshStandardMaterial({
        color: 0x263f60, roughness: 0.6
    }),
    weapon: new THREE.MeshStandardMaterial({
        color: 0x26384f, roughness: 0.27, metalness: 0.88
    }),
    barrel: new THREE.MeshStandardMaterial({
        color: 0x111b2a, roughness: 0.22, metalness: 0.94
    }),
    wood: new THREE.MeshStandardMaterial({
        color: 0x59351f, roughness: 0.42, metalness: 0.08
    }),
    black: new THREE.MeshStandardMaterial({
        color: 0x080b12, roughness: 0.3, metalness: 0.75
    })
};

/* ---------- ARENA ---------- */

const arena = new THREE.Group();
scene.add(arena);

function addBox(parent, width, height, depth, material, x, y, z) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth), material
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
}

addBox(arena, CONFIG.arena.width, 0.5, CONFIG.arena.depth,
    materials.floor, 0, -0.3, -0.5);

const leftWall = addBox(arena, 0.45, CONFIG.arena.height, CONFIG.arena.depth,
    materials.wall, -5.65, 2.15, -0.5);
leftWall.rotation.z = -0.045;

const rightWall = addBox(arena, 0.45, CONFIG.arena.height, CONFIG.arena.depth,
    materials.wall, 5.65, 2.15, -0.5);
rightWall.rotation.z = 0.045;

addBox(arena, CONFIG.arena.width, CONFIG.arena.height, 0.5,
    materials.wall, 0, 2.15, -10);

const frontReboundWallZ = 9.5;
addBox(arena, CONFIG.arena.width, CONFIG.arena.height, 0.5,
    materials.wall, 0, 2.15, frontReboundWallZ);

addBox(arena, 10.35, 3.9, 0.12, materials.dark, 0, 2.15, 9.20);
addBox(arena, 10.45, 0.10, 0.10, materials.cyan, 0, 4.12, 9.10);
addBox(arena, 10.45, 0.10, 0.10, materials.blue, 0, 0.18, 9.10);
addBox(arena, 0.10, 3.95, 0.10, materials.cyan, -5.12, 2.15, 9.10);
addBox(arena, 0.10, 3.95, 0.10, materials.cyan, 5.12, 2.15, 9.10);

for (let i = 0; i < 9; i++) {
    addBox(arena, 0.045, 3.25, 0.07,
        i % 2 === 0 ? materials.cyan : materials.blue,
        -4 + i, 2.15, 9.08);
}

const wallCore = new THREE.Group();
wallCore.position.set(0, 2.15, 9.02);
arena.add(wallCore);

const wallRingMaterial = new THREE.MeshStandardMaterial({
    color: 0x00eaff, emissive: 0x00aaff,
    emissiveIntensity: 2.8, metalness: 0.45, roughness: 0.25
});

const wallOuterRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.18, 0.055, 10, 64), wallRingMaterial
);
wallCore.add(wallOuterRing);

const wallInnerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.78, 0.035, 8, 48), materials.blue
);
wallCore.add(wallInnerRing);

const wallCoreLight = new THREE.PointLight(0x00dfff, 18, 8);
wallCoreLight.position.set(0, 0, -0.25);
wallCore.add(wallCoreLight);

for (let i = -2; i <= 2; i++) {
    addBox(arena, 2.5, 0.035, 0.045,
        materials.cyan, 0, 2.15 + i * 0.42, 9.00);
}

addBox(arena, 0.055, 0.055, 19, materials.cyan, -5.35, 0.02, -0.5);
addBox(arena, 0.055, 0.055, 19, materials.cyan, 5.35, 0.02, -0.5);
addBox(arena, 11, 0.055, 0.055, materials.cyan, 0, 0.02, -9.65);

for (let i = 0; i < 5; i++) {
    addBox(arena, 0.06, 3.4, 0.06,
        materials.blue, -4 + i * 2, 2.1, -9.68);
}

// Architectural floor inlays: broad panels and deliberate LED guides.
const floorInlay = new THREE.MeshStandardMaterial({ color: 0x081321, roughness: 0.46, metalness: 0.38 });
for (const z of [-7.2, -2.8, 1.8, 6.2]) {
    addBox(arena, 8.7, 0.018, 0.035, materials.blue, 0, -0.037, z);
    addBox(arena, 8.1, 0.012, 1.15, floorInlay, 0, -0.041, z - 0.68);
}
addBox(arena, 0.045, 0.014, 14.8, materials.cyan, -4.92, -0.037, -0.5);
addBox(arena, 0.045, 0.014, 14.8, materials.cyan, 4.92, -0.037, -0.5);

// Recessed wall panels and restrained buttresses.
for (const side of [-1, 1]) {
    for (const z of [-6.6, -1.9, 3.1, 7.0]) {
        addBox(arena, 0.12, 2.65, 1.75, materials.dark, side * 5.36, 2.1, z);
        addBox(arena, 0.035, 2.1, 0.045, materials.blue, side * 5.285, 2.1, z);
    }
}

const arenaAccentLights = [];
for (const side of [-1, 1]) {
    for (const z of [-6.8, -1.2, 4.5]) {
        const accent = new THREE.PointLight(side < 0 ? 0x087dff : 0x00c9e8, 2.2, 7);
        accent.position.set(side * 4.95, 2.7, z); arena.add(accent); arenaAccentLights.push(accent);
    }
}

// Luxury neon-club architecture: layered wall coffers, metallic trim and ceiling light rails.
const casinoGold = new THREE.MeshStandardMaterial({
    color: 0x9b6d32, metalness: 0.82, roughness: 0.28,
    emissive: 0x3a1d08, emissiveIntensity: 0.22
});
const casinoMagenta = new THREE.MeshStandardMaterial({
    color: 0xff3acb, metalness: 0.22, roughness: 0.28,
    emissive: 0xb00073, emissiveIntensity: 2.1
});
const casinoViolet = new THREE.MeshStandardMaterial({
    color: 0x8b5cff, metalness: 0.24, roughness: 0.3,
    emissive: 0x4a18b9, emissiveIntensity: 1.9
});
const casinoWarm = new THREE.MeshStandardMaterial({
    color: 0xffd28a, metalness: 0.72, roughness: 0.25,
    emissive: 0x8a4b12, emissiveIntensity: 0.7
});
const casinoPulseMaterials = [casinoMagenta, casinoViolet];

for (const side of [-1, 1]) {
    for (const z of [-6.7, -1.7, 3.3, 7.6]) {
        // Dark inset panel with a warm metallic perimeter.
        addBox(arena, 0.075, 2.75, 2.25, materials.dark, side * 5.34, 2.25, z);
        addBox(arena, 0.055, 0.055, 2.32, casinoGold, side * 5.275, 3.62, z);
        addBox(arena, 0.055, 0.055, 2.32, casinoGold, side * 5.275, 0.88, z);
        addBox(arena, 0.055, 2.72, 0.055, casinoGold, side * 5.275, 2.25, z - 1.13);
        addBox(arena, 0.055, 2.72, 0.055, casinoGold, side * 5.275, 2.25, z + 1.13);

        // Three luminous fins create depth without cluttering the play space.
        for (let fin = -1; fin <= 1; fin++) {
            addBox(arena, 0.045, 1.95, 0.035,
                fin === 0 ? casinoMagenta : casinoViolet,
                side * 5.265, 2.25, z + fin * 0.48);
        }

        const panelLight = new THREE.PointLight(
            side < 0 ? 0x9b5cff : 0xff39c8, 2.0, 4.8
        );
        panelLight.position.set(side * 4.95, 2.7, z);
        arena.add(panelLight);
        arenaAccentLights.push(panelLight);
    }
}

// Ceiling canopy: parallel light rails and recessed cross-beams.
for (const x of [-4.7, -2.35, 0, 2.35, 4.7]) {
    addBox(arena, 0.075, 0.06, 18.5, casinoGold, x, 4.18, -0.5);
    addBox(arena, 0.035, 0.035, 17.8,
        x % 2 === 0 ? casinoMagenta : casinoViolet,
        x, 4.13, -0.5);
}
for (const z of [-8.8, -4.4, 0, 4.4, 8.6]) {
    addBox(arena, 10.4, 0.055, 0.08, materials.dark, 0, 4.08, z);
    addBox(arena, 10.1, 0.025, 0.035, casinoWarm, 0, 4.045, z);
}

// Alternating overhead color pools add a cinematic rhythm to the room.
const casinoCeilingLights = [];
for (let i = 0; i < 5; i++) {
    const light = new THREE.PointLight(
        i % 2 === 0 ? 0x9b5cff : 0xff39c8, 5.5, 8
    );
    light.position.set(i % 2 === 0 ? -2.8 : 2.8, 3.95, -7.2 + i * 3.3);
    arena.add(light);
    casinoCeilingLights.push(light);
}

// A subtle centerline reflection guide anchors the polished black floor.
addBox(arena, 0.025, 0.012, 15.5, casinoViolet, 0, -0.035, -0.5);
/* ---------- CORNER BOUNCERS ---------- */

const bouncers = [];
const bouncerPositions = [
    { x: -4.25, z: 7.15 },
    { x: 4.25, z: 7.15 }
];

const bouncerTopY = 0.34;

const bouncerBaseMaterial = new THREE.MeshStandardMaterial({
    color: 0x101c32, metalness: 0.82, roughness: 0.28
});

const bouncerTopMaterial = new THREE.MeshStandardMaterial({
    color: 0x173b59, emissive: 0x006b9b,
    emissiveIntensity: 2, metalness: 0.65, roughness: 0.24
});

for (const position of bouncerPositions) {
    const group = new THREE.Group();
    group.position.set(position.x, 0, position.z);
    arena.add(group);

    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.88, 1, 0.28, 32),
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
        new THREE.TorusGeometry(0.77, 0.045, 8, 40), ringMaterial
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = bouncerTopY + 0.005;
    group.add(ring);

    for (let i = 0; i < 4; i++) {
        const marker = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.035, 0.28), materials.cyan
        );
        const angle = i / 4 * Math.PI * 2;
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
        group, x: position.x, z: position.z,
        radius: 0.92, topY: bouncerTopY, cooldown: 0,
        pulseOffset: Math.random() * Math.PI * 2,
        topMaterial, ringMaterial, light
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
        color: 0xff173f, transparent: true, opacity: 0.22,
        depthWrite: false, blending: THREE.AdditiveBlending,
        toneMapped: false
    })
);
scene.add(ballHalo);

const ballOuterAura = new THREE.Mesh(
    new THREE.SphereGeometry(0.78, 24, 16),
    new THREE.MeshBasicMaterial({
        color: 0xff1744, transparent: true, opacity: 0.075,
        depthWrite: false, blending: THREE.AdditiveBlending,
        side: THREE.BackSide, toneMapped: false
    })
);
scene.add(ballOuterAura);

/* ---------- INVISIBLE PLAYER BODY / HITBOX ---------- */

// The body is not rendered. Its capsule dimensions are used for collision.
const playerHitbox = new THREE.Group();
playerHitbox.visible = false;
scene.add(playerHitbox);

const hitboxMaterial = new THREE.MeshBasicMaterial({
    visible: false, transparent: true, opacity: 0
});

const hitboxBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.36, 0.9, 5, 10),
    hitboxMaterial
);
hitboxBody.position.y = 0.9;
playerHitbox.add(hitboxBody);

// Collision capsule: vertical segment between these two points.
const HITBOX_RADIUS = 0.36;
const HITBOX_SEGMENT_BOTTOM = 0.45;
const HITBOX_SEGMENT_TOP = 1.35;

function updatePlayerHitbox() {
    playerHitbox.position.set(playerX, jumpHeight, playerZ);
}

/* ---------- FIRST-PERSON VIEWMODEL ---------- */

const viewModel = new THREE.Group();
camera.add(viewModel);
scene.add(camera);

const gunGroup = new THREE.Group();
viewModel.add(gunGroup);

function addGunBox(width, height, depth, material, x, y, z, parent = gunGroup) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth), material
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
}

function addGunCylinder(radiusTop, radiusBottom, length, material, x, y, z) {
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 16),
        material
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    gunGroup.add(mesh);
    return mesh;
}

// Double barrel shotgun: two parallel metal barrels.
const barrelLeft = addGunCylinder(
    0.047, 0.052, 0.72, materials.barrel, 0.215, -0.205, -0.98
);
const barrelRight = addGunCylinder(
    0.047, 0.052, 0.72, materials.barrel, 0.345, -0.205, -0.98
);

// Used by the shooting effect to locate the muzzle.
const barrel = barrelRight;

// Muzzle rings and dark barrel openings.
for (const x of [0.215, 0.345]) {
    const muzzle = new THREE.Mesh(
        new THREE.TorusGeometry(0.048, 0.012, 8, 24),
        materials.weapon
    );
    muzzle.position.set(x, -0.205, -1.345);
    gunGroup.add(muzzle);

    const bore = new THREE.Mesh(
        new THREE.CircleGeometry(0.034, 20), materials.black
    );
    bore.position.set(x, -0.205, -1.346);
    gunGroup.add(bore);
}

// Barrel bridge and top rib.
addGunBox(0.19, 0.045, 0.67, materials.weapon, 0.28, -0.145, -0.99);
addGunBox(0.065, 0.025, 0.65, materials.black, 0.28, -0.126, -0.99);

// Receiver and breech.
addGunBox(0.27, 0.22, 0.32, materials.weapon, 0.28, -0.29, -0.57);
addGunBox(0.23, 0.12, 0.22, materials.black, 0.28, -0.19, -0.55);

// Walnut fore-end.
addGunBox(0.24, 0.12, 0.36, materials.wood, 0.28, -0.34, -0.91);
addGunBox(0.25, 0.035, 0.38, materials.wood, 0.28, -0.405, -0.91);

// Wooden stock and grip.
const stock = addGunBox(0.19, 0.22, 0.37, materials.wood, 0.28, -0.32, -0.32);
stock.rotation.x = -0.12;

const grip = addGunBox(0.15, 0.31, 0.19, materials.wood, 0.28, -0.51, -0.48);
grip.rotation.x = -0.22;

// Trigger guard and trigger.
const triggerGuard = new THREE.Mesh(
    new THREE.TorusGeometry(0.075, 0.012, 8, 24, Math.PI),
    materials.weapon
);
triggerGuard.position.set(0.28, -0.43, -0.61);
triggerGuard.rotation.x = Math.PI / 2;
gunGroup.add(triggerGuard);

addGunBox(0.025, 0.09, 0.035, materials.black, 0.28, -0.44, -0.61);

// Small metallic details.
addGunBox(0.045, 0.045, 0.13, materials.cyan, 0.28, -0.22, -0.72);
addGunBox(0.06, 0.025, 0.10, materials.weapon, 0.28, -0.11, -0.61);

// Iron sight.
addGunBox(0.035, 0.045, 0.055, materials.black, 0.28, -0.105, -1.25);
addGunBox(0.018, 0.035, 0.025, materials.cyan, 0.28, -0.085, -1.25);

/* ---------- HUMAN HANDS AND SHIRT SLEEVES ---------- */

// These are separate sleeve and skin meshes, not glove blocks.
const handsGroup = new THREE.Group();
viewModel.add(handsGroup);

function handBox(parent, size, material, position, rotation = [0, 0, 0]) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size[0], size[1], size[2]),
        material
    );
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
}

// Support arm: sleeve, cuff, palm and fingers.
handBox(handsGroup, [0.19, 0.20, 0.53], materials.sleeve,
    [0.12, -0.49, -0.63], [-0.2, 0.04, 0.02]);

handBox(handsGroup, [0.20, 0.205, 0.075], materials.cuff,
    [0.17, -0.405, -0.87], [-0.2, 0.04, 0.02]);

handBox(handsGroup, [0.17, 0.12, 0.19], materials.skin,
    [0.24, -0.345, -0.98], [-0.15, 0.05, 0]);

for (let i = 0; i < 4; i++) {
    handBox(handsGroup, [0.035, 0.045, 0.13], materials.skin,
        [0.185 + i * 0.037, -0.365, -1.055], [-0.12, 0, 0]);
}

handBox(handsGroup, [0.045, 0.045, 0.12], materials.skin,
    [0.32, -0.30, -0.94], [0.1, 0.2, -0.5]);

// Trigger hand: sleeve, cuff, palm and fingers around the grip.
handBox(handsGroup, [0.20, 0.21, 0.47], materials.sleeve,
    [0.39, -0.53, -0.35], [-0.12, -0.08, -0.03]);

handBox(handsGroup, [0.205, 0.21, 0.075], materials.cuff,
    [0.345, -0.43, -0.55], [-0.12, -0.08, -0.03]);

handBox(handsGroup, [0.17, 0.14, 0.19], materials.skin,
    [0.30, -0.39, -0.62], [-0.08, 0, 0]);

for (let i = 0; i < 4; i++) {
    handBox(handsGroup, [0.035, 0.045, 0.14], materials.skin,
        [0.235 + i * 0.038, -0.425, -0.58], [-0.15, 0, 0]);
}

handBox(handsGroup, [0.045, 0.05, 0.12], materials.skin,
    [0.39, -0.35, -0.66], [0, 0.1, -0.45]);

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
let bestScore = 0, recentScores = [];
const SCORE_STORAGE_KEY = "shootStreakRecords";
try {
 const saved = JSON.parse(localStorage.getItem(SCORE_STORAGE_KEY) || "null");
 if (saved && typeof saved === "object") { bestScore = Math.max(0, Number(saved.bestScore) || 0); recentScores = Array.isArray(saved.recentScores) ? saved.recentScores.slice(0,10) : []; }
} catch (error) { console.warn("Could not load score records.", error); }
function saveScoreRecord(value) {
 const safe = Math.max(0, Math.floor(Number(value) || 0)); bestScore = Math.max(bestScore, safe);
 recentScores.unshift({ score:safe, date:new Date().toISOString() }); recentScores = recentScores.slice(0,10);
 try { localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify({ bestScore, recentScores })); } catch (error) { console.warn("Could not save score records.", error); }
 if (bestScoreValue) bestScoreValue.textContent = String(bestScore).padStart(4,"0");
}
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
let movementTilt = 0;
let recoil = 0;
let weaponBob = 0;

const keys = {};
const isTouchDevice = (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
if (isTouchDevice) shell.classList.add("ss-touch-device");
let joystickPointerId=null, joystickCenter=null, lookPointerId=null, lastLookPoint=null;
function setJoystickFromPoint(x,y){if(!mobileJoystickThumb||!joystickCenter)return;const max=34,dx=x-joystickCenter.x,dy=y-joystickCenter.y,dist=Math.hypot(dx,dy),scale=dist>max?max/dist:1,lx=dx*scale,ly=dy*scale;mobileJoystickThumb.style.transform="translate("+lx+"px,"+ly+"px)";const t=.22;keys.KeyW=ly/max< -t;keys.KeyS=ly/max>t;keys.KeyA=lx/max< -t;keys.KeyD=lx/max>t;}
function resetMobileJoystick(){joystickPointerId=null;joystickCenter=null;keys.KeyW=keys.KeyA=keys.KeyS=keys.KeyD=false;if(mobileJoystickThumb)mobileJoystickThumb.style.transform="translate(0,0)";}
if(isTouchDevice&&mobileJoystick){mobileJoystick.addEventListener("pointerdown",e=>{if(!gameStarted||gamePaused||gameOver)return;e.preventDefault();joystickPointerId=e.pointerId;const r=mobileJoystick.getBoundingClientRect();joystickCenter={x:r.left+r.width/2,y:r.top+r.height/2};mobileJoystick.setPointerCapture(e.pointerId);setJoystickFromPoint(e.clientX,e.clientY);});
mobileJoystick.addEventListener("pointermove",e=>{if(e.pointerId===joystickPointerId){e.preventDefault();setJoystickFromPoint(e.clientX,e.clientY);}});
const releaseJoy=e=>{if(e.pointerId===joystickPointerId)resetMobileJoystick();};mobileJoystick.addEventListener("pointerup",releaseJoy);mobileJoystick.addEventListener("pointercancel",releaseJoy);mobileJoystick.addEventListener("lostpointercapture",resetMobileJoystick);}
if(isTouchDevice&&mobileLookZone){mobileLookZone.addEventListener("pointerdown",e=>{if(!gameStarted||gamePaused||gameOver)return;e.preventDefault();lookPointerId=e.pointerId;lastLookPoint={x:e.clientX,y:e.clientY};mobileLookZone.setPointerCapture(e.pointerId);});
mobileLookZone.addEventListener("pointermove",e=>{if(e.pointerId!==lookPointerId||!lastLookPoint||gamePaused||gameOver)return;e.preventDefault();const dx=e.clientX-lastLookPoint.x,dy=e.clientY-lastLookPoint.y;targetYaw=THREE.MathUtils.clamp(targetYaw-dx*playerSettings.sensitivity*1.45,-1.15,1.15);targetPitch=THREE.MathUtils.clamp(targetPitch-dy*playerSettings.sensitivity*1.45,-.55,.55);lastLookPoint={x:e.clientX,y:e.clientY};});
const releaseLook=e=>{if(e.pointerId===lookPointerId){lookPointerId=null;lastLookPoint=null;}};mobileLookZone.addEventListener("pointerup",releaseLook);mobileLookZone.addEventListener("pointercancel",releaseLook);mobileLookZone.addEventListener("lostpointercapture",()=>{lookPointerId=null;lastLookPoint=null;});}
if(mobileJumpButton)mobileJumpButton.addEventListener("pointerdown",e=>{e.preventDefault();tryJump();});
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();

/* ---------- OPTIONAL BACKGROUND MUSIC ---------- */

// Place the file at: shoot-streak/assets/background.mp3
// Missing, empty or unsupported files are silently ignored.
const backgroundMusic = new Audio("./assets/background.mp3");
backgroundMusic.loop = true;
backgroundMusic.volume = 0.24;
backgroundMusic.preload = "auto";

let musicAvailable = false;

backgroundMusic.addEventListener("canplay", () => {
    musicAvailable = true;
    if (gameStarted && !gamePaused && !gameOver) {
        playBackgroundMusic();
    }
});

backgroundMusic.addEventListener("error", () => {
    musicAvailable = false;
    backgroundMusic.pause();
});

function playBackgroundMusic() {
    if (!musicAvailable || !backgroundMusic.src) return;

    const playPromise = backgroundMusic.play();
    if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
            // Autoplay restrictions or unavailable file: continue silently.
        });
    }
}

function pauseBackgroundMusic() {
    backgroundMusic.pause();
}

/* ---------- AUDIO ENGINE ---------- */

let audioContext = null;
let masterGain = null;
let audioReady = false;

function initializeAudio() {
    if (!audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        audioContext = new AudioContextClass();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.48;
        masterGain.connect(audioContext.destination);
    }

    if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => {});
    }

    audioReady = true;
}

function playTone({
    frequency = 440, endFrequency = frequency, duration = 0.15,
    type = "sine", volume = 0.2, delay = 0
} = {}) {
    if (!audioReady || !audioContext || !masterGain) return;

    const now = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(1, frequency), now);
    oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, endFrequency), now + duration
    );

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, volume), now + Math.min(0.012, duration * 0.2)
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);

    oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
    };
}

function playNoise({
    duration = 0.15, volume = 0.12, frequency = 1200, delay = 0
} = {}) {
    if (!audioReady || !audioContext || !masterGain) return;

    const sampleRate = audioContext.sampleRate;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
    const channel = buffer.getChannelData(0);

    for (let i = 0; i < frameCount; i++) {
        channel[i] = Math.random() * 2 - 1;
    }

    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();

    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = frequency;

    const now = audioContext.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    source.start(now);
    source.stop(now + duration);

    source.onended = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
    };
}

/* ---------- SOUND EFFECTS ---------- */

function soundShoot() {
    // Layered low-frequency report and sharp mechanical crack.
    playTone({ frequency: 125, endFrequency: 42, duration: 0.22, type: "sawtooth", volume: 0.28 });
    playTone({ frequency: 850, endFrequency: 130, duration: 0.12, type: "square", volume: 0.12 });
    playNoise({ duration: 0.16, volume: 0.20, frequency: 2600 });
}

function soundReload() {
    playTone({ frequency: 390, endFrequency: 520, duration: 0.12, type: "triangle", volume: 0.10 });
    playTone({ frequency: 520, endFrequency: 760, duration: 0.15, type: "triangle", volume: 0.11, delay: 0.17 });
    playTone({ frequency: 760, endFrequency: 1050, duration: 0.2, type: "sine", volume: 0.12, delay: 0.38 });
    playNoise({ duration: 0.12, volume: 0.07, frequency: 1800, delay: 0.28 });
}

function soundJump() {
    playTone({ frequency: 170, endFrequency: 460, duration: 0.22, type: "sine", volume: 0.13 });
    playTone({ frequency: 260, endFrequency: 620, duration: 0.18, type: "triangle", volume: 0.07 });
}

function soundLanding() {
    playTone({ frequency: 110, endFrequency: 48, duration: 0.13, type: "triangle", volume: 0.12 });
    playNoise({ duration: 0.09, volume: 0.08, frequency: 450 });
}

function soundJumpPad() {
    playTone({ frequency: 220, endFrequency: 920, duration: 0.34, type: "sawtooth", volume: 0.17 });
    playTone({ frequency: 440, endFrequency: 1250, duration: 0.25, type: "sine", volume: 0.11, delay: 0.035 });
    playNoise({ duration: 0.18, volume: 0.10, frequency: 2600 });
}

function soundWallBounce() {
    playTone({ frequency: 680, endFrequency: 190, duration: 0.24, type: "triangle", volume: 0.16 });
    playTone({ frequency: 1150, endFrequency: 420, duration: 0.18, type: "sine", volume: 0.10 });
    playNoise({ duration: 0.12, volume: 0.08, frequency: 1700 });
}

function soundBallImpact() {
    playTone({ frequency: 240, endFrequency: 90, duration: 0.12, type: "triangle", volume: 0.09 });
}

function soundDirectHit() {
    playTone({ frequency: 160, endFrequency: 850, duration: 0.25, type: "sawtooth", volume: 0.19 });
    playTone({ frequency: 900, endFrequency: 280, duration: 0.22, type: "sine", volume: 0.13 });
    playNoise({ duration: 0.2, volume: 0.15, frequency: 3000 });
}

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
            0.0005, 0.025
        );
        playerSettings.fov = THREE.MathUtils.clamp(
            Number(saved.fov) || SETTINGS_DEFAULTS.fov, 60, 110
        );
        playerSettings.crosshair = ["cross", "dot", "circle", "off"].includes(saved.crosshair)
            ? saved.crosshair : SETTINGS_DEFAULTS.crosshair;
    }
} catch (error) {
    console.warn("SHOOT-STREAK: Could not load saved settings.", error);
}

const settingsStyle = document.createElement("style");
settingsStyle.textContent = `
#settings-open-button{position:relative;z-index:35;flex-shrink:0;margin-left:8px;padding:10px 15px;border:1px solid rgba(116,220,255,.3);border-radius:999px;color:#e9faff;background:rgba(8,19,35,.78);backdrop-filter:blur(18px);font:700 10px 'Orbitron',sans-serif;letter-spacing:1px;cursor:pointer;transition:.2s}
#settings-open-button:hover{border-color:#00eaff;box-shadow:0 0 22px rgba(0,234,255,.2);transform:translateY(-1px)}
#settings-panel{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:18px;background:rgba(2,7,15,.8);backdrop-filter:blur(12px)}
#settings-panel[hidden]{display:none!important}
.ss-settings-card{width:min(440px,100%);max-height:90vh;overflow-y:auto;padding:25px;border:1px solid rgba(93,215,255,.27);border-radius:22px;color:#eafaff;background:linear-gradient(145deg,rgba(13,28,49,.98),rgba(5,11,23,.99));box-shadow:0 24px 90px rgba(0,0,0,.58);font-family:'Space Grotesk',sans-serif}
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
.ss-crosshair-option[aria-pressed="true"]{color:#eaffff;border-color:#00dff5;background:rgba(0,223,245,.1)}
.ss-crosshair-preview{display:block;position:relative;width:20px;height:20px;margin:0 auto 6px}
.ss-crosshair-preview.cross:before,.ss-crosshair-preview.cross:after{content:'';position:absolute;background:#00eaff}
.ss-crosshair-preview.cross:before{width:2px;height:20px;left:9px;top:0}
.ss-crosshair-preview.cross:after{height:2px;width:20px;top:9px;left:0}
.ss-crosshair-preview.dot:after{content:'';position:absolute;width:5px;height:5px;border-radius:50%;background:#00eaff;left:7.5px;top:7.5px}
.ss-crosshair-preview.circle{border:2px solid #00eaff;border-radius:50%}
.ss-crosshair-preview.off:after{content:'×';position:absolute;inset:-2px 0 0;text-align:center;color:#00eaff;font-size:20px}
#settings-reset-button{margin-top:18px;width:100%;padding:12px;border:1px solid rgba(0,234,255,.28);border-radius:12px;color:#dffaff;background:rgba(0,234,255,.08);cursor:pointer;font:700 10px 'Orbitron',sans-serif;letter-spacing:1px}
#crosshair[data-crosshair="off"]{display:none!important}
#crosshair[data-crosshair="dot"]{width:5px!important;height:5px!important;border:0!important;border-radius:50%!important;background:#00efff!important;box-shadow:0 0 8px #00efff!important}
#crosshair[data-crosshair="dot"]:before,#crosshair[data-crosshair="dot"]:after{display:none!important}
#crosshair[data-crosshair="circle"]{width:22px!important;height:22px!important;border:2px solid #00efff!important;border-radius:50%!important;background:transparent!important}
#crosshair[data-crosshair="circle"]:before,#crosshair[data-crosshair="circle"]:after{display:none!important}
#crosshair[data-crosshair="cross"]{width:18px!important;height:18px!important;border:0!important;background:transparent!important}
#crosshair[data-crosshair="cross"]:before,#crosshair[data-crosshair="cross"]:after{content:''!important;display:block!important;position:absolute!important;background:#00efff!important;box-shadow:0 0 7px #00efff!important}
#crosshair[data-crosshair="cross"]:before{width:2px!important;height:18px!important;left:8px!important;top:0!important}
#crosshair[data-crosshair="cross"]:after{width:18px!important;height:2px!important;left:0!important;top:8px!important}
#crosshair{position:fixed!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;pointer-events:none!important;z-index:8!important}
#game-shell.ss-paused #game-canvas{filter:blur(3px) brightness(.58) saturate(.78);transform:scale(1.012)}
#game-shell #game-canvas{transition:filter .22s ease,transform .22s ease}
#game-shell.ss-paused:after{content:"";position:fixed;inset:0;z-index:18;pointer-events:none;background:linear-gradient(135deg,rgba(167,224,255,.055),rgba(8,21,43,.18));backdrop-filter:blur(1.5px)}
#pause-screen{z-index:25!important;backdrop-filter:blur(8px)!important}
#pause-screen:not(.hidden){display:flex!important;align-items:center;justify-content:center;flex-direction:column;gap:14px;padding:24px;background:rgba(4,12,25,.24)!important}
#pause-screen .ss-pause-title{display:block;margin:0 0 8px;color:#f0fbff;font:800 clamp(24px,4vw,38px) 'Orbitron',sans-serif;letter-spacing:4px;text-align:center;text-shadow:0 0 24px rgba(0,224,255,.34)}
#pause-screen .ss-pause-subtitle{margin:-5px 0 8px;color:#a8c7d8;font:500 11px 'Space Grotesk',sans-serif;letter-spacing:2px;text-align:center}
#pause-settings-button{min-width:180px;padding:12px 18px;border:1px solid rgba(122,225,255,.38);border-radius:999px;color:#e9fbff;background:rgba(140,205,235,.10);font:700 10px 'Orbitron',sans-serif;letter-spacing:1.4px;cursor:pointer}
@media(max-width:600px){#settings-open-button{padding:9px 11px;font-size:9px}.ss-settings-card{padding:19px}}
`;
document.head.appendChild(settingsStyle);

let crosshairElement = document.getElementById("crosshair");
if (!crosshairElement) {
    crosshairElement = document.createElement("div");
    crosshairElement.id = "crosshair";
    shell.appendChild(crosshairElement);
}

if (!pauseScreen.querySelector(".ss-pause-title")) {
    const title = document.createElement("h2");
    title.className = "ss-pause-title";
    title.textContent = "PAUSED";
    pauseScreen.prepend(title);
}

if (!pauseScreen.querySelector(".ss-pause-subtitle")) {
    const subtitle = document.createElement("p");
    subtitle.className = "ss-pause-subtitle";
    subtitle.textContent = "YOUR RUN IS ON HOLD";
    pauseScreen.querySelector(".ss-pause-title").insertAdjacentElement("afterend", subtitle);
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
(document.getElementById("topbar") || shell).appendChild(settingsButton);

const settingsPanel = document.createElement("div");
settingsPanel.id = "settings-panel";
settingsPanel.hidden = true;
settingsPanel.innerHTML = `
<section class="ss-settings-card" role="dialog" aria-modal="true" aria-labelledby="ss-settings-title">
  <div class="ss-settings-head">
    <div><h2 class="ss-settings-title" id="ss-settings-title">GAME SETTINGS</h2>
    <p class="ss-settings-subtitle">Tune your controls and visibility.</p></div>
    <button id="settings-close-button" type="button" aria-label="Close settings">×</button>
  </div>
  <div class="ss-setting-row">
    <label class="ss-setting-label" for="ss-sensitivity"><span>Mouse sensitivity</span><output class="ss-setting-value" id="ss-sensitivity-value">1.00×</output></label>
    <input class="ss-setting-range" id="ss-sensitivity" type="range" min="0.0005" max="0.025" step="0.0001">
    <p class="ss-setting-help">Controls how quickly your view moves.</p>
  </div>
  <div class="ss-setting-row">
    <label class="ss-setting-label" for="ss-fov"><span>Field of view (FOV)</span><output class="ss-setting-value" id="ss-fov-value">75°</output></label>
    <input class="ss-setting-range" id="ss-fov" type="range" min="60" max="110" step="1">
    <p class="ss-setting-help">Higher FOV shows more of the arena.</p>
  </div>
  <div class="ss-setting-row">
    <div class="ss-setting-label"><span>Crosshair type</span><span class="ss-setting-value" id="ss-crosshair-value">CROSS</span></div>
    <div class="ss-crosshair-options">
      <button class="ss-crosshair-option" type="button" data-crosshair-choice="cross" aria-pressed="true"><span class="ss-crosshair-preview cross"></span>Cross</button>
      <button class="ss-crosshair-option" type="button" data-crosshair-choice="dot" aria-pressed="false"><span class="ss-crosshair-preview dot"></span>Dot</button>
      <button class="ss-crosshair-option" type="button" data-crosshair-choice="circle" aria-pressed="false"><span class="ss-crosshair-preview circle"></span>Circle</button>
      <button class="ss-crosshair-option" type="button" data-crosshair-choice="off" aria-pressed="false"><span class="ss-crosshair-preview off"></span>Off</button>
    </div>
  </div>
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
    sensitivityValue.textContent =
        `${(playerSettings.sensitivity / SETTINGS_DEFAULTS.sensitivity).toFixed(2)}×`;

    fovInput.value = String(playerSettings.fov);
    fovValue.textContent = `${playerSettings.fov}°`;

    crosshairElement.dataset.crosshair = playerSettings.crosshair;
    crosshairValue.textContent = playerSettings.crosshair.toUpperCase();

    settingsPanel.querySelectorAll("[data-crosshair-choice]").forEach(button => {
        button.setAttribute(
            "aria-pressed",
            String(button.dataset.crosshairChoice === playerSettings.crosshair)
        );
    });

    savePlayerSettings();
}

function openSettings() {
    settingsPanel.hidden = false;
    if (document.pointerLockElement) document.exitPointerLock();

    if (gameStarted && !gameOver) {
        gamePaused = true;
        pauseBackgroundMusic();
        shell.classList.add("ss-paused");
        pauseScreen.classList.add("hidden");
    }
}

function closeSettings() {
    settingsPanel.hidden = true;

    if (gameStarted && !gameOver) {
        gamePaused = true;
        pauseBackgroundMusic();
        shell.classList.add("ss-paused");
        pauseScreen.classList.remove("hidden");
    }
}

settingsButton.addEventListener("click", openSettings);
pauseSettingsButton.addEventListener("click", openSettings);
settingsCloseButton.addEventListener("click", closeSettings);

settingsPanel.addEventListener("click", event => {
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

settingsPanel.querySelectorAll("[data-crosshair-choice]").forEach(button => {
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
        color: 0x00eaff, transparent: true, opacity: 0.9
    });

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.035, 8, 24), material
    );
    ring.position.copy(position);
    ring.lookAt(camera.position);
    scene.add(ring);

    effects.push({ object: ring, life: 0.35, maxLife: 0.35 });
}

function addShotTrail(start, end) {
    const length = start.distanceTo(end);
    if (length < 0.05) return;

    const curve = new THREE.LineCurve3(start.clone(), end.clone());

    const layers = [
        { radius: 0.055, color: 0xff7a18, opacity: 0.22, radialSegments: 7 },
        { radius: 0.027, color: 0xffb52e, opacity: 0.55, radialSegments: 6 },
        { radius: 0.010, color: 0xfff1a1, opacity: 0.95, radialSegments: 5 }
    ];

    for (const layer of layers) {
        const geometry = new THREE.TubeGeometry(
            curve, Math.max(2, Math.ceil(length * 2)),
            layer.radius, layer.radialSegments, false
        );

        const material = new THREE.MeshBasicMaterial({
            color: layer.color, transparent: true,
            opacity: layer.opacity, blending: THREE.AdditiveBlending,
            depthWrite: false, toneMapped: false
        });

        const glow = new THREE.Mesh(geometry, material);
        glow.renderOrder = 5;
        scene.add(glow);

        effects.push({
            object: glow, life: 0.3, maxLife: 0.3,
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
    if (scoreValue) scoreValue.textContent = String(score).padStart(4, "0");
    if (bestScoreValue) bestScoreValue.textContent = String(bestScore).padStart(4, "0");
    if (ammoValue) ammoValue.textContent = ammo;

    if (ammoFill) {
        ammoFill.style.width = `${(ammo / CONFIG.weapon.maxAmmo) * 100}%`;
    }

    if (reloadLabel) {
        reloadLabel.textContent =
            isReloading || ammo === 0 ? "RELOADING..." : "READY";
    }
}

/* ---------- PLAYER MOVEMENT ---------- */

function updatePlayer(delta) {
    jumpCooldown = Math.max(0, jumpCooldown - delta);

    if (jumpHeight > 0 || jumpVelocity > 0) {
        const previousHeight = jumpHeight;
        jumpVelocity -= CONFIG.player.jumpGravity * delta;
        jumpHeight += jumpVelocity * delta;

        if (jumpHeight <= 0) {
            jumpHeight = 0;
            jumpVelocity = 0;

            if (previousHeight > 0.08) {
                landingImpact = 1;
                soundLanding();
            }
        }
    }

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

    // Camera roll is controlled ONLY by A/D.
    const horizontalInput =
        (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);

    const targetMovementTilt = horizontalInput * 0.055;
    movementTilt = THREE.MathUtils.damp(
        movementTilt, targetMovementTilt, 7, delta
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

    updatePlayerHitbox();
}

function tryJump() {
    if (
        !gameStarted || gamePaused || gameOver ||
        jumpHeight > 0 || jumpCooldown > 0
    ) return;

    jumpVelocity = CONFIG.player.jumpSpeed;
    jumpCooldown = CONFIG.player.jumpCooldown;
    soundJump();
    showToast("JUMP!");
}

/* ---------- BALL PHYSICS ---------- */

function resetBall() {
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

    const speedTier = Math.floor(score / 100);
    if (speedTier > lastSpeedTier) {
        const gainedTiers = speedTier - lastSpeedTier;
        ballVelocity.multiplyScalar(Math.pow(1.08, gainedTiers));
        lastSpeedTier = speedTier;
        showToast(`BALL SPEED UP — LEVEL ${speedTier}`);
    }

    ballVelocity.z += CONFIG.ball.slopeGravity * delta;
    ballVelocity.x *= Math.pow(0.999, delta * 60);
    ballVelocity.z *= Math.pow(0.9995, delta * 60);
    ballVelocity.y -= CONFIG.ball.gravity * delta;
    ball.position.addScaledVector(ballVelocity, delta);

    // Floor contact.
    if (ball.position.y < CONFIG.ball.radius) {
        ball.position.y = CONFIG.ball.radius;

        if (ballVelocity.y < 0) {
            ballVelocity.y = Math.abs(ballVelocity.y) * 0.82;
            if (ballVelocity.y < 0.65) ballVelocity.y = 0;
        }

        ballVelocity.x *= 0.997;
        ballVelocity.z *= 0.999;
    }

    // Corner bouncers: launch effect only, ZERO points.
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
            touchingTop && bouncer.cooldown <= 0
        ) {
            ball.position.y = Math.max(
                ball.position.y, bouncer.topY + CONFIG.ball.radius
            );

            const launchAngle = Math.random() * Math.PI * 2;
            const launchSpeed = THREE.MathUtils.randFloat(11.5, 15.5);

            ballVelocity.x = Math.cos(launchAngle) * launchSpeed;
            ballVelocity.z = Math.sin(launchAngle) * launchSpeed;
            ballVelocity.y = THREE.MathUtils.randFloat(12.5, 15.5);

            bouncer.cooldown = 0.72;

            addImpactEffect(new THREE.Vector3(
                bouncer.x, bouncer.topY + 0.08, bouncer.z
            ));

            soundJumpPad();
            showToast("CORNER BOUNCER — LAUNCH!");
            break;
        }
    }

    // Ceiling.
    if (ball.position.y > 4.35) {
        ball.position.y = 4.35;
        ballVelocity.y = -Math.abs(ballVelocity.y) * 0.72;
    }

    // Side walls.
    if (ball.position.x < -5.05) {
        ball.position.x = -5.05;
        ballVelocity.x = Math.abs(ballVelocity.x) * 0.86;
        soundBallImpact();
    }

    if (ball.position.x > 5.05) {
        ball.position.x = 5.05;
        ballVelocity.x = -Math.abs(ballVelocity.x) * 0.86;
        soundBallImpact();
    }

    // Far end rebound.
    if (ball.position.z < -9.35) {
        ball.position.z = -9.35;

        if (ballVelocity.z < 0) {
            ballVelocity.z = Math.max(Math.abs(ballVelocity.z) * 0.96, 10.5);

            addImpactEffect(new THREE.Vector3(
                ball.position.x, ball.position.y, -9.30
            ));
            soundBallImpact();
        }
    }

    // Player-side energy wall rebound.
    const frontWallHitZ =
        frontReboundWallZ - 0.25 - CONFIG.ball.radius;

    if (ball.position.z > frontWallHitZ && ballVelocity.z > 0) {
        ball.position.z = frontWallHitZ;
        ballVelocity.z = -Math.max(
            Math.abs(ballVelocity.z) * CONFIG.ball.wallBounce, 7.2
        );
        ballVelocity.x *= 0.82;
        ballVelocity.x += THREE.MathUtils.clamp(
            -ball.position.x * 0.65, -2, 2
        );

        addImpactEffect(new THREE.Vector3(
            ball.position.x, ball.position.y, frontWallHitZ
        ));

        soundWallBounce();
        showToast("ENERGY WALL — BALL REBOUNDED");
    }

    // Centre pull.
    ballVelocity.x += -ball.position.x * 0.08 * delta;

    const maxSpeed = Math.min(40, 28 + speedTier * 2);
    if (ballVelocity.length() > maxSpeed) {
        ballVelocity.setLength(maxSpeed);
    }

    ball.rotation.x += ballVelocity.z * delta / CONFIG.ball.radius;
    ball.rotation.z -= ballVelocity.x * delta / CONFIG.ball.radius;

    ballLight.position.copy(ball.position);
    ballHalo.position.copy(ball.position);
    ballOuterAura.position.copy(ball.position);

    const glowPulse = 1 + Math.sin(performance.now() * 0.006) * 0.08;
    ballHalo.scale.setScalar(glowPulse);
    ballOuterAura.scale.setScalar(glowPulse * 1.04);
    ballLight.intensity = 30 + Math.sin(performance.now() * 0.006) * 4;

    // Capsule-versus-sphere player collision.
    const capsuleBottom = playerHitbox.position.y + HITBOX_SEGMENT_BOTTOM;
    const capsuleTop = playerHitbox.position.y + HITBOX_SEGMENT_TOP;

    const closestY = THREE.MathUtils.clamp(
        ball.position.y, capsuleBottom, capsuleTop
    );

    const dx = ball.position.x - playerHitbox.position.x;
    const dy = ball.position.y - closestY;
    const dz = ball.position.z - playerHitbox.position.z;

    const collisionDistance = HITBOX_RADIUS + CONFIG.ball.radius;
    const collisionDistanceSquared =
        dx * dx + dy * dy + dz * dz;

    if (
        collisionDistanceSquared < collisionDistance * collisionDistance &&
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
    if (!gameStarted || gamePaused || gameOver || isReloading) return;

    const now = performance.now();
    if (now - lastShotTime < CONFIG.weapon.fireCooldown * 1000) return;

    if (ammo <= 0) {
        showToast("AUTO RELOADING...");
        return;
    }

    lastShotTime = now;
    ammo--;

    soundShoot();

    recoil = 0.18;
    screenShake = 1.35;

    gunGroup.position.z = 0.13;
    gunGroup.rotation.x = -0.11;
    viewModel.position.z = 0.055;

    updateHUD();

    const shotDirection = new THREE.Vector3();
    camera.getWorldDirection(shotDirection);

    const toBall = new THREE.Vector3().subVectors(
        ball.position, camera.position
    );
    const ballDistance = toBall.length();

    if (ballDistance > 0 && ballDistance <= CONFIG.weapon.range) {
        toBall.normalize();

        const aimAngle = shotDirection.angleTo(toBall);
        const assistAngle = CONFIG.weapon.aimAssistAngle;

        if (aimAngle < assistAngle) {
            const proximity = 1 - aimAngle / assistAngle;
            const assistStrength =
                CONFIG.weapon.aimAssistStrength * Math.sqrt(proximity);
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

        ballVelocity.addScaledVector(direction, CONFIG.ball.knockback);
        ballVelocity.x += direction.x * 7.5;
        ballVelocity.z += direction.z * 7.5;
        ballVelocity.y += 4.8;
        ballVelocity.multiplyScalar(1.08);

        score += 100;
        updateHUD();

        soundDirectHit();
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
        !gameStarted || gamePaused || gameOver ||
        isReloading || ammo === CONFIG.weapon.maxAmmo
    ) return;

    isReloading = true;
    soundReload();
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
        showToast("SHOTGUN READY");
    }, CONFIG.weapon.reloadTime * 1000);
}

/* ---------- VIEWMODEL ANIMATION ---------- */

function updateViewModel(delta) {
    const moving = keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD;
    weaponBob += delta * (moving ? 10 : 2.2);

    const bobAmount = moving ? 0.022 : 0.004;
    viewModel.position.y = Math.sin(weaponBob) * bobAmount;
    viewModel.position.x = Math.cos(weaponBob * 0.5) * bobAmount;

    viewModel.position.z = THREE.MathUtils.damp(
        viewModel.position.z, 0, 16, delta
    );

    recoil = THREE.MathUtils.damp(recoil, 0, 12, delta);

    gunGroup.position.z = THREE.MathUtils.damp(
        gunGroup.position.z, 0, 14, delta
    );

    if (!isReloading) {
        gunGroup.rotation.x = THREE.MathUtils.damp(
            gunGroup.rotation.x, 0, 12, delta
        );
    }
}

/* ---------- BOUNCER ANIMATION ---------- */

function updateBouncers() {
    const time = performance.now() * 0.002;

    for (const bouncer of bouncers) {
        const pulse = 1.8 + Math.sin(time + bouncer.pulseOffset) * 0.45;

        bouncer.light.intensity =
            3.8 + Math.sin(time + bouncer.pulseOffset) * 0.7;

        bouncer.topMaterial.emissiveIntensity = pulse;
        bouncer.ringMaterial.emissiveIntensity = pulse + 0.5;
    }
}

/* ---------- RANDOM ARENA EVENTS (VISUAL ONLY) ---------- */
const baseArenaLighting={hemisphere:hemisphereLight.intensity,main:mainLight.intensity,back:backLight.intensity,cyan:materials.cyan.emissiveIntensity,blue:materials.blue.emissiveIntensity,exposure:renderer.toneMappingExposure,background:scene.background.clone(),fog:scene.fog.color.clone(),backColor:backLight.color.clone()};
let arenaEventTimer=13,arenaEventDuration=0,activeArenaEvent=null;
function restoreArenaLighting(){hemisphereLight.intensity=baseArenaLighting.hemisphere;mainLight.intensity=baseArenaLighting.main;backLight.intensity=baseArenaLighting.back;materials.cyan.emissiveIntensity=baseArenaLighting.cyan;materials.blue.emissiveIntensity=baseArenaLighting.blue;renderer.toneMappingExposure=baseArenaLighting.exposure;scene.background.copy(baseArenaLighting.background);scene.fog.color.copy(baseArenaLighting.fog);backLight.color.copy(baseArenaLighting.backColor);arenaAccentLights.forEach(l=>{l.intensity=2.2;});activeArenaEvent=null;arenaEventDuration=0;if(eventBanner)eventBanner.classList.remove("show");}
function startArenaEvent(){const list=["NEON SURGE","BLACKOUT","BLUE SHIFT","PULSE WAVE"];activeArenaEvent=list[Math.floor(Math.random()*list.length)];arenaEventDuration=7.5;if(eventBanner){eventBanner.textContent="// "+activeArenaEvent+" — ARENA LIGHTING SHIFT";eventBanner.classList.add("show");}
if(activeArenaEvent==="NEON SURGE"){hemisphereLight.intensity=.42;mainLight.intensity=.38;backLight.intensity=19;materials.cyan.emissiveIntensity=3;materials.blue.emissiveIntensity=2.1;arenaAccentLights.forEach(l=>{l.intensity=4.2;});}
else if(activeArenaEvent==="BLACKOUT"){hemisphereLight.intensity=.22;mainLight.intensity=.16;backLight.intensity=10;materials.cyan.emissiveIntensity=3.1;materials.blue.emissiveIntensity=2.3;renderer.toneMappingExposure=.9;arenaAccentLights.forEach(l=>{l.intensity=3.4;});}
else if(activeArenaEvent==="BLUE SHIFT"){scene.background.setHex(0x06142a);scene.fog.color.setHex(0x06142a);backLight.color.setHex(0x246fff);backLight.intensity=17;materials.cyan.emissiveIntensity=2.4;materials.blue.emissiveIntensity=2.8;arenaAccentLights.forEach(l=>{l.intensity=3.3;});}
else{materials.cyan.emissiveIntensity=3.2;materials.blue.emissiveIntensity=2.5;arenaAccentLights.forEach((l,i)=>{l.intensity=i%2===0?4.4:1.1;});}}
function updateArenaEvents(delta){if(arenaEventDuration>0){arenaEventDuration-=delta;if(arenaEventDuration<=0){restoreArenaLighting();arenaEventTimer=THREE.MathUtils.randFloat(15,23);}return;}arenaEventTimer-=delta;if(arenaEventTimer<=0)startArenaEvent();}

/* ---------- POINTER LOCK ---------- */

function requestGamePointerLock() {
    if (isTouchDevice) return;
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
    initializeAudio();

    settingsPanel.hidden = true;
    clearTimeout(reloadTimer);

    score = 0;
    resetMobileJoystick();
    arenaEventTimer = 13;
    restoreArenaLighting();
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

    for (const bouncer of bouncers) {
        bouncer.cooldown = 0;
    }

    yaw = 0;
    pitch = 0;
    targetYaw = 0;
    targetPitch = 0;
    screenShake = 0;
    landingImpact = 0;
    movementTilt = 0;

    camera.position.set(
        playerX, CONFIG.player.eyeHeight, playerZ
    );
    camera.rotation.set(0, 0, 0, "YXZ");

    updatePlayerHitbox();

    gunGroup.position.set(0, 0, 0);
    gunGroup.rotation.set(0, 0, 0);
    viewModel.position.set(0, 0, 0);

    resetBall();
    updateHUD();

    shell.classList.remove("ss-paused");
    shell.classList.toggle("ss-mobile-playing", isTouchDevice);
    startScreen.classList.add("hidden");
    pauseScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");

    playBackgroundMusic();
    if (!isTouchDevice) requestGamePointerLock();
}

function pauseGame() {
    if (!gameStarted || gameOver || gamePaused) return;

    gamePaused = true;
    pauseBackgroundMusic();
    shell.classList.add("ss-paused");
    pauseScreen.classList.remove("hidden");

    resetMobileJoystick();
    if (!isTouchDevice && document.pointerLockElement) {
        document.exitPointerLock();
    }
}

function resumeGame() {
    if (!gameStarted || gameOver) return;

    gamePaused = false;
    shell.classList.remove("ss-paused");
    pauseScreen.classList.add("hidden");

    playBackgroundMusic();
    if (!isTouchDevice) requestGamePointerLock();
}

function endGame() {
    if (gameOver) return;

    gameOver = true;
    gameStarted = false;
    gamePaused = false;
    saveScoreRecord(score);
    resetMobileJoystick();
    shell.classList.remove("ss-mobile-playing");
    restoreArenaLighting();

    pauseBackgroundMusic();
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

document.addEventListener("keydown", event => {
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

    if (event.code === "KeyR") reload();
});

document.addEventListener("keyup", event => {
    keys[event.code] = false;
});

window.addEventListener("blur", () => {
    for (const key in keys) keys[key] = false;
});

document.addEventListener("mousemove", event => {
    if (!pointerLocked || gamePaused || gameOver) return;

    targetYaw -= event.movementX * playerSettings.sensitivity;
    targetPitch -= event.movementY * playerSettings.sensitivity;

    targetYaw = THREE.MathUtils.clamp(targetYaw, -1.15, 1.15);
    targetPitch = THREE.MathUtils.clamp(targetPitch, -0.55, 0.55);
});

document.addEventListener("mousedown", event => {
    if (event.sourceCapabilities && event.sourceCapabilities.firesTouchEvents) return;
    if (event.button === 0) shoot();
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
            playBackgroundMusic();
        }
        return;
    }

    if (
        hasHadPointerLock &&
        gameStarted &&
        !gamePaused &&
        !gameOver
    ) {
        gamePaused = true;
        pauseBackgroundMusic();
        shell.classList.add("ss-paused");
        pauseScreen.classList.remove("hidden");
    }
});

shell.addEventListener("click", event => {
    if (event.target.closest("button") || isTouchDevice) return;

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
    const renderWidth = shell.clientWidth || window.innerWidth;
    const renderHeight = shell.clientHeight || window.innerHeight;
    camera.aspect = renderWidth / renderHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(renderWidth, renderHeight);
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
        updateArenaEvents(delta);
    }

    wallCore.rotation.z += delta * 0.18;
    wallOuterRing.rotation.z =
        Math.sin(performance.now() * 0.0007) * 0.08;
    wallInnerRing.rotation.z -= delta * 0.28;

    updateBouncers();
    updateEffects(delta);

    renderer.render(scene, camera);
}

/* ---------- INITIALIZATION ---------- */

updateHUD();
if (bestScoreValue) bestScoreValue.textContent = String(bestScore).padStart(4, "0");
updatePlayerHitbox();
animate();

console.log("SHOOT-STREAK initialized successfully.");
