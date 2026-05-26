const DELIMITERS = ['\t', ';', ','];

export function detectDelimiter(headerLine) {
  let winner = '\t';
  let bestScore = -1;

  for (const delimiter of DELIMITERS) {
    const score = String(headerLine).split(delimiter).length - 1;
    if (score > bestScore) {
      winner = delimiter;
      bestScore = score;
    }
  }

  return winner;
}

export function parsePlanText(text) {
  const normalized = String(text ?? '').replace(/^\uFEFF/, '').trim();

  if (!normalized) {
    return [];
  }

  const lines = normalized.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (!lines.length) {
    return [];
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = lines[0].split(delimiter).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(delimiter);
    const record = {};

    headers.forEach((header, index) => {
      record[header] = values[index] ?? '';
    });

    return record;
  });
}

export function analyzePlanText(text) {
  const records = parsePlanText(text);
  const holes = records.map(normalizeHole).filter((hole) => hole.number !== '');
  const deletedHoles = holes.filter((hole) => hole.deleted);
  const activeHoles = holes.filter((hole) => !hole.deleted && (hole.charge > 0 || hole.chargeItems.length > 0));

  const depthStats = summarize(activeHoles.map((hole) => hole.depth));
  const chargeStats = summarize(activeHoles.map((hole) => hole.charge));

  const depthOutliers = scoreOutliers(activeHoles, 'depth', depthStats).map((entry) => ({
    ...entry,
    label: 'Profundidade',
    unit: 'm',
  }));

  const chargeOutliers = scoreOutliers(activeHoles, 'charge', chargeStats).map((entry) => ({
    ...entry,
    label: 'Carga',
    unit: 'kg',
  }));

  const outliers = mergeOutliers([...depthOutliers, ...chargeOutliers]);

  return {
    totalRows: holes.length,
    deletedRows: deletedHoles.length,
    activeRows: activeHoles.length,
    outlierCount: outliers.length,
    depthOutlierCount: depthOutliers.length,
    chargeOutlierCount: chargeOutliers.length,
    holes,
    activeHoles,
    depthStats,
    chargeStats,
    outliers,
  };
}

export function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return '-';
  }

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value, digits = 0) {
  if (!Number.isFinite(value)) {
    return '-';
  }

  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: 'always',
  }).format(value);

  return `${formatted}%`;
}

function normalizeHole(record) {
  const chargeItems = parseChargeItems(record.json);

  return {
    number: String(record.Number ?? '').trim(),
    depth: toNumber(record.Length_Real),
    charge: toNumber(record.Total_Charge_Real),
    plannedDepth: toNumber(record.Length),
    plannedCharge: toNumber(record.Total_Charge),
    deleted: isDeleted(record),
    chargeItems,
    row: record,
  };
}

function parseChargeItems(raw) {
  const value = String(raw ?? '').trim();

  if (!value || value === '[]') {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseProblemList(raw) {
  const value = String(raw ?? '').trim();

  if (!value || value === '[]') {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isDeleted(record) {
  if (toNumber(record.eliminated) === 1) {
    return true;
  }

  return parseProblemList(record.problemList).some((item) => String(item?.class ?? '').toLowerCase() === 'deleted');
}

function toNumber(value) {
  if (value === null || value === undefined) {
    return 0;
  }

  const normalized = String(value).trim().replace(',', '.');

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function summarize(values) {
  const clean = values.filter((value) => Number.isFinite(value));

  if (!clean.length) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      mad: 0,
      sd: 0,
      min: 0,
      max: 0,
    };
  }

  const sorted = [...clean].sort((a, b) => a - b);
  const mean = clean.reduce((sum, value) => sum + value, 0) / clean.length;
  const median = getMedian(sorted);
  const deviations = sorted.map((value) => Math.abs(value - median)).sort((a, b) => a - b);
  const mad = getMedian(deviations);
  const variance = clean.length > 1
    ? clean.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (clean.length - 1)
    : 0;
  const sd = Math.sqrt(variance);

  return {
    count: clean.length,
    mean,
    median,
    mad,
    sd,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

function getMedian(sortedValues) {
  if (!sortedValues.length) {
    return 0;
  }

  const middle = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middle];
  }

  return (sortedValues[middle - 1] + sortedValues[middle]) / 2;
}

function scoreOutliers(holes, metric, stats) {
  if (!stats.count) {
    return [];
  }

  const threshold = stats.mad > 0 ? 3.5 : stats.sd > 0 ? 2.5 : 0;

  return holes.flatMap((hole) => {
    const value = hole[metric];

    if (!Number.isFinite(value)) {
      return [];
    }

    let score = 0;
    let reference = stats.median;
    let method = 'mad';

    if (stats.mad > 0) {
      score = 0.6745 * (value - stats.median) / stats.mad;
      reference = stats.median;
      method = 'mad';
    } else if (stats.sd > 0) {
      score = (value - stats.mean) / stats.sd;
      reference = stats.mean;
      method = 'sd';
    } else {
      return [];
    }

    if (Math.abs(score) < threshold) {
      return [];
    }

    return [{
      hole,
      metric,
      value,
      score,
      method,
      reference,
    }];
  });
}

function mergeOutliers(entries) {
  const byHole = new Map();

  for (const entry of entries) {
    const key = entry.hole.number;
    const existing = byHole.get(key) ?? {
      number: entry.hole.number,
      depth: entry.hole.depth,
      charge: entry.hole.charge,
      chargeItems: entry.hole.chargeItems,
      row: entry.hole.row,
      reasons: [],
      severity: 0,
    };

    existing.reasons.push({
      metric: entry.metric,
      label: entry.label,
      unit: entry.unit,
      value: entry.value,
      reference: entry.reference,
      score: entry.score,
      method: entry.method,
    });
    existing.severity = Math.max(existing.severity, Math.abs(entry.score));
    byHole.set(key, existing);
  }

  return [...byHole.values()].sort((a, b) => b.severity - a.severity || compareHoleNumbers(a.number, b.number));
}

function compareHoleNumbers(a, b) {
  const left = Number(a);
  const right = Number(b);

  if (Number.isFinite(left) && Number.isFinite(right)) {
    return left - right;
  }

  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
}
