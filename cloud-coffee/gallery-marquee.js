(() => {
  const gallery = document.querySelector('[data-cloud-gallery]');
  if (!gallery) return;

  const track = gallery.querySelector('.cloud-gallery__track');
  const originalGroup = gallery.querySelector('.cloud-gallery__group:not([data-gallery-clone])');
  if (!track || !originalGroup) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clones = [];
  const cleanups = [];
  let isInViewport = false;
  let isHovered = false;
  let isTouched = false;
  let isFocused = false;
  let resizeFrame = 0;

  function createClone() {
    const clone = originalGroup.cloneNode(true);
    clone.dataset.galleryClone = 'true';
    clone.setAttribute('aria-hidden', 'true');
    clone.removeAttribute('role');
    clone.querySelectorAll('[role]').forEach((element) => element.removeAttribute('role'));
    clone.querySelectorAll('img').forEach((image) => {
      image.alt = '';
      image.loading = 'lazy';
    });
    return clone;
  }

  function updatePlayback() {
    const shouldRun = isInViewport
      && !document.hidden
      && !isHovered
      && !isTouched
      && !isFocused
      && !reducedMotion.matches;

    gallery.classList.toggle('is-running', shouldRun);
    gallery.classList.toggle('is-paused', !shouldRun);
  }

  function syncCloneCount(distance) {
    const requiredClones = Math.max(1, Math.ceil(window.innerWidth / distance));

    while (clones.length < requiredClones) {
      const clone = createClone();
      track.append(clone);
      clones.push(clone);
    }

    while (clones.length > requiredClones) {
      clones.pop().remove();
    }
  }

  function updateMetrics() {
    resizeFrame = 0;
    const distance = originalGroup.getBoundingClientRect().width;
    if (!distance) return;

    syncCloneCount(distance);
    const pixelsPerSecond = window.innerWidth <= 760 ? 24 : 31;
    track.style.setProperty('--cloud-gallery-shift', `${-distance}px`);
    track.style.setProperty('--cloud-gallery-duration', `${distance / pixelsPerSecond}s`);
  }

  function requestMetricsUpdate() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(updateMetrics);
  }

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  originalGroup.querySelectorAll('img').forEach((image) => {
    image.loading = 'eager';
    if (!image.complete) listen(image, 'load', requestMetricsUpdate, { once: true });
  });

  const viewportObserver = new IntersectionObserver(([entry]) => {
    isInViewport = entry.isIntersecting && entry.intersectionRatio >= 0.08;
    updatePlayback();
  }, { threshold: [0, 0.08, 0.25] });

  const sizeObserver = 'ResizeObserver' in window
    ? new ResizeObserver(requestMetricsUpdate)
    : null;

  listen(gallery, 'pointerenter', () => {
    isHovered = true;
    updatePlayback();
  });
  listen(gallery, 'pointerleave', () => {
    isHovered = false;
    updatePlayback();
  });
  listen(gallery, 'focusin', () => {
    isFocused = true;
    updatePlayback();
  });
  listen(gallery, 'focusout', () => {
    isFocused = false;
    updatePlayback();
  });
  listen(gallery, 'touchstart', () => {
    isTouched = true;
    updatePlayback();
  }, { passive: true });
  listen(gallery, 'touchend', () => {
    isTouched = false;
    updatePlayback();
  }, { passive: true });
  listen(gallery, 'touchcancel', () => {
    isTouched = false;
    updatePlayback();
  }, { passive: true });
  listen(document, 'visibilitychange', updatePlayback);
  listen(window, 'resize', requestMetricsUpdate, { passive: true });
  listen(reducedMotion, 'change', () => {
    requestMetricsUpdate();
    updatePlayback();
  });
  listen(window, 'pageshow', () => {
    requestMetricsUpdate();
    updatePlayback();
  });

  viewportObserver.observe(gallery);
  sizeObserver?.observe(originalGroup);
  requestAnimationFrame(() => requestAnimationFrame(updateMetrics));

  listen(window, 'pagehide', () => {
    cancelAnimationFrame(resizeFrame);
    viewportObserver.disconnect();
    sizeObserver?.disconnect();
    cleanups.forEach((cleanup) => cleanup());
  }, { once: true });
})();
