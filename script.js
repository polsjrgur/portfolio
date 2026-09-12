const body = document.body;
const cursorVisual = document.querySelector('.cursor-shape');
const hero = document.querySelector('.hero');
const posterZone = document.querySelector('.poster-zone');
const cards = [...document.querySelectorAll('.poster-card')];
const menuButton = document.querySelector('.menu-button');
const menuPanel = document.querySelector('.menu-panel');
const dialog = document.querySelector('.project-dialog');
const dialogClose = document.querySelector('.dialog-close');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const anyFinePointer = window.matchMedia('(any-pointer: fine)');

const CURSOR_STATE = Object.freeze({
  DEFAULT: 'default',
  CTA: 'cta',
  INTERACTIVE: 'interactive',
  POSTER: 'poster'
});

const projects = {
  soultube: {
    number: 'Project 01 / 07',
    title: 'Soultube',
    category: 'Digital product / Art direction',
    description: 'A music application concept shaped through an immersive interface, expressive typography and a cinematic visual system.',
    image: './assets/work-soultube.png'
  },
  harmony: {
    number: 'Project 02 / 07',
    title: 'False Harmony',
    category: 'Installation / Visual narrative',
    description: 'An installation-led visual narrative exploring care, repetition and the tension between closeness and emotional distance.',
    image: './assets/work-harmony.png'
  },
  safe: {
    number: 'Project 03 / 07',
    title: 'Safe?',
    category: 'Editorial / Illustration',
    description: 'A visual study of protection and restriction, asking when safety supports growth and when it begins to limit it.',
    image: './assets/work-safe.png'
  },
  designjob: {
    number: 'Project 04 / 07',
    title: 'Design Job',
    category: 'Exhibition / Editorial identity',
    description: 'A restrained exhibition identity built through precise typography, printed matter and a modular geometric language.',
    image: './assets/work-design-job.png'
  },
  cloudcoffee: {
    number: 'Project 05 / 07',
    title: 'Cloud Coffee',
    category: 'Brand identity / Campaign',
    description: 'A tactile coffee identity combining local landscape, expressive typography and surreal product imagery.',
    image: './assets/work-cloud-coffee.png'
  },
  yiguo: {
    number: 'Project 06 / 07',
    title: 'Yi Grow',
    category: 'Education / Brand communication',
    description: 'A bold campaign for an art education space, pairing direct information design with a memorable graphic symbol.',
    image: './assets/work-yiguo.png'
  },
  untitled: {
    number: 'Project 07 / 07',
    title: 'Untitled',
    category: 'Visual design / Experimental',
    description: 'An experimental visual project developed through composition, image making and a tightly controlled graphic system.',
    image: './assets/work-untitled.png'
  }
};

let cursorState = CURSOR_STATE.DEFAULT;
let pointerX = -100;
let pointerY = -100;
let dotX = -100;
let dotY = -100;
let observedMousePointer = false;
let currentActiveCard = null;
let posterInteractionsReady = reducedMotion.matches;
let posterExitTimer = 0;
let cursorMorphTarget = 0;
let cursorMode = 'idle';
let cursorTransitionElapsed = 0;
let cursorTransitionDuration = 0;
let cursorTransitionStart = null;
let cursorTransitionEndRotation = 90;
let cursorEntryBaseRotation = 0;
let cursorLoopPhase = 0;
let cursorLoopCycle = 0;
let cursorLoopBaseRotation = 90;
let cursorShape = {
  scale: 10 / 78,
  borderWidth: 0,
  fillAlpha: 1,
  radius: 50,
  rotation: 0
};
let lastAnimationFrame = performance.now();

const CURSOR_DOT_SCALE = 10 / 78;
const CURSOR_BORDER_WIDTH = 2.5;
const CURSOR_ENTRY_DURATION = 630;
const CURSOR_EXIT_DURATION = 360;
const CURSOR_LOOP_HOLD = 270;
const CURSOR_LOOP_TRANSITION = 660;
const CURSOR_LOOP_DURATION = (CURSOR_LOOP_HOLD + CURSOR_LOOP_TRANSITION) * 2;

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

const ctaButtons = [...document.querySelectorAll('.primary-action')];

body.dataset.cursorState = CURSOR_STATE.DEFAULT;

function canUseCustomCursor() {
  return anyFinePointer.matches || observedMousePointer;
}

function canUsePosterEffects() {
  return posterInteractionsReady && canUseCustomCursor() && !reducedMotion.matches && window.innerWidth > 760;
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

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function smoothStep(value) {
  return value * value * (3 - 2 * value);
}

function createBezierEasing(x1, y1, x2, y2) {
  const sample = (start, control1, control2, end, value) => {
    const inverse = 1 - value;
    return inverse ** 3 * start
      + 3 * inverse ** 2 * value * control1
      + 3 * inverse * value ** 2 * control2
      + value ** 3 * end;
  };

  return (progress) => {
    const clamped = Math.max(0, Math.min(1, progress));
    let lower = 0;
    let upper = 1;
    let parameter = clamped;

    for (let index = 0; index < 12; index += 1) {
      const sampledX = sample(0, x1, x2, 1, parameter);
      if (Math.abs(sampledX - clamped) < 0.0001) break;
      if (sampledX < clamped) lower = parameter;
      else upper = parameter;
      parameter = (lower + upper) / 2;
    }

    return sample(0, y1, y2, 1, parameter);
  };
}

const cursorEaseOut = createBezierEasing(0.16, 1, 0.3, 1);

function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

function interpolateCursorShape(start, end, progress) {
  return {
    scale: lerp(start.scale, end.scale, progress),
    borderWidth: lerp(start.borderWidth, end.borderWidth, progress),
    fillAlpha: lerp(start.fillAlpha, end.fillAlpha, progress),
    radius: lerp(start.radius, end.radius, progress),
    rotation: lerp(start.rotation, end.rotation, progress)
  };
}

function getEntryShape(elapsed) {
  const keyframes = [
    { time: 0, scale: CURSOR_DOT_SCALE, borderWidth: 0, fillAlpha: 1, radius: 50, rotation: 0, easing: cursorEaseOut },
    { time: 150, scale: 1, borderWidth: CURSOR_BORDER_WIDTH, fillAlpha: 0.16, radius: 46, rotation: 30, easing: cursorEaseOut },
    { time: 345, scale: 1, borderWidth: CURSOR_BORDER_WIDTH, fillAlpha: 0.12, radius: 42, rotation: 42, easing: smoothStep },
    { time: 450, scale: 1, borderWidth: CURSOR_BORDER_WIDTH, fillAlpha: 0.04, radius: 18, rotation: 68, easing: smoothStep },
    { time: 540, scale: 1, borderWidth: CURSOR_BORDER_WIDTH, fillAlpha: 0, radius: 6, rotation: 82, easing: cursorEaseOut },
    { time: CURSOR_ENTRY_DURATION, scale: 1, borderWidth: CURSOR_BORDER_WIDTH, fillAlpha: 0, radius: 0, rotation: 90, easing: cursorEaseOut }
  ];

  const bounded = Math.max(0, Math.min(CURSOR_ENTRY_DURATION, elapsed));
  let endIndex = keyframes.findIndex((frame) => frame.time >= bounded);
  if (endIndex <= 0) return { ...keyframes[0], rotation: cursorEntryBaseRotation };
  if (endIndex < 0) endIndex = keyframes.length - 1;

  const start = keyframes[endIndex - 1];
  const end = keyframes[endIndex];
  const rawProgress = (bounded - start.time) / Math.max(1, end.time - start.time);
  const progress = end.easing(rawProgress);
  const shape = interpolateCursorShape(start, end, progress);
  shape.rotation += cursorEntryBaseRotation;
  return shape;
}

function getLoopRadius(phase) {
  const squareHoldEnd = CURSOR_LOOP_HOLD;
  const circleTransitionEnd = squareHoldEnd + CURSOR_LOOP_TRANSITION;
  const circleHoldEnd = circleTransitionEnd + CURSOR_LOOP_HOLD;

  if (phase <= squareHoldEnd) return 0;
  if (phase < circleTransitionEnd) {
    const progress = cursorEaseOut((phase - squareHoldEnd) / CURSOR_LOOP_TRANSITION);
    return 50 * progress;
  }
  if (phase <= circleHoldEnd) return 50;

  const progress = cursorEaseOut((phase - circleHoldEnd) / CURSOR_LOOP_TRANSITION);
  return 50 * (1 - progress);
}

function getLoopRotation(phase) {
  const squareHoldEnd = CURSOR_LOOP_HOLD;
  const circleTransitionEnd = squareHoldEnd + CURSOR_LOOP_TRANSITION;
  const circleHoldEnd = circleTransitionEnd + CURSOR_LOOP_HOLD;

  if (phase <= squareHoldEnd) return 0;
  if (phase < circleTransitionEnd) {
    const progress = cursorEaseOut((phase - squareHoldEnd) / CURSOR_LOOP_TRANSITION);
    return 180 * progress;
  }
  if (phase <= circleHoldEnd) return 180;

  const progress = cursorEaseOut((phase - circleHoldEnd) / CURSOR_LOOP_TRANSITION);
  return 180 + 180 * progress;
}

function applyCursorShape() {
  cursorVisual.style.setProperty('--cursor-scale', cursorShape.scale.toFixed(5));
  cursorVisual.style.setProperty('--cursor-border-width', `${cursorShape.borderWidth.toFixed(3)}px`);
  cursorVisual.style.setProperty('--cursor-fill-alpha', cursorShape.fillAlpha.toFixed(4));
  cursorVisual.style.setProperty('--cursor-radius', `${cursorShape.radius.toFixed(3)}%`);
  cursorVisual.style.setProperty('--cursor-rotation', `${cursorShape.rotation.toFixed(3)}deg`);
}

function enterPosterCursor() {
  if (cursorMorphTarget === 1 && cursorMode !== 'exit') return;
  cursorMorphTarget = 1;

  if (cursorMode === 'exit') {
    cursorTransitionStart = { ...cursorShape };
    cursorTransitionElapsed = 0;
    cursorTransitionDuration = 420;
    cursorTransitionEndRotation = Math.ceil((cursorShape.rotation + 1) / 90) * 90;
    cursorMode = 'resume';
    return;
  }

  cursorEntryBaseRotation = Math.ceil(cursorShape.rotation / 90) * 90;
  cursorTransitionElapsed = 0;
  cursorMode = 'enter';
}

function exitPosterCursor() {
  if (cursorMorphTarget === 0) return;
  cursorMorphTarget = 0;
  cursorTransitionStart = { ...cursorShape };
  cursorTransitionElapsed = 0;
  cursorTransitionDuration = CURSOR_EXIT_DURATION;
  cursorTransitionEndRotation = cursorShape.rotation + 45;
  cursorMode = 'exit';
}

function resetCursorMorph() {
  cursorMorphTarget = 0;
  cursorMode = 'idle';
  cursorTransitionElapsed = 0;
  cursorTransitionStart = null;
  cursorLoopPhase = 0;
  cursorLoopCycle = 0;
  cursorLoopBaseRotation = 90;
  cursorShape = {
    scale: CURSOR_DOT_SCALE,
    borderWidth: 0,
    fillAlpha: 1,
    radius: 50,
    rotation: 0
  };
  body.classList.remove('cursor-outline');
  applyCursorShape();
}

function renderCursorMorph(deltaTime) {
  if (cursorMode === 'enter') {
    cursorTransitionElapsed = Math.min(CURSOR_ENTRY_DURATION, cursorTransitionElapsed + deltaTime);
    cursorShape = getEntryShape(cursorTransitionElapsed);

    if (cursorTransitionElapsed >= CURSOR_ENTRY_DURATION) {
      cursorMode = 'loop';
      cursorLoopPhase = 0;
      cursorLoopCycle = 0;
      cursorLoopBaseRotation = cursorShape.rotation;
    }
  } else if (cursorMode === 'resume') {
    cursorTransitionElapsed = Math.min(cursorTransitionDuration, cursorTransitionElapsed + deltaTime);
    const progress = cursorEaseOut(cursorTransitionElapsed / cursorTransitionDuration);
    cursorShape = interpolateCursorShape(cursorTransitionStart, {
      scale: 1,
      borderWidth: CURSOR_BORDER_WIDTH,
      fillAlpha: 0,
      radius: 0,
      rotation: cursorTransitionEndRotation
    }, progress);

    if (cursorTransitionElapsed >= cursorTransitionDuration) {
      cursorMode = 'loop';
      cursorLoopPhase = 0;
      cursorLoopCycle = 0;
      cursorLoopBaseRotation = cursorTransitionEndRotation;
    }
  } else if (cursorMode === 'loop') {
    const loopTime = cursorLoopPhase + deltaTime;
    cursorLoopCycle += Math.floor(loopTime / CURSOR_LOOP_DURATION);
    cursorLoopPhase = loopTime % CURSOR_LOOP_DURATION;
    cursorShape = {
      scale: 1,
      borderWidth: CURSOR_BORDER_WIDTH,
      fillAlpha: 0,
      radius: getLoopRadius(cursorLoopPhase),
      rotation: cursorLoopBaseRotation + cursorLoopCycle * 360 + getLoopRotation(cursorLoopPhase)
    };
  } else if (cursorMode === 'exit') {
    cursorTransitionElapsed = Math.min(cursorTransitionDuration, cursorTransitionElapsed + deltaTime);
    const progress = cursorEaseOut(cursorTransitionElapsed / cursorTransitionDuration);
    cursorShape = interpolateCursorShape(cursorTransitionStart, {
      scale: CURSOR_DOT_SCALE,
      borderWidth: 0,
      fillAlpha: 1,
      radius: 50,
      rotation: cursorTransitionEndRotation
    }, progress);

    if (cursorTransitionElapsed >= cursorTransitionDuration) {
      cursorMode = 'idle';
      cursorTransitionStart = null;
      cursorShape = {
        scale: CURSOR_DOT_SCALE,
        borderWidth: 0,
        fillAlpha: 1,
        radius: 50,
        rotation: cursorTransitionEndRotation
      };
    }
  }

  body.classList.toggle('cursor-outline', cursorMode === 'loop');
  applyCursorShape();
}

function setCursorState(nextState) {
  if (nextState === cursorState) return;

  if (cursorState === CURSOR_STATE.POSTER) {
    deactivatePosterState();
    exitPosterCursor();
  }
  cursorState = nextState;
  body.dataset.cursorState = nextState;
  if (nextState === CURSOR_STATE.POSTER) {
    activatePosterState();
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
  if (!image || !mask) return false;
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
  const poster = getPosterAtPoint(clientX, clientY);

  if (poster) {
    clearPosterExitTimer();
    setCursorState(CURSOR_STATE.POSTER);
    enterPosterCursor();
    setActiveCard(poster);
    return;
  }

  const nextState = resolveNonPosterCursorState(target);
  if (cursorState === CURSOR_STATE.POSTER && nextState === CURSOR_STATE.DEFAULT) {
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
  if (event.pointerType === 'mouse' && !observedMousePointer) {
    observedMousePointer = true;
    syncPointerCapabilities();
  }

  if (!canUseCustomCursor()) return;

  const wasVisible = body.classList.contains('cursor-visible');
  pointerX = event.clientX;
  pointerY = event.clientY;
  if (!wasVisible) {
    dotX = pointerX;
    dotY = pointerY;
  }
  body.classList.add('cursor-visible');
  updatePointerState(event.target, pointerX, pointerY);
  updatePosterTargets();
}

function hideCursor() {
  clearPosterExitTimer();
  body.classList.remove('cursor-visible');
  setCursorState(CURSOR_STATE.DEFAULT);
  resetCursorMorph();
  resetPosterMotion();
}

function animatePointer(frameTime = performance.now()) {
  const deltaTime = Math.min(40, Math.max(0, frameTime - lastAnimationFrame));
  lastAnimationFrame = frameTime;
  const targetDotX = pointerX;
  const targetDotY = pointerY;
  const distance = Math.hypot(targetDotX - dotX, targetDotY - dotY);
  const follow = Math.min(0.196, 0.07 + distance / 315);
  dotX += (targetDotX - dotX) * follow;
  dotY += (targetDotY - dotY) * follow;

  const remainingX = targetDotX - dotX;
  const remainingY = targetDotY - dotY;
  const remainingDistance = Math.hypot(remainingX, remainingY);
  if (remainingDistance > 45) {
    dotX = targetDotX - remainingX / remainingDistance * 45;
    dotY = targetDotY - remainingY / remainingDistance * 45;
  }

  if (Math.abs(targetDotX - dotX) < 0.1 && Math.abs(targetDotY - dotY) < 0.1) {
    dotX = targetDotX;
    dotY = targetDotY;
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
  if (!canUseCustomCursor()) return;

  button.classList.add('is-fill-repositioning');
  button.classList.remove('is-fill-expanded');
  setFillGeometry(button, getFillGeometry(button, event));
  void button.offsetWidth;
  button.classList.remove('is-fill-repositioning');
  void button.offsetWidth;
  button.classList.add('is-fill-expanded');
}

function retractCta(button, event) {
  if (!canUseCustomCursor()) return;

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

function setActiveCard(nextActiveCard) {
  if (nextActiveCard === currentActiveCard) return;
  currentActiveCard = nextActiveCard;

  const activeIndex = cards.indexOf(nextActiveCard);
  const squeezeByDistance = [0, 68, 52, 39, 29, 21, 15];

  cards.forEach((card, index) => {
    card.classList.toggle('is-active', card === nextActiveCard);

    let pushX = 0;
    let pushY = 0;

    if (activeIndex >= 0 && index !== activeIndex) {
      const distance = Math.abs(index - activeIndex);
      const strength = squeezeByDistance[distance] || 15;

      if (index < activeIndex) {
        pushX = -Math.min(45, strength);
        pushY = Math.min(12, strength * 0.22);
      } else {
        pushX = Math.min(62, strength);
        pushY = -Math.min(28, strength * 0.45);
      }
    }

    card.style.setProperty('--push-x', `${pushX.toFixed(2)}px`);
    card.style.setProperty('--push-y', `${pushY.toFixed(2)}px`);
  });
}

cards.forEach((card) => {
  card.addEventListener('click', () => openProject(card.dataset.project));
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
if (reducedMotion.matches) {
  body.classList.add('poster-interactions-ready');
} else {
  frontCard?.addEventListener('animationend', (event) => {
    if (event.animationName === 'poster-card-in') unlockPosterInteractions();
  }, { once: true });
  window.setTimeout(unlockPosterInteractions, 3900);
}

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) unlockPosterInteractions();
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
