(() => {
  const marqueeElements = [...document.querySelectorAll('[data-material-marquee]')];
  if (!marqueeElements.length) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stateByElement = new Map();
  const listenerCleanups = [];
  let resizeFrame = 0;
  let destroyed = false;

  function createClone(group) {
    const clone = group.cloneNode(true);
    clone.dataset.marqueeClone = 'true';
    clone.setAttribute('aria-hidden', 'true');
    clone.removeAttribute('role');
    clone.removeAttribute('aria-label');
    clone.querySelectorAll('[role]').forEach((element) => element.removeAttribute('role'));
    clone.querySelectorAll('img').forEach((image) => {
      image.alt = '';
      image.loading = 'lazy';
    });
    return clone;
  }

  function updatePlayback(state) {
    const shouldRun = state.isInViewport
      && !document.hidden
      && !state.isHovered
      && !state.isTouched
      && !reducedMotion.matches;

    state.marquee.classList.toggle('is-running', shouldRun);
    state.marquee.classList.toggle('is-paused', !shouldRun);
  }

  function syncCloneCount(state, distance) {
    const requiredClones = Math.max(1, Math.ceil(window.innerWidth / distance));

    while (state.clones.length < requiredClones) {
      const clone = createClone(state.originalGroup);
      state.track.append(clone);
      state.clones.push(clone);
    }

    while (state.clones.length > requiredClones) {
      state.clones.pop().remove();
    }
  }

  function updateMetrics(state) {
    const distance = state.originalGroup.getBoundingClientRect().width;
    if (!distance) return;

    syncCloneCount(state, distance);
    const pixelsPerSecond = window.innerWidth <= 760 ? 26 : 34;
    state.track.style.setProperty('--material-marquee-shift', `${-distance}px`);
    state.track.style.setProperty('--material-marquee-duration', `${distance / pixelsPerSecond}s`);
  }

  function updateAllMetrics() {
    resizeFrame = 0;
    stateByElement.forEach(updateMetrics);
  }

  function requestMetricsUpdate() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(updateAllMetrics);
  }

  function addListener(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listenerCleanups.push(() => target.removeEventListener(type, handler, options));
  }

  const viewportObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const state = stateByElement.get(entry.target);
      if (!state) return;

      state.isInViewport = entry.isIntersecting && entry.intersectionRatio >= 0.08;
      updatePlayback(state);
    });
  }, { threshold: [0, 0.08, 0.25] });

  const sizeObserver = 'ResizeObserver' in window
    ? new ResizeObserver(requestMetricsUpdate)
    : null;

  marqueeElements.forEach((marquee) => {
    const track = marquee.querySelector('.material-marquee__track');
    const originalGroup = marquee.querySelector('.material-marquee__group:not([data-marquee-clone])');
    if (!track || !originalGroup) return;

    const state = {
      marquee,
      track,
      originalGroup,
      clones: [],
      isInViewport: false,
      isHovered: false,
      isTouched: false
    };

    stateByElement.set(marquee, state);
    originalGroup.querySelectorAll('img').forEach((image) => {
      image.loading = 'eager';
    });

    addListener(marquee, 'pointerenter', () => {
      state.isHovered = true;
      updatePlayback(state);
    });
    addListener(marquee, 'pointerleave', () => {
      state.isHovered = false;
      updatePlayback(state);
    });
    addListener(marquee, 'touchstart', () => {
      state.isTouched = true;
      updatePlayback(state);
    }, { passive: true });
    addListener(marquee, 'touchend', () => {
      state.isTouched = false;
      updatePlayback(state);
    }, { passive: true });
    addListener(marquee, 'touchcancel', () => {
      state.isTouched = false;
      updatePlayback(state);
    }, { passive: true });

    originalGroup.querySelectorAll('img').forEach((image) => {
      if (!image.complete) addListener(image, 'load', requestMetricsUpdate, { once: true });
    });

    viewportObserver.observe(marquee);
    sizeObserver?.observe(originalGroup);
  });

  function updateAllPlayback() {
    stateByElement.forEach(updatePlayback);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(resizeFrame);
    viewportObserver.disconnect();
    sizeObserver?.disconnect();
    listenerCleanups.forEach((cleanup) => cleanup());
  }

  addListener(document, 'visibilitychange', updateAllPlayback);
  addListener(window, 'resize', requestMetricsUpdate, { passive: true });
  addListener(reducedMotion, 'change', () => {
    requestMetricsUpdate();
    updateAllPlayback();
  });
  addListener(window, 'pageshow', () => {
    requestMetricsUpdate();
    updateAllPlayback();
  });
  addListener(window, 'pagehide', (event) => {
    if (!event.persisted) {
      destroy();
      return;
    }

    stateByElement.forEach((state) => {
      state.isInViewport = false;
      updatePlayback(state);
    });
  });

  requestAnimationFrame(() => requestAnimationFrame(updateAllMetrics));
})();
