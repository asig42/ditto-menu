const form = $('editor');
let category = 'food';
let selected = null;
let undoSnapshot = null;
let reordering = false;
let reorderDraft = null;
let editorSnapshot = '';
let pendingDelete = false;
const stateLabels = {public:'공개 중',soldout:'품절',hidden:'숨김',draft:'초안'};

// Populate category & food group selects
for (const [key, label] of categories) {
  const option = document.createElement('option');
  option.value = key;
  option.textContent = label;
  form.elements.category.append(option);
}
for (const [key, label] of foodGroups) {
  const option = document.createElement('option');
  option.value = key;
  option.textContent = label;
  form.elements.group.append(option);
}

function action(label, handler, className) {
  const el = node('button', label, className);
  el.type = 'button';
  el.addEventListener('click', handler);
  return el;
}

function activeRecords() {
  return reordering && reorderDraft ? reorderDraft : records;
}

function currentFormSnapshot() {
  return JSON.stringify({
    name: form.elements.name.value,
    english: form.elements.english.value,
    category: form.elements.category.value,
    group: form.elements.group.value,
    price: form.elements.price.value,
    detail: form.elements.detail.value,
    englishDetail: form.elements.englishDetail.value
  });
}

function isDirty() {
  return !form.hidden && editorSnapshot !== '' && currentFormSnapshot() !== editorSnapshot;
}

function confirmDiscardIfDirty() {
  if (!isDirty()) return true;
  return window.confirm('저장하지 않은 수정 내용이 있습니다. 이동할까요?');
}

function syncGroupVisibility() {
  const isFood = form.elements.category.value === 'food';
  $('group-field').hidden = !isFood;
}

function resetDeleteConfirm() {
  pendingDelete = false;
  const btn = $('delete-item');
  if (btn) {
    btn.textContent = '메뉴 삭제';
    btn.removeAttribute('data-confirm');
  }
}

function setUndo(snapshot) {
  undoSnapshot = snapshot;
  $('undo').hidden = !undoSnapshot;
}

let saving = false;
async function commit(next, message, {allowUndo = false} = {}) {
  if (saving) return false;
  const before = records;
  saving = true;
  const adminEl = $('admin');
  adminEl.inert = true;
  adminEl.dataset.saving = 'true';
  try {
    if (window.dittoRuntime?.cloud) await window.dittoCloud.save(next);
    else localStorage.setItem(storageKey, JSON.stringify(next));
  } catch (error) {
    $('status').textContent = error.message || '저장하지 못했습니다. 다시 시도해 주세요.';
    return false;
  } finally {
    adminEl.inert = false;
    delete adminEl.dataset.saving;
    saving = false;
  }
  records = next;
  setUndo(allowUndo ? {records: before} : null);
  $('status').textContent = message;
  renderAdmin();
  return true;
}

async function toggle(row, state) {
  const messages = {
    hidden: '손님 메뉴에서 내렸습니다.',
    soldout: '품절로 표시했습니다.',
    public: row.state === 'soldout' ? '판매를 재개했습니다.' : '손님 메뉴에 공개했습니다.'
  };
  await commit(
    records.map(entry => entry.id === row.id ? {...entry, state} : entry),
    messages[state] || '상태를 변경했습니다.',
    {allowUndo: state === 'hidden' || state === 'soldout'}
  );
}

function rowsInSameScope(list, row) {
  if (row.category === 'food') {
    const g = row.group || 'warm';
    return list.filter(entry => entry.category === 'food' && (entry.group || 'warm') === g);
  }
  return list.filter(entry => entry.category === row.category);
}

function moveLocal(row, step) {
  if (!reordering || !reorderDraft) return;
  const scoped = rowsInSameScope(reorderDraft, row);
  const idx = scoped.findIndex(entry => entry.id === row.id);
  const neighbor = scoped[idx + step];
  if (!neighbor) return;
  const next = [...reorderDraft];
  const from = next.findIndex(entry => entry.id === row.id);
  const to = next.findIndex(entry => entry.id === neighbor.id);
  [next[from], next[to]] = [next[to], next[from]];
  reorderDraft = next;
  renderAdmin();
  const sameBtn = $('admin-list').querySelector(`button[data-move-id="${row.id}"][data-step="${step}"]`);
  const altBtn = $('admin-list').querySelector(`button[data-move-id="${row.id}"][data-step="${-step}"]`);
  if (sameBtn && !sameBtn.disabled) sameBtn.focus();
  else if (altBtn && !altBtn.disabled) altBtn.focus();
}

function enableDrag(handle, row) {
  handle.addEventListener('pointerdown', event => {
    if (saving || !reordering || !reorderDraft) return;
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    const source = handle.closest('.admin-row');
    const sourceScope = source.dataset.scope;
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
      const candidate = document.elementFromPoint(x, y)?.closest('.admin-row');
      if (!candidate || candidate === source || candidate.dataset.scope !== sourceScope) {
        target = null;
        return;
      }
      target = candidate;
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
      const next = reorderDraft.filter(entry => entry.id !== row.id);
      const index = next.findIndex(entry => entry.id === destination);
      if (index < 0) return;
      next.splice(index + Number(after), 0, row);
      if (next.every((entry, idx) => entry === reorderDraft[idx])) return;
      reorderDraft = next;
      renderAdmin();
    }
    handle.addEventListener('pointermove', track);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
    handle.addEventListener('lostpointercapture', finish);
  });
}

function renderRow(row, scopedRows, index, scopeKey) {
  const el = node('article', '', 'admin-row');
  el.dataset.id = row.id;
  el.dataset.scope = scopeKey;
  const content = row.live || row.draft;
  const select = action('', () => {
    if (reordering) return;
    if (row.id !== selected && !confirmDiscardIfDirty()) return;
    edit(row);
  });
  select.className = 'row-select';
  select.dataset.id = row.id;
  select.setAttribute('aria-pressed', String(!reordering && row.id === selected));
  if (reordering) {
    select.disabled = true;
    select.tabIndex = -1;
  }
  const meta = node('div', '', 'row-meta');
  if (content.price) meta.append(node('span', content.price));
  meta.append(node('span', stateLabels[row.state] || row.state, 'badge badge--' + row.state));
  if (row.live && row.draft) meta.append(node('span', '미공개 수정', 'badge badge--pending'));
  select.append(node('strong', content.name), meta);

  const controls = node('div', '', 'row-actions');
  if (reordering) {
    const handle = node('span', '⠿', 'drag-handle');
    handle.setAttribute('aria-hidden', 'true');
    enableDrag(handle, row);
    controls.append(handle);
    for (const [step, symbol, name] of [[-1,'↑','순서 위로'],[1,'↓','순서 아래로']]) {
      const button = action(symbol, () => moveLocal(row, step));
      button.dataset.moveId = row.id;
      button.dataset.step = String(step);
      button.setAttribute('aria-label', content.name + ' ' + name);
      button.disabled = !scopedRows[index + step];
      controls.append(button);
    }
  } else {
    if (row.state === 'public') {
      controls.append(action('품절', () => toggle(row, 'soldout'), 'action-soldout'));
      controls.append(action('내리기', () => toggle(row, 'hidden')));
    } else if (row.state === 'soldout') {
      controls.append(action('판매 재개', () => toggle(row, 'public'), 'action-soldout'));
      controls.append(action('내리기', () => toggle(row, 'hidden')));
    } else if (row.state === 'hidden') {
      controls.append(action('다시 공개', () => toggle(row, 'public')));
    }
  }
  el.append(select, controls);
  return el;
}

function renderAdmin() {
  const source = activeRecords();
  $('admin-nav').replaceChildren();
  for (const [key, label] of categories) {
    const button = action(label, () => {
      if (key === category) return;
      if (!confirmDiscardIfDirty()) return;
      if (reordering) {
        reordering = false;
        reorderDraft = null;
      }
      category = key;
      selected = null;
      editorSnapshot = '';
      form.hidden = true;
      $('empty-editor').hidden = false;
      renderAdmin();
      $('admin-nav').querySelector('[aria-pressed="true"]').focus();
    });
    button.setAttribute('aria-pressed', String(category === key));
    $('admin-nav').append(button);
  }
  const list = $('admin-list');
  list.replaceChildren();
  const rows = source.filter(row => row.category === category);
  $('list-title').textContent = categories.find(([key]) => key === category)[1];
  const publicCount = rows.filter(row => row.state === 'public').length;
  const soldoutCount = rows.filter(row => row.state === 'soldout').length;
  $('count').textContent = [
    '전체 ' + rows.length,
    '공개 ' + publicCount,
    soldoutCount ? '품절 ' + soldoutCount : ''
  ].filter(Boolean).join(' · ');
  $('reorder').setAttribute('aria-pressed', String(reordering));
  $('reorder').textContent = reordering ? '순서 변경 완료' : '순서 변경';
  $('reorder-cancel').hidden = !reordering;
  $('add').hidden = reordering;
  $('reorder-help').hidden = !reordering;
  $('undo').hidden = reordering || !undoSnapshot;

  const editing = records.find(row => row.id === selected);
  $('editor-state').textContent = editing ? stateLabels[editing.state] : '새 항목';
  $('danger-actions').hidden = !editing;
  $('discard-draft').hidden = !(editing && editing.live && editing.draft);

  if (category === 'food') {
    for (const [groupKey, groupLabel] of foodGroups) {
      const groupedRows = rows.filter(row => (row.group || 'warm') === groupKey);
      if (!groupedRows.length) continue;
      list.append(node('div', groupLabel, 'admin-group-head'));
      for (const [index, row] of groupedRows.entries()) {
        list.append(renderRow(row, groupedRows, index, 'food:' + groupKey));
      }
    }
  } else {
    for (const [index, row] of rows.entries()) {
      list.append(renderRow(row, rows, index, category));
    }
  }
}

function edit(row) {
  selected = row?.id ?? null;
  const content = row?.draft || row?.live;
  form.reset();
  resetDeleteConfirm();
  for (const key of ['name','english','price','detail']) {
    form.elements[key].value = content?.[key] ?? '';
  }
  form.elements.englishDetail.value = row ? englishDetailFor(row.id, content) ?? '' : '';
  form.elements.category.value = row?.category || category;
  form.elements.group.value = row?.group || 'warm';
  syncGroupVisibility();
  $('editor-title').textContent = row ? content.name : '메뉴 추가';
  $('preview').hidden = true;
  $('empty-editor').hidden = true;
  form.hidden = false;
  editorSnapshot = currentFormSnapshot();
  renderAdmin();
  form.elements.name.focus();
}

function input() {
  const values = {
    name: form.elements.name.value.trim(),
    english: form.elements.english.value.trim(),
    price: form.elements.price.value.trim(),
    detail: form.elements.detail.value.trim(),
    englishDetail: form.elements.englishDetail.value.trim()
  };
  form.elements.name.setCustomValidity(values.name ? '' : '메뉴명을 입력해 주세요.');
  return values;
}

form.elements.category.addEventListener('change', syncGroupVisibility);
form.elements.name.oninput = () => form.elements.name.setCustomValidity('');
form.addEventListener('input', () => {
  if (pendingDelete) resetDeleteConfirm();
});

$('add').onclick = () => {
  if (!confirmDiscardIfDirty()) return;
  edit();
};

$('reorder').onclick = async () => {
  if (!reordering) {
    if (!confirmDiscardIfDirty()) return;
    selected = null;
    editorSnapshot = '';
    form.hidden = true;
    $('empty-editor').hidden = false;
    reordering = true;
    reorderDraft = [...records];
    renderAdmin();
    return;
  }
  const changed = reorderDraft && reorderDraft.some((entry, idx) => entry.id !== records[idx]?.id);
  const next = reorderDraft;
  reordering = false;
  reorderDraft = null;
  if (changed) {
    await commit(next, '표시 순서를 저장했습니다.', {allowUndo: true});
  } else {
    renderAdmin();
  }
};

$('reorder-cancel').onclick = () => {
  reordering = false;
  reorderDraft = null;
  renderAdmin();
};

$('close-editor').onclick = () => {
  if (!confirmDiscardIfDirty()) return;
  const previous = selected;
  selected = null;
  editorSnapshot = '';
  resetDeleteConfirm();
  form.hidden = true;
  $('empty-editor').hidden = false;
  renderAdmin();
  const target = Array.from($('admin-list').querySelectorAll('.row-select')).find(button => button.dataset.id === previous);
  (target || $('add')).focus();
};

$('undo').onclick = async () => {
  if (!undoSnapshot) return;
  const restore = undoSnapshot.records;
  await commit(restore, '이전 상태로 되돌렸습니다.');
};

$('preview-button').onclick = () => {
  const values = input();
  if (!form.reportValidity()) return;
  const existing = records.find(row => row.id === selected);
  const previewState = existing?.state === 'soldout' ? 'soldout' : 'public';
  const koBlock = node('div', '', 'preview-block');
  koBlock.append(node('span', '손님 화면 · KR', 'preview-label'), item(values, 'ko', previewState));
  const enBlock = node('div', '', 'preview-block');
  enBlock.append(node('span', '손님 화면 · EN', 'preview-label'), item(values, 'en', previewState));
  $('preview').replaceChildren(koBlock, enBlock);
  $('preview').hidden = false;
  $('preview').scrollIntoView({block: 'nearest'});
};

$('discard-draft').onclick = async () => {
  const existing = records.find(row => row.id === selected);
  if (!existing || !existing.live || !existing.draft) return;
  const cleaned = {...existing};
  delete cleaned.draft;
  const next = records.map(entry => entry.id === selected ? cleaned : entry);
  if (await commit(next, '미공개 수정을 취소했습니다.')) {
    edit(cleaned);
  }
};

$('delete-item').onclick = async () => {
  const existing = records.find(row => row.id === selected);
  if (!existing) return;
  if (!pendingDelete) {
    pendingDelete = true;
    $('delete-item').textContent = '정말 삭제할까요? (다시 클릭)';
    $('delete-item').dataset.confirm = 'true';
    return;
  }
  const next = records.filter(entry => entry.id !== existing.id);
  const deletedName = (existing.live || existing.draft).name;
  if (await commit(next, `‘${deletedName}’ 메뉴를 삭제했습니다.`, {allowUndo: true})) {
    selected = null;
    editorSnapshot = '';
    resetDeleteConfirm();
    form.hidden = true;
    $('empty-editor').hidden = false;
    renderAdmin();
  }
};

form.onsubmit = async event => {
  event.preventDefault();
  const values = input();
  if (!form.reportValidity()) return;
  const targetCategory = form.elements.category.value;
  const targetGroup = targetCategory === 'food' ? form.elements.group.value : '';
  const existing = records.find(row => row.id === selected);
  const row = {...(existing ?? {id: crypto.randomUUID(), category: targetCategory, state: 'draft'})};
  row.category = targetCategory;
  if (targetCategory === 'food') row.group = targetGroup || 'warm';
  else delete row.group;

  const publish = event.submitter?.value === 'public';
  if (publish) {
    row.live = values;
    row.state = existing?.state === 'soldout' ? 'soldout' : 'public';
    delete row.draft;
  } else {
    row.draft = values;
  }
  const next = existing ? records.map(entry => entry.id === selected ? row : entry) : [...records, row];
  if (await commit(next, publish ? '손님 메뉴에 공개했습니다.' : '초안을 저장했습니다.')) {
    category = targetCategory;
    selected = row.id;
    $('editor-title').textContent = values.name;
    editorSnapshot = currentFormSnapshot();
    resetDeleteConfirm();
    renderAdmin();
  }
};

window.addEventListener('beforeunload', event => {
  if (isDirty()) {
    event.preventDefault();
    event.returnValue = '';
  }
});

renderAdmin();

if (!window.dittoRuntime?.cloud) $('admin').hidden = false;
