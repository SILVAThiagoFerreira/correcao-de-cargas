import { analyzePlanText, formatNumber } from './logic.js';

const elements = {
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('fileInput'),
  sampleButton: document.getElementById('sampleButton'),
  fileName: document.getElementById('fileName'),
  status: document.getElementById('status'),
  metrics: {
    loaded: document.getElementById('metricLoaded'),
    deleted: document.getElementById('metricDeleted'),
    depth: document.getElementById('metricDepth'),
    charge: document.getElementById('metricCharge'),
  },
  resultsTitle: document.getElementById('resultsTitle'),
  resultsMeta: document.getElementById('resultsMeta'),
  emptyState: document.getElementById('emptyState'),
  resultsBody: document.getElementById('resultsBody'),
};

let lastFileName = '--';

bindEvents();
renderIdleState();

function bindEvents() {
  elements.fileInput.addEventListener('change', handleFileSelection);
  elements.sampleButton.addEventListener('click', loadSampleFile);

  elements.dropzone.addEventListener('dragenter', activateDropzone);
  elements.dropzone.addEventListener('dragover', activateDropzone);
  elements.dropzone.addEventListener('dragleave', deactivateDropzone);
  elements.dropzone.addEventListener('drop', handleDrop);
}

function renderIdleState() {
  setFileName(lastFileName);
  setStatus('Pronto', 'neutral');
  setMetrics({
    loaded: '-',
    deleted: '-',
    depth: '-',
    charge: '-',
  });
  elements.resultsTitle.textContent = 'Alertas';
  elements.resultsMeta.textContent = '0';
  showEmptyState('Carregue arquivo.');
}

async function handleFileSelection(event) {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  await loadFile(file);
  event.target.value = '';
}

async function handleDrop(event) {
  event.preventDefault();
  deactivateDropzone(event);

  const file = event.dataTransfer.files?.[0];

  if (!file) {
    return;
  }

  await loadFile(file);
}

function activateDropzone(event) {
  event.preventDefault();
  elements.dropzone.classList.add('is-dragging');
}

function deactivateDropzone(event) {
  event.preventDefault();
  elements.dropzone.classList.remove('is-dragging');
}

async function loadSampleFile() {
  setBusy(true);

  try {
    const response = await fetch('./input/PP210526_EXEC.csv');

    if (!response.ok) {
      throw new Error('Falha ao buscar o arquivo de exemplo.');
    }

    const text = await response.text();
    renderAnalysis(analyzePlanText(text), 'PP210526_EXEC.csv');
  } catch (error) {
    showError('Erro ao abrir exemplo.');
  } finally {
    setBusy(false);
  }
}

async function loadFile(file) {
  setBusy(true);

  try {
    const text = await file.text();
    renderAnalysis(analyzePlanText(text), file.name);
  } catch (error) {
    showError('Arquivo inválido.');
  } finally {
    setBusy(false);
  }
}

function renderAnalysis(analysis, fileName) {
  lastFileName = fileName;
  setFileName(fileName);

  setStatus(`${analysis.activeRows} furos · ${analysis.outlierCount} alertas`, analysis.outlierCount > 0 ? 'alert' : 'neutral');

  setMetrics({
    loaded: analysis.activeRows,
    deleted: analysis.deletedRows,
    depth: `${formatNumber(analysis.depthStats.mean, 2)} m`,
    charge: `${formatNumber(analysis.chargeStats.mean, 2)} kg`,
  });

  elements.resultsTitle.textContent = 'Alertas';
  elements.resultsMeta.textContent = String(analysis.outliers.length);

  if (!analysis.activeRows) {
    showEmptyState('Sem furos.');
    return;
  }

  if (!analysis.outliers.length) {
    showEmptyState('Sem alertas.');
    return;
  }

  elements.emptyState.classList.add('hidden');
  elements.resultsBody.classList.remove('hidden');
  elements.resultsBody.innerHTML = analysis.outliers.map(renderCard).join('');
}

function renderCard(hole) {
  const reasons = [...hole.reasons].sort((left, right) => metricOrder(left.metric) - metricOrder(right.metric));
  const tone = reasons[0]?.metric ?? 'depth';
  const classes = ['outlier-card', `outlier-card--${tone}`];

  if (reasons.length > 1) {
    classes.push('outlier-card--mixed');
  }

  return `
    <article class="${classes.join(' ')}">
      <div class="outlier-card__visuals">
        ${reasons.map((reason) => `<div class="outlier-card__art outlier-card__art--${reason.metric}">${renderArt(reason.metric)}</div>`).join('')}
      </div>
      <div class="outlier-card__body">
        <strong class="outlier-card__hole">Furo ${escapeHtml(hole.number)}</strong>
        <div class="outlier-card__facts">
          ${reasons.map(renderFact).join('')}
        </div>
      </div>
    </article>
  `;
}

function renderFact(reason) {
  const label = reason.metric === 'depth' ? 'Prof.' : 'Carga';
  const unit = reason.metric === 'depth' ? 'm' : 'kg';

  return `
    <div class="fact fact--${reason.metric}">
      <span>${label}</span>
      <strong>${escapeHtml(formatNumber(reason.value, 2))} ${unit}</strong>
    </div>
  `;
}

function renderArt(metric) {
  return metric === 'depth' ? renderDepthArt() : renderChargeArt();
}

function renderDepthArt() {
  return `
    <svg viewBox="0 0 180 140" role="img" aria-label="Profundidade" class="illustration illustration--depth" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="160" height="120" rx="24" fill="#f7f9fc" />
      <rect x="69" y="18" width="42" height="14" rx="7" fill="#d51f2b" />
      <path d="M71 39h38c10 0 18 8 18 18v22c0 18-14 33-37 33s-37-15-37-33V57c0-10 8-18 18-18z" fill="#102033" />
      <path d="M90 30v18" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
      <path d="M82 41l8 8 8-8" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M49 32h10M45 46h14M49 60h10M45 74h14M49 88h10" stroke="#7d8aa0" stroke-width="3" stroke-linecap="round" />
      <path d="M81 100h18" stroke="#d51f2b" stroke-width="6" stroke-linecap="round" />
      <path d="M84 108l6 6 6-6" fill="none" stroke="#d51f2b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}

function renderChargeArt() {
  return `
    <svg viewBox="0 0 180 140" role="img" aria-label="Carga" class="illustration illustration--charge" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="160" height="120" rx="24" fill="#f7f9fc" />
      <path d="M71 32h38c10 0 18 8 18 18v34c0 10-8 18-18 18H71c-10 0-18-8-18-18V50c0-10 8-18 18-18z" fill="#102033" />
      <rect x="78" y="34" width="24" height="14" rx="7" fill="#d51f2b" />
      <rect x="78" y="50" width="24" height="14" rx="7" fill="#ef4c54" />
      <rect x="78" y="66" width="24" height="14" rx="7" fill="#d51f2b" />
      <rect x="78" y="82" width="24" height="14" rx="7" fill="#ef4c54" />
      <path d="M126 34l4 8 8 4-8 4-4 8-4-8-8-4 8-4 4-8z" fill="#d51f2b" />
      <path d="M49 34h10M45 48h14M49 62h10M45 76h14M49 90h10" stroke="#7d8aa0" stroke-width="3" stroke-linecap="round" />
      <path d="M95 24l6 6 6-6" fill="none" stroke="#ef4c54" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}

function showEmptyState(message) {
  elements.emptyState.classList.remove('hidden');
  elements.resultsBody.classList.add('hidden');
  elements.resultsBody.innerHTML = '';
  elements.emptyState.textContent = message;
}

function showError(message) {
  setStatus(message, 'error');
  showEmptyState('Arquivo inválido.');
}

function setFileName(fileName) {
  elements.fileName.textContent = fileName;
}

function setStatus(message, tone) {
  elements.status.dataset.tone = tone;
  elements.status.textContent = message;
}

function setMetrics(values) {
  elements.metrics.loaded.textContent = values.loaded;
  elements.metrics.deleted.textContent = values.deleted;
  elements.metrics.depth.textContent = values.depth;
  elements.metrics.charge.textContent = values.charge;
}

function setBusy(isBusy) {
  elements.sampleButton.disabled = isBusy;
  elements.fileInput.disabled = isBusy;
  elements.dropzone.classList.toggle('is-busy', isBusy);
}

function metricOrder(metric) {
  return metric === 'depth' ? 0 : 1;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}
