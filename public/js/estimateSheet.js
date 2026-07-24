// ── Pure utility functions (also exported for Node.js tests) ─────────

function calculateTotal(groups) {
  let total = 0;
  for (const g of groups) {
    for (const t of [...g.tasks, ...g.edgeCases, ...g.testing]) total += t.mandays;
  }
  return Math.round(total * 10) / 10;
}

function csvEscape(value) {
  const s = String(value);
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function tsvEscape(val) {
  return String(val == null ? '' : val).replace(/\t/g, ' ').replace(/\n/g, ' ');
}

function generateCSV(groups) {
  const rows = ['Group,Subgroup,Task,Complexity,Mandays,Notes'];
  for (const g of groups) {
    const push = (label, tasks) =>
      tasks.forEach(t => {
        const notes = Array.isArray(t.notes) ? t.notes.join(' | ') : '';
        rows.push([g.name, label, t.name, t.complexity, t.mandays, notes].map(csvEscape).join(','));
      });
    push('Tasks',      g.tasks);
    push('Edge Cases', g.edgeCases);
    push('Testing',    g.testing);
  }
  return rows.join('\n');
}

function generateClipboardText(groups) {
  const rows = ['Group\tSubgroup\tTask\tComplexity\tMandays\tNotes'];
  for (const g of groups) {
    const push = (label, tasks) =>
      tasks.forEach(t => {
        const notes = Array.isArray(t.notes) ? t.notes.join(' | ') : '';
        rows.push([g.name, label, t.name, t.complexity, t.mandays, notes].map(tsvEscape).join('\t'));
      });
    push('Tasks',      g.tasks);
    push('Edge Cases', g.edgeCases);
    push('Testing',    g.testing);
  }
  return rows.join('\n');
}

// ── DOM helpers ──────────────────────────────────────────────────────

function syncEditsToEstimate() {
  // no-op: edits are synced live to window._currentEstimate via _taskRef on each event
}

// ── DOM rendering ────────────────────────────────────────────────────

function badgeClass(complexity) {
  return complexity === 'Complex' ? 'badge-complex'
       : complexity === 'Medium'  ? 'badge-med'
       : 'badge-low';
}

function recalcTotal() {
  let total = 0;
  document.querySelectorAll('#estimateBody .md-input').forEach(inp => {
    total += parseFloat(inp.value) || 0;
  });
  const el = document.getElementById('grandTotal');
  if (el) el.textContent = (Math.round(total * 10) / 10).toFixed(1);

  // Update per-group subtotals
  document.querySelectorAll('#estimateBody .group').forEach(groupEl => {
    let subtotal = 0;
    groupEl.querySelectorAll('.md-input').forEach(inp => {
      subtotal += parseFloat(inp.value) || 0;
    });
    const span = groupEl.querySelector('.group-subtotal');
    if (span) span.textContent = (Math.round(subtotal * 10) / 10).toFixed(1) + ' md';
  });
}

// Tracks which add-form is currently open so only one is open at a time
let _openAddForm = null;

function collapseOpenAddForm() {
  if (_openAddForm) {
    _openAddForm.style.display = 'none';
    if (_openAddForm._addBtn) _openAddForm._addBtn.style.display = '';
    _openAddForm = null;
  }
}

function buildNotesEditable(task, desc, row) {
  const editable = document.createElement('div');
  editable.className = 'notes-editable';
  editable.contentEditable = 'true';
  const ul = document.createElement('ul');
  (task.notes || []).forEach(note => {
    const li = document.createElement('li');
    li.textContent = note;
    ul.appendChild(li);
  });
  editable.appendChild(ul);
  editable.addEventListener('blur', () => {
    const items = Array.from(editable.querySelectorAll('li'))
      .map(li => li.textContent.trim())
      .filter(Boolean);
    if (items.length === 0) {
      row._taskRef.notes = null;
      desc.classList.remove('has-notes');
      editable.replaceWith(buildNotesPlaceholder(task, desc, row));
    } else {
      row._taskRef.notes = items;
    }
  });
  return editable;
}

function buildNotesPlaceholder(task, desc, row) {
  const placeholder = document.createElement('div');
  placeholder.className = 'notes-placeholder';
  placeholder.textContent = '+ Add notes…';
  placeholder.addEventListener('click', () => {
    task.notes = [];
    desc.classList.add('has-notes');
    const editable = buildNotesEditable(task, desc, row);
    const li = document.createElement('li');
    editable.querySelector('ul').appendChild(li);
    placeholder.replaceWith(editable);
    editable.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.setStart(li, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  });
  return placeholder;
}

function buildAddForm(taskArr, containerEl, addBtn) {
  let selectedComplexity = 'Low';

  const form = document.createElement('div');
  form.className = 'add-form';
  form._addBtn = addBtn;

  const row1 = document.createElement('div');
  row1.className = 'add-form-row';

  const nameInput = document.createElement('input');
  nameInput.className = 'add-form-name';
  nameInput.placeholder = 'Task name…';
  nameInput.type = 'text';

  const badgeGroup = document.createElement('div');
  badgeGroup.className = 'badge-group';
  ['Low', 'Medium', 'Complex'].forEach((level, i) => {
    const b = document.createElement('span');
    b.className = `complexity-badge ${badgeClass(level)}${i !== 0 ? ' dim' : ''}`;
    b.textContent = level;
    b.addEventListener('click', () => {
      selectedComplexity = level;
      badgeGroup.querySelectorAll('.complexity-badge').forEach(el => el.classList.add('dim'));
      b.classList.remove('dim');
    });
    badgeGroup.appendChild(b);
  });

  const mdInput = document.createElement('input');
  mdInput.className = 'add-form-md';
  mdInput.type = 'number';
  mdInput.min = '0.1';
  mdInput.step = 'any';
  mdInput.value = '0.5';

  row1.append(nameInput, badgeGroup, mdInput);

  const actions = document.createElement('div');
  actions.className = 'add-form-actions';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'add-form-confirm';
  confirmBtn.textContent = 'Add';
  confirmBtn.type = 'button';
  confirmBtn.disabled = true;

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'add-form-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.type = 'button';

  nameInput.addEventListener('input', () => {
    confirmBtn.disabled = !nameInput.value.trim();
  });

  function resetForm() {
    nameInput.value = '';
    confirmBtn.disabled = true;
    selectedComplexity = 'Low';
    badgeGroup.querySelectorAll('.complexity-badge').forEach((b, i) => b.classList.toggle('dim', i !== 0));
    mdInput.value = '0.5';
    form.style.display = 'none';
    addBtn.style.display = '';
    if (_openAddForm === form) _openAddForm = null;
  }

  cancelBtn.addEventListener('click', resetForm);

  confirmBtn.addEventListener('click', () => {
    const newTask = {
      name: nameInput.value.trim(),
      complexity: selectedComplexity,
      mandays: parseFloat(mdInput.value) || 0.5,
      notes: null,
    };
    taskArr.push(newTask);
    const newRow = buildTaskRow(newTask, taskArr);
    containerEl.insertBefore(newRow, addBtn);
    resetForm();
    recalcTotal();
  });

  actions.append(cancelBtn, confirmBtn);
  form.append(row1, actions);
  return form;
}

function appendAddControls(containerEl, taskArr) {
  const addBtn = document.createElement('button');
  addBtn.className = 'add-task-btn';
  addBtn.textContent = '+ Add task';

  const form = buildAddForm(taskArr, containerEl, addBtn);
  form.style.display = 'none';

  addBtn.addEventListener('click', () => {
    collapseOpenAddForm();
    _openAddForm = form;
    addBtn.style.display = 'none';
    form.style.display = '';
    form.querySelector('.add-form-name').focus();
  });

  containerEl.appendChild(addBtn);
  containerEl.appendChild(form);
}

function buildTaskRow(task, taskArr) {
  const row = document.createElement('div');
  row.className = 'task-row';
  row._taskRef = task;
  row._taskArr = taskArr;

  const main = document.createElement('div');
  main.className = 'task-main';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'task-name-edit';
  nameInput.value = task.name;
  nameInput.addEventListener('input', () => { row._taskRef.name = nameInput.value; });

  const badgeGroup = document.createElement('div');
  badgeGroup.className = 'badge-group';
  ['Low', 'Medium', 'Complex'].forEach(level => {
    const b = document.createElement('span');
    b.className = `complexity-badge ${badgeClass(level)}${level !== task.complexity ? ' dim' : ''}`;
    b.textContent = level;
    b.addEventListener('click', () => {
      badgeGroup.querySelectorAll('.complexity-badge').forEach(el => el.classList.add('dim'));
      b.classList.remove('dim');
      row._taskRef.complexity = level;
    });
    badgeGroup.appendChild(b);
  });

  const mdInput = document.createElement('input');
  mdInput.className = 'md-input';
  mdInput.type = 'number';
  mdInput.min = '0.1';
  mdInput.step = 'any';
  mdInput.value = task.mandays;
  mdInput.addEventListener('input', () => {
    const val = parseFloat(mdInput.value);
    if (!isNaN(val) && val > 0) row._taskRef.mandays = val;
    recalcTotal();
  });

  const unit = document.createElement('span');
  unit.className = 'md-unit';
  unit.textContent = 'md';

  const removeBtn = document.createElement('button');
  removeBtn.className = 'task-remove-btn';
  removeBtn.title = 'Remove task';
  removeBtn.textContent = '✕';
  removeBtn.type = 'button';
  removeBtn.addEventListener('click', () => {
    const idx = row._taskArr.indexOf(row._taskRef);
    if (idx !== -1) row._taskArr.splice(idx, 1);
    row.remove();
    recalcTotal();
  });

  main.append(nameInput, badgeGroup, mdInput, unit, removeBtn);
  row.appendChild(main);

  const desc = document.createElement('div');
  desc.className = 'task-desc' + (Array.isArray(task.notes) && task.notes.length > 0 ? ' has-notes' : '');

  const label = document.createElement('div');
  label.className = 'desc-label';
  label.textContent = 'Notes';
  desc.appendChild(label);

  if (Array.isArray(task.notes) && task.notes.length > 0) {
    desc.appendChild(buildNotesEditable(task, desc, row));
  } else {
    desc.appendChild(buildNotesPlaceholder(task, desc, row));
  }

  row.appendChild(desc);
  return row;
}

function groupSubtotal(group) {
  return calculateTotal([group]);
}

function buildSubgroup(label, taskArr) {
  const sub = document.createElement('div');
  sub.className = 'subgroup';

  const lbl = document.createElement('div');
  lbl.className = 'subgroup-label';
  lbl.textContent = label;
  sub.appendChild(lbl);

  taskArr.forEach(t => sub.appendChild(buildTaskRow(t, taskArr)));
  appendAddControls(sub, taskArr);
  return sub;
}

function buildGroup(group, collapsible, startCollapsed) {
  const el = document.createElement('div');
  el.className = 'group' + (startCollapsed ? ' collapsed' : '');

  const header = document.createElement('div');
  header.className = 'group-header' + (collapsible ? ' collapsible' : '');
  header.innerHTML = `
    <span class="group-name"></span>
    <span class="group-chevron">▶</span>
    <div class="group-line"></div>
    <span class="group-subtotal"></span>
  `;
  header.querySelector('.group-name').textContent = group.name;
  header.querySelector('.group-subtotal').textContent = groupSubtotal(group).toFixed(1) + ' md';

  if (collapsible) {
    header.addEventListener('click', () => el.classList.toggle('collapsed'));
  }
  el.appendChild(header);

  const body = document.createElement('div');
  body.className = 'group-body';
  group.tasks.forEach(t => body.appendChild(buildTaskRow(t, group.tasks)));
  appendAddControls(body, group.tasks);
  body.appendChild(buildSubgroup('Edge Cases', group.edgeCases));
  body.appendChild(buildSubgroup('Testing',    group.testing));
  el.appendChild(body);

  return el;
}

function renderEstimate(data) {
  const body  = document.getElementById('estimateBody');
  const multi = data.groups.length > 1;
  body.innerHTML = '';
  data.groups.forEach(g => body.appendChild(buildGroup(g, multi, multi)));
  recalcTotal();
}

if (typeof window !== 'undefined') {
  window.renderEstimate = renderEstimate;
}

// ── Node.js export for testing ────────────────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = { calculateTotal, generateCSV, generateClipboardText };
}
