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

let lastFileName = 'Nenhum arquivo selecionado';

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
  setStatus('Aguardando arquivo', 'neutral');
  setMetrics({
    loaded: '-',
    deleted: '-',
    depth: '-',
    charge: '-',
  });
  elements.resultsTitle.textContent = 'Outliers identificados';
  elements.resultsMeta.textContent = '0';
  showEmptyState(
    'Nenhum arquivo processado ainda.',
    'Importe um CSV, TSV ou TXT estruturado para iniciar a análise.',
  );
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
    showError('Falha ao carregar a amostra.', 'Verifique se o arquivo de exemplo está disponível.');
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
    showError('Arquivo inválido.', 'O arquivo deve ser tabular e seguir o modelo CSV/TSV esperado.');
  } finally {
    setBusy(false);
  }
}

function renderAnalysis(analysis, fileName) {
  lastFileName = fileName;
  setFileName(fileName);

  const outlierLabel = analysis.outlierCount === 1
    ? '1 outlier identificado'
    : `${analysis.outlierCount} outliers identificados`;

  setStatus(`${analysis.activeRows} furos válidos · ${outlierLabel}`, analysis.outlierCount > 0 ? 'alert' : 'neutral');

  setMetrics({
    loaded: analysis.activeRows,
    deleted: analysis.deletedRows,
    depth: `${formatNumber(analysis.depthStats.mean, 2)} m`,
    charge: `${formatNumber(analysis.chargeStats.mean, 2)} kg`,
  });

  elements.resultsTitle.textContent = 'Outliers identificados';
  elements.resultsMeta.textContent = String(analysis.outliers.length);

  if (!analysis.activeRows) {
    showEmptyState('Sem registros elegíveis.', 'Não há furos ativos com profundidade e carga válidas para análise.');
    return;
  }

  if (!analysis.outliers.length) {
    showEmptyState('Sem outliers identificados.', 'Os registros permanecem dentro da faixa estatística esperada para profundidade e carga.');
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
  const title = buildOutlierTitle(reasons);

  if (reasons.length > 1) {
    classes.push('outlier-card--mixed');
  }

  return `
    <article class="${classes.join(' ')}">
      <div class="outlier-card__visuals">
        ${reasons.map((reason) => `<div class="outlier-card__art outlier-card__art--${reason.metric}">${renderArt(reason)}</div>`).join('')}
      </div>
      <div class="outlier-card__body">
        <div class="outlier-card__heading">
          <strong class="outlier-card__hole">Furo ${escapeHtml(hole.number)}</strong>
          <span class="outlier-card__divider" aria-hidden="true">|</span>
          <span class="outlier-card__tag outlier-card__tag--${tone}${reasons.length > 1 ? ' outlier-card__tag--mixed' : ''}">${escapeHtml(title)}</span>
        </div>
        <div class="outlier-card__facts">
          ${reasons.map(renderFact).join('')}
        </div>
      </div>
    </article>
  `;
}

function renderFact(reason) {
  const label = reason.metric === 'depth' ? 'Profundidade real' : 'Carga total real';
  const unit = reason.metric === 'depth' ? 'm' : 'kg';
  const referenceLabel = reason.method === 'mad' ? 'mediana' : 'média';
  const estimatorLabel = reason.method === 'mad' ? 'MAD' : 'DP';
  const deviationLabel = reason.method === 'mad' ? 'z robusto' : 'z';
  const note = `Ref.: ${referenceLabel} ${formatNumber(reason.reference, 2)} ${unit} · ${estimatorLabel} · ${deviationLabel} ${formatSignedNumber(reason.score, 2)}`;

  return `
    <div class="fact fact--${reason.metric}">
      <span>${label}</span>
      <strong>${escapeHtml(formatNumber(reason.value, 2))} ${unit}</strong>
      <div class="subtle">${escapeHtml(note)}</div>
    </div>
  `;
}

function renderArt(reason) {
  return reason.metric === 'depth' ? renderDepthArt(reason) : renderChargeArt(reason);
}

function renderDepthArt(reason) {
  const direction = getReasonDirection(reason);
  const trendFill = direction === 'down' ? '#eff5fb' : '#eef4fb';
  const trendColor = '#103d68';
  const trendArrow = direction === 'down' ? '↓' : '↑';
  const trendHeadline = direction === 'down' ? 'DIMINUIÇÃO' : 'AUMENTO';
  const trendCaption = direction === 'down' ? 'ABAIXO DA REFERÊNCIA' : 'ACIMA DA REFERÊNCIA';

  return `
    <svg viewBox="0 0 180 140" role="img" aria-label="Ilustração de outlier de profundidade com ${trendCaption.toLowerCase()}" class="illustration illustration--depth" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="160" height="120" rx="24" fill="#f8fbff" />
      <circle cx="132" cy="38" r="28" fill="#dfeaf6" opacity="0.75" />
      <g opacity="0.65" stroke="#c9d3e0" stroke-width="1.2" stroke-linecap="round">
        <path d="M34 28h14M34 38h10M34 48h14M34 58h10M34 68h14M34 78h10M34 88h14M34 98h10M34 108h14" />
      </g>
      <path d="M78 26h24c8 0 14 6 14 14v56c0 15-10 25-26 25s-26-10-26-25V40c0-8 6-14 14-14z" fill="#122136" />
      <path d="M80 34h20c6 0 11 5 11 11v42c0 10-7 17-21 17s-21-7-21-17V45c0-6 5-11 11-11z" fill="#15263b" opacity="0.92" />
      <path d="M90 28v16" stroke="#d51f2b" stroke-width="4" stroke-linecap="round" />
      <path d="M82 38l8 8 8-8" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M45 116h90" stroke="#aeb9c9" stroke-width="2" stroke-linecap="round" />
      <circle cx="90" cy="100" r="10" fill="#d51f2b" opacity="0.12" />
      <circle cx="90" cy="100" r="5.5" fill="#d51f2b" />
      <path d="M64 102c8-6 16-9 26-9s18 3 26 9" fill="none" stroke="#5f7088" stroke-width="2" stroke-linecap="round" opacity="0.75" />
      ${renderTrendGlyph(trendArrow, trendHeadline, trendCaption, trendColor, trendFill)}
    </svg>
  `;
}

function renderChargeArt(reason) {
  const direction = getReasonDirection(reason);
  const trendFill = direction === 'down' ? '#fff4f4' : '#fdeeee';
  const trendColor = '#d51f2b';
  const trendArrow = direction === 'down' ? '↓' : '↑';
  const trendHeadline = direction === 'down' ? 'DIMINUIÇÃO' : 'AUMENTO';
  const trendCaption = direction === 'down' ? 'ABAIXO DA REFERÊNCIA' : 'ACIMA DA REFERÊNCIA';

  return `
    <svg viewBox="0 0 180 140" role="img" aria-label="Ilustração de outlier de carga com ${trendCaption.toLowerCase()}" class="illustration illustration--charge" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="160" height="120" rx="24" fill="#f8fbff" />
      <circle cx="55" cy="40" r="24" fill="#f6dfe1" opacity="0.76" />
      <g opacity="0.65" stroke="#c9d3e0" stroke-width="1.2" stroke-linecap="round">
        <path d="M32 34h14M32 46h10M32 58h14M32 70h10M32 82h14M32 94h10M32 106h14" />
      </g>
      <rect x="70" y="22" width="44" height="96" rx="22" fill="#132235" stroke="#d7dfec" stroke-width="1.2" />
      <rect x="78" y="32" width="28" height="76" rx="14" fill="#0f1c2c" opacity="0.96" />
      <rect x="80" y="38" width="24" height="10" rx="5" fill="#ef4c54" />
      <rect x="80" y="51" width="24" height="10" rx="5" fill="#ef4c54" />
      <rect x="80" y="64" width="24" height="10" rx="5" fill="#d51f2b" />
      <rect x="80" y="77" width="24" height="10" rx="5" fill="#ef4c54" />
      <rect x="80" y="90" width="24" height="10" rx="5" fill="#d51f2b" />
      <path d="M126 34l4 8 8 4-8 4-4 8-4-8-8-4 8-4 4-8z" fill="#d51f2b" />
      <path d="M44 116h92" stroke="#aeb9c9" stroke-width="2" stroke-linecap="round" />
      <path d="M141 38h12M141 50h8M141 62h12M141 74h8M141 86h12M141 98h8" stroke="#aeb9c9" stroke-width="2" stroke-linecap="round" />
      ${renderTrendGlyph(trendArrow, trendHeadline, trendCaption, trendColor, trendFill)}
    </svg>
  `;
}

function renderTrendGlyph(arrow, headline, caption, color, panelFill) {
  return `
    <g transform="translate(118 20)">
      <rect x="0" y="0" width="48" height="100" rx="24" fill="${panelFill}" stroke="#d7dfec" stroke-width="1" />
      <circle cx="24" cy="27" r="14" fill="${color}" opacity="0.14" />
      <text x="24" y="36" text-anchor="middle" fill="${color}" font-size="28" font-weight="700" font-family="'IBM Plex Sans', system-ui, sans-serif">${arrow}</text>
      <text x="24" y="64" text-anchor="middle" fill="${color}" font-size="8.5" font-weight="700" letter-spacing="0.14em" font-family="'IBM Plex Sans', system-ui, sans-serif">${headline}</text>
      <text x="24" y="81" text-anchor="middle" fill="#66758a" font-size="6.5" font-weight="700" letter-spacing="0.08em" font-family="'IBM Plex Sans', system-ui, sans-serif">${caption}</text>
    </g>
  `;
}

function buildOutlierTitle(reasons) {
  const descriptors = [...new Set(reasons.map((reason) => describeOutlierDescriptor(reason)))];

  if (!descriptors.length) {
    return 'Outlier';
  }

  return `Outlier de ${descriptors.join(' e ')}`;
}

function describeOutlierDescriptor(reason) {
  const direction = getReasonDirection(reason);

  if (reason.metric === 'depth') {
    return direction === 'down' ? 'Baixa Profundidade' : 'Alta Profundidade';
  }

  return direction === 'down' ? 'Carga Reduzida' : 'Carga Elevada';
}

function getReasonDirection(reason) {
  return reason.score < 0 ? 'down' : 'up';
}

function showEmptyState(title, detail = '') {
  elements.emptyState.classList.remove('hidden');
  elements.resultsBody.classList.add('hidden');
  elements.resultsBody.innerHTML = '';

  if (detail) {
    elements.emptyState.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span>`;
    return;
  }

  elements.emptyState.textContent = title;
}

function showError(message, detail = '') {
  setStatus(message, 'error');
  showEmptyState(message, detail);
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

function formatSignedNumber(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return '-';
  }

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
    signDisplay: 'always',
  }).format(value);
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
