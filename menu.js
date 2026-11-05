let activeCategory = 'food';
const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
const language = languages.map(tag => tag?.toLowerCase().split('-')[0])
  .find(tag => tag === 'ko' || tag === 'en') ?? 'en';
const english = language === 'en';
const englishNotes = {
  bottle: 'Our sommelier recommends a bottle based on your dishes and preferences. Bottle wines are available by recommendation.',
  glass: 'Our by-the-glass selection changes daily. Please ask us what we are pouring today.'
};

if (english) {
  document.documentElement.lang = 'en';
  document.title = 'DITTO Busan · Menu';
  const introduction = [
    'DITTO is a wine bar in Busan specializing in pairings. Our cooking centers on fermentation and aging.',
    'Sommelier Kim Hyeong-jun leads our pairings. He brings 15 years of experience and previously served as head sommelier at a two-Michelin-starred restaurant.',
    'Chef Yun Su-yeong prepares dishes to complement the wines.',
    'We talk with each guest to find the right glass and plate for them.',
    'Thank you for visiting.'
  ];
  document.querySelectorAll('#intro p').forEach((paragraph, index) => {
    paragraph.textContent = introduction[index];
  });
  $('intro').setAttribute('aria-label', 'About DITTO');
  document.querySelector('.arrow').setAttribute('aria-label', 'About DITTO');
  document.querySelector('.next').textContent = 'View menu';
  $('menu-nav').setAttribute('aria-label', 'Menu categories');
}
function highlight() {
  for (const link of $('menu-nav').children) {
    if (link.hash === '#' + activeCategory) link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  }
}
function renderGuest() {
  $('menu-list').replaceChildren();
  $('menu-nav').replaceChildren();
  for (const [key, label, heading, note] of categories) {
    const link = node('a', english ? heading : label);
    link.href = '#' + key;
    $('menu-nav').append(link);
    const section = node('section', '', 'category');
    section.id = key;
    section.append(node('h2', heading));
    if (note) section.append(node('p', english ? englishNotes[key] : note, 'note'));
    const entries = node('div', '', 'entries');
    const visible = records.filter(row => row.category === key && row.state === 'public');
    for (const row of visible) {
      entries.append(item({...row.live, englishDetail:englishDetailFor(row.id, row.live)}, language));
    }
    if (!visible.length) entries.append(node('p', english ? 'No items are currently available.' : '현재 공개된 메뉴가 없습니다.', 'note'));
    section.append(entries);
    $('menu-list').append(section);
  }
  highlight();
}
window.addEventListener('scroll', () => {
  const current = categories.findLast(([key]) => $(key).getBoundingClientRect().top < 110)?.[0] ?? 'food';
  if (current !== activeCategory) {
    activeCategory = current;
    highlight();
  }
}, {passive:true});

const landing = document.querySelector('.landing');
const intro = $('intro');
const atLanding = () => window.scrollY <= 2;
const showIntro = () => intro.scrollIntoView({block:'start'});

// Keep trackpad momentum from carrying the first gesture past the intro.
let wheelGesture;
window.addEventListener('wheel', event => {
  if (event.ctrlKey || event.deltaY <= Math.abs(event.deltaX)) return;
  if (!wheelGesture && !atLanding()) return;
  if (!event.cancelable) return;
  event.preventDefault();
  if (!wheelGesture) showIntro();
  clearTimeout(wheelGesture);
  wheelGesture = setTimeout(() => { wheelGesture = undefined; }, 150);
}, {passive:false});

let swipe;
landing.addEventListener('touchstart', event => {
  const touch = event.touches[0];
  swipe = atLanding() && event.touches.length === 1
    ? {x:touch.clientX, y:touch.clientY, advanced:false}
    : undefined;
}, {passive:true});
landing.addEventListener('touchmove', event => {
  if (!swipe || event.touches.length !== 1 || !event.cancelable) return;
  const touch = event.touches[0];
  const distance = swipe.y - touch.clientY;
  if (!swipe.advanced && distance <= Math.abs(touch.clientX - swipe.x)) return;
  event.preventDefault();
  if (!swipe.advanced && distance >= 12) {
    swipe.advanced = true;
    showIntro();
  }
}, {passive:false});

if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => {
    for (const [index, entry] of entries.filter(entry => entry.isIntersecting).entries()) {
      observer.unobserve(entry.target);
      setTimeout(() => entry.target.classList.remove('waiting'), index * 180);
    }
  }, {threshold:.35});
  for (const paragraph of document.querySelectorAll('.intro p')) {
    paragraph.classList.add('waiting');
    observer.observe(paragraph);
  }
}

renderGuest();
if (location.hash) requestAnimationFrame(() => $(location.hash.slice(1))?.scrollIntoView());
window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return;
  records = event.newValue ? JSON.parse(event.newValue) : initial;
  renderGuest();
});
