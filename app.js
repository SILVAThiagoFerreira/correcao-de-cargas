import { analyzePlanText, formatNumber, formatPercent } from './logic.js';

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
    alerts: document.getElementById('metricAlerts'),
  },
  resultsTitle: document.getElementById('resultsTitle'),
  resultsMeta: document.getElementById('resultsMeta'),
  emptyState: document.getElementById('emptyState'),
  tableWrap: document.getElementById('tableWrap'),
  tbody: document.getElementById('resultsBody'),
};

let lastFileName = 'Nenhum arquivo carregado';

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
  setStatus('Carregue o arquivo exportado para analisar.', 'neutral');
  setMetrics({
    loaded: '-',
    deleted: '-',
    depth: '-',
    charge: '-',
    alerts: '-',
  });
  showEmptyState('Envie um arquivo para iniciar a leitura.', 'O sistema aceita o modelo exportado pelo app e ignora automaticamente os furos deletados.');
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
    showError('Não foi possível carregar o exemplo. Envie um arquivo do app ou tente novamente.');
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
    showError('Não foi possível ler esse arquivo. Verifique se ele segue o modelo exportado pelo app.');
  } finally {
    setBusy(false);
  }
}

function renderAnalysis(analysis, fileName) {
  lastFileName = fileName;
  setFileName(fileName);

  const alertText = analysis.outlierCount === 0
    ? 'Nenhum alerta'
    : `${analysis.outlierCount} suspeitos`;

  setStatus(
    `${analysis.activeRows} furos carregados analisados. ${analysis.deletedRows} deletados ignorados. ${analysis.outlierCount} suspeitos encontrados.`,
    analysis.outlierCount > 0 ? 'alert' : 'neutral',
  );

  setMetrics({
    loaded: analysis.activeRows,
    deleted: analysis.deletedRows,
    depth: `${formatNumber(analysis.depthStats.mean, 2)} m`,
    charge: `${formatNumber(analysis.chargeStats.mean, 2)} kg`,
    alerts: alertText,
  });

  if (!analysis.activeRows) {
    showEmptyState('Nenhum furo carregado foi encontrado nesse arquivo.', 'Se o arquivo estiver no modelo correto, a leitura acontece automaticamente ao importar.');
    return;
  }

  if (!analysis.outliers.length) {
    showEmptyState('Nenhum outlier encontrado.', 'Os furos carregados ficaram dentro da faixa esperada para profundidade e carga.');
    return;
  }

  elements.emptyState.classList.add('hidden');
  elements.tableWrap.classList.remove('hidden');
  elements.resultsTitle.textContent = 'Furos com alerta';
  elements.resultsMeta.textContent = `${analysis.outliers.length} furos sinalizados`;
  elements.tbody.innerHTML = analysis.outliers.map(renderRow).join('');
}

function renderRow(hole) {
  const depthReason = hole.reasons.find((reason) => reason.metric === 'depth');
  const chargeReason = hole.reasons.find((reason) => reason.metric === 'charge');
  const reasonBadges = hole.reasons.map((reason) => {
    const badgeClass = reason.metric === 'depth' ? 'badge badge--depth' : 'badge badge--charge';
    const delta = reason.reference > 0 ? formatPercent(((reason.value - reason.reference) / reason.reference) * 100, 0) : '-';

    return `<span class="${badgeClass}">${escapeHtml(reason.label)} ${escapeHtml(delta)}</span>`;
  }).join('');

  const primaryReason = hole.reasons[0];

  return `
    <tr class="outlier-row">
      <td>
        <strong>Furo ${escapeHtml(hole.number)}</strong>
        <span class="subtle">${escapeHtml(hole.reasons.length > 1 ? 'Mais de um alerta' : primaryReason.label)}</span>
      </td>
      <td>
        <strong>${escapeHtml(formatNumber(hole.depth, 2))} m</strong>
        <span class="subtle">Referência: ${depthReason ? escapeHtml(formatNumber(depthReason.reference, 2)) + ' m' : '—'}</span>
      </td>
      <td>
        <strong>${escapeHtml(formatNumber(hole.charge, 2))} kg</strong>
        <span class="subtle">Referência: ${chargeReason ? escapeHtml(formatNumber(chargeReason.reference, 2)) + ' kg' : '—'}</span>
      </td>
      <td>
        <div class="badge-row">${reasonBadges}</div>
      </td>
    </tr>
  `;
}

function showEmptyState(title, description) {
  elements.emptyState.classList.remove('hidden');
  elements.tableWrap.classList.add('hidden');
  elements.resultsTitle.textContent = 'Furos com alerta';
  elements.resultsMeta.textContent = 'Lista vazia';
  elements.emptyState.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(description)}</span>
  `;
}

function showError(message) {
  setStatus(message, 'error');
  showEmptyState('Não foi possível analisar o arquivo.', 'Envie um CSV/TSV exportado no mesmo modelo do app.');
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
  elements.metrics.alerts.textContent = values.alerts;
}

function setBusy(isBusy) {
  elements.sampleButton.disabled = isBusy;
  elements.fileInput.disabled = isBusy;
  elements.dropzone.classList.toggle('is-busy', isBusy);
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
