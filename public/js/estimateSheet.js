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
  const rows = ['Group,Subgroup,Task,Complexity,Mandays'];
  for (const g of groups) {
    const push = (label, tasks) =>
      tasks.forEach(t => rows.push([g.name, label, t.name, t.complexity, t.mandays].map(csvEscape).join(',')));
    push('Tasks',      g.tasks);
    push('Edge Cases', g.edgeCases);
    push('Testing',    g.testing);
  }
  return rows.join('\n');
}

function generateClipboardText(groups) {
  const rows = ['Group\tSubgroup\tTask\tComplexity\tMandays'];
  for (const g of groups) {
    const push = (label, tasks) =>
      tasks.forEach(t => rows.push([g.name, label, t.name, t.complexity, t.mandays].map(tsvEscape).join('\t')));
    push('Tasks',      g.tasks);
    push('Edge Cases', g.edgeCases);
    push('Testing',    g.testing);
  }
  return rows.join('\n');
}

// ── DOM helpers ──────────────────────────────────────────────────────

function syncEditsToEstimate() {
  if (!window._currentEstimate) return;
  const inputs = Array.from(document.querySelectorAll('.md-input'));
  let i = 0;
  window._currentEstimate.groups.forEach(group => {
    ['tasks', 'edgeCases', 'testing'].forEach(sub => {
      group[sub].forEach(task => {
        if (inputs[i]) {
          task.mandays = parseFloat(inputs[i].value) || task.mandays;
          i++;
        }
      });
    });
  });
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

function buildTaskRow(task) {
  const row  = document.createElement('div');
  row.className = 'task-row';

  const main = document.createElement('div');
  main.className = 'task-main';

  const nameEl  = document.createElement('span');
  nameEl.className   = 'task-name';
  nameEl.textContent = task.name;

  const badge  = document.createElement('span');
  badge.className   = `complexity-badge ${badgeClass(task.complexity)}`;
  badge.textContent = task.complexity;

  const input  = document.createElement('input');
  input.className = 'md-input';
  input.type      = 'number';
  input.min       = '0.5';
  input.step      = '0.5';
  input.value     = task.mandays;
  input.addEventListener('input', recalcTotal);

  const unit  = document.createElement('span');
  unit.className   = 'md-unit';
  unit.textContent = 'md';

  main.append(nameEl, badge, input, unit);
  row.appendChild(main);

  if (task.notes) {
    const desc  = document.createElement('div');
    desc.className = 'task-desc';

    const label = document.createElement('div');
    label.className   = 'desc-label';
    label.textContent = 'Notes';

    const text  = document.createElement('div');
    text.className   = 'desc-text';
    text.textContent = task.notes;

    desc.append(label, text);
    row.appendChild(desc);
  }

  return row;
}

function groupSubtotal(group) {
  return calculateTotal([group]);
}

function buildGroup(group) {
  const el = document.createElement('div');
  el.className = 'group';

  const header = document.createElement('div');
  header.className = 'group-header';
  header.innerHTML = `
    <span class="group-name"></span>
    <div class="group-line"></div>
    <span class="group-subtotal"></span>
  `;
  header.querySelector('.group-name').textContent = group.name;
  header.querySelector('.group-subtotal').textContent = groupSubtotal(group).toFixed(1) + ' md';
  el.appendChild(header);

  group.tasks.forEach(t => el.appendChild(buildTaskRow(t)));

  const addSubgroup = (label, tasks) => {
    if (!tasks.length) return;
    const sub = document.createElement('div');
    sub.className = 'subgroup';
    const lbl = document.createElement('div');
    lbl.className   = 'subgroup-label';
    lbl.textContent = label;
    sub.appendChild(lbl);
    tasks.forEach(t => sub.appendChild(buildTaskRow(t)));
    el.appendChild(sub);
  };

  addSubgroup('Edge Cases', group.edgeCases);
  addSubgroup('Testing',    group.testing);

  return el;
}

function renderEstimate(data) {
  const body = document.getElementById('estimateBody');
  body.innerHTML = '';
  data.groups.forEach(g => body.appendChild(buildGroup(g)));
  recalcTotal();
}

if (typeof window !== 'undefined') {
  window.renderEstimate = renderEstimate;
}

// ── Node.js export for testing ────────────────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = { calculateTotal, generateCSV, generateClipboardText };
}
