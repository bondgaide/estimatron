// ── Constants ─────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const PLATFORM_LABELS = {
  web:     'Web Application',
  ios:     'iOS (Native)',
  android: 'Android (Native)',
  cross:   'Cross-platform Mobile',
  api:     'API / Backend only',
};

const TECH_STACKS = {
  web:     { Frontend: ['React','Vue.js','Angular','Svelte','Next.js','Nuxt.js','TypeScript','Tailwind CSS','SASS','Redux','Zustand'], Backend: ['Node.js','Express','NestJS','Django','FastAPI','Flask','Spring Boot','Ruby on Rails','Laravel','Go','.NET','GraphQL'], Database: ['PostgreSQL','MySQL','MongoDB','Redis','SQLite','Firebase','Supabase','DynamoDB','Prisma','TypeORM'] },
  ios:     { iOS: ['Swift','SwiftUI','UIKit','Core Data','Combine','XCTest','Objective-C'], Backend: ['Node.js','Express','NestJS','Django','FastAPI','Flask','Spring Boot','Ruby on Rails','Laravel','Go','.NET','GraphQL'], Database: ['PostgreSQL','MySQL','MongoDB','Redis','SQLite','Firebase','Supabase','DynamoDB','Prisma','TypeORM'] },
  android: { Android: ['Kotlin','Jetpack Compose','Android SDK','Room','Retrofit','Coroutines','Gradle'], Backend: ['Node.js','Express','NestJS','Django','FastAPI','Flask','Spring Boot','Ruby on Rails','Laravel','Go','.NET','GraphQL'], Database: ['PostgreSQL','MySQL','MongoDB','Redis','SQLite','Firebase','Supabase','DynamoDB','Prisma','TypeORM'] },
  cross:   { 'Mobile Framework': ['React Native','Flutter','Expo','Dart','NativeScript'], Backend: ['Node.js','Express','NestJS','Django','FastAPI','Flask','Spring Boot','Ruby on Rails','Laravel','Go','.NET','GraphQL'], Database: ['PostgreSQL','MySQL','MongoDB','Redis','SQLite','Firebase','Supabase','DynamoDB','Prisma','TypeORM'] },
  api:     { Backend: ['Node.js','Express','NestJS','Django','FastAPI','Flask','Spring Boot','Ruby on Rails','Laravel','Go','.NET','GraphQL'], Database: ['PostgreSQL','MySQL','MongoDB','Redis','SQLite','Firebase','Supabase','DynamoDB','Prisma','TypeORM'] },
};

const TECH_CAT_STYLES = {
  Frontend:          { dot: '#7F77DD', border: '#534AB7', text: '#AFA9EC', bg: 'rgba(83,74,183,0.18)' },
  Backend:           { dot: '#EF9F27', border: '#7a4a0a', text: '#FAC775', bg: 'rgba(133,79,11,0.18)' },
  Database:          { dot: '#D4537E', border: '#993556', text: '#F4C0D1', bg: 'rgba(153,53,86,0.18)' },
  iOS:               { dot: '#378ADD', border: '#185FA5', text: '#B5D4F4', bg: 'rgba(24,95,165,0.18)' },
  Android:           { dot: '#639922', border: '#3B6D11', text: '#C0DD97', bg: 'rgba(59,109,17,0.18)' },
  'Mobile Framework':{ dot: '#1D9E75', border: '#0F6E56', text: '#9FE1CB', bg: 'rgba(15,110,86,0.18)' },
  Custom:            { dot: '#888780', border: '#5F5E5A', text: '#D3D1C7', bg: 'rgba(95,94,90,0.15)' },
};

const TECH_CAT_STYLES_LIGHT = {
  Frontend:          { dot: '#534AB7', border: '#534AB7', text: '#3a328a', bg: 'rgba(83,74,183,0.10)' },
  Backend:           { dot: '#b87720', border: '#7a4a0a', text: '#8a5510', bg: 'rgba(150,90,10,0.10)' },
  Database:          { dot: '#993556', border: '#993556', text: '#7a1f42', bg: 'rgba(153,53,86,0.10)' },
  iOS:               { dot: '#185FA5', border: '#185FA5', text: '#135189', bg: 'rgba(24,95,165,0.10)' },
  Android:           { dot: '#3B6D11', border: '#3B6D11', text: '#2a4e0c', bg: 'rgba(59,109,17,0.10)' },
  'Mobile Framework':{ dot: '#0F6E56', border: '#0F6E56', text: '#095c46', bg: 'rgba(15,110,86,0.10)' },
  Custom:            { dot: '#5F5E5A', border: '#5F5E5A', text: '#4a4946', bg: 'rgba(95,94,90,0.10)' },
};

// ── Pure helpers (exported for testing) ──────────────────────────────
function validateFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `${file.name}: unsupported format. Use PNG, JPG, or WEBP.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `${file.name}: file exceeds 10 MB limit.`;
  }
  return null;
}

function encodeImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve({ data: reader.result.split(',')[1], mediaType: file.type });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── DOM-dependent code ────────────────────────────────────────────────
if (typeof document !== 'undefined') {

  let uploadedImages = [];
  let techChips      = [];

  const platformSelect  = document.getElementById('platformSelect');
  const requirementsEl  = document.getElementById('requirements');
  const uploadZone      = document.getElementById('uploadZone');
  const fileInput       = document.getElementById('fileInput');
  const thumbRow        = document.getElementById('thumbRow');
  const generateBtn     = document.getElementById('generateBtn');
  const estimateSection = document.getElementById('estimateSection');
  const mainEl          = document.getElementById('main');
  const estimateTitleEl = document.getElementById('estimateTitle');
  const platformChipEl  = document.getElementById('platformChip');
  const regenBtn        = document.getElementById('regenBtn');
  const exportCsvBtn    = document.getElementById('exportCsvBtn');
  const copyBtn         = document.getElementById('copyBtn');
  const includeTestingCheck  = document.getElementById('includeTestingCheck');
  const includeBackendCheck  = document.getElementById('includeBackendCheck');
  const includeBackendLabel  = document.getElementById('includeBackendLabel');
  const includeGaCheck        = document.getElementById('includeGaCheck');
  const includeGaLabel        = document.getElementById('includeGaLabel');
  const includeAiAssistCheck  = document.getElementById('includeAiAssistCheck');
  const inputCard            = document.querySelector('.input-card');
  const techChipWrap  = document.getElementById('techChipWrap');
  const techChipInput = document.getElementById('techChipInput');
  const techDropdown  = document.getElementById('techDropdown');
  const techChipsEl   = document.getElementById('techChips');

  // ── Toast ──────────────────────────────────────────────────────────
  window.showToast = function showToast(message, type = 'error') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 8000);
  };

  // ── Button state ───────────────────────────────────────────────────
  function updateButtonState() {
    generateBtn.disabled = !(requirementsEl.value.trim().length > 0 || uploadedImages.length > 0);
  }
  requirementsEl.addEventListener('input', updateButtonState);
  platformSelect.addEventListener('change', () => {
    const isApiOnly = platformSelect.value === 'api';
    includeBackendCheck.disabled = isApiOnly;
    includeBackendLabel.classList.toggle('disabled', isApiOnly);
    includeBackendCheck.checked = isApiOnly;
    includeGaCheck.disabled = isApiOnly;
    includeGaLabel.classList.toggle('disabled', isApiOnly);
    if (isApiOnly) includeGaCheck.checked = false;
    if (techDropdown.classList.contains('open')) renderTechDropdown();
  });
  includeBackendCheck.addEventListener('change', () => {
    if (techDropdown.classList.contains('open')) renderTechDropdown();
  });

  // ── Theme toggle ───────────────────────────────────────────────────
  document.querySelector('.logo-dot').addEventListener('click', () => {
    const isLight = document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    renderTechChips();
    if (techDropdown.classList.contains('open')) renderTechDropdown();
  });

  // ── Tech Stack ─────────────────────────────────────────────────────
  function getCatStyle(cat) {
    const map = document.documentElement.classList.contains('light') ? TECH_CAT_STYLES_LIGHT : TECH_CAT_STYLES;
    return map[cat] || map.Custom;
  }

  function getTechCategories() {
    const all = TECH_STACKS[platformSelect.value] || {};
    if (includeBackendCheck.checked) return all;
    return Object.fromEntries(
      Object.entries(all).filter(([cat]) => cat !== 'Backend' && cat !== 'Database')
    );
  }

  function renderTechChips() {
    techChipsEl.innerHTML = '';
    techChips.forEach(({ label, cat }) => {
      const s = getCatStyle(cat);
      const chip = document.createElement('span');
      chip.className = 'tech-chip';
      chip.style.cssText = `border-color:${s.border};color:${s.text};background:${s.bg}`;
      chip.textContent = label;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'tech-chip-remove';
      rm.style.color = s.text;
      rm.textContent = '×';
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        techChips = techChips.filter(c => c.label !== label);
        renderTechChips();
        if (techDropdown.classList.contains('open')) renderTechDropdown();
      });
      chip.appendChild(rm);
      techChipsEl.appendChild(chip);
    });
  }

  function renderTechDropdown() {
    const q = techChipInput.value.trim().toLowerCase();
    const cats = getTechCategories();
    const selected = new Set(techChips.map(c => c.label));
    techDropdown.innerHTML = '';
    let hasItems = false;

    Object.entries(cats).forEach(([cat, items]) => {
      const filtered = items.filter(item => !selected.has(item) && (!q || item.toLowerCase().includes(q)));
      if (!filtered.length) return;
      const s = getCatStyle(cat);
      const catLbl = document.createElement('div');
      catLbl.className = 'tech-cat-label';
      const dot = document.createElement('span');
      dot.className = 'tech-cat-dot';
      dot.style.background = s.dot;
      catLbl.appendChild(dot);
      catLbl.appendChild(document.createTextNode(cat));
      techDropdown.appendChild(catLbl);
      const row = document.createElement('div');
      row.className = 'tech-cat-items';
      filtered.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tech-suggestion';
        btn.style.cssText = `border-color:${s.border};color:${s.text};background:${s.bg}`;
        btn.textContent = item;
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          techChips.push({ label: item, cat });
          renderTechChips();
          techChipInput.value = '';
          renderTechDropdown();
        });
        row.appendChild(btn);
      });
      techDropdown.appendChild(row);
      hasItems = true;
    });

    if (q) {
      const raw = techChipInput.value.trim();
      if (!selected.has(raw)) {
        const allItems = Object.values(cats).flat();
        if (!allItems.some(i => i.toLowerCase() === q)) {
          const hint = document.createElement('div');
          hint.className = 'tech-empty';
          hint.textContent = `Press Enter to add "${raw}"`;
          techDropdown.appendChild(hint);
          hasItems = true;
        }
      }
    }

    if (!hasItems) {
      const empty = document.createElement('div');
      empty.className = 'tech-empty';
      empty.textContent = Object.keys(cats).length === 0 ? 'No categories for this platform' : 'All suggestions selected';
      techDropdown.appendChild(empty);
    }
  }

  techChipWrap.addEventListener('click', () => techChipInput.focus());
  techChipInput.addEventListener('focus', () => {
    techChipWrap.classList.add('focused');
    renderTechDropdown();
    techDropdown.classList.add('open');
  });
  techChipInput.addEventListener('blur', () => {
    techChipWrap.classList.remove('focused');
    setTimeout(() => techDropdown.classList.remove('open'), 150);
  });
  techChipInput.addEventListener('input', () => renderTechDropdown());
  techChipInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const label = techChipInput.value.trim();
      if (label && !techChips.some(c => c.label.toLowerCase() === label.toLowerCase())) {
        techChips.push({ label, cat: 'Custom' });
        renderTechChips();
        techChipInput.value = '';
        renderTechDropdown();
      }
    } else if (e.key === 'Escape') {
      techDropdown.classList.remove('open');
    } else if (e.key === 'Backspace' && !techChipInput.value && techChips.length) {
      techChips.pop();
      renderTechChips();
      if (techDropdown.classList.contains('open')) renderTechDropdown();
    }
  });

  // ── Loading state ──────────────────────────────────────────────────
  const STATUS_MESSAGES = [
    'Analysing requirements…',
    'Identifying task groups…',
    'Breaking down edge cases…',
    'Estimating complexity…',
    'Calculating mandays…',
    'Almost there…',
  ];

  let _loadingInterval = null;
  let _statusMsgEl     = null;

  function startLoading() {
    inputCard.classList.add('is-loading');
    generateBtn.classList.add('is-loading');
    generateBtn.innerHTML = '<span class="btn-spinner"></span>Generating…';
    generateBtn.disabled = true;

    _statusMsgEl = document.createElement('p');
    _statusMsgEl.className = 'status-msg';
    _statusMsgEl.textContent = STATUS_MESSAGES[0];
    generateBtn.insertAdjacentElement('afterend', _statusMsgEl);

    let idx = 0;
    _loadingInterval = setInterval(() => {
      idx = (idx + 1) % STATUS_MESSAGES.length;
      _statusMsgEl.textContent = STATUS_MESSAGES[idx];
    }, 3000);
  }

  function stopLoading() {
    inputCard.classList.remove('is-loading');
    generateBtn.classList.remove('is-loading');
    generateBtn.innerHTML = 'Generate Estimation';
    generateBtn.disabled = false;
    if (_loadingInterval) { clearInterval(_loadingInterval); _loadingInterval = null; }
    if (_statusMsgEl)     { _statusMsgEl.remove(); _statusMsgEl = null; }
  }

  // ── Thumbnails ─────────────────────────────────────────────────────
  function renderThumbs() {
    thumbRow.innerHTML = '';
    uploadedImages.forEach((img, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'thumb';

      const preview = document.createElement('img');
      preview.src = `data:${img.mediaType};base64,${img.data}`;
      preview.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:7px;';
      thumb.appendChild(preview);

      const x = document.createElement('span');
      x.className = 'x';
      x.textContent = '✕';
      x.dataset.index = i;
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadedImages.splice(parseInt(e.currentTarget.dataset.index), 1);
        renderThumbs();
        updateButtonState();
      });
      thumb.appendChild(x);
      thumbRow.appendChild(thumb);
    });
  }

  // ── File handling ──────────────────────────────────────────────────
  async function handleFiles(files) {
    for (const file of Array.from(files)) {
      const err = validateFile(file);
      if (err) { showToast(err); continue; }
      try {
        const encoded = await encodeImageToBase64(file);
        uploadedImages.push(encoded);
      } catch {
        showToast(`Failed to read ${file.name}`);
      }
    }
    renderThumbs();
    updateButtonState();
  }

  // ── Upload zone events ─────────────────────────────────────────────
  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', () => { handleFiles(fileInput.files); fileInput.value = ''; });

  // ── Generate ───────────────────────────────────────────────────────
  generateBtn.addEventListener('click', async () => {
    const requirements  = requirementsEl.value.trim();
    const platform      = platformSelect.value;
    const includeTesting = includeTestingCheck.checked;
    const includeBackend = includeBackendCheck.checked && !includeBackendCheck.disabled;
    const includeGa       = includeGaCheck.checked && !includeGaCheck.disabled;
    const includeAiAssist = includeAiAssistCheck.checked;

    startLoading();

    try {
      const res  = await fetch('/api/estimate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ requirements, platform, images: uploadedImages, includeTesting, includeBackend, techStack: techChips.map(c => c.label), includeGa, includeAiAssist }),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Generation failed — please try again');
        return;
      }

      window._currentEstimate    = data;
      estimateTitleEl.textContent = data.title || 'Untitled Estimate';
      platformChipEl.textContent  = PLATFORM_LABELS[platform];
      if (window.renderEstimate) window.renderEstimate(data);
      estimateSection.classList.add('visible');
      mainEl.classList.add('has-estimate');
      estimateSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      showToast(
        navigator.onLine
          ? 'Generation failed — please try again'
          : 'No connection — check your network and try again'
      );
    } finally {
      stopLoading();
      updateButtonState();
    }
  });

  // ── Re-generate ────────────────────────────────────────────────────
  regenBtn.addEventListener('click', () => {
    estimateSection.classList.remove('visible');
    mainEl.classList.remove('has-estimate');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ── Export CSV ─────────────────────────────────────────────────────
  exportCsvBtn.addEventListener('click', () => {
    if (!window._currentEstimate) return;
    syncEditsToEstimate();
    const csv  = generateCSV(window._currentEstimate.groups);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href:     url,
      download: `${window._currentEstimate.title.replace(/\s+/g, '-')}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── Copy to clipboard ──────────────────────────────────────────────
  copyBtn.addEventListener('click', async () => {
    if (!window._currentEstimate) return;
    syncEditsToEstimate();
    try {
      await navigator.clipboard.writeText(generateClipboardText(window._currentEstimate.groups));
      showToast('Copied to clipboard', 'success');
    } catch {
      showToast('Copy failed — use Export CSV instead');
    }
  });

} // end DOM guard

// ── Exports for Jest ──────────────────────────────────────────────────
if (typeof module !== 'undefined') module.exports = { validateFile, encodeImageToBase64, MAX_FILE_SIZE, ALLOWED_TYPES };
