const body = document.body;
const menuButton = document.querySelector('.menu-button');
const menuPanel = document.querySelector('.menu-panel');
const cursorPosition = document.querySelector('.cursor-position');
const cursorVisual = document.querySelector('.cursor-shape');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(any-pointer: fine)');
const cursorMorphController = window.createPortfolioCursorMorph({ body, cursorVisual });

function setMenuOpen(open) {
  menuButton.setAttribute('aria-expanded', String(open));
  menuPanel.classList.toggle('is-open', open);
  menuPanel.setAttribute('aria-hidden', String(!open));
  body.classList.toggle('menu-open', open);
}

menuButton.addEventListener('click', () => {
  setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true');
});

menuPanel.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setMenuOpen(false));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenuOpen(false);
});

let targetX = -100;
let targetY = -100;
let currentX = -100;
let currentY = -100;
let lastPointerMoveAt = 0;
let cursorReactionReadyAt = 0;
let currentCursorStrength = 0.06;
let cursorInitialized = false;
let logoCursorActive = false;
let lastFrame = performance.now();
const CURSOR_REACTION_DELAY = 100;
const CURSOR_IDLE_THRESHOLD = 90;
const CURSOR_MOVING_STRENGTH = 0.24;
const CURSOR_IDLE_STRENGTH = 0.06;
const CURSOR_STRENGTH_BLEND = 0.07;

function showCursor(event) {
  if (!body.classList.contains('site-page-ready')) return;
  if (!finePointer.matches || event.pointerType === 'touch') return;

  const now = performance.now();
  const wasIdle = cursorInitialized
    && lastPointerMoveAt > 0
    && now - lastPointerMoveAt >= CURSOR_IDLE_THRESHOLD;
  targetX = event.clientX;
  targetY = event.clientY;
  const isLogo = event.target instanceof Element && Boolean(event.target.closest('.brand'));

  if (isLogo !== logoCursorActive) {
    logoCursorActive = isLogo;
    if (logoCursorActive && !reducedMotion.matches) cursorMorphController.enter();
    else cursorMorphController.exit();
  }

  if (!cursorInitialized) {
    currentX = targetX;
    currentY = targetY;
    cursorInitialized = true;
    currentCursorStrength = CURSOR_IDLE_STRENGTH;
    cursorReactionReadyAt = now;
  } else if (wasIdle) {
    cursorReactionReadyAt = now + CURSOR_REACTION_DELAY;
  }

  lastPointerMoveAt = now;
  body.classList.add('cursor-visible');
}

function hideCursor() {
  body.classList.remove('cursor-visible');
  lastPointerMoveAt = 0;
  cursorReactionReadyAt = 0;
  logoCursorActive = false;
  cursorMorphController.reset();
}

function animateCursor(now) {
  const deltaTime = Math.min(40, Math.max(0, now - lastFrame));
  const delta = Math.min(deltaTime / 16.67, 2);
  lastFrame = now;

  if (cursorInitialized) {
    const isMouseMoving = lastPointerMoveAt > 0
      && now - lastPointerMoveAt < CURSOR_IDLE_THRESHOLD;
    const targetStrength = isMouseMoving
      ? CURSOR_MOVING_STRENGTH
      : CURSOR_IDLE_STRENGTH;
    const strengthBlend = 1 - Math.pow(1 - CURSOR_STRENGTH_BLEND, delta);
    currentCursorStrength += (targetStrength - currentCursorStrength) * strengthBlend;

    if (now >= cursorReactionReadyAt) {
      const follow = 1 - Math.pow(1 - currentCursorStrength, delta);
      currentX += (targetX - currentX) * follow;
      currentY += (targetY - currentY) * follow;

      if (Math.hypot(targetX - currentX, targetY - currentY) < 0.4) {
        currentX = targetX;
        currentY = targetY;
      }
    }

    cursorPosition.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
  }

  cursorMorphController.render(deltaTime);
  requestAnimationFrame(animateCursor);
}

window.addEventListener('pointermove', showCursor, { passive: true });
document.addEventListener('pointerleave', hideCursor);
window.addEventListener('blur', hideCursor);
window.addEventListener('siteintro:start', hideCursor);
window.addEventListener('pagehide', hideCursor);
requestAnimationFrame(animateCursor);
