(() => {
  const base = new URL('../', document.baseURI);
  const grid = document.querySelector('.projects-grid');
  const dialog = document.querySelector('.project-dialog');
  const projects = Object.values(window.portfolioProjects);
  document.querySelector('.projects-count').textContent = `${String(projects.length).padStart(2, '0')} projects`;

  projects.forEach((project) => {
    const item = document.createElement(project.url ? 'a' : 'button');
    item.className = 'projects-item';
    if (project.url) item.href = new URL(project.url, base).href;
    else item.type = 'button';

    const figure = document.createElement('figure');
    figure.className = 'projects-item__media media-reveal';
    const image = document.createElement('img');
    image.src = new URL(project.image, base).href;
    image.alt = `${project.title} project cover`;
    image.loading = 'lazy';
    image.decoding = 'async';
    figure.append(image);

    const number = document.createElement('span');
    number.className = 'projects-item__number';
    number.textContent = project.number;
    const title = document.createElement('span');
    title.className = 'projects-item__title';
    title.textContent = project.title;
    const category = document.createElement('span');
    category.className = 'projects-item__category';
    category.textContent = project.category;
    item.append(figure, number, title, category);
    grid.append(item);

    if (!project.url) {
      item.addEventListener('click', () => {
        const dialogImage = dialog.querySelector('.dialog-art img');
        dialogImage.src = image.src;
        dialogImage.alt = image.alt;
        dialog.querySelector('.dialog-number').textContent = project.number;
        dialog.querySelector('h2').textContent = project.title;
        dialog.querySelector('.dialog-category').textContent = project.category;
        dialog.querySelector('.dialog-description').textContent = project.description;
        dialog.querySelector('.dialog-project-link').hidden = true;
        dialog.showModal();
      });
    }
  });

  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
})();
