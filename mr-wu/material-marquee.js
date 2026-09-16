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
      && !state.isDragging
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
      isDragging: false,
      pointerId: null,
      startX: 0,
      startTime: 0,
      animation: null
    };

    stateByElement.set(marquee, state);
    originalGroup.querySelectorAll('img').forEach((image) => {
      image.loading = 'eager';
    });

    addListener(marquee, 'pointerenter', (event) => {
      if (event.pointerType === 'touch') return;
      state.isHovered = true;
      updatePlayback(state);
    });
    addListener(marquee, 'pointerleave', (event) => {
      if (event.pointerType === 'touch') return;
      state.isHovered = false;
      updatePlayback(state);
    });

    function dragTo(clientX) {
      if (reducedMotion.matches) {
        marquee.scrollLeft -= clientX - state.startX;
        state.startX = clientX;
        return;
      }

      const distance = state.originalGroup.getBoundingClientRect().width;
      const duration = state.animation?.effect?.getComputedTiming().duration;
      if (!distance || !Number.isFinite(duration) || !duration) return;

      const time = state.startTime - (clientX - state.startX) * duration / distance;
      state.animation.currentTime = ((time % duration) + duration) % duration;
    }

    function finishDrag(event, cancelled = false) {
      if (event.pointerId !== state.pointerId) return;
      if (!cancelled) dragTo(event.clientX);
      state.isDragging = false;
      state.pointerId = null;
      state.animation = null;
      if (event.pointerType === 'touch') {
        state.isHovered = false;
      } else {
        const bounds = marquee.getBoundingClientRect();
        state.isHovered = event.clientX >= bounds.left && event.clientX <= bounds.right
          && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
      }
      updatePlayback(state);
      if (marquee.hasPointerCapture(event.pointerId)) marquee.releasePointerCapture(event.pointerId);
    }

    addListener(marquee, 'pointerdown', (event) => {
      if (state.isDragging || (event.pointerType === 'mouse' && event.button !== 0)) return;
      state.animation = reducedMotion.matches ? null : track.getAnimations()[0];
      state.startTime = state.animation?.currentTime ?? 0;
      state.startX = event.clientX;
      state.pointerId = event.pointerId;
      state.isDragging = true;
      marquee.setPointerCapture(event.pointerId);
      updatePlayback(state);
      if (event.pointerType === 'mouse') event.preventDefault();
    });
    addListener(marquee, 'pointermove', (event) => {
      if (state.isDragging && event.pointerId === state.pointerId) dragTo(event.clientX);
    });
    addListener(marquee, 'pointerup', (event) => finishDrag(event));
    addListener(marquee, 'pointercancel', (event) => finishDrag(event, true));
    addListener(marquee, 'lostpointercapture', (event) => finishDrag(event, true));

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
