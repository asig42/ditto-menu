let activeCategory = 'food';
let loadingMenu = Boolean(window.dittoRuntime?.cloud);
const langStorageKey = 'ditto-menu-lang';

function detectInitialLanguage() {
  try {
    const saved = sessionStorage.getItem(langStorageKey);
    if (saved === 'ko' || saved === 'en') return saved;
  } catch {}
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return languages.map(tag => tag?.toLowerCase().split('-')[0])
    .find(tag => tag === 'ko' || tag === 'en') ?? 'en';
}

let language = detectInitialLanguage();

const copy = {
  ko: {
    title: 'DITTO 부산 · 메뉴',
    introLabel: '디토 소개',
    arrowLabel: '디토 소개 보기',
    skipMenu: '메뉴 바로가기',
    next: '메뉴 보기',
    navLabel: '메뉴 카테고리',
    langLabel: '언어 선택',
    tagline: '부산 페어링 전문 와인바',
    loading: '메뉴를 불러오고 있습니다.',
    empty: '현재 공개된 메뉴가 없습니다.',
    error: '메뉴를 불러오지 못했습니다. 새로고침하거나 직원에게 문의해 주세요.',
    introHtml: [
      '디토는 부산의 페어링 전문 와인바입니다<br>요리는 발효와 숙성을 주제로 합니다',
      '미슐랭2스타 헤드소믈리에 출신<br>15년 경력의 “김형준 소믈리에”가<br>전반적인 페어링을 책임지고 있으며',
      '“윤수영 셰프”가 이에 어울리는<br>요리를 준비하고 있습니다',
      '손님과의 소통을 바탕으로<br>가장 완벽한 한 잔과 한 접시를<br>제안드립니다',
      '방문해 주셔서 감사합니다'
    ],
    notes: {
      bottle: categories.find(([key]) => key === 'bottle')[3],
      glass: categories.find(([key]) => key === 'glass')[3]
    }
  },
  en: {
    title: 'DITTO Busan · Menu',
    introLabel: 'About DITTO',
    arrowLabel: 'About DITTO',
    skipMenu: 'Skip to menu',
    next: 'View menu',
    navLabel: 'Menu categories',
    langLabel: 'Language',
    tagline: 'Pairing Wine Bar · Busan',
    loading: 'Loading menu...',
    empty: 'No items are currently available.',
    error: 'Unable to load the menu. Please refresh or ask our staff.',
    introText: [
      'DITTO is a wine bar in Busan specializing in pairings. Our cooking centers on fermentation and aging.',
      'Sommelier Kim Hyeong-jun leads our pairings. He brings 15 years of experience and previously served as head sommelier at a two-Michelin-starred restaurant.',
      'Chef Yun Su-yeong prepares dishes to complement the wines.',
      'We talk with each guest to find the right glass and plate for them.',
      'Thank you for visiting.'
    ],
    notes: {
      bottle: 'Our sommelier recommends a bottle based on your dishes and preferences. Bottle wines are available by recommendation.',
      glass: 'Our by-the-glass selection changes daily. Please ask us what we are pouring today.'
    }
  }
};

function updateNavFades() {
  const nav = $('menu-nav');
  const track = $('nav-track');
  if (!nav || !track) return;
  const maxScroll = nav.scrollWidth - nav.clientWidth;
  track.classList.toggle('has-left', nav.scrollLeft > 4);
  track.classList.toggle('has-right', maxScroll - nav.scrollLeft > 4);
}

function scrollActiveTabIntoView(activeLink) {
  const nav = $('menu-nav');
  if (!nav || !activeLink) return;
  const targetLeft = activeLink.offsetLeft - (nav.clientWidth - activeLink.offsetWidth) / 2;
  const clamped = Math.max(0, Math.min(targetLeft, nav.scrollWidth - nav.clientWidth));
  nav.scrollTo({left: clamped, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
}

function highlight(shouldScrollNav = false) {
  let activeLink = null;
  for (const link of $('menu-nav').children) {
    if (link.hash === '#' + activeCategory) {
      link.setAttribute('aria-current', 'location');
      activeLink = link;
    } else {
      link.removeAttribute('aria-current');
    }
  }
  if (shouldScrollNav && activeLink) scrollActiveTabIntoView(activeLink);
}

function applyLanguageChrome() {
  const english = language === 'en';
  const strings = copy[language];
  document.documentElement.lang = language;
  document.title = strings.title;
  document.querySelectorAll('#intro p').forEach((paragraph, index) => {
    paragraph.replaceChildren();
    if (english) {
      paragraph.textContent = strings.introText[index];
    } else {
      const lines = strings.introHtml[index].split('<br>');
      lines.forEach((line, lineIndex) => {
        if (lineIndex > 0) paragraph.append(document.createElement('br'));
        paragraph.append(document.createTextNode(line));
      });
    }
  });
  $('intro').setAttribute('aria-label', strings.introLabel);
  document.querySelector('.arrow').setAttribute('aria-label', strings.arrowLabel);
  document.querySelector('.skip-menu').textContent = strings.skipMenu;
  document.querySelector('.next').textContent = strings.next;
  $('menu-nav').setAttribute('aria-label', strings.navLabel);
  $('footer-tagline').textContent = strings.tagline;
  document.querySelectorAll('.lang-switch').forEach(group => {
    group.setAttribute('aria-label', strings.langLabel);
  });
  document.querySelectorAll('.lang-switch button').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.lang === language));
  });
}

function setLanguage(nextLanguage) {
  if (nextLanguage !== 'ko' && nextLanguage !== 'en') return;
  if (nextLanguage === language) return;
  language = nextLanguage;
  try { sessionStorage.setItem(langStorageKey, language); } catch {}
  applyLanguageChrome();
  renderGuest();
}

function renderEntries(container, rows) {
  const entries = node('div', '', 'entries');
  for (const row of rows) {
    entries.append(item({...row.live, englishDetail: englishDetailFor(row.id, row.live)}, language, row.state));
  }
  container.append(entries);
}

function renderGuest() {
  const english = language === 'en';
  const strings = copy[language];
  $('menu-list').replaceChildren();
  $('menu-nav').replaceChildren();
  for (const [key, label, heading, note] of categories) {
    const link = node('a', english ? heading : label);
    link.href = '#' + key;
    $('menu-nav').append(link);
    const section = node('section', '', 'category category--' + key);
    section.id = key;
    section.append(node('h2', heading));
    if (note) section.append(node('p', strings.notes[key] || note, 'note'));
    if (loadingMenu) {
      const skeleton = node('div', '', 'loading-skeleton');
      skeleton.setAttribute('aria-busy', 'true');
      skeleton.append(
        node('p', strings.loading, 'note'),
        node('div', '', 'skeleton-bar mid'),
        node('div', '', 'skeleton-bar short')
      );
      section.append(skeleton);
    } else {
      const visible = records.filter(row => row.category === key && (row.state === 'public' || row.state === 'soldout'));
      if (!visible.length) {
        section.append(node('p', strings.empty, 'note'));
      } else if (key === 'food') {
        const grouped = new Map(foodGroups.map(([groupKey]) => [groupKey, []]));
        const ungrouped = [];
        for (const row of visible) {
          if (row.group && grouped.has(row.group)) grouped.get(row.group).push(row);
          else ungrouped.push(row);
        }
        const activeGroups = foodGroups.filter(([groupKey]) => grouped.get(groupKey).length > 0);
        if (activeGroups.length > 1) {
          for (const [groupKey] of activeGroups) {
            const sub = node('div', '', 'subgroup');
            sub.append(node('h3', foodGroupLabel(groupKey, language), 'subgroup-title'));
            renderEntries(sub, grouped.get(groupKey));
            section.append(sub);
          }
          if (ungrouped.length) {
            const sub = node('div', '', 'subgroup');
            renderEntries(sub, ungrouped);
            section.append(sub);
          }
        } else {
          renderEntries(section, visible);
        }
      } else {
        renderEntries(section, visible);
      }
    }
    $('menu-list').append(section);
  }
  highlight(false);
  requestAnimationFrame(updateNavFades);
}

function syncActiveCategory() {
  const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
  let current = 'food';
  if (nearBottom) {
    current = categories[categories.length - 1][0];
  } else {
    const matched = categories.findLast(([key]) => {
      const el = $(key);
      return el && el.getBoundingClientRect().top < 110;
    });
    current = matched?.[0] ?? 'food';
  }
  if (current !== activeCategory) {
    activeCategory = current;
    highlight(true);
  }
}

window.addEventListener('scroll', syncActiveCategory, {passive: true});
$('menu-nav').addEventListener('scroll', updateNavFades, {passive: true});
window.addEventListener('resize', updateNavFades, {passive: true});

document.querySelectorAll('.lang-switch button').forEach(button => {
  button.addEventListener('click', () => setLanguage(button.dataset.lang));
});

const landing = document.querySelector('.landing');
const intro = $('intro');
const atLanding = () => window.scrollY <= 2;
const showIntro = () => intro.scrollIntoView({block: 'start'});

// Keep trackpad momentum from carrying the first gesture past the intro.
let wheelGesture;
window.addEventListener('wheel', event => {
  if (event.ctrlKey || event.deltaY <= Math.abs(event.deltaX)) return;
  if (!wheelGesture && !atLanding()) return;
  if (!event.cancelable) return;
  event.preventDefault();
  if (!wheelGesture) showIntro();
  clearTimeout(wheelGesture);
  wheelGesture = setTimeout(() => { wheelGesture = undefined; }, 260);
}, {passive: false});

let swipe;
landing.addEventListener('touchstart', event => {
  const touch = event.touches[0];
  swipe = atLanding() && event.touches.length === 1
    ? {x: touch.clientX, y: touch.clientY, advanced: false}
    : undefined;
}, {passive: true});
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
}, {passive: false});

if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => {
    for (const [index, entry] of entries.filter(entry => entry.isIntersecting).entries()) {
      observer.unobserve(entry.target);
      setTimeout(() => entry.target.classList.remove('waiting'), index * 180);
    }
  }, {threshold: .35});
  for (const paragraph of document.querySelectorAll('.intro p')) {
    paragraph.classList.add('waiting');
    observer.observe(paragraph);
  }
}

async function loadCloudMenu() {
  try {
    const response = await fetch('/api/menu', {cache: 'no-store'});
    if (!response.ok) throw new Error('menu unavailable');
    const fetched = await response.json();
    records = normalizeRecords(fetched) || [];
    loadingMenu = false;
    renderGuest();
    $('menu-error').textContent = '';
  } catch {
    loadingMenu = false;
    renderGuest();
    $('menu-error').textContent = copy[language].error;
  }
}

applyLanguageChrome();
if (window.dittoRuntime?.cloud) {
  records = [];
  loadCloudMenu();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadCloudMenu();
  });
}
renderGuest();
if (location.hash) requestAnimationFrame(() => $(location.hash.slice(1))?.scrollIntoView());
window.addEventListener('storage', event => {
  if (window.dittoRuntime?.cloud) return;
  if (event.key !== storageKey && event.key !== null) return;
  records = event.newValue ? (parseStoredRecords(event.newValue) ?? initial) : initial;
  renderGuest();
});
