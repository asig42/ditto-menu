const form = $('editor');
let category = 'food';
let selected = null;
let restoreId = null;
let reordering = false;
const stateLabels = {public:'공개 중',hidden:'숨김',draft:'초안'};
function action(label, handler) {
  const el = node('button', label);
  el.type = 'button';
  el.addEventListener('click', handler);
  return el;
}
function commit(next, message) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    $('status').textContent = '저장하지 못했습니다. 브라우저의 저장 설정을 확인해 주세요.';
    return false;
  }
  records = next;
  $('status').textContent = message;
  renderAdmin();
  return true;
}
function toggle(row, state) {
  if (commit(records.map(entry => entry.id === row.id ? {...entry, state} : entry),
    state === 'hidden' ? '손님 메뉴에서 내렸습니다.' : '손님 메뉴에 공개했습니다.')) {
    restoreId = state === 'hidden' ? row.id : null;
    $('undo').hidden = !restoreId;
  }
}
function move(row, step) {
  const inCategory = records.filter(entry => entry.category === category);
  const neighbor = inCategory[inCategory.indexOf(row) + step];
  if (!neighbor) return;
  const next = [...records];
  const from = records.indexOf(row);
  const to = records.indexOf(neighbor);
  [next[from], next[to]] = [next[to], next[from]];
  commit(next, '표시 순서를 저장했습니다.');
}
function enableDrag(handle, row) {
  handle.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    const source = handle.closest('.admin-row');
    const pointer = event.pointerId;
    let x = event.clientX;
    let y = event.clientY;
    const startY = y;
    let started = false;
    let frame;
    let target;
    let after;
    handle.setPointerCapture(pointer);

    function markTarget() {
      target?.removeAttribute('data-drop');
      target = document.elementFromPoint(x, y)?.closest('.admin-row');
      if (!target || target === source) {
        target = null;
        return;
      }
      const bounds = target.getBoundingClientRect();
      after = y > bounds.top + bounds.height / 2;
      target.dataset.drop = after ? 'after' : 'before';
    }
    function scrollNearEdge() {
      const edge = 48;
      const distance = y < edge ? y - edge : Math.max(0, y - window.innerHeight + edge);
      if (distance) {
        window.scrollBy(0, Math.sign(distance) * Math.min(18, Math.ceil(Math.abs(distance) / 3)));
        markTarget();
      }
      frame = requestAnimationFrame(scrollNearEdge);
    }
    function track(event) {
      if (event.pointerId !== pointer) return;
      x = event.clientX;
      y = event.clientY;
      if (!started && Math.abs(y - startY) < 5) return;
      if (!started) {
        started = true;
        source.classList.add('dragging');
        frame = requestAnimationFrame(scrollNearEdge);
      }
      markTarget();
    }
    function finish(event) {
      if (event.pointerId !== pointer) return;
      if (started && event.type === 'pointerup') {
        x = event.clientX;
        y = event.clientY;
        markTarget();
      }
      const destination = target?.dataset.id;
      source.classList.remove('dragging');
      target?.removeAttribute('data-drop');
      cancelAnimationFrame(frame);
      handle.removeEventListener('pointermove', track);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
      handle.removeEventListener('lostpointercapture', finish);
      if (event.type !== 'pointerup' || !destination) return;
      const next = records.filter(entry => entry.id !== row.id);
      const index = next.findIndex(entry => entry.id === destination);
      if (index < 0) return;
      next.splice(index + Number(after), 0, row);
      if (next.every((entry, index) => entry === records[index])) return;
      commit(next, '표시 순서를 저장했습니다.');
    }
    handle.addEventListener('pointermove', track);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
    handle.addEventListener('lostpointercapture', finish);
  });
}
function renderAdmin() {
  $('admin-nav').replaceChildren();
  for (const [key, label] of categories) {
    const button = action(label, () => {
      category = key;
      selected = null;
      form.hidden = true;
      $('empty-editor').hidden = false;
      reordering = false;
      renderAdmin();
      $('admin-nav').querySelector('[aria-pressed="true"]').focus();
    });
    button.setAttribute('aria-pressed', String(category === key));
    $('admin-nav').append(button);
  }
  const list = $('admin-list');
  list.replaceChildren();
  const rows = records.filter(row => row.category === category);
  $('list-title').textContent = categories.find(([key]) => key === category)[1];
  $('count').textContent = '전체 ' + rows.length + ' · 공개 ' + rows.filter(row => row.state === 'public').length;
  $('reorder').setAttribute('aria-pressed', String(reordering));
  $('reorder').textContent = reordering ? '순서 변경 완료' : '순서 변경';
  $('reorder-help').hidden = !reordering;
  const editing = records.find(row => row.id === selected);
  $('editor-state').textContent = editing ? stateLabels[editing.state] : '새 항목';
  for (const [index, row] of rows.entries()) {
    const el = node('article', '', 'admin-row');
    el.dataset.id = row.id;
    const content = row.live || row.draft;
    const select = action('', () => edit(row));
    select.className = 'row-select';
    select.dataset.id = row.id;
    select.setAttribute('aria-pressed', String(row.id === selected));
    select.append(node('strong', content.name), node('small', [content.price, stateLabels[row.state], row.live && row.draft && '미공개 수정 있음'].filter(Boolean).join(' · ')));
    const controls = node('div', '', 'row-actions');
    if (reordering) {
      const handle = node('span', '⠿', 'drag-handle');
      handle.setAttribute('aria-hidden', 'true');
      enableDrag(handle, row);
      controls.append(handle);
      for (const [step, symbol, name] of [[-1,'↑','순서 위로'],[1,'↓','순서 아래로']]) {
        const button = action(symbol, () => move(row, step));
        button.setAttribute('aria-label', content.name + ' ' + name);
        button.disabled = !rows[index + step];
        controls.append(button);
      }
    } else {
      if (row.state === 'public') controls.append(action('내리기', () => toggle(row, 'hidden')));
      if (row.state === 'hidden') controls.append(action('다시 공개', () => toggle(row, 'public')));
    }
    el.append(select, controls);
    list.append(el);
  }
}
function edit(row) {
  selected = row?.id ?? null;
  const content = row?.draft || row?.live;
  form.reset();
  for (const key of ['name','english','price','detail']) {
    form.elements[key].value = content?.[key] ?? '';
  }
  form.elements.englishDetail.value = row ? englishDetailFor(row.id, content) ?? '' : '';
  $('editor-title').textContent = row ? content.name : '메뉴 추가';
  $('preview').hidden = true;
  $('empty-editor').hidden = true;
  form.hidden = false;
  renderAdmin();
  form.elements.name.focus();
}
function input() {
  const values = Object.fromEntries(new FormData(form));
  for (const key of Object.keys(values)) values[key] = values[key].trim();
  form.elements.name.setCustomValidity(values.name ? '' : '메뉴명을 입력해 주세요.');
  return values;
}
$('add').onclick = () => edit();
$('reorder').onclick = () => {
  reordering = !reordering;
  renderAdmin();
};
$('close-editor').onclick = () => {
  const previous = selected;
  selected = null;
  form.hidden = true;
  $('empty-editor').hidden = false;
  renderAdmin();
  const target = Array.from($('admin-list').querySelectorAll('.row-select')).find(button => button.dataset.id === previous);
  (target || $('add')).focus();
};
$('undo').onclick = () => {
  const row = records.find(entry => entry.id === restoreId);
  if (row?.state === 'hidden') toggle(row, 'public');
};
form.elements.name.oninput = () => form.elements.name.setCustomValidity('');
$('preview-button').onclick = () => {
  const values = input();
  if (!form.reportValidity()) return;
  $('preview').replaceChildren(item(values));
  $('preview').hidden = false;
};
form.onsubmit = event => {
  event.preventDefault();
  const values = input();
  if (!form.reportValidity()) return;
  const existing = records.find(row => row.id === selected);
  const row = {...(existing ?? {id:Date.now().toString(36), category, state:'draft'})};
  const publish = event.submitter?.value === 'public';
  if (publish) {
    row.live = values;
    row.state = 'public';
    delete row.draft;
  } else row.draft = values;
  const next = existing ? records.map(entry => entry.id === selected ? row : entry) : [...records, row];
  if (commit(next, publish ? '손님 메뉴에 공개했습니다.' : '초안을 저장했습니다.')) {
    selected = row.id;
    $('editor-title').textContent = values.name;
    renderAdmin();
  }
};


renderAdmin();
