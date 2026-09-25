window.portfolioProjects = {
  soultube: {
    title: 'Soultube',
    filterCategory: 'ui-ux',
    category: 'Digital product / Art direction',
    description: 'A music application concept that turns listening patterns into emotional spaces people can explore and share.',
    image: './assets/work-soultube.png',
    url: './soultube/'
  },
  harmony: {
    title: 'False Harmony',
    filterCategory: 'poster',
    category: 'Installation / Visual narrative',
    projectsSubtitle: 'Selected · JAGDA International Student Poster Award 2026',
    description: 'An installation-led visual narrative exploring care, repetition and the tension between closeness and emotional distance.',
    image: './assets/work-harmony.png',
    url: './false-harmony/'
  },
  safe: {
    title: 'Safe',
    filterCategory: 'poster',
    category: 'Editorial / Illustration',
    projectsSubtitle: 'Selected · JAGDA International Student Poster Award 2025',
    description: 'A visual study of protection and restriction, asking when safety supports growth and when it begins to limit it.',
    image: './assets/work-safe.png',
    url: './safe/'
  },
  designjob: {
    title: 'Design Job',
    filterCategory: 'typography-editorial',
    category: 'Exhibition / Editorial identity',
    description: 'A restrained exhibition identity built through precise typography, printed matter and a modular geometric language.',
    image: './assets/work-design-job.png'
  },
  cloudcoffee: {
    title: 'Cloud Coffee',
    filterCategory: 'brand',
    category: 'Brand identity / Campaign',
    description: 'A tactile coffee identity combining local landscape, expressive typography and surreal product imagery.',
    image: './assets/work-cloud-coffee.png',
    url: './cloud-coffee/'
  },
  yiguo: {
    title: 'Yi Grow',
    filterCategory: 'brand',
    category: 'Education / Brand communication',
    description: 'A bold campaign for an art education space, pairing direct information design with a memorable graphic symbol.',
    image: './assets/work-yiguo.png'
  },
  untitled: {
    title: 'The Digital of Dan Role',
    filterCategory: 'packaging',
    category: 'Visual design / Experimental',
    description: 'An experimental visual project developed through composition, image making and a tightly controlled graphic system.',
    image: './mr-wu/assets/packaging/collection-claw-vertical.png',
    url: './mr-wu/'
  },
  harmonyis: {
    title: 'Harmony Is...',
    filterCategory: 'poster',
    category: 'Poster Design / Visual Communication',
    projectsSubtitle: 'Selected – Exhibition Only · JAGDA International Student Poster Award 2026',
    description: 'A three-poster series that reopens the traditional idea of harmony through fragmented characters, human movement and the changing trajectories of relationships.',
    image: './assets/work-harmony-is.jpg',
    url: './harmony-is/'
  },
  travelingsoap: {
    title: 'Traveling Soap',
    filterCategory: 'packaging',
    category: 'Packaging Design / Visual Identity',
    description: 'This project explores soap packaging inspired by aromatic ingredients rooted in different regions of Japan, with the aim of evoking memories associated with each place through scent.',
    image: './traveling-soap/assets/soap-cover.jpg',
    url: './traveling-soap/'
  }
};

const portfolioProjectList = Object.values(window.portfolioProjects);
portfolioProjectList.forEach((project, index) => {
  const current = String(index + 1).padStart(2, '0');
  const total = String(portfolioProjectList.length).padStart(2, '0');
  project.number = `Project ${current} / ${total}`;
});
