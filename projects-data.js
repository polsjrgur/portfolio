window.portfolioProjects = {
  soultube: {
    title: 'Soultube',
    category: 'Digital product / Art direction',
    description: 'A music application concept that turns listening patterns into emotional spaces people can explore and share.',
    image: './assets/work-soultube.png',
    url: './soultube/'
  },
  harmony: {
    title: 'False Harmony',
    category: 'Installation / Visual narrative',
    description: 'An installation-led visual narrative exploring care, repetition and the tension between closeness and emotional distance.',
    image: './assets/work-harmony.png',
    url: './false-harmony/'
  },
  safe: {
    title: 'Safe?',
    category: 'Editorial / Illustration',
    description: 'A visual study of protection and restriction, asking when safety supports growth and when it begins to limit it.',
    image: './assets/work-safe.png',
    url: './safe/'
  },
  designjob: {
    title: 'Design Job',
    category: 'Exhibition / Editorial identity',
    description: 'A restrained exhibition identity built through precise typography, printed matter and a modular geometric language.',
    image: './assets/work-design-job.png'
  },
  cloudcoffee: {
    title: 'Cloud Coffee',
    category: 'Brand identity / Campaign',
    description: 'A tactile coffee identity combining local landscape, expressive typography and surreal product imagery.',
    image: './assets/work-cloud-coffee.png',
    url: './cloud-coffee/'
  },
  yiguo: {
    title: 'Yi Grow',
    category: 'Education / Brand communication',
    description: 'A bold campaign for an art education space, pairing direct information design with a memorable graphic symbol.',
    image: './assets/work-yiguo.png'
  },
  untitled: {
    title: 'The Digital of Dan Role',
    category: 'Visual design / Experimental',
    description: 'An experimental visual project developed through composition, image making and a tightly controlled graphic system.',
    image: './mr-wu/assets/packaging/collection-claw-vertical.png',
    url: './mr-wu/'
  },
  harmonyis: {
    title: 'Harmony Is...',
    category: 'Poster Design / Visual Communication',
    description: 'A three-poster series that reopens the traditional idea of harmony through fragmented characters, human movement and the changing trajectories of relationships.',
    image: './assets/work-harmony-is.jpg',
    url: './harmony-is/'
  },
  travelingsoap: {
    title: 'Traveling Soap',
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
