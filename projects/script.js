(() => {
  const base = new URL('../', document.baseURI);
  const grid = document.querySelector('.projects-grid');
  const dialog = document.querySelector('.project-dialog');
  const count = document.querySelector('.projects-count');
  const filters = [...document.querySelectorAll('.projects-filter')];
  const orderedProjects = Object.entries(window.portfolioProjects);
  const harmonyIsIndex = orderedProjects.findIndex(([key]) => key === 'harmonyis');
  const safeIndex = orderedProjects.findIndex(([key]) => key === 'safe');
  if (harmonyIsIndex !== -1 && safeIndex !== -1) {
    const [harmonyIs] = orderedProjects.splice(harmonyIsIndex, 1);
    orderedProjects.splice(orderedProjects.findIndex(([key]) => key === 'safe'), 0, harmonyIs);
  }
  const projects = orderedProjects.map(([, project]) => project);
  const entries = [];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  count.textContent = `${String(projects.length).padStart(2, '0')} PROJECTS`;

  projects.forEach((project) => {
    const item = document.createElement(project.url ? 'a' : 'button');
    item.className = 'projects-item';
    if (project.url) item.href = new URL(project.url, base).href;
    else item.type = 'button';

    const figure = document.createElement('figure');
    figure.className = 'projects-item__media';
    const zoom = document.createElement('div');
    zoom.className = 'projects-item__zoom';
    const image = document.createElement('img');
    image.src = new URL(project.image, base).href;
    image.alt = `${project.title} project cover`;
    image.loading = 'lazy';
    image.decoding = 'async';
    zoom.append(image);
    figure.append(zoom);

    const title = document.createElement('span');
    title.className = 'projects-item__title';
    title.textContent = project.title;
    const category = document.createElement('span');
    category.className = 'projects-item__category';
    category.textContent = project.projectsSubtitle || project.category;
    item.append(figure, title, category);
    grid.append(item);
    entries.push({ item, project });

    if (!project.url) {
      item.addEventListener('click', () => {
        const dialogImage = dialog.querySelector('.dialog-art img');
        dialogImage.src = image.src;
        dialogImage.alt = image.alt;
        dialog.querySelector('h2').textContent = project.title;
        dialog.querySelector('.dialog-category').textContent = project.category;
        dialog.querySelector('.dialog-description').textContent = project.description;
        dialog.querySelector('.dialog-project-link').hidden = true;
        dialog.showModal();
        hideCursor();
      });
    }
  });

  let activeFilter = 'all';
  let changeToken = 0;
  let exitTimer;
  let settleTimer;
  let entryFrame;

  function displayFilter(filter) {
    const matching = entries.filter(({ project }) => filter === 'all' || project.filterCategory === filter);
    const startHeight = grid.getBoundingClientRect().height;

    entries.forEach(({ item, project }) => {
      const included = filter === 'all' || project.filterCategory === filter;
      item.hidden = !included;
      item.inert = !included;
      item.classList.remove('is-exiting');
      item.style.removeProperty('--filter-delay');
      if (included) {
        item.classList.add('is-entering');
      } else {
        item.classList.remove('is-entering');
      }
    });

    if (reducedMotion.matches) {
      matching.forEach(({ item }) => item.classList.remove('is-entering'));
      grid.classList.remove('is-resizing', 'is-switching');
      grid.style.removeProperty('height');
      return;
    }

    grid.style.height = 'auto';
    const endHeight = grid.getBoundingClientRect().height;
    grid.style.height = `${startHeight}px`;
    grid.getBoundingClientRect();
    grid.classList.add('is-resizing');
    grid.style.height = `${endHeight}px`;
    matching.forEach(({ item }, index) => {
      item.style.setProperty('--filter-delay', `${index * 60}ms`);
    });

    const token = changeToken;
    entryFrame = requestAnimationFrame(() => {
      if (token !== changeToken) return;
      matching.forEach(({ item }) => item.classList.remove('is-entering'));
    });
    settleTimer = setTimeout(() => {
      if (token !== changeToken) return;
      grid.classList.remove('is-resizing', 'is-switching');
      grid.style.removeProperty('height');
      matching.forEach(({ item }) => item.style.removeProperty('--filter-delay'));
    }, 440 + (matching.length - 1) * 60);
  }

  function selectFilter(filter) {
    if (filter === activeFilter) return;
    activeFilter = filter;
    changeToken += 1;
    clearTimeout(exitTimer);
    clearTimeout(settleTimer);
    cancelAnimationFrame(entryFrame);
    grid.classList.remove('is-resizing');
    grid.style.removeProperty('height');
    entries.forEach(({ item }) => {
      item.classList.remove('is-exiting', 'is-entering');
      item.style.removeProperty('--filter-delay');
    });

    filters.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
    const resultCount = entries.filter(({ project }) => filter === 'all' || project.filterCategory === filter).length;
    count.textContent = `${String(resultCount).padStart(2, '0')} PROJECTS`;

    if (reducedMotion.matches) {
      displayFilter(filter);
      return;
    }

    grid.classList.add('is-switching');
    entries.forEach(({ item }) => {
      if (!item.hidden) {
        item.inert = true;
        item.classList.add('is-exiting');
      }
    });
    const token = changeToken;
    exitTimer = setTimeout(() => {
      if (token === changeToken) displayFilter(filter);
    }, 210);
  }

  filters.forEach((button) => button.addEventListener('click', () => selectFilter(button.dataset.filter)));

  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  const body = document.body;
  const menuButton = document.querySelector('.menu-button');
  const menuPanel = document.querySelector('.menu-panel');
  const cursorPosition = document.querySelector('.cursor-position');
  const cursorVisual = document.querySelector('.cursor-shape');
  const finePointer = window.matchMedia('(any-pointer: fine)');
  const cursorMorph = window.createPortfolioCursorMorph({ body, cursorVisual });
  let targetX = -100;
  let targetY = -100;
  let currentX = -100;
  let currentY = -100;
  let cursorInitialized = false;
  let cursorTarget = null;
  let lastFrame = performance.now();

  function hideCursor() {
    body.classList.remove('cursor-visible');
    cursorTarget = null;
    cursorInitialized = false;
    cursorMorph.reset();
  }

  function setMenuOpen(open) {
    menuButton.setAttribute('aria-expanded', String(open));
    menuPanel.classList.toggle('is-open', open);
    menuPanel.setAttribute('aria-hidden', String(!open));
    body.classList.toggle('menu-open', open);
    if (open) hideCursor();
  }

  menuButton.addEventListener('click', () => setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true'));
  menuPanel.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenuOpen(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenuOpen(false);
  });

  window.addEventListener('pointermove', (event) => {
    if (!body.classList.contains('site-page-ready') || document.hidden || dialog.open
      || body.classList.contains('menu-open') || reducedMotion.matches
      || !finePointer.matches || event.pointerType === 'touch') {
      hideCursor();
      return;
    }

    targetX = event.clientX;
    targetY = event.clientY;
    if (!cursorInitialized) {
      currentX = targetX;
      currentY = targetY;
      cursorInitialized = true;
    }
    const target = event.target instanceof Element
      ? event.target.closest('.brand, .projects-item:not([hidden])')
      : null;
    if (target !== cursorTarget) {
      cursorTarget = target;
      if (target) cursorMorph.enter();
      else cursorMorph.exit();
    }
    body.classList.add('cursor-visible');
  }, { passive: true });

  function animateCursor(now) {
    const dt = Math.min(40, Math.max(0, now - lastFrame));
    lastFrame = now;
    if (cursorInitialized) {
      const follow = 1 - Math.pow(0.78, dt / 16.67);
      currentX += (targetX - currentX) * follow;
      currentY += (targetY - currentY) * follow;
      cursorPosition.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
    cursorMorph.render(dt);
    requestAnimationFrame(animateCursor);
  }

  document.addEventListener('pointerleave', hideCursor);
  window.addEventListener('blur', hideCursor);
  window.addEventListener('pagehide', hideCursor);
  window.addEventListener('siteintro:start', hideCursor);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hideCursor(); });
  reducedMotion.addEventListener('change', hideCursor);
  finePointer.addEventListener('change', hideCursor);
  dialog.addEventListener('close', hideCursor);
  requestAnimationFrame(animateCursor);
})();
