(() => {
  const labels = document.querySelector('.soap-label-grid');
  if (!labels || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(([entry]) => {
    labels.classList.toggle('is-in-view', entry.isIntersecting);
  }, { rootMargin: '0px 0px -10% 0px' });
  observer.observe(labels);

  document.addEventListener('visibilitychange', () => {
    labels.classList.toggle('is-page-hidden', document.hidden);
  });
})();
