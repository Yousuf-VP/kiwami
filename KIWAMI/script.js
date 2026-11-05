
/* =========================================
   KIWAMI — INTERACTIONS
   Navigation · Scroll · Carousel · Arcade
========================================= */

document.addEventListener("DOMContentLoaded", () => {
  const siteHeader = document.getElementById("siteHeader");
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");
  const allNavLinks = document.querySelectorAll(".nav-link");

  /* -------------------------
     MOBILE NAVIGATION
  ------------------------- */

  function closeMenu() {
    navLinks.classList.remove("open");
    menuToggle.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
  }

  menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");

    menuToggle.classList.toggle("open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute(
      "aria-label",
      isOpen ? "Close navigation" : "Open navigation"
    );
  });

  allNavLinks.forEach(link => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("click", event => {
    if (
      navLinks.classList.contains("open") &&
      !navLinks.contains(event.target) &&
      !menuToggle.contains(event.target)
    ) {
      closeMenu();
    }
  });

  /* -------------------------
     HEADER SCROLL EFFECT
  ------------------------- */

  function updateHeader() {
    siteHeader.classList.toggle("header-scrolled", window.scrollY > 25);
  }

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  /* -------------------------
     SCROLL REVEAL
  ------------------------- */

  const revealElements = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: "0px 0px -35px 0px"
    });

    revealElements.forEach(element => revealObserver.observe(element));
  } else {
    revealElements.forEach(element => element.classList.add("visible"));
  }

  /* -------------------------
     ACTIVE NAV LINK
  ------------------------- */

  const sections = document.querySelectorAll("main section[id]");

  if ("IntersectionObserver" in window) {
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const sectionId = entry.target.id;

        allNavLinks.forEach(link => {
          const isActive = link.getAttribute("href") === `#${sectionId}`;
          link.classList.toggle("active", isActive);
        });
      });
    }, {
      rootMargin: "-35% 0px -55% 0px"
    });

    sections.forEach(section => sectionObserver.observe(section));
  }

  /* -------------------------
     GAME CAROUSEL
  ------------------------- */

  const gamesViewport = document.getElementById("gamesViewport");
  const gamesPrev = document.getElementById("gamesPrev");
  const gamesNext = document.getElementById("gamesNext");

  function getCardStep() {
    const card = gamesViewport.querySelector(".game-card");
    if (!card) return 300;

    const track = document.getElementById("gamesTrack");
    const styles = window.getComputedStyle(track);
    const gap = parseFloat(styles.columnGap) || 0;

    return card.getBoundingClientRect().width + gap;
  }

  gamesPrev.addEventListener("click", () => {
    gamesViewport.scrollBy({
      left: -getCardStep(),
      behavior: "smooth"
    });
  });

  gamesNext.addEventListener("click", () => {
    gamesViewport.scrollBy({
      left: getCardStep(),
      behavior: "smooth"
    });
  });

  /* -------------------------
     CURRENT YEAR
  ------------------------- */

  document.getElementById("currentYear").textContent =
    new Date().getFullYear();

  /* =========================================
     SHOOT-STREAK ARCADE GAME
  ========================================= */

  const shootModal = document.getElementById("shootModal");
  const closeShootGame = document.getElementById("closeShootGame");
  const playGameButtons = document.querySelectorAll(".play-game-button");

  const startGameButton = document.getElementById("startGame");
  const shootTarget = document.getElementById("shootTarget");
  const gameArena = document.getElementById("gameArena");
  const arenaMessage = document.getElementById("arenaMessage");

  const scoreDisplay = document.getElementById("gameScore");
  const timeDisplay = document.getElementById("gameTime");
  const bestDisplay = document.getElementById("gameBest");

  const BEST_SCORE_KEY = "kiwami_shoot_streak_best";

  let score = 0;
  let timeLeft = 30;
  let bestScore = loadBestScore();
  let gameInterval = null;
  let gameRunning = false;
  let previousFocusedElement = null;

  bestDisplay.textContent = bestScore;

  function loadBestScore() {
    try {
      return Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
    } catch (error) {
      return 0;
    }
  }

  function saveBestScore(value) {
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(value));
    } catch (error) {
      // The game still works if browser storage is unavailable.
    }
  }

  function openShootGame() {
    previousFocusedElement = document.activeElement;

    shootModal.classList.add("open");
    shootModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    closeShootGame.focus();
    resetGame();
  }

  function closeModal() {
    if (!shootModal.classList.contains("open")) return;

    stopGame();

    shootModal.classList.remove("open");
    shootModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");

    if (previousFocusedElement) {
      previousFocusedElement.focus();
    }
  }

  function resetGame() {
    stopGame();

    score = 0;
    timeLeft = 30;

    scoreDisplay.textContent = score;
    timeDisplay.textContent = timeLeft;
    bestDisplay.textContent = bestScore;

    shootTarget.classList.remove("visible");

    arenaMessage.classList.remove("hidden");
    arenaMessage.innerHTML = `
      <span class="arena-symbol">◎</span>
      <strong>READY?</strong>
      <p>Tap the targets before time runs out.</p>
      <button class="button button-primary" id="startGame">
        Start game <span>↗</span>
      </button>
    `;

    document.getElementById("startGame").addEventListener("click", startGame);
  }

  function startGame() {
    if (gameRunning) return;

    gameRunning = true;
    score = 0;
    timeLeft = 30;

    scoreDisplay.textContent = score;
    timeDisplay.textContent = timeLeft;

    arenaMessage.classList.add("hidden");

    moveTarget();
    shootTarget.classList.add("visible");

    gameInterval = window.setInterval(() => {
      timeLeft -= 1;
      timeDisplay.textContent = timeLeft;

      if (timeLeft <= 0) {
        finishGame();
      }
    }, 1000);
  }

  function moveTarget() {
    const arenaRect = gameArena.getBoundingClientRect();
    const targetSize = shootTarget.offsetWidth || 38;

    const maxX = Math.max(0, arenaRect.width - targetSize);
    const maxY = Math.max(0, arenaRect.height - targetSize);

    const x = Math.random() * maxX;
    const y = Math.random() * maxY;

    shootTarget.style.left = `${x}px`;
    shootTarget.style.top = `${y}px`;
  }

  function hitTarget() {
    if (!gameRunning) return;

    score += 1;
    scoreDisplay.textContent = score;

    if (score > bestScore) {
      bestScore = score;
      bestDisplay.textContent = bestScore;
      saveBestScore(bestScore);
    }

    moveTarget();
  }

  function finishGame() {
    stopGame();

    shootTarget.classList.remove("visible");

    arenaMessage.classList.remove("hidden");
    arenaMessage.innerHTML = `
      <span class="arena-symbol">✦</span>
      <strong>TIME'S UP</strong>
      <p>You scored ${score} ${score === 1 ? "point" : "points"}. ${
        score >= bestScore && score > 0 ? "New personal best!" : "Can you beat that?"
      }</p>
      <button class="button button-primary" id="startGame">
        Play again <span>↗</span>
      </button>
    `;

    document.getElementById("startGame").addEventListener("click", startGame);
  }

  function stopGame() {
    gameRunning = false;

    if (gameInterval !== null) {
      clearInterval(gameInterval);
      gameInterval = null;
    }

    shootTarget.classList.remove("visible");
  }

  playGameButtons.forEach(button => {
    button.addEventListener("click", openShootGame);
  });

  closeShootGame.addEventListener("click", closeModal);

  shootModal.querySelector("[data-close-modal]").addEventListener("click", closeModal);

  shootTarget.addEventListener("pointerdown", event => {
    event.preventDefault();
    hitTarget();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && shootModal.classList.contains("open")) {
      closeModal();
    }
  });

  // Reposition the target safely if the game arena changes size.
  window.addEventListener("resize", () => {
    if (gameRunning) moveTarget();
  });
});
