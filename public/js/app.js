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
  const inputCard            = document.querySelector('.input-card');

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
    }, 4000);
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
    if (isApiOnly) includeBackendCheck.checked = false;
    else           includeBackendCheck.checked = true;
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

    startLoading();

    try {
      const res  = await fetch('/api/estimate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ requirements, platform, images: uploadedImages, includeTesting, includeBackend }),
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
