// SGPS trust-state contract — exercise production popup renderer functions.
// Node stdlib only; browser screenshots and real journeys are separate E3/E4 gates.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const src = fs.readFileSync(path.join(root, 'extension/popup.js'), 'utf8');
const slice = (start, end) => {
  const i = src.indexOf(start), j = src.indexOf(end, i + start.length);
  assert.ok(i >= 0 && j > i, 'Missing production renderer: ' + start);
  return src.slice(i, j);
};
const actual = slice('function renderRules() {', '\nfunction writeRules(')
  + '\n' + slice('function renderYoloNote() {', '\nfunction renderLogTop(');
const msg = {
  topicsNote: 'Only matching topics', keywordsNote: 'Keywords block approvals',
  yoloNote: 'YOLO can click standing grants',
  rulesIgnoredYolo: 'YOLO rules ignored',
  yoloDormant: 'YOLO configured; logging-only',
  dryRunChip: 'Dry-run', yoloChip: 'YOLO',
  topicsEmpty: 'No topics', keywordsEmpty: 'No keywords'
};
function check(yoloMode, dryRun, armed = false) {
  const elements = Object.fromEntries(
    ['topicsNote','keywordsNote','topicsList','kwList','dryBand','safetyChip','yoloNote']
      .map(id => [id, { textContent: 'initial confirmation', innerHTML: '', hidden: true }])
  );
  const context = {
    v18: { yoloMode, dryRun, rules: { topics: [], keywords: [] } },
    yoloArmed: armed, $: id => elements[id] || null,
    t: (key, fallback) => msg[key] || fallback,
    esc: s => String(s), renderLogTop: () => {}
  };
  vm.runInNewContext(actual + '\nrenderRules(); renderDry();', context);
  assert.equal(elements.dryBand.hidden, !dryRun, 'dry-run banner must match effective mode');
  assert.equal(elements.safetyChip.hidden, !(dryRun || yoloMode));
  const expectedChip = dryRun ? 'Dry-run' : yoloMode ? 'YOLO' : 'initial confirmation';
  assert.equal(elements.safetyChip.textContent, expectedChip, 'effective mode wins');
  assert.equal(elements.topicsNote.textContent, yoloMode ? 'YOLO rules ignored' : 'Only matching topics');
  assert.equal(elements.keywordsNote.textContent, yoloMode ? 'YOLO rules ignored' : 'Keywords block approvals');
  const expectedNote = armed ? 'initial confirmation' : yoloMode && dryRun ? 'YOLO configured; logging-only' : 'YOLO can click standing grants';
  assert.equal(elements.yoloNote.textContent, expectedNote, 'confirmation not erased by refresh');
}
for (const yolo of [false, true]) for (const dry of [false, true]) check(yolo, dry);
check(false, false, true);
console.log('PASS: effective YOLO/Dry-run states and armed confirmation (5 checks)');
