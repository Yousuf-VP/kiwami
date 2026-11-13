import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

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
const graphicsQualityInputs = [...document.querySelectorAll("[data-graphics-quality]")];
const graphicsShadowInputs = [...document.querySelectorAll("[data-graphics-shadows]")];
const graphicsMotionInputs = [...document.querySelectorAll("[data-graphics-motion]")];
const graphicsStatusOutputs = [...document.querySelectorAll("[data-graphics-status]")];
const graphicsMonitorInputs = [...document.querySelectorAll("[data-graphics-monitor]")];
const landscapeLayoutInputs = [...document.querySelectorAll("[data-force-landscape]")];
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
  easy: { label: "EASY", speed: 1.05, ramp: 0.85, bounce: 1.10, chaos: 0.45, aim: 0.18, xpMultiplier: 0.75 },
  medium: { label: "MEDIUM", speed: 1.3, ramp: 1.05, bounce: 1.18, chaos: 0.7, aim: 0.34, xpMultiplier: 1 },
  hard: { label: "HARD", speed: 1.6, ramp: 1.28, bounce: 1.28, chaos: 1.0, aim: 0.52, xpMultiplier: 1.5 },
  extreme: { label: "EXTREME", speed: 1.95, ramp: 1.55, bounce: 1.42, chaos: 1.35, aim: 0.72, xpMultiplier: 2 },
  master: { label: "MASTER", speed: 2.35, ramp: 1.85, bounce: 1.58, chaos: 1.75, aim: 1.0, xpMultiplier: 2.5 }
};
let selectedDifficulty = "medium";

const CONFIG = {
  room: { halfWidth: 7.5, halfDepth: 10, height: 5.5 },
  player: { speed: 9.2, radius: 0.42, startX: 0, startZ: 5.8, jumpSpeed: 9.4, jumpGravity: 19 },
  ball: { radius: 0.62, speed: 8.2, gravity: 12.5, bounce: 0.92, maxSpeed: 25 }
};

let state = "ready";
const GRAPHICS_PRESETS = {
  performance: { label: "PERFORMANCE", scale: 0.78, maxPixelRatio: 1.0, shadowMapSize: 512 },
  balanced: { label: "BALANCED", scale: 1.0, maxPixelRatio: 1.5, shadowMapSize: 512 },
  high: { label: "HIGH", scale: 1.08, maxPixelRatio: 2.0, shadowMapSize: 1024 }
};
const graphicsSettings = { quality: "balanced", shadows: false, motionEffects: true, performanceMonitor: false, forceLandscape: false };
try {
  const savedGraphics = JSON.parse(localStorage.getItem("dodgeCoreGraphics") || "null");
  if (savedGraphics && typeof savedGraphics === "object") {
    if (GRAPHICS_PRESETS[savedGraphics.quality]) graphicsSettings.quality = savedGraphics.quality;
    if (typeof savedGraphics.shadows === "boolean") graphicsSettings.shadows = savedGraphics.shadows;
    if (typeof savedGraphics.motionEffects === "boolean") graphicsSettings.motionEffects = savedGraphics.motionEffects;
    if (typeof savedGraphics.performanceMonitor === "boolean") graphicsSettings.performanceMonitor = savedGraphics.performanceMonitor;
    // Forced landscape is a per-session opt-in. Never restore it from localStorage.
  }
} catch {}
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

/* INFINITE XP + LEVEL PROGRESSION
   Every 100 score grants 10 base XP, multiplied by the selected difficulty.
   Level N begins at 100 * N^2 total XP; level progress is XP within that band.
*/
const PROGRESSION_KEY = "dodgeCoreProgression";
const PROGRESSION_OWNER_KEY = "dodgeCoreProgressionOwner";
const CASH_KEY = "dodgeCoreCash";
const CASH_OWNER_KEY = "dodgeCoreCashOwner";
let cashBalance = 0;
let cashEarnedThisRun = 0;
try {
  cashBalance = Math.max(0, Math.floor(Number(localStorage.getItem(CASH_KEY)) || 0));
} catch {}
let totalXP = 0;
let lastXpMilestone = 0;
let runStartingXP = 0;
let xpAnimationFrame = 0;
try {
  const savedProgression = JSON.parse(localStorage.getItem(PROGRESSION_KEY) || "null");
  if (savedProgression && typeof savedProgression === "object") {
    totalXP = Math.max(0, Math.floor(Number(savedProgression.totalXP) || 0));
  }
} catch {}

function getLevelProgress() {
  const level = Math.floor(Math.sqrt(totalXP / 100) + 1e-9);
  const levelStartXP = 100 * level * level;
  const nextLevelXP = 100 * (level + 1) * (level + 1);
  return {
    level,
    levelStartXP,
    nextLevelXP,
    currentLevelXP: totalXP - levelStartXP,
    requiredLevelXP: nextLevelXP - levelStartXP,
    percent: Math.min(100, Math.max(0, ((totalXP - levelStartXP) / (nextLevelXP - levelStartXP)) * 100))
  };
}

/* SUPABASE AUTH + CLOUD PLAYER PROFILE */
const supabaseReady = /^https:\/\//.test(SUPABASE_URL) &&
  !SUPABASE_URL.includes("YOUR_PROJECT") &&
  SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
const supabase = supabaseReady ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
let currentUser = null;
let currentUsername = "GUEST PLAYER";
let cloudSaveInFlight = Promise.resolve();

function setAccountMessage(message, isError = false) {
  document.querySelectorAll("[data-account-message]").forEach(node => {
    node.textContent = message;
    node.classList.toggle("is-error", isError);
  });
}
function renderAccountUI() {
  updateKiwamiPlayerBadge();
  const signedIn = Boolean(currentUser);
  document.querySelectorAll("[data-player-name]").forEach(node => node.textContent = signedIn ? currentUsername : "GUEST PLAYER");
  document.querySelectorAll("[data-account-logout]").forEach(node => {
    node.textContent = signedIn ? "LOG OUT" : "EXIT GUEST";
    node.setAttribute("aria-label", signedIn ? "Log out of player account" : "Exit guest session");
  });
  document.querySelectorAll("[data-player-status]").forEach(node => node.textContent = signedIn ? "CLOUD SYNC" : "LOCAL");
  document.querySelectorAll("[data-account-summary]").forEach(node => node.textContent = signedIn ? "SIGNED IN" : "GUEST MODE");
  document.querySelectorAll("[data-account-identity]").forEach(node => node.classList.toggle("hidden", !signedIn));
  document.querySelectorAll("[data-account-form]").forEach(node => node.classList.toggle("hidden", signedIn));
  document.querySelectorAll("[data-account-switch-label], [data-account-mode-switch]").forEach(node => node.classList.toggle("hidden", signedIn));
  document.querySelectorAll("[data-account-identity-name]").forEach(node => node.textContent = currentUsername);
  document.querySelectorAll("[data-account-identity-email]").forEach(node => node.textContent = currentUser?.email || "");
  renderProgression();
  renderCash();
}
function syncMenuProgression() {
  const progress = getLevelProgress();
  document.querySelectorAll("[data-menu-level]").forEach(node => node.textContent = String(progress.level));
  document.querySelectorAll("[data-menu-xp]").forEach(node => node.textContent = totalXP.toLocaleString() + " XP");
}
async function syncCloudProgression() {
  if (!supabase || !currentUser) return;
  const userId = currentUser.id;
  const xpSnapshot = totalXP;
  const cashSnapshot = cashBalance;
  cloudSaveInFlight = cloudSaveInFlight.catch(() => {}).then(async () => {
    if (!currentUser || currentUser.id !== userId) return;
    const { error } = await supabase.from("player_profiles")
      .update({ total_xp: xpSnapshot, cash_balance: cashSnapshot, username: currentUsername })
      .eq("id", userId);
    if (error) throw error;
  });
  try {
    await cloudSaveInFlight;
    setAccountMessage("Cloud save complete.");
  } catch (error) {
    setAccountMessage("Cloud save failed: " + (error.message || "Please try again."), true);
  }
}
async function loadCloudProgression(user) {
  if (!supabase || !user) return;
  let localOwner = null;
  try { localOwner = localStorage.getItem(PROGRESSION_OWNER_KEY); } catch {}
  const { data, error } = await supabase.from("player_profiles")
    .select("username,total_xp,cash_balance").eq("id", user.id).maybeSingle();
  if (error) {
    setAccountMessage("Could not load cloud profile: " + error.message, true);
    return;
  }
  const cloudXP = Math.max(0, Number(data?.total_xp) || 0);
  const cloudCash = Math.max(0, Math.floor(Number(data?.cash_balance) || 0));
  if (localOwner && localOwner !== user.id) {
    // Never carry one signed-in player's local progress or wallet into another account.
    totalXP = cloudXP;
    cashBalance = cloudCash;
  } else {
    // Import guest progress once, or merge this account's local progress with cloud.
    totalXP = Math.max(totalXP, cloudXP);
    cashBalance = Math.max(cashBalance, cloudCash);
  }
  try {
    localStorage.setItem(PROGRESSION_OWNER_KEY, user.id);
    localStorage.setItem(CASH_OWNER_KEY, user.id);
  } catch {}
  saveCash();
  renderCash();
  loadShopInventory();
  renderShop();
  currentUsername = data?.username || user.user_metadata?.username || user.email?.split("@")[0] || "PLAYER";
  saveProgression();
  renderCareerStats();
  renderProgression();
  syncMenuProgression();
  if (!data || totalXP > cloudXP || cashBalance > cloudCash) await syncCloudProgression();
}
async function initializeCloudAccount() {
  if (!supabase) {
    setAccountMessage("Cloud accounts are not configured yet. Add your Supabase project URL and anon key to supabase-config.js.");
    renderAccountUI();
    return;
  }
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    currentUser = data.session?.user || null;
    if (currentUser) {
      await loadCloudProgression(currentUser);
      document.getElementById("auth-gate")?.classList.add("hidden");
    }
    renderAccountUI();
    supabase.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      if (currentUser) {
        document.getElementById("auth-gate")?.classList.add("hidden");
        queueMicrotask(() => loadCloudProgression(currentUser).then(renderAccountUI));
      } else {
        currentUsername = "GUEST PLAYER";
        loadShopInventory();
        renderShop();
        document.getElementById("auth-gate")?.classList.remove("hidden");
        renderAccountUI();
      }
    });
    if (!currentUser) setAccountMessage("Create an account or log in to enable cloud saves.");
  } catch (error) {
    setAccountMessage("Account service error: " + (error.message || "Check your Supabase setup."), true);
  }
}
document.querySelectorAll("[data-account-mode-switch]").forEach(button => {
  button.addEventListener("click", () => {
    const panel = button.closest("[data-account-panel]");
    const form = panel?.querySelector("[data-account-form]");
    if (!form) return;
    const signup = form.dataset.accountMode !== "login";
    form.dataset.accountMode = signup ? "login" : "signup";
    const username = form.querySelector('[name="username"]');
    if (username) {
      username.closest("label").classList.toggle("hidden", !signup);
      username.required = signup;
    }
    const submit = form.querySelector("[data-account-submit]");
    if (submit) submit.textContent = signup ? "LOG IN" : "CREATE ACCOUNT";
    const switchLabel = panel.querySelector("[data-account-switch-label]");
    if (switchLabel) switchLabel.textContent = signup ? "New to DODGE CORE?" : "Already registered?";
    button.textContent = signup ? "CREATE ACCOUNT" : "LOG IN";
    setAccountMessage(signup ? "Enter your email and password to sign in." : "Choose a player name and create your account.");
  });
});
document.querySelectorAll("[data-account-form]").forEach(form => {
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!supabase) {
      setAccountMessage("Supabase is not configured. Follow the setup guide in supabase-schema.sql.", true);
      return;
    }
    const values = new FormData(form);
    const email = String(values.get("email") || "").trim();
    const password = String(values.get("password") || "");
    const username = String(values.get("username") || "").trim();
    const signup = form.dataset.accountMode !== "login";
    const submit = form.querySelector("[data-account-submit]");
    if (submit) submit.disabled = true;
    setAccountMessage(signup ? "Creating your account…" : "Signing in…");
    try {
      if (signup) {
        if (username.length < 3) throw new Error("Player name must be at least 3 characters.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
            emailRedirectTo: window.location.href.split("#")[0]
          }
        });
        if (error) throw error;
        if (data.session) {
          currentUser = data.user;
          currentUsername = username;
          await loadCloudProgression(currentUser);
          renderAccountUI();
          document.getElementById("auth-gate")?.classList.add("hidden");
          setAccountMessage("Account created. Cloud progression is ready.");
        } else {
          setAccountMessage("ACCOUNT CREATED — check your inbox and tap the confirmation link. You’ll return here signed in automatically; no separate login is needed.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser = data.user;
        await loadCloudProgression(currentUser);
        renderAccountUI();
        document.getElementById("auth-gate")?.classList.add("hidden");
        setAccountMessage("Welcome back. Your cloud progress is loaded.");
      }
    } catch (error) {
      setAccountMessage(error.message || "Account action failed.", true);
    } finally {
      if (submit) submit.disabled = false;
    }
  });
});
document.getElementById("auth-offline-button")?.addEventListener("click", () => {
  document.getElementById("auth-gate")?.classList.add("hidden");
  loadShopInventory();
  renderShop();
  setAccountMessage("Offline session. Progress stays on this device until cloud accounts are configured.");
});

document.querySelectorAll("[data-account-logout]").forEach(button => {
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    button.disabled = true;
    const wasSignedIn = Boolean(currentUser);
    try {
      if (wasSignedIn) {
        if (!supabase) throw new Error("Account service is unavailable. Refresh and try again.");
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) throw error;
        currentUser = null;
        currentUsername = "GUEST PLAYER";
        totalXP = 0;
        cashBalance = 0;
        try {
          localStorage.removeItem(PROGRESSION_KEY);
          localStorage.removeItem(PROGRESSION_OWNER_KEY);
          localStorage.removeItem(CASH_KEY);
          localStorage.removeItem(CASH_OWNER_KEY);
        } catch {}
        renderCash();
        loadShopInventory();
        renderShop();
        setAccountMessage("Signed out. Your cloud progression remains saved to your account.");
      } else {
        setAccountMessage("Guest session ended. Sign in or create an account to continue.");
      }
      document.getElementById("auth-gate")?.classList.remove("hidden");
      renderAccountUI();
    } catch (error) {
      setAccountMessage(error.message || "Could not end this session.", true);
    } finally {
      button.disabled = false;
    }
  });
});

function saveProgression() {
  try {
    localStorage.setItem(PROGRESSION_KEY, JSON.stringify({ totalXP }));
  } catch {}
}
function saveCash() {
  try { localStorage.setItem(CASH_KEY, String(Math.max(0, Math.floor(cashBalance)))); } catch {}
}
function renderCash() {
  document.querySelectorAll("[data-menu-cash]").forEach(node => {
    node.textContent = Math.floor(cashBalance).toLocaleString();
  });
  const reward = document.getElementById("cash-reward-amount");
  if (reward) reward.textContent = "+" + Math.floor(cashEarnedThisRun).toLocaleString() + " CASH";
  const total = document.getElementById("cash-reward-total");
  if (total) total.textContent = Math.floor(cashBalance).toLocaleString() + " CASH AVAILABLE";
}
/* CARD-BASED COSMETIC SHOP — purchases use the existing CASH wallet. */
const SHOP_ITEMS = [
  { id:"crimson-core", name:"CRIMSON CORE", category:"skin", description:"The original arena signature.", price:0, color:"#ff2447", glow:"#ff123c", rarity:"STANDARD" },
  { id:"arctic-core", name:"ARCTIC CORE", category:"skin", description:"A cold, high-voltage finish.", price:180, color:"#75dfff", glow:"#21bfff", rarity:"RARE" },
  { id:"violet-core", name:"VIOLET CORE", category:"skin", description:"A deep violet energy shell.", price:320, color:"#b18aff", glow:"#813cff", rarity:"EPIC" },
  { id:"phantom-core", name:"PHANTOM CORE", category:"skin", description:"A pale core with a sharp glow.", price:460, color:"#e8efff", glow:"#a9c5ff", rarity:"EPIC" },
  { id:"void-core", name:"VOID CORE", category:"effect", description:"A dark shell wrapped in purple light.", price:620, color:"#77718f", glow:"#8c5cff", rarity:"ELITE" },
  { id:"pulse-core", name:"PULSE CORE", category:"effect", description:"A bright red core with an amplified aura.", price:780, color:"#ff5269", glow:"#ff183d", rarity:"ELITE" },
  { id:"default-frame", name:"STANDARD FRAME", category:"frame", description:"A clean profile frame for your player badge.", price:0, color:"#8b929f", glow:"#667080", rarity:"STANDARD" },
  { id:"ember-frame", name:"EMBER FRAME", category:"frame", description:"A sharp red outline with a warm glow.", price:220, color:"#ff536b", glow:"#ff183d", rarity:"RARE" },
  { id:"arctic-frame", name:"ARCTIC FRAME", category:"frame", description:"A cool, bright edge for your player identity.", price:380, color:"#75dfff", glow:"#21bfff", rarity:"EPIC" },
  { id:"void-frame", name:"VOID FRAME", category:"frame", description:"A dark violet frame with a subtle pulse.", price:540, color:"#b18aff", glow:"#813cff", rarity:"ELITE" }
];
const SHOP_INVENTORY_PREFIX = "dodgeCoreShopInventory:";
let shopInventory = { owned:["crimson-core","default-frame"], equipped:"crimson-core", equippedFrame:"default-frame" };
let activeShopFilter = "all";

function shopStorageKey() {
  return SHOP_INVENTORY_PREFIX + (currentUser?.id || "guest");
}
function loadShopInventory() {
  try {
    const saved = JSON.parse(localStorage.getItem(shopStorageKey()) || "null");
    const validOwned = Array.isArray(saved?.owned)
      ? saved.owned.filter(id => SHOP_ITEMS.some(item => item.id === id))
      : [];
    const equipped = SHOP_ITEMS.some(item => item.id === saved?.equipped && item.category !== "frame" && validOwned.includes(saved.equipped))
      ? saved.equipped : "crimson-core";
    const equippedFrame = SHOP_ITEMS.some(item => item.id === saved?.equippedFrame && item.category === "frame" && validOwned.includes(saved.equippedFrame))
      ? saved.equippedFrame : "default-frame";
    shopInventory = { owned:[...new Set(["crimson-core","default-frame", ...validOwned])], equipped, equippedFrame };
  } catch {
    shopInventory = { owned:["crimson-core","default-frame"], equipped:"crimson-core", equippedFrame:"default-frame" };
  }
  applyEquippedPlayerFrame();
}
function saveShopInventory() {
  try { localStorage.setItem(shopStorageKey(), JSON.stringify(shopInventory)); } catch {}
}
function applyEquippedBallSkin() {
  const item = SHOP_ITEMS.find(entry => entry.id === shopInventory.equipped && entry.category !== "frame") || SHOP_ITEMS[0];
  if (typeof THREE === "undefined" || !mats?.ball || !ballAura || !ballLight) return;
  mats.ball.color.set(item.color);
  mats.ball.emissive.set(item.glow);
  ballAura.material.color.set(item.glow);
  ballLight.color.set(item.glow);
}
function applyEquippedPlayerFrame() {
  const frame = SHOP_ITEMS.find(entry => entry.id === shopInventory.equippedFrame && entry.category === "frame") || SHOP_ITEMS.find(entry => entry.id === "default-frame");
  if (!frame) return;
  document.querySelectorAll("[data-player-avatar]").forEach(node => {
    node.style.border = "1px solid " + frame.color;
    node.style.boxShadow = frame.id === "default-frame" ? "none" : "0 0 14px " + frame.glow + "55";
  });
}
function renderShop() {
  const grid = document.querySelector("[data-shop-grid]");
  if (!grid) return;
  document.querySelectorAll("[data-shop-cash]").forEach(node => {
    node.textContent = Math.floor(cashBalance).toLocaleString();
  });
  grid.replaceChildren();
  const visibleItems = SHOP_ITEMS.filter(item => activeShopFilter === "all" || item.category === activeShopFilter);
  visibleItems.forEach(item => {
    const owned = shopInventory.owned.includes(item.id);
    const equipped = item.category === "frame" ? shopInventory.equippedFrame === item.id : shopInventory.equipped === item.id;
    const card = document.createElement("article");
    card.className = "shop-item-card" + (equipped ? " is-equipped" : "");
    const preview = document.createElement("div");
    preview.className = "shop-item-preview" + (item.category === "frame" ? " is-frame" : "");
    preview.style.setProperty("--item-color", item.color);
    preview.style.setProperty("--item-glow", item.glow);
    preview.innerHTML = '<span class="shop-preview-orb"></span><span class="shop-preview-ring"></span>';
    const meta = document.createElement("div");
    meta.className = "shop-item-meta";
    const rarity = document.createElement("span");
    rarity.className = "shop-item-rarity";
    rarity.textContent = item.rarity;
    const category = document.createElement("span");
    category.textContent = item.category === "skin" ? "CORE SKIN" : item.category === "frame" ? "PLAYER FRAME" : "AURA EFFECT";
    meta.append(rarity, category);
    const title = document.createElement("h4");
    title.textContent = item.name;
    const description = document.createElement("p");
    description.textContent = item.description;
    const footer = document.createElement("div");
    footer.className = "shop-item-footer";
    const price = document.createElement("strong");
    price.className = "shop-item-price";
    price.textContent = item.price === 0 ? "FREE" : "◈ " + item.price.toLocaleString();
    const action = document.createElement("button");
    action.type = "button";
    action.className = "shop-item-action";
    action.dataset.shopAction = item.id;
    action.textContent = equipped ? "EQUIPPED" : owned ? "EQUIP" : "BUY";
    action.disabled = equipped;
    footer.append(price, action);
    card.append(preview, meta, title, description, footer);
    grid.append(card);
  });
}
function setShopStatus(message, isError = false) {
  const status = document.querySelector("[data-shop-status]");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}
function purchaseOrEquipShopItem(itemId) {
  const item = SHOP_ITEMS.find(entry => entry.id === itemId);
  if (!item) return;
  const owned = shopInventory.owned.includes(item.id);
  if (!owned) {
    if (cashBalance < item.price) {
      setShopStatus("NOT ENOUGH CASH — COMPLETE MORE RUNS TO EARN CASH.", true);
      return;
    }
    cashBalance -= item.price;
    saveCash();
    shopInventory.owned.push(item.id);
    if (currentUser) syncCloudProgression();
    setShopStatus(item.name + " UNLOCKED. EQUIPPED.");
  } else {
    setShopStatus(item.name + " EQUIPPED.");
  }
  if (item.category === "frame") shopInventory.equippedFrame = item.id;
  else shopInventory.equipped = item.id;
  saveShopInventory();
  applyEquippedBallSkin();
  applyEquippedPlayerFrame();
  renderCash();
  renderShop();
}
document.querySelectorAll("[data-shop-filter]").forEach(button => {
  button.addEventListener("click", () => {
    activeShopFilter = button.dataset.shopFilter;
    document.querySelectorAll("[data-shop-filter]").forEach(tab => {
      const selected = tab === button;
      tab.classList.toggle("selected", selected);
      tab.setAttribute("aria-pressed", String(selected));
    });
    renderShop();
  });
});
document.querySelector("[data-shop-grid]")?.addEventListener("click", event => {
  const action = event.target.closest("[data-shop-action]");
  if (action) purchaseOrEquipShopItem(action.dataset.shopAction);
});
loadShopInventory();
renderShop();
applyEquippedPlayerFrame();

function awardCashForRun(survivalSeconds) {
  const difficultyMultiplier = DIFFICULTIES[selectedDifficulty]?.xpMultiplier ?? 1;
  const earned = survivalSeconds > 0
    ? Math.max(1, Math.floor((survivalSeconds / 5) * difficultyMultiplier))
    : 0;
  cashEarnedThisRun = earned;
  cashBalance += earned;
  saveCash();
  renderCash();
  renderShop();
  if (earned > 0 && currentUser) syncCloudProgression();
  return earned;
}
function renderProgression() {
  updateKiwamiPlayerBadge();
  const progress = getLevelProgress();
  const levelNode = document.getElementById("level-value");
  const xpNode = document.getElementById("xp-value");
  const fillNode = document.getElementById("xp-fill");
  if (levelNode) levelNode.textContent = String(progress.level);
  if (xpNode) xpNode.textContent = Math.floor(progress.currentLevelXP).toLocaleString() + " / " + progress.requiredLevelXP.toLocaleString() + " XP";
  if (fillNode) fillNode.style.width = progress.percent + "%";
  syncMenuProgression();
}
function awardXPForScore(currentScore) {
  const reachedMilestone = Math.floor(currentScore / 100);
  if (reachedMilestone <= lastXpMilestone) return;
  const difficultyMultiplier = DIFFICULTIES[selectedDifficulty]?.xpMultiplier ?? 1;
  const gainedXP = (reachedMilestone - lastXpMilestone) * 10 * difficultyMultiplier;
  lastXpMilestone = reachedMilestone;
  totalXP = Math.round((totalXP + gainedXP) * 100) / 100;
  saveProgression();
  renderProgression();
  renderCareerStats();
  syncCloudProgression();
}

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
    "career-favourite": getFavouriteDifficulty(),
    "career-level": String(getLevelProgress().level),
    "career-xp": totalXP.toLocaleString() + " XP",
    "career-games-mobile": String(careerStats.totalGamesPlayed),
    "career-time-mobile": formatCareerTime(careerStats.totalSurvivalSeconds),
    "career-best-mobile": String(careerStats.bestScore).padStart(4, "0"),
    "career-favourite-mobile": getFavouriteDifficulty(),
    "career-level-mobile": String(getLevelProgress().level),
    "career-xp-mobile": totalXP.toLocaleString() + " XP"
  };
  for (const [id, value] of Object.entries(values)) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }
}
renderCareerStats();
renderProgression();


/* DAILY CHALLENGES — one rotating objective per local calendar day */
const DAILY_CHALLENGE_KEY = "dodgeCoreDailyChallenge";
const DAILY_CHALLENGES = [
  { id:"stay-sharp", title:"STAY SHARP", description:"Survive 45 seconds in one run.", target:45, unit:"SEC", type:"survive" },
  { id:"score-climber", title:"SCORE CLIMBER", description:"Reach 600 points in one run.", target:600, unit:"PTS", type:"score" },
  { id:"hardened-run", title:"HARDENED RUN", description:"Finish a run on HARD difficulty or higher.", target:1, unit:"RUN", type:"hard-finish" },
  { id:"long-haul", title:"LONG HAUL", description:"Survive 75 seconds in one run.", target:75, unit:"SEC", type:"survive" },
  { id:"extreme-reflexes", title:"EXTREME REFLEXES", description:"Survive 30 seconds on EXTREME or MASTER.", target:30, unit:"SEC", type:"extreme-survive" }
];
function getDailyChallengeDate() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth()+1).padStart(2,"0"), String(now.getDate()).padStart(2,"0")].join("-");
}
function getDailyChallengeForDate(dateKey) {
  const dayNumber = Number(dateKey.replace(/-/g,"")) || 0;
  return DAILY_CHALLENGES[dayNumber % DAILY_CHALLENGES.length];
}
let dailyChallengeDate = getDailyChallengeDate();
let dailyChallengeDefinition = getDailyChallengeForDate(dailyChallengeDate);
let dailyChallengeProgress = 0;
let dailyChallengeCompleted = false;
let dailyChallengeUpdateTimer = 0;
try {
  const savedDaily = JSON.parse(localStorage.getItem(DAILY_CHALLENGE_KEY) || "null");
  if (savedDaily && savedDaily.date === dailyChallengeDate && savedDaily.id === dailyChallengeDefinition.id) {
    dailyChallengeProgress = THREE.MathUtils.clamp(Number(savedDaily.progress) || 0, 0, dailyChallengeDefinition.target);
    dailyChallengeCompleted = savedDaily.completed === true;
  }
} catch {}
function saveDailyChallengeState() {
  try {
    localStorage.setItem(DAILY_CHALLENGE_KEY, JSON.stringify({
      date:dailyChallengeDate,
      id:dailyChallengeDefinition.id,
      progress:dailyChallengeProgress,
      completed:dailyChallengeCompleted
    }));
  } catch {}
}
function renderDailyChallenge() {
  const challenge = dailyChallengeDefinition;
  const progress = Math.min(challenge.target, dailyChallengeProgress);
  const percent = Math.round((progress / challenge.target) * 100);
  const progressText = Math.floor(progress).toLocaleString() + " / " + challenge.target.toLocaleString() + " " + challenge.unit;
  document.querySelectorAll("[data-daily-title]").forEach(node => node.textContent = challenge.title);
  document.querySelectorAll("[data-daily-description]").forEach(node => node.textContent = challenge.description);
  document.querySelectorAll("[data-daily-date]").forEach(node => node.textContent = "TODAY · " + dailyChallengeDate);
  document.querySelectorAll("[data-daily-progress]").forEach(node => node.textContent = progressText);
  document.querySelectorAll("[data-daily-status]").forEach(node => {
    node.textContent = dailyChallengeCompleted ? "COMPLETED" : "IN PROGRESS";
    node.dataset.completed = String(dailyChallengeCompleted);
  });
  document.querySelectorAll("[data-daily-summary]").forEach(node => node.textContent = dailyChallengeCompleted ? "COMPLETED" : percent + "%");
  document.querySelectorAll("[data-daily-bar]").forEach(node => node.style.width = percent + "%");
}
function refreshDailyChallengeIfNeeded() {
  const today = getDailyChallengeDate();
  if (today === dailyChallengeDate) return;
  dailyChallengeDate = today;
  dailyChallengeDefinition = getDailyChallengeForDate(today);
  dailyChallengeProgress = 0;
  dailyChallengeCompleted = false;
  dailyChallengeUpdateTimer = 0;
  saveDailyChallengeState();
  renderDailyChallenge();
}
function updateDailyChallenge(runEnded = false) {
  refreshDailyChallengeIfNeeded();
  if (dailyChallengeCompleted) return;
  const challenge = dailyChallengeDefinition;
  let currentProgress = 0;
  if (challenge.type === "survive") currentProgress = elapsed;
  else if (challenge.type === "score") currentProgress = elapsed * 10;
  else if (challenge.type === "hard-finish" && runEnded && ["hard","extreme","master"].includes(selectedDifficulty)) currentProgress = 1;
  else if (challenge.type === "extreme-survive" && ["extreme","master"].includes(selectedDifficulty)) currentProgress = elapsed;
  const nextProgress = Math.min(challenge.target, Math.max(0, currentProgress));
  if (Math.floor(nextProgress) <= Math.floor(dailyChallengeProgress) && nextProgress < challenge.target) return;
  dailyChallengeProgress = Math.max(dailyChallengeProgress, nextProgress);
  if (dailyChallengeProgress >= challenge.target) dailyChallengeCompleted = true;
  saveDailyChallengeState();
  renderDailyChallenge();
}
function tickDailyChallenge(delta) {
  dailyChallengeUpdateTimer += delta;
  if (dailyChallengeUpdateTimer >= 0.25) {
    dailyChallengeUpdateTimer = 0;
    updateDailyChallenge(false);
  }
}
renderDailyChallenge();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08090d);
scene.fog = new THREE.Fog(0x08090d, 18, 34);

const camera = new THREE.PerspectiveCamera(76, 1, 0.05, 90);
scene.add(camera); // Camera-attached avatar arms are rendered with the scene.
camera.position.set(0, 1.65, CONFIG.player.startZ);
camera.lookAt(0, 1.65, CONFIG.player.startZ - 12);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
const initialGraphicsPreset = GRAPHICS_PRESETS[graphicsSettings.quality];
renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * initialGraphicsPreset.scale, initialGraphicsPreset.maxPixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

// Optional directional light used only when the player enables real-time shadows.
const shadowLight = new THREE.DirectionalLight(0xffffff, 0);
shadowLight.position.set(-4, 9, 5);
shadowLight.castShadow = true;
shadowLight.shadow.camera.left = -10;
shadowLight.shadow.camera.right = 10;
shadowLight.shadow.camera.top = 9;
shadowLight.shadow.camera.bottom = -11;
shadowLight.shadow.camera.near = 0.5;
shadowLight.shadow.camera.far = 24;
shadowLight.shadow.bias = -0.00025;
shadowLight.shadow.normalBias = 0.025;
shadowLight.shadow.radius = 3;
scene.add(shadowLight);
scene.add(shadowLight.target);

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
  mesh.receiveShadow = true;
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
ball.castShadow = true;
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
  { name:"RED", hex:0xff2447, glow:0xff002b, dark:0x210811, ground:0x18070d },
  { name:"GREEN", hex:0x39d98a, glow:0x16b96d, dark:0x071b12, ground:0x07140d },
  { name:"LIGHT BLUE", hex:0x55dcff, glow:0x21bfff, dark:0x071a25, ground:0x07131c },
  { name:"BLUE", hex:0x397dff, glow:0x185dff, dark:0x07152b, ground:0x07101f },
  { name:"PURPLE", hex:0xa879ff, glow:0x813cff, dark:0x160d28, ground:0x10091c },
  { name:"PINK", hex:0xff5aa9, glow:0xff278b, dark:0x210b19, ground:0x180812 },
  { name:"WHITE", hex:0xf2f5ff, glow:0xcbd8ff, dark:0x171a24, ground:0x10131b }
];
const ARENA_THEME_OPTIONS = [
  { value:"red", label:"CLASSIC RED", threshold:0, index:0 },
  { value:"green", label:"EMERALD", threshold:300, index:1 },
  { value:"ice", label:"ICE BLUE", threshold:600, index:2 },
  { value:"blue", label:"COBALT", threshold:900, index:3 },
  { value:"purple", label:"VIOLET", threshold:1200, index:4 },
  { value:"pink", label:"ROSE", threshold:1500, index:5 },
  { value:"white", label:"WHITEOUT", threshold:2000, index:6 }
];
let selectedArenaTheme = "red";
try {
  const savedTheme = localStorage.getItem("dodgeCoreArenaTheme");
  if (ARENA_THEME_OPTIONS.some(theme => theme.value === savedTheme)) selectedArenaTheme = savedTheme;
} catch {}
function selectedArenaThemeConfig() {
  return ARENA_THEME_OPTIONS.find(theme => theme.value === selectedArenaTheme) || ARENA_THEME_OPTIONS[0];
}
function syncArenaThemeControls() {
  const current = selectedArenaThemeConfig();
  document.querySelectorAll("[data-arena-theme]").forEach(select => {
    for (const option of select.options) {
      const config = ARENA_THEME_OPTIONS.find(theme => theme.value === option.value);
      option.disabled = Boolean(config && careerStats.bestScore < config.threshold);
    }
    select.value = selectedArenaTheme;
  });
  document.querySelectorAll("[data-arena-theme-status]").forEach(output => {
    output.textContent = current.label + " SELECTED  /  BEST SCORE " + careerStats.bestScore.toLocaleString();
  });
}
document.querySelectorAll("[data-arena-theme]").forEach(select => select.addEventListener("change", () => {
  const choice = ARENA_THEME_OPTIONS.find(theme => theme.value === select.value);
  if (!choice || careerStats.bestScore < choice.threshold) {
    syncArenaThemeControls();
    return;
  }
  selectedArenaTheme = choice.value;
  try { localStorage.setItem("dodgeCoreArenaTheme", selectedArenaTheme); } catch {}
  syncArenaThemeControls();
  if (state !== "playing") resetArenaTheme();
}));

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
  const paletteIndex = (selectedArenaThemeConfig().index + milestone) % arenaThemes.length;
  const palette = arenaThemes[paletteIndex];
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
  triggerArenaTheme(0);
  if (themeBanner) themeBanner.classList.remove("theme-banner-show");
  syncArenaThemeControls();
}

const eventBanner = document.getElementById("event-banner");
const ARENA_EVENTS = [
  { id:"low-gravity", label:"LOW GRAVITY", description:"JUMPS STAY AIRBORNE LONGER", duration:7.5 },
  { id:"fog-surge", label:"FOG SURGE", description:"VISIBILITY TEMPORARILY REDUCED", duration:7.5 },
  { id:"ball-tempo", label:"BALL TEMPO", description:"THE BALL MOVES FASTER", duration:7.5 },
  { id:"light-shift", label:"LIGHT SHIFT", description:"ARENA LIGHTING CHANGES", duration:7.5 }
];
let activeArenaEvent = null;
let arenaEventRemaining = 0;
let arenaEventCooldown = 18;
function finishArenaEvent() {
  if (!activeArenaEvent) return;
  if (activeArenaEvent.id === "fog-surge") { scene.fog.near = 18; scene.fog.far = 34; }
  if (activeArenaEvent.id === "ball-tempo") { ballVelocity.multiplyScalar(1 / 1.15); }
  if (activeArenaEvent.id === "light-shift") { ceilingLight.intensity = 22; redRoomGlow.intensity = 18; }
  activeArenaEvent = null;
  arenaEventRemaining = 0;
}
function startArenaEvent() {
  const event = ARENA_EVENTS[Math.floor(Math.random() * ARENA_EVENTS.length)];
  activeArenaEvent = event;
  arenaEventRemaining = event.duration;
  if (event.id === "fog-surge") { scene.fog.near = 8; scene.fog.far = 23; }
  if (event.id === "ball-tempo") { ballVelocity.multiplyScalar(1.15); }
  if (event.id === "light-shift") { ceilingLight.intensity = 12; redRoomGlow.intensity = 26; }
  if (eventBanner) {
    eventBanner.textContent = "ARENA EVENT  /  " + event.label + " — " + event.description;
    eventBanner.classList.remove("event-banner-show");
    void eventBanner.offsetWidth;
    eventBanner.classList.add("event-banner-show");
  }
}
function updateArenaEvents(delta) {
  if (activeArenaEvent) {
    arenaEventRemaining -= delta;
    if (arenaEventRemaining <= 0) finishArenaEvent();
    return;
  }
  arenaEventCooldown -= delta;
  if (arenaEventCooldown <= 0) {
    startArenaEvent();
    arenaEventCooldown = 22 + Math.random() * 8;
  }
}
function resetArenaEvents() {
  finishArenaEvent();
  arenaEventCooldown = 18;
  if (eventBanner) eventBanner.classList.remove("event-banner-show");
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

const DEFAULT_KEYBINDS = { forward:"w", backward:"s", left:"a", right:"d", jump:" " };
let keybinds = { ...DEFAULT_KEYBINDS };
let rebindingAction = null;
try {
  const savedBinds = JSON.parse(localStorage.getItem("dodgeCoreKeybinds") || "null");
  if (savedBinds && typeof savedBinds === "object") {
    for (const action of Object.keys(DEFAULT_KEYBINDS)) {
      if (typeof savedBinds[action] === "string" && savedBinds[action].length <= 20) keybinds[action] = savedBinds[action];
    }
  }
} catch {}
function displayKey(key) {
  if (key === " ") return "SPACE";
  if (key.startsWith("arrow")) return key.replace("arrow", "ARROW ").toUpperCase();
  return key.toUpperCase();
}
function syncKeybindButtons() {
  document.querySelectorAll("[data-rebind]").forEach(button => {
    const action = button.dataset.rebind;
    button.textContent = displayKey(keybinds[action] || DEFAULT_KEYBINDS[action]);
    button.classList.toggle("is-rebinding", rebindingAction === action);
    button.setAttribute("aria-label", "Rebind " + action + " key");
  });
}
function beginKeyRebind(action) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_KEYBINDS, action)) return;
  rebindingAction = action;
  syncKeybindButtons();
}
document.querySelectorAll("[data-rebind]").forEach(button => button.addEventListener("click", () => beginKeyRebind(button.dataset.rebind)));
syncKeybindButtons();

let joystickScale = 1;
let joystickResponse = 1;
try {
  const savedTouch = JSON.parse(localStorage.getItem("dodgeCoreTouchControls") || "null");
  if (savedTouch && typeof savedTouch === "object") {
    joystickScale = THREE.MathUtils.clamp(Number(savedTouch.size) || 1, 0.8, 1.3);
    joystickResponse = THREE.MathUtils.clamp(Number(savedTouch.response) || 1, 0.6, 1.6);
  }
} catch {}
const joystickSizeInputs = [...document.querySelectorAll("[data-joystick-size]")];
const joystickResponseInputs = [...document.querySelectorAll("[data-joystick-sensitivity]")];
function applyTouchControlSettings(persist = false) {
  joystickBase.style.setProperty("--joystick-scale", String(joystickScale));
  joystickSizeInputs.forEach(input => { input.value = String(Math.round(joystickScale * 100)); });
  joystickResponseInputs.forEach(input => { input.value = String(Math.round(joystickResponse * 100)); });
  document.querySelectorAll("[data-joystick-size-value]").forEach(output => output.textContent = Math.round(joystickScale * 100) + "%");
  document.querySelectorAll("[data-joystick-sensitivity-value]").forEach(output => output.textContent = Math.round(joystickResponse * 100) + "%");
  if (persist) {
    try { localStorage.setItem("dodgeCoreTouchControls", JSON.stringify({ size:joystickScale, response:joystickResponse })); } catch {}
  }
}
joystickSizeInputs.forEach(input => input.addEventListener("input", () => {
  joystickScale = THREE.MathUtils.clamp(Number(input.value) / 100, 0.8, 1.3);
  applyTouchControlSettings(true);
}));
joystickResponseInputs.forEach(input => input.addEventListener("input", () => {
  joystickResponse = THREE.MathUtils.clamp(Number(input.value) / 100, 0.6, 1.6);
  applyTouchControlSettings(true);
}));
applyTouchControlSettings();

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
window.visualViewport?.addEventListener("resize", resize);
if ("ResizeObserver" in window) new ResizeObserver(resize).observe(shell);
resize();

function saveGraphicsSettings() {
  try { localStorage.setItem("dodgeCoreGraphics", JSON.stringify(graphicsSettings)); } catch {}
}
function syncForceLandscapeMode() {
  const enabled = graphicsSettings.forceLandscape;
  document.body.classList.toggle("force-landscape", enabled);

  // Native orientation lock is used when the browser permits it (usually
  // fullscreen or an installed app). The CSS rotation remains the fallback.
  if (enabled && screen.orientation && typeof screen.orientation.lock === "function") {
    try {
      const lockResult = screen.orientation.lock("landscape");
      if (lockResult && typeof lockResult.catch === "function") lockResult.catch(() => {});
    } catch {}
  } else if (!enabled && screen.orientation && typeof screen.orientation.unlock === "function") {
    try { screen.orientation.unlock(); } catch {}
  }

  requestAnimationFrame(() => requestAnimationFrame(resize));
}

function applyGraphicsSettings(persist = false) {
  const preset = GRAPHICS_PRESETS[graphicsSettings.quality] || GRAPHICS_PRESETS.balanced;
  graphicsQualityInputs.forEach(input => { input.value = graphicsSettings.quality; });
  graphicsShadowInputs.forEach(input => { input.checked = graphicsSettings.shadows; });
  graphicsMotionInputs.forEach(input => { input.checked = graphicsSettings.motionEffects; });
  graphicsMonitorInputs.forEach(input => { input.checked = graphicsSettings.performanceMonitor; });
  landscapeLayoutInputs.forEach(input => { input.checked = graphicsSettings.forceLandscape; });
  syncForceLandscapeMode();
  const monitor = document.getElementById("performance-monitor");
  if (monitor) monitor.hidden = !graphicsSettings.performanceMonitor;
  graphicsStatusOutputs.forEach(output => {
    output.textContent = preset.label + "  /  " + (graphicsSettings.shadows ? "SHADOWS ON" : "SHADOWS OFF");
  });

  const pixelRatio = Math.min((window.devicePixelRatio || 1) * preset.scale, preset.maxPixelRatio);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = graphicsSettings.shadows;
  shadowLight.intensity = graphicsSettings.shadows ? 0.62 : 0;
  shadowLight.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
  shadowLight.shadow.needsUpdate = true;
  resize();
  if (persist) saveGraphicsSettings();
}
graphicsQualityInputs.forEach(input => input.addEventListener("change", () => {
  if (!GRAPHICS_PRESETS[input.value]) return;
  graphicsSettings.quality = input.value;
  applyGraphicsSettings(true);
}));
graphicsShadowInputs.forEach(input => input.addEventListener("change", () => {
  graphicsSettings.shadows = input.checked;
  applyGraphicsSettings(true);
}));
graphicsMotionInputs.forEach(input => input.addEventListener("change", () => {
  graphicsSettings.motionEffects = input.checked;
  applyGraphicsSettings(true);
}));
graphicsMonitorInputs.forEach(input => input.addEventListener("change", () => {
  graphicsSettings.performanceMonitor = input.checked;
  applyGraphicsSettings(true);
}));
landscapeLayoutInputs.forEach(input => input.addEventListener("change", () => {
  graphicsSettings.forceLandscape = input.checked;
  applyGraphicsSettings(true);
}));
applyGraphicsSettings();


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

/* COD-style dedicated menu sections: panels leave the button list and
   occupy one shared full-screen section. Original DOM position is restored on Back. */
const detailScreen = document.getElementById("menu-detail-screen");
const detailContent = document.getElementById("menu-detail-content");
const detailTitle = document.getElementById("menu-detail-title");
const detailBack = document.getElementById("menu-detail-back");
let activeDetailPanel = null;
let activeDetailTrigger = null;
let activeDetailPlaceholder = null;

const detailTitles = {
  difficulty: "SELECT DIFFICULTY",
  settings: "GAME SETTINGS",
  career: "CAREER RECORD",
  shop: "CORE SHOP",
  leaderboard: "GLOBAL LEADERBOARD",
  daily: "DAILY CHALLENGE"
};

let leaderboardMetric = "score";
let leaderboardRequest = 0;

function formatLeaderboardValue(row, metric) {
  if (metric === "level") return "LVL " + Number(row.player_level || 0).toLocaleString();
  if (metric === "xp") return Number(row.total_xp || 0).toLocaleString() + " XP";
  return Number(row.best_score || 0).toLocaleString();
}

function renderLeaderboardRows(rows, metric) {
  const host = document.querySelector("[data-leaderboard-rows]");
  if (!host) return;
  host.replaceChildren();
  if (!rows?.length) {
    const empty = document.createElement("div");
    empty.className = "leaderboard-state";
    empty.textContent = "NO GLOBAL RECORDS YET. BE THE FIRST.";
    host.append(empty);
    return;
  }
  rows.forEach(row => {
    const item = document.createElement("article");
    item.className = "leaderboard-row" + (row.is_current_player ? " is-you" : "") + (Number(row.rank_position) <= 3 ? " is-podium podium-" + row.rank_position : "");
    const identity = document.createElement("div");
    identity.className = "leaderboard-player";
    const rank = document.createElement("strong");
    rank.className = "leaderboard-rank";
    rank.textContent = "#" + Number(row.rank_position).toLocaleString();
    const details = document.createElement("span");
    details.className = "leaderboard-player-copy";
    const name = document.createElement("b");
    name.textContent = row.username || "PLAYER";
    const meta = document.createElement("small");
    meta.textContent = "LEVEL " + Number(row.player_level || 0).toLocaleString() + (row.is_current_player ? " · YOU" : "");
    details.append(name, meta);
    identity.append(rank, details);
    const value = document.createElement("strong");
    value.className = "leaderboard-value";
    value.textContent = formatLeaderboardValue(row, metric);
    item.append(identity, value);
    host.append(item);
  });
}

async function loadGlobalLeaderboard() {
  const host = document.querySelector("[data-leaderboard-rows]");
  const status = document.querySelector("[data-leaderboard-status]");
  const rankNode = document.querySelector("[data-leaderboard-player-rank]");
  const bestNode = document.querySelector("[data-leaderboard-player-best]");
  const countNode = document.querySelector("[data-leaderboard-player-count]");
  const valueHeading = document.querySelector("[data-leaderboard-value-heading]");
  if (!host) return;
  const requestId = ++leaderboardRequest;
  const headings = { score: "BEST SCORE", level: "PLAYER LEVEL", xp: "TOTAL XP" };
  if (valueHeading) valueHeading.textContent = headings[leaderboardMetric];
  if (!supabase) {
    host.innerHTML = '<div class="leaderboard-state">CLOUD LEADERBOARD IS NOT CONFIGURED.</div>';
    if (status) status.textContent = "Add the Supabase configuration and apply leaderboard-schema.sql in your project.";
    return;
  }
  host.innerHTML = '<div class="leaderboard-state">SYNCING GLOBAL RANKINGS…</div>';
  if (status) status.textContent = currentUser ? "Loading your global position…" : "Viewing public rankings. Sign in to submit a score.";
  try {
    const { data, error } = await supabase.rpc("get_dodge_core_leaderboard", {
      p_metric: leaderboardMetric,
      p_limit: 100
    });
    if (error) throw error;
    if (requestId !== leaderboardRequest) return;
    const rows = Array.isArray(data) ? data : [];
    renderLeaderboardRows(rows, leaderboardMetric);
    const mine = rows.find(row => row.is_current_player);
    if (rankNode) rankNode.textContent = mine ? "#" + Number(mine.rank_position).toLocaleString() : (currentUser ? "UNRANKED" : "SIGN IN");
    if (bestNode) bestNode.textContent = mine ? Number(mine.best_score || 0).toLocaleString() : String(best || 0).toLocaleString();
    if (countNode) countNode.textContent = rows.filter(row => !row.is_current_player || Number(row.rank_position) <= 100).length.toLocaleString() + (rows.length >= 100 ? "+" : "");
    if (status) status.textContent = currentUser
      ? (mine ? "YOUR VERIFIED PROFILE IS INCLUDED IN THE GLOBAL RANKINGS." : "Your account has no published score yet. Finish a run to set your first record.")
      : "Public rankings are read-only while signed out. Sign in to publish your personal best.";
  } catch (error) {
    if (requestId !== leaderboardRequest) return;
    host.innerHTML = '<div class="leaderboard-state">RANKINGS COULD NOT BE LOADED.</div>';
    if (status) status.textContent = error.message || "Check the leaderboard database setup and try again.";
    if (rankNode) rankNode.textContent = "—";
    if (bestNode) bestNode.textContent = "—";
    if (countNode) countNode.textContent = "—";
  }
}

async function submitGlobalBestScore(finalScoreValue, survivalSeconds) {
  if (!supabase || !currentUser) return;
  const scoreValue = Math.max(0, Math.floor(Number(finalScoreValue) || 0));
  const survivalMs = Math.max(0, Math.round(Number(survivalSeconds) * 1000));
  try {
    const { error } = await supabase.rpc("submit_dodge_core_score", {
      p_score: scoreValue,
      p_survival_ms: survivalMs,
      p_difficulty: selectedDifficulty
    });
    if (error) throw error;
    const status = document.querySelector("[data-leaderboard-status]");
    if (status) status.textContent = "RUN RECORD SUBMITTED. GLOBAL POSITION UPDATED WHEN VERIFIED.";
    if (!document.getElementById("leaderboard-panel")?.classList.contains("hidden")) await loadGlobalLeaderboard();
  } catch (error) {
    const status = document.querySelector("[data-leaderboard-status]");
    if (status) status.textContent = "GLOBAL RECORD NOT SUBMITTED: " + (error.message || "Please try again later.");
  }
}

document.querySelectorAll("[data-leaderboard-metric]").forEach(button => {
  button.addEventListener("click", () => {
    leaderboardMetric = button.dataset.leaderboardMetric || "score";
    document.querySelectorAll("[data-leaderboard-metric]").forEach(tab => {
      const active = tab === button;
      tab.classList.toggle("selected", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    loadGlobalLeaderboard();
  });
});
document.querySelector("[data-leaderboard-refresh]")?.addEventListener("click", loadGlobalLeaderboard);

function closeMenuDetail() {
  if (!activeDetailPanel || !detailScreen) return;
  activeDetailPanel.classList.add("hidden");
  if (activeDetailPlaceholder?.parentNode) {
    activeDetailPlaceholder.parentNode.insertBefore(activeDetailPanel, activeDetailPlaceholder);
    activeDetailPlaceholder.remove();
  }
  if (activeDetailTrigger) {
    activeDetailTrigger.setAttribute("aria-expanded", "false");
    activeDetailTrigger.classList.remove("active");
    activeDetailTrigger.focus({ preventScroll: true });
  }
  activeDetailPanel = null;
  activeDetailTrigger = null;
  activeDetailPlaceholder = null;
  detailScreen.classList.add("hidden");
  detailScreen.setAttribute("aria-hidden", "true");
  document.body.classList.remove("menu-detail-open");
}

function openMenuDetail(button) {
  const panel = document.getElementById(button.dataset.panelToggle);
  if (!panel || !detailScreen || !detailContent) return;
  closeMenuDetail();
  activeDetailTrigger = button;
  document.querySelectorAll(".kiwami-nav-button,.mobile-nav-button").forEach(node => node.classList.toggle("active", node === button));
  button.classList.add("active");
  button.setAttribute("aria-expanded", "true");
  activeDetailPanel = panel;
  activeDetailPlaceholder = document.createComment("menu-panel-position");
  panel.parentNode.insertBefore(activeDetailPlaceholder, panel);
  const kind = button.dataset.panelToggle
    .replace(/^(mobile|desktop|pause)-/, "")
    .replace(/-panel$/, "");
  detailTitle.textContent = detailTitles[kind] || "ARENA OPTIONS";
  detailContent.replaceChildren(panel);
  panel.classList.remove("hidden");
  detailScreen.classList.remove("hidden");
  detailScreen.setAttribute("aria-hidden", "false");
  document.body.classList.add("menu-detail-open");
  detailBack.focus({ preventScroll: true });
  if (kind === "leaderboard") loadGlobalLeaderboard();
}

document.querySelectorAll("[data-panel-toggle]").forEach(button => {
  button.setAttribute("aria-haspopup", "dialog");
  button.addEventListener("click", () => openMenuDetail(button));
});
detailBack?.addEventListener("click", closeMenuDetail);
detailScreen?.querySelectorAll("[data-detail-close]").forEach(node => {
  node.addEventListener("click", closeMenuDetail);
});
document.addEventListener("keydown", event => {
  if (!detailScreen || detailScreen.classList.contains("hidden")) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeMenuDetail();
  }
});
detailContent?.addEventListener("click", event => {
  if (event.target.closest("[data-difficulty]")) closeMenuDetail();
});

/* Layered arena atmosphere. Generated once; CSS handles all animation. */
function installArenaAtmosphere(screen) {
  if (!screen || screen.querySelector(":scope > .arena-cinematic-fx")) return;
  const fx = document.createElement("div");
  fx.className = "arena-cinematic-fx";
  fx.setAttribute("aria-hidden", "true");
  // Extra arena instrumentation: layered orbital rings and a central energy pulse.
  for (let i = 0; i < 3; i++) {
    const ring = document.createElement("span");
    ring.className = "arena-orbit-ring ring-" + (i + 1);
    fx.append(ring);
  }
  const corePulse = document.createElement("span");
  corePulse.className = "arena-core-pulse";
  fx.append(corePulse);
  const lightSweep = document.createElement("span");
  lightSweep.className = "arena-horizontal-sweep";
  fx.append(lightSweep);
  for (let i = 0; i < 20; i++) {
    const beam = document.createElement("span");
    beam.className = "arena-energy-beam";
    beam.style.setProperty("--beam-x", (i * 17 + 4) % 100 + "%");
    beam.style.setProperty("--beam-delay", -(i * 0.83) + "s");
    beam.style.setProperty("--beam-duration", (5.5 + (i % 5) * 1.35) + "s");
    beam.style.setProperty("--beam-angle", (-22 + (i % 7) * 7) + "deg");
    fx.append(beam);
  }
  for (let i = 0; i < 42; i++) {
    const spark = document.createElement("span");
    spark.className = "arena-spark";
    spark.style.setProperty("--spark-x", (i * 37 + 9) % 100 + "%");
    spark.style.setProperty("--spark-y", (i * 23 + 13) % 100 + "%");
    spark.style.setProperty("--spark-delay", -(i * 0.47) + "s");
    spark.style.setProperty("--spark-duration", (3.2 + (i % 6) * 1.1) + "s");
    fx.append(spark);
  }
  screen.prepend(fx);
}
installArenaAtmosphere(startScreen);
installArenaAtmosphere(pauseScreen);


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

let gameOverRevealTimer = 0;

function setScreen(active) {
  shell.classList.toggle("is-playing", active === "playing");
  startScreen.classList.toggle("hidden", active !== "ready");
  pauseScreen.classList.toggle("hidden", active !== "paused");
  gameOverScreen.classList.toggle("hidden", active !== "over");
  pauseButton.textContent = active === "paused" ? "PAUSED" : "PAUSE";
  pauseButton.disabled = active === "ready" || active === "over";

  const cinematic = document.getElementById("game-over-cinematic");
  const results = gameOverScreen.querySelector(".game-over-results");
  if (gameOverRevealTimer) {
    window.clearTimeout(gameOverRevealTimer);
    gameOverRevealTimer = 0;
  }
  if (active === "over") {
    // Keep the results window fully hidden while the GAME OVER sequence runs.
    results?.classList.remove("is-visible");
    cinematic?.classList.remove("is-playing", "is-finished");
    if (cinematic) {
      void cinematic.offsetWidth;
      cinematic.classList.add("is-playing");
    }
    const rewardDelay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 2550;
    gameOverRevealTimer = window.setTimeout(() => {
      gameOverRevealTimer = 0;
      if (state !== "over") return;
      cinematic?.classList.add("is-finished");
      results?.classList.add("is-visible");
      animateRunXPReward(runStartingXP, totalXP);
    }, rewardDelay);
  } else {
    cinematic?.classList.remove("is-playing", "is-finished");
    results?.classList.remove("is-visible");
  }
}

function resetRun() {
  resetArenaEvents();
  elapsed = 0;
  score = 0;
  lastXpMilestone = 0;
  runStartingXP = totalXP;
  renderProgression();
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
  cashEarnedThisRun = 0;
  renderCash();
  refreshDailyChallengeIfNeeded();
  resetRun();
  careerStats.totalGamesPlayed += 1;
  saveCareerStats();
  renderCareerStats();
  state = "playing";
  gameOverTrack.pause();
  gameOverTrack.currentTime = 0;
  if (musicEnabled) startBackgroundMusic();
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
  gameOverTrack.pause();
  if (musicEnabled) startBackgroundMusic();
  keys.clear();
  touchDirections.clear();
  resetJoystick();
  if (document.pointerLockElement) document.exitPointerLock();
  setScreen(state);
}


function renderRewardProgress(xp) {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 100) + 1e-9);
  const start = 100 * level * level;
  const next = 100 * (level + 1) * (level + 1);
  const percent = Math.min(100, Math.max(0, ((xp - start) / (next - start)) * 100));
  const levelNode = document.getElementById("xp-reward-level");
  const totalNode = document.getElementById("xp-reward-total");
  const fill = document.getElementById("xp-reward-fill");
  const hudLevel = document.getElementById("level-value");
  const hudXP = document.getElementById("xp-value");
  const hudFill = document.getElementById("xp-fill");
  if (levelNode) levelNode.textContent = String(level);
  const currentLevelXP = Math.max(0, xp - start);
  const requiredLevelXP = next - start;
  if (totalNode) totalNode.textContent = Math.floor(currentLevelXP).toLocaleString() + " / " + requiredLevelXP.toLocaleString() + " XP";
  if (fill) fill.style.width = percent + "%";
  if (hudLevel) hudLevel.textContent = String(level);
  if (hudXP) hudXP.textContent = Math.floor(currentLevelXP).toLocaleString() + " / " + requiredLevelXP.toLocaleString() + " XP";
  if (hudFill) hudFill.style.width = percent + "%";
  document.querySelectorAll("[data-menu-level]").forEach(node => node.textContent = String(level));
  document.querySelectorAll("[data-menu-xp]").forEach(node => node.textContent = Math.floor(xp).toLocaleString() + " XP");
}
function animateRunXPReward(startXP, endXP) {
  if (xpAnimationFrame) cancelAnimationFrame(xpAnimationFrame);
  const panel = document.getElementById("xp-reward-panel");
  const amount = document.getElementById("xp-reward-amount");
  const levelup = document.getElementById("xp-levelup-banner");
  const levelupValue = document.getElementById("xp-levelup-value");
  if (!panel || !amount) return;
  const gained = Math.max(0, endXP - startXP);
  const startLevel = Math.floor(Math.sqrt(Math.max(0, startXP) / 100) + 1e-9);
  const endLevel = Math.floor(Math.sqrt(Math.max(0, endXP) / 100) + 1e-9);
  amount.textContent = "+" + gained.toLocaleString() + " XP";
  panel.classList.toggle("has-reward", gained > 0);
  if (levelup) levelup.classList.add("hidden");
  renderRewardProgress(startXP);
  const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 2200;
  if (!duration || !gained) {
    renderRewardProgress(endXP);
    if (endLevel > startLevel && levelup) {
      levelupValue.textContent = String(endLevel);
      levelup.classList.remove("hidden");
    }
    return;
  }
  const startedAt = performance.now();
  const tick = now => {
    const raw = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - raw, 3);
    const currentXP = startXP + gained * eased;
    renderRewardProgress(currentXP);
    if (raw < 1) {
      xpAnimationFrame = requestAnimationFrame(tick);
    } else {
      xpAnimationFrame = 0;
      renderRewardProgress(endXP);
      if (endLevel > startLevel && levelup) {
        levelupValue.textContent = String(endLevel);
        levelup.classList.remove("hidden");
        panel.classList.add("level-up");
      }
    }
  };
  xpAnimationFrame = requestAnimationFrame(tick);
}

function endRun() {
  if (state !== "playing") return;
  state = "over";
  playGameOverSound();
  const final = Math.floor(score);
  const survived = Math.max(0, elapsed);
  const earnedThisRun = Math.max(0, totalXP - runStartingXP);
  const cashEarned = awardCashForRun(survived);
  updateDailyChallenge(true);
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
  syncArenaThemeControls();
  // Publish only the signed-in player's best run through the database RPC.
  submitGlobalBestScore(final, survived);

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
  renderCash();
  if (earnedThisRun > 0) syncCloudProgression();
  setScreen(state);
}


/* DODGE CORE AUDIO — user-provided MP3 assets */
const MUSIC_PREF_KEY = "dodgeCoreMusicEnabled";
let musicEnabled = true;
const backgroundTrack = new Audio(new URL("./bg.mp3", import.meta.url).href);
backgroundTrack.loop = true;
backgroundTrack.preload = "auto";
backgroundTrack.volume = 0.42;

const gameOverTrack = new Audio(new URL("./gameover.mp3", import.meta.url).href);
gameOverTrack.preload = "auto";
gameOverTrack.volume = 0.82;

const buttonSoundUrl = new URL("./Button.mp3", import.meta.url).href;
try { musicEnabled = localStorage.getItem(MUSIC_PREF_KEY) !== "0"; } catch {}

function updateMusicControls() {
  document.querySelectorAll("[data-music-toggle]").forEach(button => {
    button.textContent = musicEnabled ? "ON" : "OFF";
    button.setAttribute("aria-pressed", musicEnabled ? "true" : "false");
    button.classList.toggle("is-on", musicEnabled);
  });
}

function startBackgroundMusic() {
  if (!musicEnabled || document.hidden) return;
  gameOverTrack.pause();
  backgroundTrack.play().catch(() => {
    // Browsers may block playback until the next user interaction.
  });
}

function stopBackgroundMusic() {
  backgroundTrack.pause();
}

function setMusicEnabled(enabled) {
  musicEnabled = Boolean(enabled);
  try { localStorage.setItem(MUSIC_PREF_KEY, musicEnabled ? "1" : "0"); } catch {}
  updateMusicControls();
  if (musicEnabled) startBackgroundMusic();
  else stopBackgroundMusic();
}

function playButtonSound() {
  const sound = new Audio(buttonSoundUrl);
  sound.preload = "auto";
  sound.volume = 0.48;
  sound.play().catch(() => {
    // Missing assets or browser playback restrictions fail silently.
  });
}

function playGameOverSound() {
  stopBackgroundMusic();
  gameOverTrack.currentTime = 0;
  gameOverTrack.play().catch(() => {
    // The game remains playable if the optional audio file is not present.
  });
}

gameOverTrack.addEventListener("ended", () => {
  if (musicEnabled && state === "over") startBackgroundMusic();
});

document.querySelectorAll("[data-music-toggle]").forEach(button => {
  button.addEventListener("click", () => setMusicEnabled(!musicEnabled));
});

document.addEventListener("click", event => {
  if (event.target instanceof Element && event.target.closest("button")) {
    playButtonSound();
  }
  if (musicEnabled) startBackgroundMusic();
});

document.addEventListener("keydown", () => {
  if (musicEnabled) startBackgroundMusic();
}, { once: true });

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    backgroundTrack.pause();
    gameOverTrack.pause();
  } else if (musicEnabled && state !== "over") {
    startBackgroundMusic();
  }
});

updateMusicControls();

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
  const target = event.target;
  const isTypingTarget = target instanceof HTMLElement && (
    target.isContentEditable ||
    target.matches("input, textarea, select, [contenteditable='true']")
  );
  // Never capture movement keys while the player is entering account details or using menus.
  if (isTypingTarget) return;

  const key = event.key.toLowerCase();
  if (rebindingAction) {
    event.preventDefault();
    if (key === "escape") {
      rebindingAction = null;
      syncKeybindButtons();
      return;
    }
    keybinds[rebindingAction] = key === "spacebar" ? " " : key;
    try { localStorage.setItem("dodgeCoreKeybinds", JSON.stringify(keybinds)); } catch {}
    rebindingAction = null;
    syncKeybindButtons();
    return;
  }
  // Outside gameplay, ordinary keyboard input belongs to the menu/browser.
  if (state !== "playing") {
    if (key === "escape" && state === "paused") resumeRun();
    return;
  }
  if ([...Object.values(keybinds), "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key) || key === " ") event.preventDefault();
  keys.add(key);
  if (key === keybinds.jump && !event.repeat) jumpPlayer();
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
  touchMoveX=THREE.MathUtils.clamp((dx/max)*joystickResponse,-1,1); touchMoveY=THREE.MathUtils.clamp((dy/max)*joystickResponse,-1,1);
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
  if (isDown(keybinds.left, "arrowleft", "left")) side -= 1;
  if (isDown(keybinds.right, "arrowright", "right")) side += 1;
  if (isDown(keybinds.forward, "arrowup", "up")) forward += 1;
  if (isDown(keybinds.backward, "arrowdown", "down")) forward -= 1;

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
    jumpVelocity -= CONFIG.player.jumpGravity * (activeArenaEvent?.id === "low-gravity" ? 0.72 : 1) * delta;
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

// The ball continuously tracks the player position so its approach stays deliberate.
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

  // Smooth pursuit: steer toward the player's current arena position every frame.
  const targetDirection = new THREE.Vector2(
    player.position.x - ball.position.x,
    player.position.z - ball.position.z
  );
  const horizontalSpeed = Math.hypot(ballVelocity.x, ballVelocity.z);
  if (targetDirection.lengthSq() > 0.001 && horizontalSpeed > 0.001) {
    targetDirection.normalize();
    const currentDirection = new THREE.Vector2(ballVelocity.x, ballVelocity.z).normalize();
    const trackingStrength = 1 - Math.exp(-delta * (1.35 + difficulty.aim * 2.8));
    currentDirection.lerp(targetDirection, trackingStrength).normalize();
    ballVelocity.x = currentDirection.x * horizontalSpeed;
    ballVelocity.z = currentDirection.y * horizontalSpeed;
  }

  ball.position.x += ballVelocity.x * delta;
  ball.position.z += ballVelocity.z * delta;
  ballVerticalVelocity -= CONFIG.ball.gravity * delta;
  ball.position.y += ballVerticalVelocity * delta;

  // Wall impacts preserve more energy at higher difficulties and add a random deflection.
  const wallBounce = Math.min(1.32, CONFIG.ball.bounce * difficulty.bounce);
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
    const floorRestitution = Math.min(1.42, 0.96 * difficulty.bounce);
    ballVerticalVelocity = Math.min(
      20,
      Math.abs(ballVerticalVelocity) * floorRestitution + 2.4 + Math.random() * (1.4 + difficulty.chaos)
    );
    turnBallRandomly(0.08 + difficulty.chaos * 0.12);
    aimBallAtPlayer(difficulty);
  }
  if (ball.position.y > CONFIG.room.height - CONFIG.ball.radius) {
    ball.position.y = CONFIG.room.height - CONFIG.ball.radius;
    const ceilingRestitution = Math.min(1.35, 0.94 * difficulty.bounce);
    ballVerticalVelocity = -Math.min(20, Math.abs(ballVerticalVelocity) * ceilingRestitution);
    turnBallRandomly(0.1 + difficulty.chaos * 0.12);
    aimBallAtPlayer(difficulty);
  }

  // Accelerate toward a difficulty-scaled target, with a hard cap for stable physics.
  const targetSpeed = Math.min(
    (CONFIG.ball.speed + Math.min(elapsed * 0.09 * difficulty.ramp, 5.5 * difficulty.ramp)) * difficulty.speed * (activeArenaEvent?.id === "ball-tempo" ? 1.15 : 1),
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
  ballVerticalVelocity = THREE.MathUtils.clamp(ballVerticalVelocity, -16, 16);

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

  const motionScale = graphicsSettings.motionEffects ? 1 : 0;
  cameraMotionTime += delta * (moveAmount > 0.04 ? 13 : 2.2);
  landingKick = THREE.MathUtils.damp(landingKick, 0, 10, delta);
  const strideBob = Math.abs(Math.sin(cameraMotionTime)) * 0.075 * moveAmount * motionScale;
  const verticalBounce = Math.sin(cameraMotionTime * 2) * 0.018 * moveAmount * motionScale;
  const lateralSway = Math.sin(cameraMotionTime) * 0.045 * moveAmount * motionScale;
  const forwardDip = -Math.max(0, localForward) * 0.045 * motionScale;
  const strafeLean = -localStrafe * 0.075 * motionScale;
  const strideRoll = Math.sin(cameraMotionTime) * 0.012 * moveAmount * motionScale;

  camera.position.set(
    player.position.x + rightX * lateralSway,
    1.65 + jumpHeight - strideBob + verticalBounce - landingKick + forwardDip * 0.18,
    player.position.z + rightZ * lateralSway
  );
  camera.rotation.order = "YXZ";
  camera.rotation.set(
    cameraPitch + Math.max(0, localForward) * 0.025 * motionScale + landingKick * 0.22 * motionScale,
    cameraYaw,
    strafeLean + strideRoll
  );
  playerFillLight.position.set(player.position.x, 1.9 + jumpHeight, player.position.z);
}

let performanceSampleTime = 0;
let performanceSampleFrames = 0;
function animate() {
  requestAnimationFrame(animate);
  const frameDelta = clock.getDelta();
  const delta = Math.min(frameDelta, 0.04);
  if (graphicsSettings.performanceMonitor) {
    performanceSampleTime += Math.max(0, frameDelta);
    performanceSampleFrames += 1;
    if (performanceSampleTime >= 0.5) {
      const fps = Math.round(performanceSampleFrames / performanceSampleTime);
      const frameMs = fps > 0 ? (1000 / fps).toFixed(1) : "--";
      const monitor = document.getElementById("performance-monitor");
      if (monitor) monitor.innerHTML = "FPS " + fps + "<span>FRAME " + frameMs + " ms</span>";
      performanceSampleTime = 0;
      performanceSampleFrames = 0;
    }
  }
  if (state === "playing") {
    elapsed += delta;
    updatePlayer(delta);
    updateBall(delta);
    updateArenaEvents(delta);
    updateCamera(delta);
    score = elapsed * 10;
    awardXPForScore(score);
    tickDailyChallenge(delta);
    const reachedMilestone = Math.floor(score / 100);
    if (reachedMilestone > lastThemeMilestone) {
      lastThemeMilestone = reachedMilestone;
      triggerArenaTheme(reachedMilestone);
    }
    updateArenaTheme(delta);
    applyEquippedBallSkin();
    scoreValue.textContent = String(Math.floor(score)).padStart(4, "0");
    timeValue.textContent = elapsed.toFixed(1) + "s";
    ball.rotation.x += delta * 0.8;
    ball.rotation.z += delta * 1.1;
    ballAura.rotation.y -= delta * 0.4;
  } else {
    updateArenaTheme(delta);
    applyEquippedBallSkin();
    ball.rotation.x += delta * 0.25;
    ball.rotation.z += delta * 0.32;
  }
  renderer.render(scene, camera);
}


setScreen("ready");
animate();

// Startup order: studio ident -> resolve the saved cloud session -> login gate (if needed).
// Keep the authentication UI hidden until the studio intro has completely faded out.
let startupSequenceFinished = false;
async function finishStudioStartup() {
  if (startupSequenceFinished) return;
  startupSequenceFinished = true;
  introScreen?.remove();
  document.body.classList.remove("startup-pending");
  document.body.classList.add("auth-check-pending");
  try {
    await initializeCloudAccount();
  } finally {
    document.body.classList.remove("auth-check-pending");
  }
}
requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(() => {
  if (!introScreen) {
    finishStudioStartup();
    return;
  }
  introScreen.classList.add("intro-exit");
  // Wait for the full 900ms fade, not merely the start of the transition.
  window.setTimeout(finishStudioStartup, 950);
}, 3200)));

/* Give each player a bold initial badge and sync the level progress strip. */
function updateKiwamiPlayerBadge(){
  const displayedName = document.querySelector("[data-player-name]")?.textContent?.trim();
  const metadataName = currentUser?.user_metadata?.username;
  const emailName = currentUser?.email?.split("@")[0];
  const name = String(currentUsername || metadataName || displayedName || emailName || "PLAYER").trim() || "PLAYER";
  const initial = Array.from(name)[0]?.toLocaleUpperCase() || "P";
  const palette = ["#b51f35","#8d263f","#7c3021","#315c78","#5b3b87","#286b5d","#8a5a1e"];
  let hash = 0;
  for(let i=0;i<name.length;i++) hash = (hash*31 + name.charCodeAt(i)) >>> 0;
  const color = palette[hash % palette.length];
  document.querySelectorAll("[data-player-avatar]").forEach(node=>{
    node.textContent = initial;
    node.setAttribute("aria-label", name + " avatar");
    node.setAttribute("data-initial", initial);
    node.style.background = "linear-gradient(145deg, "+color+", #101116)";
    node.style.display = "grid";
    node.style.visibility = "visible";
    node.style.opacity = "1";
  });
  const progress = getLevelProgress();
  document.querySelectorAll("[data-menu-level-bar]").forEach(node=>node.style.width = progress.percent + "%");
}
