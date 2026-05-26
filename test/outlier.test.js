import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { analyzePlanText, parsePlanText } from '../logic.js';

test('parses the real export model', () => {
  const filePath = fileURLToPath(new URL('../input/PP210526_EXEC.csv', import.meta.url));
  const text = readFileSync(filePath, 'utf8');
  const records = parsePlanText(text);

  assert.ok(records.length > 100);
  assert.equal(records[0].Number, '1');
  assert.equal(records[0].Length_Real, '11.3');
});

test('ignores deleted holes and flags depth and charge outliers', () => {
  const text = [
    'Number\tLength\tLength_Real\tTotal_Charge_Real\tjson\teliminated\tproblemList',
    '1\t10\t10\t150\t[{"qty":150}]\t0\t[]',
    '2\t10\t10.2\t151\t[{"qty":151}]\t0\t[]',
    '3\t10\t9.8\t149\t[{"qty":149}]\t0\t[]',
    '4\t10\t25\t152\t[{"qty":152}]\t0\t[]',
    '5\t10\t10.1\t500\t[{"qty":500}]\t0\t[]',
    '6\t10\t30\t180\t[{"qty":180}]\t1\t[{"class":"deleted"}]',
  ].join('\n');

  const analysis = analyzePlanText(text);

  assert.equal(analysis.deletedRows, 1);
  assert.equal(analysis.activeRows, 5);
  assert.equal(analysis.depthOutlierCount, 1);
  assert.equal(analysis.chargeOutlierCount, 1);
  assert.equal(analysis.outlierCount, 2);
  assert.deepEqual(
    analysis.outliers.map((hole) => hole.number).sort((a, b) => Number(a) - Number(b)),
    ['4', '5'],
  );

  const depthHole = analysis.outliers.find((hole) => hole.number === '4');
  const chargeHole = analysis.outliers.find((hole) => hole.number === '5');

  assert.ok(depthHole);
  assert.ok(chargeHole);
  assert.equal(depthHole.reasons[0].label, 'Profundidade');
  assert.equal(chargeHole.reasons[0].label, 'Carga');
});
