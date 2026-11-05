let activeCategory = 'food';
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
    const link = node('a', label);
    link.href = '#' + key;
    $('menu-nav').append(link);
    const section = node('section', '', 'category');
    section.id = key;
    section.append(node('h2', heading));
    if (note) section.append(node('p', note, 'note'));
    const entries = node('div', '', 'entries');
    const visible = records.filter(row => row.category === key && row.state === 'public');
    for (const row of visible) entries.append(item(row.live));
    if (!visible.length) entries.append(node('p', '현재 공개된 메뉴가 없습니다.', 'note'));
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
