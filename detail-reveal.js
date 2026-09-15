(() => {
  const body = document.body;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let controller = null;
  let initFrame = 0;

  function getRevealElements() {
    return [...document.querySelectorAll('.reveal-text, .reveal-body, .media-reveal')];
  }

  function setSequenceDelays() {
    document.querySelectorAll('[data-detail-reveal-group]').forEach((group) => {
      const elements = [...group.querySelectorAll('.reveal-text, .reveal-body')]
        .filter((element) => element.closest('[data-detail-reveal-group]') === group);

      elements.forEach((element, index) => {
        element.style.setProperty('--detail-reveal-delay', `${(index * 0.1).toFixed(2)}s`);
      });
    });

    document.querySelectorAll('[data-detail-media-group]').forEach((group) => {
      const mediaItems = [...group.querySelectorAll('.media-reveal')]
        .filter((element) => element.closest('[data-detail-media-group]') === group);

      mediaItems.forEach((element, index) => {
        element.style.setProperty('--media-reveal-delay', `${(index * 0.15).toFixed(2)}s`);
      });
    });
  }

  function createController() {
    const revealElements = getRevealElements();
    setSequenceDelays();

    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      revealElements.forEach((element) => element.classList.add('is-visible'));
      return { destroy() {} };
    }

    let scrollDirection = 'down';
    let previousScrollY = window.scrollY;
    let directionFrame = 0;
    let observeFrame = 0;
    let refreshFrame = 0;
    const imageLoadCleanups = [];
    const visibilityState = new WeakMap();

    function setDirection(element, direction) {
      element.classList.toggle('reveal-from-up', direction === 'up');
      element.classList.toggle('reveal-from-down', direction !== 'up');
    }

    revealElements.forEach((element) => {
      element.classList.remove('is-visible', 'is-resetting', 'reveal-from-up', 'reveal-from-down');
      setDirection(element, 'down');
      visibilityState.set(element, false);
    });

    function updateScrollDirection() {
      directionFrame = 0;
      const currentScrollY = window.scrollY;
      const difference = currentScrollY - previousScrollY;

      if (Math.abs(difference) > 1) {
        scrollDirection = difference > 0 ? 'down' : 'up';
      }

      previousScrollY = currentScrollY;
    }

    function handleScroll() {
      if (!directionFrame) directionFrame = requestAnimationFrame(updateScrollDirection);
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const isVisible = visibilityState.get(entry.target);
        const isMedia = entry.target.matches('.media-reveal');
        const image = isMedia ? entry.target.querySelector('img') : null;
        const enterThreshold = entry.target.matches('.reveal-body') ? 0.15 : 0.12;

        if (entry.isIntersecting && entry.intersectionRatio >= enterThreshold && !isVisible) {
          if (image && (!image.complete || image.naturalWidth === 0)) return;

          setDirection(entry.target, scrollDirection);
          void entry.target.offsetWidth;
          entry.target.classList.add('is-visible');
          visibilityState.set(entry.target, true);
          return;
        }

        if (!entry.isIntersecting && isVisible) {
          if (isMedia) entry.target.classList.add('is-resetting');
          entry.target.classList.remove('is-visible');
          setDirection(entry.target, entry.boundingClientRect.bottom <= 0 ? 'up' : 'down');

          if (isMedia) {
            void entry.target.offsetWidth;
            entry.target.classList.remove('is-resetting');
          }

          visibilityState.set(entry.target, false);
        }
      });
    }, {
      threshold: [0, 0.1, 0.12, 0.15, 0.18]
    });

    function refresh() {
      refreshFrame = 0;
      revealElements.forEach((element) => {
        observer.unobserve(element);
        observer.observe(element);
      });
    }

    function requestRefresh() {
      if (!refreshFrame) refreshFrame = requestAnimationFrame(refresh);
    }

    revealElements.forEach((element) => {
      const image = element.matches('.media-reveal') ? element.querySelector('img') : null;
      if (!image || image.complete) return;

      image.addEventListener('load', requestRefresh, { once: true });
      imageLoadCleanups.push(() => image.removeEventListener('load', requestRefresh));
    });

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', requestRefresh, { passive: true });

    observeFrame = requestAnimationFrame(() => {
      observeFrame = requestAnimationFrame(() => {
        observeFrame = 0;
        revealElements.forEach((element) => observer.observe(element));
      });
    });

    return {
      destroy() {
        observer.disconnect();
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', requestRefresh);
        imageLoadCleanups.forEach((cleanup) => cleanup());
        cancelAnimationFrame(directionFrame);
        cancelAnimationFrame(observeFrame);
        cancelAnimationFrame(refreshFrame);
      }
    };
  }

  function initialize() {
    controller?.destroy();
    controller = createController();
  }

  function schedule() {
    if (!body.classList.contains('site-page-ready')) return;
    cancelAnimationFrame(initFrame);
    initFrame = requestAnimationFrame(() => {
      initFrame = 0;
      initialize();
    });
  }

  function destroy() {
    cancelAnimationFrame(initFrame);
    initFrame = 0;
    controller?.destroy();
    controller = null;
  }

  window.DetailReveal = { refresh: schedule, destroy };
  window.addEventListener('siteintro:start', destroy);
  window.addEventListener('siteintro:complete', schedule);
  window.addEventListener('pageshow', (event) => {
    if ((event.persisted || !controller) && body.classList.contains('site-page-ready')) schedule();
  });
  window.addEventListener('pagehide', destroy);
  reducedMotion.addEventListener('change', schedule);

  if (document.readyState !== 'loading' && body.classList.contains('site-page-ready')) schedule();
})();
