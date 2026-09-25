(() => {
  const tailStageEnd = 110;
  const animationEnd = 200;
  const followTimeConstant = 110;
  const logoFollowMaxX = 3.2;
  const logoFollowMaxY = 2.1;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let controller = null;
  let initFrame = 0;

  function clamp(value) {
    return Math.max(0, Math.min(1, value));
  }

  function createLogoController() {
    const logo = document.querySelector('.site-logo');
    if (!logo) return { destroy() {} };

    const brand = logo.closest('.brand');
    const brandMotion = logo.closest('.brand-motion');
    const logos = [logo, ...brandMotion.querySelectorAll('.site-logo--contrast')];
    let targetProgress = clamp(window.scrollY / animationEnd);
    let currentProgress = targetProgress;
    let animationFrame = 0;
    let lastFrameTime = 0;
    let finalLineScale = 1;
    let finalPShift = 0;
    let hoverAnimationFrame = 0;
    let hoverLastFrameTime = 0;
    let followX = 0;
    let followY = 0;
    let followTargetX = 0;
    let followTargetY = 0;

    function smoothStep(value) {
      return value * value * (3 - 2 * value);
    }

    function refreshGeometry() {
      const d = logo.querySelector('.logo-d');
      const line = logo.querySelector('.logo-rule');
      const dWidth = d?.getBBox().width;
      const lineWidth = line?.getBBox().width;

      if (!dWidth || !lineWidth) return;
      finalLineScale = dWidth / lineWidth;
      finalPShift = -(lineWidth - dWidth);
      render(currentProgress);
    }

    function render(progress) {
      const scrollPosition = clamp(progress) * animationEnd;
      const tailProgress = smoothStep(clamp(scrollPosition / tailStageEnd));
      const compactProgress = smoothStep(clamp(
        (scrollPosition - tailStageEnd) / (animationEnd - tailStageEnd)
      ));
      const lineScale = 1 - (1 - finalLineScale) * compactProgress;
      const pShift = finalPShift * compactProgress;

      logos.forEach((layer) => {
        layer.style.setProperty('--logo-tail-shift', `${(-56 * tailProgress).toFixed(3)}px`);
        layer.style.setProperty('--logo-tail-opacity', (1 - tailProgress).toFixed(4));
        layer.style.setProperty('--logo-tail-blur', `${(2 * tailProgress).toFixed(3)}px`);
        layer.style.setProperty('--logo-line-scale', lineScale.toFixed(5));
        layer.style.setProperty('--logo-p-shift', `${pShift.toFixed(3)}px`);
      });
    }

    function getTargetProgress() {
      return clamp(window.scrollY / animationEnd);
    }

    function animate(now) {
      const deltaTime = lastFrameTime ? Math.min(64, now - lastFrameTime) : 16.67;
      lastFrameTime = now;

      if (reducedMotion.matches) {
        currentProgress = targetProgress;
      } else {
        const smoothing = 1 - Math.exp(-deltaTime / followTimeConstant);
        currentProgress += (targetProgress - currentProgress) * smoothing;
      }

      if (Math.abs(targetProgress - currentProgress) < 0.0005) {
        currentProgress = targetProgress;
      }

      render(currentProgress);

      if (currentProgress !== targetProgress) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        animationFrame = 0;
        lastFrameTime = 0;
      }
    }

    function requestAnimation() {
      targetProgress = getTargetProgress();

      if (reducedMotion.matches) {
        currentProgress = targetProgress;
        render(currentProgress);
        return;
      }

      if (!animationFrame) animationFrame = requestAnimationFrame(animate);
    }

    function handleReducedMotionChange() {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      lastFrameTime = 0;
      targetProgress = getTargetProgress();
      currentProgress = targetProgress;
      render(currentProgress);
    }

    function handleResize() {
      refreshGeometry();
    }

    function renderLogoFollow() {
      if (!brandMotion) return;
      brandMotion.style.setProperty('--logo-follow-x', `${followX.toFixed(3)}px`);
      brandMotion.style.setProperty('--logo-follow-y', `${followY.toFixed(3)}px`);
    }

    function animateLogoFollow(now) {
      const deltaTime = hoverLastFrameTime ? Math.min(40, now - hoverLastFrameTime) : 16.67;
      hoverLastFrameTime = now;
      const follow = 1 - Math.pow(1 - 0.22, deltaTime / 16.67);

      followX += (followTargetX - followX) * follow;
      followY += (followTargetY - followY) * follow;

      if (Math.abs(followTargetX - followX) < 0.02) followX = followTargetX;
      if (Math.abs(followTargetY - followY) < 0.02) followY = followTargetY;
      renderLogoFollow();

      if (followX !== followTargetX || followY !== followTargetY) {
        hoverAnimationFrame = requestAnimationFrame(animateLogoFollow);
      } else {
        hoverAnimationFrame = 0;
        hoverLastFrameTime = 0;
      }
    }

    function requestLogoFollow() {
      if (reducedMotion.matches || window.innerWidth <= 760) {
        followX = 0;
        followY = 0;
        followTargetX = 0;
        followTargetY = 0;
        renderLogoFollow();
        return;
      }

      if (!hoverAnimationFrame) {
        hoverAnimationFrame = requestAnimationFrame(animateLogoFollow);
      }
    }

    function updateLogoFollow(event) {
      if (!brand || event.pointerType === 'touch') return;
      const bounds = brand.getBoundingClientRect();
      const normalizedX = Math.max(-1, Math.min(1,
        (event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width / 2)
      ));
      const normalizedY = Math.max(-1, Math.min(1,
        (event.clientY - (bounds.top + bounds.height / 2)) / (bounds.height / 2)
      ));
      followTargetX = normalizedX * logoFollowMaxX;
      followTargetY = normalizedY * logoFollowMaxY;
      requestLogoFollow();
    }

    function resetLogoFollow() {
      followTargetX = 0;
      followTargetY = 0;
      requestLogoFollow();
    }

    render(currentProgress);
    refreshGeometry();
    renderLogoFollow();
    window.addEventListener('scroll', requestAnimation, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    reducedMotion.addEventListener('change', handleReducedMotionChange);
    brand?.addEventListener('pointerenter', updateLogoFollow, { passive: true });
    brand?.addEventListener('pointermove', updateLogoFollow, { passive: true });
    brand?.addEventListener('pointerleave', resetLogoFollow, { passive: true });
    brand?.addEventListener('pointercancel', resetLogoFollow, { passive: true });

    return {
      destroy() {
        window.removeEventListener('scroll', requestAnimation);
        window.removeEventListener('resize', handleResize);
        reducedMotion.removeEventListener('change', handleReducedMotionChange);
        brand?.removeEventListener('pointerenter', updateLogoFollow);
        brand?.removeEventListener('pointermove', updateLogoFollow);
        brand?.removeEventListener('pointerleave', resetLogoFollow);
        brand?.removeEventListener('pointercancel', resetLogoFollow);
        cancelAnimationFrame(animationFrame);
        cancelAnimationFrame(hoverAnimationFrame);
      }
    };
  }

  function initializeLogo() {
    controller?.destroy();
    controller = createLogoController();
  }

  function scheduleLogoInitialization() {
    cancelAnimationFrame(initFrame);
    initFrame = requestAnimationFrame(() => {
      initFrame = 0;
      initializeLogo();
    });
  }

  function destroyLogo() {
    cancelAnimationFrame(initFrame);
    initFrame = 0;
    controller?.destroy();
    controller = null;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleLogoInitialization, { once: true });
  } else {
    scheduleLogoInitialization();
  }

  window.addEventListener('pageshow', () => {
    if (!controller) scheduleLogoInitialization();
  });
  window.addEventListener('pagehide', destroyLogo);
})();
