(() => {
  const INITIAL_HOLD = 90;
  const LINE_DURATION = 520;
  const TAIL_DURATION = 650;
  const FULL_LOGO_HOLD = 200;
  const DISSOLVE_DURATION = 720;
  const REDUCED_HOLD = 110;
  const REDUCED_FADE = 240;
  const TAIL_SHIFT = -56;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let playbackId = 0;
  let animationFrame = 0;
  let overlay = null;

  function clamp(value) {
    return Math.max(0, Math.min(1, value));
  }

  function smoothStep(value) {
    const progress = clamp(value);
    return progress * progress * (3 - 2 * progress);
  }

  function setLogoProgress(logo, lineProgress, tailProgress, finalLineScale, finalPShift) {
    const lineValue = smoothStep(lineProgress);
    const tailValue = smoothStep(tailProgress);
    const lineScale = finalLineScale + (1 - finalLineScale) * lineValue;
    const pShift = finalPShift * (1 - lineValue);

    logo.style.setProperty('--logo-line-scale', lineScale.toFixed(5));
    logo.style.setProperty('--logo-p-shift', `${pShift.toFixed(3)}px`);
    logo.style.setProperty('--logo-tail-shift', `${(TAIL_SHIFT * (1 - tailValue)).toFixed(3)}px`);
    logo.style.setProperty('--logo-tail-opacity', tailValue.toFixed(4));
    logo.style.setProperty('--logo-tail-blur', `${(2 * (1 - tailValue)).toFixed(3)}px`);
  }

  function cloneLogo(source) {
    const clone = source.cloneNode(true);
    const uniquePrefix = `site-intro-${Date.now()}-${playbackId}`;
    const clipPaths = [...clone.querySelectorAll('clipPath[id]')];

    clipPaths.forEach((clipPath) => {
      const oldId = clipPath.id;
      const nextId = `${uniquePrefix}-${oldId}`;
      clone.querySelectorAll(`[clip-path="url(#${oldId})"]`).forEach((element) => {
        element.setAttribute('clip-path', `url(#${nextId})`);
      });
      clipPath.id = nextId;
    });

    const referencedRule = clone.querySelector('.logo-rule');
    if (referencedRule) {
      const rule = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      rule.setAttribute('class', 'logo-rule');
      rule.setAttribute('x1', '0.01');
      rule.setAttribute('y1', '115.52');
      rule.setAttribute('x2', '140.95');
      rule.setAttribute('y2', '115.52');
      rule.setAttribute('fill', 'none');
      rule.setAttribute('stroke', '#ffffff');
      rule.setAttribute('stroke-width', '9.78');
      rule.setAttribute('stroke-miterlimit', '10');
      referencedRule.replaceWith(rule);
    }

    clone.removeAttribute('style');
    clone.classList.add('site-intro-logo');
    return clone;
  }

  function getCompactGeometry(logo) {
    const d = logo.querySelector('.logo-d');
    const line = logo.querySelector('.logo-rule');
    const dWidth = d?.getBBox().width || 45.08;
    const lineWidth = line?.getBBox().width || 140.94;

    return {
      finalLineScale: dWidth / lineWidth,
      finalPShift: -(lineWidth - dWidth)
    };
  }

  function removeOverlay() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    overlay?.remove();
    overlay = null;
    document.body.classList.remove('site-intro-active', 'site-intro-dissolving');
  }

  function setPageWaiting() {
    document.documentElement.classList.add('site-intro-pending');
    document.body.classList.remove('site-page-ready', 'site-intro-dissolving');
    document.body.classList.add('site-intro-active');
    window.dispatchEvent(new CustomEvent('siteintro:start'));
  }

  function preparePageHideCover() {
    playbackId += 1;
    removeOverlay();
    overlay = document.createElement('div');
    overlay.className = 'site-intro-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.append(overlay);
    setPageWaiting();
  }

  function finishIntro(introLogo) {
    introLogo.style.opacity = '0';
    overlay?.remove();
    overlay = null;
    animationFrame = 0;
    document.body.classList.remove('site-intro-active', 'site-intro-dissolving');
    document.documentElement.classList.remove('site-intro-pending');
    document.body.classList.add('site-page-ready');
    window.dispatchEvent(new CustomEvent('siteintro:complete'));
  }

  function playReducedIntro(introLogo, startTime, now) {
    const elapsed = now - startTime;
    const fadeProgress = smoothStep((elapsed - REDUCED_HOLD) / REDUCED_FADE);
    if (elapsed >= REDUCED_HOLD) document.body.classList.add('site-intro-dissolving');
    overlay.style.opacity = (1 - fadeProgress).toFixed(4);

    if (fadeProgress >= 1) {
      finishIntro(introLogo);
      return true;
    }

    return false;
  }

  function playIntro() {
    const headerLogo = document.querySelector('.site-header .site-logo');
    if (!headerLogo) return;

    playbackId += 1;
    const currentPlayback = playbackId;
    removeOverlay();
    window.scrollTo(0, 0);

    overlay = document.createElement('div');
    overlay.className = 'site-intro-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    const logoMotion = document.createElement('div');
    logoMotion.className = 'site-intro-logo-motion';
    const introLogo = cloneLogo(headerLogo);
    logoMotion.append(introLogo);
    overlay.append(logoMotion);
    document.body.append(overlay);
    setPageWaiting();

    headerLogo.style.setProperty('--logo-tail-shift', '0px');
    headerLogo.style.setProperty('--logo-tail-opacity', '1');
    headerLogo.style.setProperty('--logo-tail-blur', '0px');
    headerLogo.style.setProperty('--logo-line-scale', '1');
    headerLogo.style.setProperty('--logo-p-shift', '0px');

    requestAnimationFrame(() => {
      if (currentPlayback !== playbackId || !overlay) return;

      const { finalLineScale, finalPShift } = getCompactGeometry(introLogo);

      if (reducedMotion.matches) {
        setLogoProgress(introLogo, 1, 1, finalLineScale, finalPShift);
      } else {
        setLogoProgress(introLogo, 0, 0, finalLineScale, finalPShift);
      }

      const startTime = performance.now();
      const lineStart = INITIAL_HOLD;
      const tailStart = lineStart + LINE_DURATION;
      const dissolveStart = tailStart + TAIL_DURATION + FULL_LOGO_HOLD;
      const totalDuration = dissolveStart + DISSOLVE_DURATION;

      function render(now) {
        if (currentPlayback !== playbackId || !overlay) return;

        if (reducedMotion.matches) {
          if (!playReducedIntro(introLogo, startTime, now)) {
            animationFrame = requestAnimationFrame(render);
          }
          return;
        }

        const elapsed = now - startTime;
        const lineProgress = clamp((elapsed - lineStart) / LINE_DURATION);
        const tailProgress = clamp((elapsed - tailStart) / TAIL_DURATION);
        const dissolveProgress = smoothStep((elapsed - dissolveStart) / DISSOLVE_DURATION);

        setLogoProgress(introLogo, lineProgress, tailProgress, finalLineScale, finalPShift);
        if (elapsed >= dissolveStart) document.body.classList.add('site-intro-dissolving');
        overlay.style.opacity = (1 - dissolveProgress).toFixed(4);
        overlay.style.filter = `blur(${(8 * dissolveProgress).toFixed(3)}px)`;
        overlay.style.transform = `scale(${(1 + 0.015 * dissolveProgress).toFixed(5)})`;

        if (elapsed >= totalDuration) {
          finishIntro(introLogo);
          return;
        }

        animationFrame = requestAnimationFrame(render);
      }

      animationFrame = requestAnimationFrame(render);
    });
  }

  function scheduleIntro() {
    playIntro();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleIntro, { once: true });
  } else {
    scheduleIntro();
  }

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) scheduleIntro();
  });
  window.addEventListener('pagehide', () => {
    preparePageHideCover();
  });
})();
