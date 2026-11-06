
/* =========================================
   KIWAMI — INTERACTIONS
   Navigation · Scroll · Carousel
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
    if (!navLinks || !menuToggle) return;

    navLinks.classList.remove("open");
    menuToggle.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
  }

  if (menuToggle && navLinks) {
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
  }

  /* -------------------------
     HEADER SCROLL EFFECT
  ------------------------- */

  function updateHeader() {
    if (!siteHeader) return;

    siteHeader.classList.toggle(
      "header-scrolled",
      window.scrollY > 25
    );
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

    revealElements.forEach(element => {
      revealObserver.observe(element);
    });
  } else {
    revealElements.forEach(element => {
      element.classList.add("visible");
    });
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
          const isActive =
            link.getAttribute("href") === `#${sectionId}`;

          link.classList.toggle("active", isActive);
        });
      });
    }, {
      rootMargin: "-35% 0px -55% 0px"
    });

    sections.forEach(section => {
      sectionObserver.observe(section);
    });
  }

  /* -------------------------
     GAME CAROUSEL
  ------------------------- */

  const gamesViewport = document.getElementById("gamesViewport");
  const gamesTrack = document.getElementById("gamesTrack");
  const gamesPrev = document.getElementById("gamesPrev");
  const gamesNext = document.getElementById("gamesNext");

  function getCardStep() {
    if (!gamesViewport || !gamesTrack) return 300;

    const card = gamesViewport.querySelector(".game-card");
    if (!card) return 300;

    const styles = window.getComputedStyle(gamesTrack);
    const gap = parseFloat(styles.columnGap) || 0;

    return card.getBoundingClientRect().width + gap;
  }

  if (gamesViewport && gamesPrev) {
    gamesPrev.addEventListener("click", () => {
      gamesViewport.scrollBy({
        left: -getCardStep(),
        behavior: "smooth"
      });
    });
  }

  if (gamesViewport && gamesNext) {
    gamesNext.addEventListener("click", () => {
      gamesViewport.scrollBy({
        left: getCardStep(),
        behavior: "smooth"
      });
    });
  }

  /* -------------------------
     CURRENT YEAR
  ------------------------- */

  const currentYear = document.getElementById("currentYear");

  if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
  }

  /* -------------------------
     SHOOT-STREAK
  ------------------------- */

  // No embedded mini-game is initialized here.
  // The homepage anchor navigates directly to:
  // ./shoot-streak/index.html
});
