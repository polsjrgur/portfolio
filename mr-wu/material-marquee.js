(() => {
  const marquee = document.querySelector('[data-material-marquee]');
  if (!marquee) return;

  const track = marquee.querySelector('.material-marquee__track');
  const originalGroup = marquee.querySelector('.material-marquee__group');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cloneGroup = originalGroup.cloneNode(true);
  let isInViewport = false;
  let isHovered = false;
  let isTouched = false;
  let resizeFrame = 0;

  cloneGroup.dataset.marqueeClone = 'true';
  cloneGroup.setAttribute('aria-hidden', 'true');
  cloneGroup.removeAttribute('role');
  cloneGroup.querySelectorAll('[role]').forEach((element) => element.removeAttribute('role'));
  cloneGroup.querySelectorAll('img').forEach((image) => {
    image.loading = 'eager';
    image.alt = '';
  });
  track.append(cloneGroup);

  function updatePlayback() {
    const shouldRun = isInViewport
      && !document.hidden
      && !isHovered
      && !isTouched
      && !reducedMotion.matches;

    marquee.classList.toggle('is-running', shouldRun);
    marquee.classList.toggle('is-paused', !shouldRun);
  }

  function updateMetrics() {
    resizeFrame = 0;
    const distance = originalGroup.getBoundingClientRect().width;
    if (!distance) return;

    const pixelsPerSecond = window.innerWidth <= 760 ? 26 : 34;
    track.style.setProperty('--material-marquee-shift', `${-distance}px`);
    track.style.setProperty('--material-marquee-duration', `${distance / pixelsPerSecond}s`);
  }

  function requestMetricsUpdate() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(updateMetrics);
  }

  const viewportObserver = new IntersectionObserver(([entry]) => {
    isInViewport = entry.isIntersecting && entry.intersectionRatio >= 0.08;
    updatePlayback();
  }, { threshold: [0, 0.08, 0.25] });

  const sizeObserver = 'ResizeObserver' in window
    ? new ResizeObserver(requestMetricsUpdate)
    : null;

  marquee.addEventListener('pointerenter', () => {
    isHovered = true;
    updatePlayback();
  });
  marquee.addEventListener('pointerleave', () => {
    isHovered = false;
    updatePlayback();
  });
  marquee.addEventListener('touchstart', () => {
    isTouched = true;
    updatePlayback();
  }, { passive: true });
  marquee.addEventListener('touchend', () => {
    isTouched = false;
    updatePlayback();
  }, { passive: true });
  marquee.addEventListener('touchcancel', () => {
    isTouched = false;
    updatePlayback();
  }, { passive: true });
  document.addEventListener('visibilitychange', updatePlayback);
  window.addEventListener('resize', requestMetricsUpdate, { passive: true });
  reducedMotion.addEventListener('change', updatePlayback);

  viewportObserver.observe(marquee);
  sizeObserver?.observe(originalGroup);
  requestAnimationFrame(() => requestAnimationFrame(updateMetrics));

  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(resizeFrame);
    viewportObserver.disconnect();
    sizeObserver?.disconnect();
  }, { once: true });
})();
