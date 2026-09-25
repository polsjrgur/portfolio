const body = document.body;
const cursorVisual = document.querySelector('.cursor-shape');
const hero = document.querySelector('.hero');
const heroContactSlot = document.querySelector('.hero-contact-slot');
const heroContactButton = document.querySelector('.hero-contact-button');
const posterZone = document.querySelector('.poster-zone');
const cards = [...document.querySelectorAll('.poster-card')];
const menuButton = document.querySelector('.menu-button');
const menuPanel = document.querySelector('.menu-panel');
const dialog = document.querySelector('.project-dialog');
const dialogClose = document.querySelector('.dialog-close');
const dialogProjectLink = document.querySelector('.dialog-project-link');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const anyFinePointer = window.matchMedia('(any-pointer: fine)');

const CURSOR_STATE = Object.freeze({
  DEFAULT: 'default',
  CTA: 'cta',
  INTERACTIVE: 'interactive',
  POSTER: 'poster',
  LOGO: 'logo'
});

const projects = window.portfolioProjects;

let cursorState = CURSOR_STATE.DEFAULT;
let pointerX = -100;
let pointerY = -100;
let dotX = -100;
let dotY = -100;
let lastPointerMoveAt = 0;
let cursorReactionReadyAt = 0;
let currentCursorStrength = 0.06;
let observedMousePointer = false;
let currentActiveCard = null;
let posterInteractionsReady = reducedMotion.matches;
let posterExitTimer = 0;
let posterUnlockTimer = 0;
let posterAnimationEndHandler = null;
let lastAnimationFrame = performance.now();

const cursorMorphController = window.createPortfolioCursorMorph({ body, cursorVisual });
const CURSOR_REACTION_DELAY = 100;
const CURSOR_IDLE_THRESHOLD = 90;
const CURSOR_MOVING_STRENGTH = 0.24;
const CURSOR_IDLE_STRENGTH = 0.06;
const CURSOR_STRENGTH_BLEND = 0.07;

const posterAlphaMasks = new WeakMap();

const cardMotion = cards.map((card) => ({
  card,
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  maxX: Number(card.style.getPropertyValue('--follow-x-max')) || 24,
  maxY: Number(card.style.getPropertyValue('--follow-y-max')) || 16
}));

const ctaButtons = [...document.querySelectorAll('.primary-action, .hero-contact-button')];

body.dataset.cursorState = CURSOR_STATE.DEFAULT;

function canUseCustomCursor() {
  return anyFinePointer.matches || observedMousePointer;
}

function canUseOutlineCursor() {
  return canUseCustomCursor() && !reducedMotion.matches && window.innerWidth > 760;
}

function canUsePosterEffects() {
  return posterInteractionsReady && canUseOutlineCursor();
}

function syncPointerCapabilities() {
  body.classList.toggle('has-custom-cursor', canUseCustomCursor());
  body.classList.toggle('has-poster-cursor', canUsePosterEffects());

  if (!canUseCustomCursor()) hideCursor();
}

function resetPosterMotion() {
  cardMotion.forEach((motion) => {
    motion.targetX = 0;
    motion.targetY = 0;
  });
}

function activatePosterState() {
  if (!canUsePosterEffects()) return;
  posterZone.classList.add('is-expanded');
}

function deactivatePosterState() {
  posterZone.classList.remove('is-expanded');
  setActiveCard(null);
}

function clearPosterExitTimer() {
  if (!posterExitTimer) return;
  window.clearTimeout(posterExitTimer);
  posterExitTimer = 0;
}

function smoothStep(value) {
  return value * value * (3 - 2 * value);
}

function enterPosterCursor() {
  cursorMorphController.enter();
}

function exitPosterCursor() {
  cursorMorphController.exit();
}

function resetCursorMorph() {
  cursorMorphController.reset();
}

function renderCursorMorph(deltaTime) {
  cursorMorphController.render(deltaTime);
}

function setCursorState(nextState) {
  if (nextState === cursorState) return;

  const wasMorphing = cursorState === CURSOR_STATE.POSTER || cursorState === CURSOR_STATE.LOGO;
  const willMorph = nextState === CURSOR_STATE.POSTER || nextState === CURSOR_STATE.LOGO;
  if (cursorState === CURSOR_STATE.POSTER) {
    deactivatePosterState();
  }
  if (wasMorphing && !willMorph) {
    exitPosterCursor();
  }
  cursorState = nextState;
  body.dataset.cursorState = nextState;
  if (nextState === CURSOR_STATE.POSTER) {
    activatePosterState();
  }
  if (!wasMorphing && willMorph) {
    enterPosterCursor();
  }
}

function resolveNonPosterCursorState(target) {
  if (!(target instanceof Element)) return CURSOR_STATE.DEFAULT;

  if (target.closest('.primary-action')) {
    return CURSOR_STATE.CTA;
  }

  if (target.closest('a, button, [role="button"]')) {
    return CURSOR_STATE.INTERACTIVE;
  }

  return CURSOR_STATE.DEFAULT;
}

function getPosterAlphaMask(image) {
  const cached = posterAlphaMasks.get(image);
  if (cached && cached.src === image.currentSrc) return cached;
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) return null;

  const maxDimension = 1024;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  try {
    const rgba = context.getImageData(0, 0, width, height).data;
    const alpha = new Uint8Array(width * height);
    let opaque = true;

    for (let sourceIndex = 3, alphaIndex = 0; sourceIndex < rgba.length; sourceIndex += 4, alphaIndex += 1) {
      const value = rgba[sourceIndex];
      alpha[alphaIndex] = value;
      if (value < 255) opaque = false;
    }

    const mask = { src: image.currentSrc, width, height, alpha, opaque };
    posterAlphaMasks.set(image, mask);
    return mask;
  } catch {
    return null;
  }
}

function isVisiblePosterPixel(card, clientX, clientY) {
  const bounds = card.getBoundingClientRect();
  if (clientX < bounds.left || clientX >= bounds.right || clientY < bounds.top || clientY >= bounds.bottom) {
    return false;
  }

  const image = card.querySelector('img');
  const mask = image ? getPosterAlphaMask(image) : null;
  if (!image) return false;

  // Local file previews can block canvas pixel reads. These poster assets are
  // opaque, so preserve interaction by falling back to their rendered bounds.
  if (!mask) return true;
  if (mask.opaque) return true;

  const normalizedX = (clientX - bounds.left) / bounds.width;
  const normalizedY = (clientY - bounds.top) / bounds.height;
  const boxAspect = bounds.width / bounds.height;
  const imageAspect = image.naturalWidth / image.naturalHeight;
  let sourceX;
  let sourceY;

  if (imageAspect > boxAspect) {
    const visibleWidth = image.naturalHeight * boxAspect;
    sourceX = (image.naturalWidth - visibleWidth) / 2 + normalizedX * visibleWidth;
    sourceY = normalizedY * image.naturalHeight;
  } else {
    const visibleHeight = image.naturalWidth / boxAspect;
    sourceX = normalizedX * image.naturalWidth;
    sourceY = (image.naturalHeight - visibleHeight) / 2 + normalizedY * visibleHeight;
  }

  const maskX = Math.max(0, Math.min(mask.width - 1, Math.floor(sourceX / image.naturalWidth * mask.width)));
  const maskY = Math.max(0, Math.min(mask.height - 1, Math.floor(sourceY / image.naturalHeight * mask.height)));
  return mask.alpha[maskY * mask.width + maskX] > 20;
}

function getPosterAtPoint(clientX, clientY) {
  if (!canUsePosterEffects()) return null;

  const seen = new Set();
  const elements = document.elementsFromPoint(clientX, clientY);

  for (const element of elements) {
    const card = element.closest?.('.poster-card');
    if (card) {
      if (seen.has(card)) continue;
      seen.add(card);
      if (isVisiblePosterPixel(card, clientX, clientY)) return card;
      continue;
    }

    if (element === posterZone || element.classList.contains('poster-stage')) continue;
    return null;
  }

  return null;
}

function updatePointerState(target, clientX, clientY) {
  const logo = target instanceof Element ? target.closest('.brand') : null;
  const projectsLink = target instanceof Element ? target.closest('.secondary-action') : null;
  if ((logo || projectsLink) && canUseOutlineCursor()) {
    clearPosterExitTimer();
    setActiveCard(null);
    setCursorState(CURSOR_STATE.LOGO);
    return;
  }

  const poster = getPosterAtPoint(clientX, clientY);

  if (poster) {
    clearPosterExitTimer();
    setCursorState(CURSOR_STATE.POSTER);
    enterPosterCursor();
    setActiveCard(poster);
    return;
  }

  const nextState = resolveNonPosterCursorState(target);
  if (
    (cursorState === CURSOR_STATE.POSTER || cursorState === CURSOR_STATE.LOGO)
    && nextState === CURSOR_STATE.DEFAULT
  ) {
    if (!posterExitTimer) {
      exitPosterCursor();
      posterExitTimer = window.setTimeout(() => {
        posterExitTimer = 0;
        setCursorState(CURSOR_STATE.DEFAULT);
      }, 40);
    }
    return;
  }

  clearPosterExitTimer();
  setCursorState(nextState);
}

function updatePosterTargets() {
  if (!canUsePosterEffects()) {
    resetPosterMotion();
    return;
  }

  const bounds = hero.getBoundingClientRect();
  const x = Math.max(-1, Math.min(1, (pointerX - (bounds.left + bounds.width / 2)) / (bounds.width / 2)));
  const y = Math.max(-1, Math.min(1, (pointerY - (bounds.top + bounds.height / 2)) / (bounds.height / 2)));

  cardMotion.forEach((motion) => {
    motion.targetX = x * motion.maxX;
    motion.targetY = y * motion.maxY;
  });
}

function handlePointerMove(event) {
  if (!body.classList.contains('site-page-ready')) return;

  if (event.pointerType === 'mouse' && !observedMousePointer) {
    observedMousePointer = true;
    syncPointerCapabilities();
  }

  if (!canUseCustomCursor()) return;

  const now = performance.now();
  const wasVisible = body.classList.contains('cursor-visible');
  const wasIdle = wasVisible
    && lastPointerMoveAt > 0
    && now - lastPointerMoveAt >= CURSOR_IDLE_THRESHOLD;
  pointerX = event.clientX;
  pointerY = event.clientY;

  if (!wasVisible) {
    dotX = pointerX;
    dotY = pointerY;
    currentCursorStrength = CURSOR_IDLE_STRENGTH;
    cursorReactionReadyAt = now;
  } else if (wasIdle) {
    cursorReactionReadyAt = now + CURSOR_REACTION_DELAY;
  }

  lastPointerMoveAt = now;
  body.classList.add('cursor-visible');
  updatePointerState(event.target, pointerX, pointerY);
  updatePosterTargets();
}

function hideCursor() {
  clearPosterExitTimer();
  body.classList.remove('cursor-visible');
  lastPointerMoveAt = 0;
  cursorReactionReadyAt = 0;
  setCursorState(CURSOR_STATE.DEFAULT);
  resetCursorMorph();
  resetPosterMotion();
}

function animatePointer(frameTime = performance.now()) {
  const deltaTime = Math.min(40, Math.max(0, frameTime - lastAnimationFrame));
  lastAnimationFrame = frameTime;
  const targetDotX = pointerX;
  const targetDotY = pointerY;
  const frameScale = Math.min(2, Math.max(0.25, deltaTime / 16.67));
  const isMouseMoving = lastPointerMoveAt > 0
    && frameTime - lastPointerMoveAt < CURSOR_IDLE_THRESHOLD;
  const targetStrength = isMouseMoving
    ? CURSOR_MOVING_STRENGTH
    : CURSOR_IDLE_STRENGTH;
  const strengthBlend = 1 - Math.pow(1 - CURSOR_STRENGTH_BLEND, frameScale);
  currentCursorStrength += (targetStrength - currentCursorStrength) * strengthBlend;

  if (frameTime >= cursorReactionReadyAt) {
    const follow = 1 - Math.pow(1 - currentCursorStrength, frameScale);
    dotX += (targetDotX - dotX) * follow;
    dotY += (targetDotY - dotY) * follow;

    if (Math.hypot(targetDotX - dotX, targetDotY - dotY) < 0.4) {
      dotX = targetDotX;
      dotY = targetDotY;
    }
  }

  body.style.setProperty('--dot-x', `${dotX.toFixed(3)}px`);
  body.style.setProperty('--dot-y', `${dotY.toFixed(3)}px`);
  renderCursorMorph(deltaTime);

  cardMotion.forEach((motion) => {
    motion.x += (motion.targetX - motion.x) * 0.22;
    motion.y += (motion.targetY - motion.y) * 0.22;
    motion.card.style.setProperty('--follow-x', `${motion.x.toFixed(3)}px`);
    motion.card.style.setProperty('--follow-y', `${motion.y.toFixed(3)}px`);
  });

  requestAnimationFrame(animatePointer);
}

function getFillGeometry(button, event) {
  const bounds = button.getBoundingClientRect();
  const x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
  const y = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
  const farX = Math.max(x, bounds.width - x);
  const farY = Math.max(y, bounds.height - y);
  const radius = Math.hypot(farX, farY) + 4;
  return { x, y, radius };
}

function setFillGeometry(button, geometry) {
  button.style.setProperty('--fill-x', `${geometry.x}px`);
  button.style.setProperty('--fill-y', `${geometry.y}px`);
  button.style.setProperty('--fill-radius', `${geometry.radius.toFixed(3)}px`);
}

function expandCta(button, event) {
  if (event.pointerType === 'touch') return;

  button.classList.add('is-fill-repositioning');
  button.classList.remove('is-fill-expanded');
  setFillGeometry(button, getFillGeometry(button, event));
  void button.offsetWidth;
  button.classList.remove('is-fill-repositioning');
  void button.offsetWidth;
  button.classList.add('is-fill-expanded');
}

function retractCta(button, event) {
  if (event.pointerType === 'touch') return;

  button.classList.add('is-fill-repositioning', 'is-fill-expanded');
  setFillGeometry(button, getFillGeometry(button, event));
  void button.offsetWidth;
  button.classList.remove('is-fill-repositioning');
  void button.offsetWidth;
  button.classList.remove('is-fill-expanded');
}

ctaButtons.forEach((button) => {
  button.addEventListener('pointerenter', (event) => expandCta(button, event));
  button.addEventListener('pointerleave', (event) => retractCta(button, event));
  button.addEventListener('pointercancel', (event) => retractCta(button, event));
});

let lastHeroScrollY = window.scrollY;
let heroHeight = hero?.offsetHeight || window.innerHeight;
let heroContactTop = heroContactSlot?.offsetTop || 0;
let hasLeftHero = window.scrollY >= heroHeight;
let buttonDropPlayedForCurrentReturn = false;
let pageScrollFrameRequested = false;
let transitionScrollRenderer = null;

function renderHeroReturnState() {
  if (!hero || !heroContactButton || reducedMotion.matches || window.innerWidth <= 760) {
    lastHeroScrollY = window.scrollY;
    return;
  }

  const currentScrollY = window.scrollY;
  const isScrollingUp = currentScrollY < lastHeroScrollY;

  if (currentScrollY >= heroHeight * 0.98) {
    hasLeftHero = true;
    buttonDropPlayedForCurrentReturn = false;
    heroContactButton.classList.remove('is-returning');
  } else if (
    hasLeftHero
    && isScrollingUp
    && !buttonDropPlayedForCurrentReturn
    && currentScrollY <= heroContactTop
  ) {
    buttonDropPlayedForCurrentReturn = true;
    heroContactButton.classList.remove('is-returning');
    void heroContactButton.offsetWidth;
    heroContactButton.classList.add('is-returning');
  }

  lastHeroScrollY = currentScrollY;
}

function requestPageScrollEffects() {
  if (pageScrollFrameRequested) return;
  pageScrollFrameRequested = true;
  requestAnimationFrame(() => {
    pageScrollFrameRequested = false;
    renderHeroReturnState();
    transitionScrollRenderer?.();
  });
}

heroContactButton?.addEventListener('animationend', (event) => {
  if (event.animationName === 'hero-contact-drop') {
    heroContactButton.classList.remove('is-returning');
  }
});

window.addEventListener('scroll', requestPageScrollEffects, { passive: true });
window.addEventListener('resize', () => {
  heroHeight = hero?.offsetHeight || window.innerHeight;
  heroContactTop = heroContactSlot?.offsetTop || 0;
  lastHeroScrollY = window.scrollY;
  requestPageScrollEffects();
});

function setActiveCard(nextActiveCard) {
  if (nextActiveCard === currentActiveCard) return;
  currentActiveCard = nextActiveCard;

  const activeIndex = cards.indexOf(nextActiveCard);
  const squeezeByDistance = [0, 68, 49, 34, 23, 15];
  const focusOffsets = [
    { x: -65, y: -45 },
    { x: -68, y: -38 },
    { x: -70, y: -28 },
    { x: -72, y: -14 },
    { x: -68, y: 0 },
    { x: -64, y: 18 }
  ];

  cards.forEach((card, index) => {
    const isActive = card === nextActiveCard;
    card.classList.toggle('is-active', isActive);

    const focus = isActive ? focusOffsets[index] : null;
    card.style.setProperty('--focus-x', `${focus?.x || 0}px`);
    card.style.setProperty('--focus-y', `${focus?.y || 0}px`);
    card.style.setProperty('--focus-scale', isActive ? '1.08' : '1');

    let pushX = 0;
    let pushY = 0;

    if (activeIndex >= 0 && index !== activeIndex) {
      const distance = Math.abs(index - activeIndex);
      const strength = squeezeByDistance[distance] || 15;

      if (index < activeIndex) {
        pushX = -Math.min(72, strength);
        pushY = Math.min(20, strength * 0.28);
      } else {
        pushX = Math.min(72, strength);
        pushY = -Math.min(40, strength * 0.55);
      }
    }

    card.style.setProperty('--push-x', `${pushX.toFixed(2)}px`);
    card.style.setProperty('--push-y', `${pushY.toFixed(2)}px`);
  });
}

cards.forEach((card) => {
  card.addEventListener('click', () => {
    const project = projects[card.dataset.project];

    if (project?.url) {
      window.location.href = project.url;
      return;
    }

    openProject(card.dataset.project);
  });
});

window.addEventListener('pointermove', handlePointerMove, { passive: true });
document.addEventListener('pointerleave', hideCursor);
window.addEventListener('blur', hideCursor);

menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  menuPanel.classList.toggle('is-open', !isOpen);
  menuPanel.setAttribute('aria-hidden', String(isOpen));
  body.classList.toggle('menu-open', !isOpen);
  body.style.overflow = isOpen ? '' : 'hidden';
});

menuPanel.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    menuPanel.classList.remove('is-open');
    menuPanel.setAttribute('aria-hidden', 'true');
    body.classList.remove('menu-open');
    body.style.overflow = '';
  });
});

function openProject(key) {
  const project = projects[key];
  if (!project) return;

  const image = dialog.querySelector('.dialog-art img');
  image.src = project.image;
  image.alt = `${project.title} project poster`;
  dialog.querySelector('.dialog-number').textContent = project.number;
  dialog.querySelector('h2').textContent = project.title;
  dialog.querySelector('.dialog-category').textContent = project.category;
  dialog.querySelector('.dialog-description').textContent = project.description;
  dialogProjectLink.hidden = !project.url;
  if (project.url) dialogProjectLink.href = project.url;
  setCursorState(CURSOR_STATE.DEFAULT);
  dialog.showModal();
}

dialogClose.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuPanel.classList.contains('is-open')) {
    menuButton.click();
  }
});

function resetPointerEffects() {
  setCursorState(CURSOR_STATE.DEFAULT);
  resetPosterMotion();
  setActiveCard(null);
  ctaButtons.forEach((button) => {
    button.classList.remove('is-fill-expanded', 'is-fill-repositioning');
  });
}

function unlockPosterInteractions() {
  if (posterInteractionsReady) return;
  posterInteractionsReady = true;
  body.classList.add('poster-interactions-ready');
  syncPointerCapabilities();

  if (pointerX >= 0 && pointerY >= 0) {
    const target = document.elementFromPoint(pointerX, pointerY);
    updatePointerState(target, pointerX, pointerY);
    updatePosterTargets();
  }
}

const frontCard = cards.find((card) => card.classList.contains('poster-card--front'));

function cancelPosterUnlockSchedule() {
  window.clearTimeout(posterUnlockTimer);
  posterUnlockTimer = 0;

  if (frontCard && posterAnimationEndHandler) {
    frontCard.removeEventListener('animationend', posterAnimationEndHandler);
  }

  posterAnimationEndHandler = null;
}

function resetPosterIntroState() {
  cancelPosterUnlockSchedule();
  posterInteractionsReady = false;
  body.classList.remove('poster-interactions-ready');
  hideCursor();
}

function schedulePosterUnlock() {
  cancelPosterUnlockSchedule();

  if (reducedMotion.matches) {
    unlockPosterInteractions();
    return;
  }

  posterAnimationEndHandler = (event) => {
    if (event.animationName !== 'poster-card-in') return;
    cancelPosterUnlockSchedule();
    unlockPosterInteractions();
  };
  frontCard?.addEventListener('animationend', posterAnimationEndHandler);
  posterUnlockTimer = window.setTimeout(() => {
    cancelPosterUnlockSchedule();
    unlockPosterInteractions();
  }, 3900);
}

window.addEventListener('siteintro:start', resetPosterIntroState);
window.addEventListener('siteintro:complete', schedulePosterUnlock);

if (body.classList.contains('site-page-ready')) schedulePosterUnlock();

reducedMotion.addEventListener('change', () => {
  if (body.classList.contains('site-page-ready')) schedulePosterUnlock();
  resetPointerEffects();
  syncPointerCapabilities();
});
anyFinePointer.addEventListener('change', () => {
  resetPointerEffects();
  syncPointerCapabilities();
});
window.addEventListener('resize', () => {
  resetPointerEffects();
  syncPointerCapabilities();
});

syncPointerCapabilities();
animatePointer();

const selfPrSection = document.querySelector('.self-pr');

if (selfPrSection) {
  const prTitle = selfPrSection.querySelector('.pr-title');
  const prLines = [...selfPrSection.querySelectorAll('.pr-line')];
  const prBody = selfPrSection.querySelector('.pr-body');
  const prLineCharacters = prLines.map((line) => {
    const words = line.dataset.prText.trim().split(/\s+/);
    const characters = [];

    line.replaceChildren();
    words.forEach((word, wordIndex) => {
      const wordElement = document.createElement('span');
      wordElement.className = 'pr-word';

      [...word].forEach((character) => {
        const characterElement = document.createElement('span');
        characterElement.className = 'pr-char';
        characterElement.textContent = character;
        wordElement.append(characterElement);
        characters.push(characterElement);
      });

      line.append(wordElement);
      if (wordIndex < words.length - 1) {
        const space = document.createElement('span');
        space.className = 'pr-space';
        space.textContent = ' ';
        line.append(space);
      }
    });

    return characters;
  });

  let prFrameRequested = false;

  function clampProgress(value) {
    return Math.max(0, Math.min(1, value));
  }

  function getPrSegmentProgress(progress, start, end) {
    return smoothStep(clampProgress((progress - start) / (end - start)));
  }

  function renderPrCharacters(characters, progress, start, end) {
    const overlap = 2;
    const step = (end - start) / Math.max(1, characters.length - 1 + overlap);
    const duration = step * overlap;

    characters.forEach((character, index) => {
      const characterStart = start + index * step;
      const characterProgress = smoothStep(clampProgress((progress - characterStart) / duration));
      character.style.setProperty('--char-progress', characterProgress.toFixed(4));
      character.classList.toggle('is-visible', characterProgress > 0.001);
    });
  }

  function renderSelfPr() {
    prFrameRequested = false;

    if (reducedMotion.matches) {
      prLineCharacters.flat().forEach((character) => {
        character.style.setProperty('--char-progress', '1');
        character.classList.add('is-visible');
      });
      prBody.style.setProperty('--body-progress', '1');
      prBody.classList.add('is-visible');
      return;
    }

    const sectionTop = selfPrSection.offsetTop;
    const viewportHeight = window.innerHeight;
    const isMobile = window.innerWidth <= 760;
    const animationStart = sectionTop - viewportHeight * (isMobile ? 0.62 : 0.6);
    const mobileTitleOffset = prTitle.getBoundingClientRect().top - selfPrSection.getBoundingClientRect().top;
    const animationEnd = isMobile
      ? sectionTop + mobileTitleOffset
      : sectionTop + selfPrSection.offsetHeight - viewportHeight;
    const progress = clampProgress((window.scrollY - animationStart) / Math.max(1, animationEnd - animationStart));

    renderPrCharacters(prLineCharacters[0], progress, 0.08, 0.3);
    renderPrCharacters(prLineCharacters[1], progress, 0.3, 0.55);

    const bodyProgress = getPrSegmentProgress(progress, 0.55, 0.72);
    prBody.style.setProperty('--body-progress', bodyProgress.toFixed(4));
    prBody.classList.toggle('is-visible', bodyProgress > 0.001);
  }

  function requestPrRender() {
    if (prFrameRequested) return;
    prFrameRequested = true;
    requestAnimationFrame(renderSelfPr);
  }

  window.addEventListener('scroll', requestPrRender, { passive: true });
  window.addEventListener('resize', requestPrRender);
  reducedMotion.addEventListener('change', requestPrRender);
  renderSelfPr();

  const markPrReady = () => {
    selfPrSection.classList.add('is-pr-ready');
    requestPrRender();
  };

  if (document.fonts?.ready) {
    document.fonts.ready.then(markPrReady);
  } else {
    markPrReady();
  }
}

const transitionScene = document.querySelector('.transition-scene');
const profilePanels = [...document.querySelectorAll('[data-profile-panel]')];

function clampUnit(value) {
  return Math.max(0, Math.min(1, value));
}

function getSegmentProgress(progress, start, end) {
  return smoothStep(clampUnit((progress - start) / Math.max(0.001, end - start)));
}

function setRevealProgress(element, progress, start, end, distance = 24) {
  if (!element) return;
  const value = getSegmentProgress(progress, start, end);
  element.style.setProperty('--reveal-opacity', value.toFixed(4));
  element.style.setProperty('--reveal-y', `${((1 - value) * distance).toFixed(3)}px`);
}

function setItemProgress(element, progress, start, end, distance = 20) {
  if (!element) return;
  const value = getSegmentProgress(progress, start, end);
  element.style.setProperty('--item-opacity', value.toFixed(4));
  element.style.setProperty('--item-y', `${((1 - value) * distance).toFixed(3)}px`);
}

function setRuleProgress(element, progress, start, end) {
  if (!element) return;
  element.style.setProperty('--line-progress', getSegmentProgress(progress, start, end).toFixed(4));
}

function renderProfilePanelContent(panel, rawProgress) {
  if (!panel) return;
  const progress = clampUnit(rawProgress);
  const type = panel.dataset.profilePanel;
  const title = panel.querySelector('.profile-panel-title');

  setRevealProgress(title, progress, 0.08, 0.28, 28);

  if (type === 'introduction') {
    setRevealProgress(panel.querySelector('.profile-identity'), progress, 0.27, 0.46, 22);
    setRevealProgress(panel.querySelector('.profile-summary'), progress, 0.42, 0.68, 20);
    return;
  }

  if (type === 'skills') {
    [...panel.querySelectorAll('.capability-row')].forEach((row, index) => {
      const start = 0.2 + index * 0.13;
      setRuleProgress(row.querySelector('.profile-rule'), progress, start, start + 0.12);
      row.querySelectorAll('.profile-reveal').forEach((element) => {
        setRevealProgress(element, progress, start + 0.05, start + 0.19, 18);
      });
    });
    return;
  }

  if (type === 'software') {
    [...panel.querySelectorAll('.software-row')].forEach((row, rowIndex) => {
      const start = 0.2 + rowIndex * 0.14;
      setRuleProgress(row.querySelector('.profile-rule'), progress, start, start + 0.1);
      setRevealProgress(row.querySelector('.software-name'), progress, start + 0.03, start + 0.16, 18);
      row.querySelectorAll('.software-rating i.is-filled').forEach((dot, dotIndex) => {
        dot.style.setProperty('--dot-progress', getSegmentProgress(
          progress,
          start + 0.08 + dotIndex * 0.018,
          start + 0.17 + dotIndex * 0.018
        ).toFixed(4));
      });
    });
    return;
  }

  if (type === 'education') {
    const timeline = panel.querySelector('.education-timeline');
    timeline?.style.setProperty('--timeline-progress', getSegmentProgress(progress, 0.2, 0.78).toFixed(4));
    [...panel.querySelectorAll('.education-timeline li')].forEach((item, index) => {
      const start = 0.22 + index * 0.105;
      setItemProgress(item, progress, start, start + 0.16, 18);
    });
    return;
  }

  if (type === 'awards') {
    setRevealProgress(panel.querySelector('.award-brand'), progress, 0.18, 0.36, 22);
    [...panel.querySelectorAll('.award-item')].forEach((item, index) => {
      const start = 0.3 + index * 0.22;
      setRuleProgress(item.querySelector('.profile-rule'), progress, start, start + 0.13);
      setItemProgress(item.querySelector('.award-status'), progress, start + 0.04, start + 0.18, 18);
      setItemProgress(item.querySelector('.award-name'), progress, start + 0.09, start + 0.25, 18);
    });
    return;
  }

  if (type === 'contact') {
    [...panel.querySelectorAll('.interest-list .profile-reveal')].forEach((item, index) => {
      const start = 0.22 + index * 0.12;
      setRevealProgress(item, progress, start, start + 0.15, 20);
    });
    setRevealProgress(panel.querySelector('.availability'), progress, 0.58, 0.76, 18);
    setRevealProgress(panel.querySelector('.profile-footer'), progress, 0.7, 0.88, 14);
  }
}

let profileFrameRequested = false;
let profileLayoutDirty = true;
const profileLayout = new Map();

function refreshProfileLayout() {
  profilePanels.forEach((panel) => {
    const bounds = panel.getBoundingClientRect();
    profileLayout.set(panel, {
      top: bounds.top + window.scrollY,
      height: bounds.height
    });
  });
  profileLayoutDirty = false;
}

function renderProfilePanels() {
  profileFrameRequested = false;
  const showImmediately = reducedMotion.matches || window.innerWidth <= 760;
  const viewportHeight = window.innerHeight;
  const scrollY = window.scrollY;

  if (profileLayoutDirty) refreshProfileLayout();

  profilePanels.forEach((panel) => {
    const metrics = profileLayout.get(panel);
    if (!metrics) return;
    const top = metrics.top - scrollY;
    const bottom = top + metrics.height;
    const progress = showImmediately
      ? 1
      : clampUnit((viewportHeight * 0.76 - top) / (viewportHeight * 0.7));
    const exit = showImmediately
      ? 1
      : smoothStep(clampUnit((bottom - viewportHeight * 0.08) / (viewportHeight * 0.28)));
    const inner = panel.querySelector('.profile-panel-inner');

    inner?.style.setProperty('--panel-opacity', exit.toFixed(4));
    inner?.style.setProperty('--panel-y', `${((1 - exit) * -22).toFixed(3)}px`);
    renderProfilePanelContent(panel, progress);
  });
}

function requestProfileRender() {
  if (profileFrameRequested) return;
  profileFrameRequested = true;
  requestAnimationFrame(renderProfilePanels);
}

function requestProfileLayoutRefresh() {
  profileLayoutDirty = true;
  requestProfileRender();
}

window.addEventListener('scroll', requestProfileRender, { passive: true });
window.addEventListener('resize', requestProfileLayoutRefresh);
window.addEventListener('load', requestProfileLayoutRefresh, { once: true });
reducedMotion.addEventListener('change', requestProfileLayoutRefresh);
document.fonts?.ready.then(requestProfileLayoutRefresh);
renderProfilePanels();

if (transitionScene) {
  const fallback = transitionScene.querySelector('.manifesto-fallback');
  const sliceContainer = transitionScene.querySelector('.transition-slices');
  const brandMotion = document.querySelector('.site-header .brand-motion');
  const baseLogo = brandMotion?.querySelector('.site-logo');
  const contrastLogo = baseLogo?.cloneNode(true);
  const svgNamespace = 'http://www.w3.org/2000/svg';
  let contrastClip;
  let contrastRects = [];
  if (contrastLogo) {
    contrastLogo.classList.add('site-logo--contrast');
    contrastLogo.querySelectorAll('clipPath[id]').forEach((clip) => {
      const originalId = clip.id;
      clip.id = `homepage-contrast-${originalId}`;
      contrastLogo.querySelector(`[clip-path="url(#${originalId})"]`)
        ?.setAttribute('clip-path', `url(#${clip.id})`);
    });
    contrastClip = document.createElementNS(svgNamespace, 'clipPath');
    contrastClip.id = 'homepage-logo-contrast-region';
    contrastClip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    contrastLogo.querySelector('defs').append(contrastClip);
    contrastLogo.setAttribute('clip-path', `url(#${contrastClip.id})`);
    brandMotion.append(contrastLogo);
  }
  const stripeWeights = [
    0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55,
    0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.1,
    1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2
  ];
  const stripeDuration = 0.5;
  const stripeStagger = 0.05;
  const stripeTimelineDuration = stripeDuration + stripeStagger * (stripeWeights.length - 1);
  const scrubTimeConstant = 420;
  const slices = [];
  let transitionTop = 0;
  let transitionRange = 1;
  let targetTransitionProgress = 0;
  let currentTransitionProgress = 0;
  let transitionAnimationFrame = 0;
  let contrastAnimationFrame = 0;
  let lastTransitionFrameTime = 0;
  let transitionInitialized = false;

  sliceContainer.replaceChildren();
  stripeWeights.forEach((weight) => {
    const slice = document.createElement('div');
    slice.className = 'transition-slice';
    slice.style.flexGrow = String(weight);
    sliceContainer.append(slice);
    slices.push(slice);
    if (contrastClip) {
      const rect = document.createElementNS(svgNamespace, 'rect');
      rect.setAttribute('x', '0');
      rect.setAttribute('width', '488.57');
      rect.setAttribute('height', '0');
      contrastClip.append(rect);
      contrastRects.push(rect);
    }
  });

  function syncHeaderContrast(active) {
    if (!active || !contrastLogo) {
      contrastRects.forEach((rect) => rect.setAttribute('height', '0'));
      body.classList.remove('nav-on-red');
      return;
    }

    const logoBounds = contrastLogo.getBoundingClientRect();
    const menuBounds = menuButton.getBoundingClientRect();
    const menuCenterY = menuBounds.top + menuBounds.height / 2;
    let menuOnRed = false;
    slices.forEach((slice, index) => {
      const band = slice.getBoundingClientRect();
      if (band.height > 0.5 && band.top <= menuCenterY && band.bottom >= menuCenterY) {
        menuOnRed = true;
      }
      const top = Math.max(band.top, logoBounds.top);
      const bottom = Math.min(band.bottom, logoBounds.bottom);
      const rect = contrastRects[index];
      if (bottom <= top || band.height <= 0.5 || logoBounds.height <= 0) {
        rect.setAttribute('height', '0');
        return;
      }
      rect.setAttribute('y', ((top - logoBounds.top) / logoBounds.height * 145.82).toFixed(3));
      rect.setAttribute('height', ((bottom - top) / logoBounds.height * 145.82).toFixed(3));
    });
    body.classList.toggle('nav-on-red', menuOnRed);
  }

  function followHeaderContrast() {
    const active = !reducedMotion.matches && window.innerWidth > 760
      && window.scrollY >= transitionTop && window.scrollY <= transitionTop + transitionRange
      && currentTransitionProgress < 0.999;
    syncHeaderContrast(active);
    contrastAnimationFrame = active ? requestAnimationFrame(followHeaderContrast) : 0;
  }

  function refreshTransitionLayout() {
    const bounds = fallback.getBoundingClientRect();
    transitionTop = bounds.top + window.scrollY;
    transitionRange = Math.max(1, fallback.offsetHeight);
  }

  function clampTransitionProgress(value) {
    return Math.max(0, Math.min(1, value));
  }

  function easeStripe(value) {
    const progress = clampTransitionProgress(value);
    return 1 - Math.pow(1 - progress, 2);
  }

  function getTransitionScrollProgress() {
    return clampTransitionProgress((window.scrollY - transitionTop) / transitionRange);
  }

  function renderTransition(progress = currentTransitionProgress) {
    if (reducedMotion.matches || window.innerWidth <= 760) {
      fallback.style.visibility = 'visible';
      sliceContainer.style.visibility = 'visible';
      body.classList.remove('nav-on-red', 'nav-in-shutter');
      slices.forEach((slice) => { slice.style.transform = 'none'; });
      syncHeaderContrast(false);
      cancelAnimationFrame(contrastAnimationFrame);
      contrastAnimationFrame = 0;
      return;
    }

    const scrollY = window.scrollY;
    const sceneIsActive = scrollY >= transitionTop && scrollY <= transitionTop + transitionRange;
    const transitionComplete = progress >= 0.999;

    fallback.style.visibility = 'visible';
    sliceContainer.style.visibility = transitionComplete ? 'hidden' : 'visible';
    body.classList.remove('nav-in-shutter');

    const timelineTime = progress * stripeTimelineDuration;
    slices.forEach((slice, index) => {
      const reverseIndex = slices.length - 1 - index;
      const start = reverseIndex * stripeStagger;
      const rawProgress = clampTransitionProgress((timelineTime - start) / stripeDuration);
      const localProgress = easeStripe(rawProgress);
      slice.style.transform = localProgress <= 0.00001
        ? 'none'
        : `scaleY(${(1 - localProgress).toFixed(5)})`;
    });
    const active = sceneIsActive && !transitionComplete;
    syncHeaderContrast(active);
    if (active && !contrastAnimationFrame) {
      contrastAnimationFrame = requestAnimationFrame(followHeaderContrast);
    } else if (!active && contrastAnimationFrame) {
      cancelAnimationFrame(contrastAnimationFrame);
      contrastAnimationFrame = 0;
    }
  }

  function animateTransition(now) {
    const deltaTime = lastTransitionFrameTime
      ? Math.min(64, now - lastTransitionFrameTime)
      : 16.67;
    lastTransitionFrameTime = now;
    const difference = targetTransitionProgress - currentTransitionProgress;
    const smoothing = 1 - Math.exp(-deltaTime / scrubTimeConstant);

    currentTransitionProgress += difference * smoothing;
    if (Math.abs(difference) < 0.0001) currentTransitionProgress = targetTransitionProgress;
    renderTransition(currentTransitionProgress);

    if (Math.abs(targetTransitionProgress - currentTransitionProgress) >= 0.0001) {
      transitionAnimationFrame = requestAnimationFrame(animateTransition);
    } else {
      transitionAnimationFrame = 0;
      lastTransitionFrameTime = 0;
    }
  }

  function requestTransitionAnimation() {
    if (transitionAnimationFrame) return;
    transitionAnimationFrame = requestAnimationFrame(animateTransition);
  }

  function updateTransitionTarget() {
    const now = performance.now();
    const nextProgress = getTransitionScrollProgress();

    if (!transitionInitialized || reducedMotion.matches || window.innerWidth <= 760) {
      transitionInitialized = true;
      targetTransitionProgress = nextProgress;
      currentTransitionProgress = nextProgress;
      lastTransitionFrameTime = now;
      renderTransition(currentTransitionProgress);
      return;
    }

    if (Math.abs(nextProgress - targetTransitionProgress) > 0.00001) {
      targetTransitionProgress = nextProgress;
    }

    requestTransitionAnimation();
  }

  function requestTransitionLayoutRefresh() {
    refreshTransitionLayout();
    requestPageScrollEffects();
  }

  window.addEventListener('resize', requestTransitionLayoutRefresh);
  window.addEventListener('load', requestTransitionLayoutRefresh, { once: true });
  reducedMotion.addEventListener('change', requestTransitionLayoutRefresh);
  document.fonts?.ready.then(requestTransitionLayoutRefresh);
  transitionScrollRenderer = updateTransitionTarget;
  refreshTransitionLayout();
  requestPageScrollEffects();
}
