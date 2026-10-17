import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const load = (name) => JSON.parse(readFileSync(path.join(dist, 'data', `${name}.json`), 'utf8'));
const questions = load('questions');
const lessons = load('lessons');
const cards = load('cards');
const catalog = load('catalog');
const OBJECTIVES = new Set(catalog.domains.flatMap((d) => d.objectives.map((o) => o.id)));

const strings = (value) => (typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : []);
const imageRefs = (value) => strings(value).flatMap((s) => [...s.matchAll(/src="([^"]+)"/g)].map((m) => m[1]));

test('dataset sizes match the catalog', () => {
  assert.equal(questions.length, 1406);
  assert.equal(lessons.length, 51);
  assert.equal(cards.length, 2339);
  assert.equal(catalog.stats.bookImages, 150);
  assert.equal(OBJECTIVES.size, 15);
});

test('ids are unique', () => {
  for (const set of [questions, lessons, cards]) assert.equal(new Set(set.map((x) => x.id)).size, set.length);
});

test('every question has valid answers and an explanation', () => {
  for (const q of questions) {
    const labels = new Set(q.options.map((o) => o.label));
    assert.ok(q.options.length >= 2, q.id);
    assert.ok(q.correct_answers.length >= 1, q.id);
    for (const a of q.correct_answers) assert.ok(labels.has(a), `${q.id} answer ${a}`);
    assert.ok(q.explanation && q.explanation.length > 0, `${q.id} explanation`);
    assert.ok(q.objective === null || OBJECTIVES.has(q.objective), `${q.id} objective ${q.objective}`);
  }
});

test('book question counts per chapter match the source book', () => {
  const counts = {};
  for (const q of questions.filter((x) => x.source === 'sybex')) counts[q.sourceChapter] = (counts[q.sourceChapter] ?? 0) + 1;
  assert.deepEqual(counts, { 1: 250, 2: 333, 3: 150, 4: 103, 5: 85, 6: 85 });
});

test('no unavailable-image placeholders and every image resolves locally', () => {
  const missing = [];
  for (const item of [...questions, ...lessons, ...cards]) {
    const text = JSON.stringify(item);
    assert.ok(!text.includes('[Image unavailable]'), `${item.id} has a placeholder`);
    for (const src of imageRefs(item)) if (!existsSync(path.join(dist, src))) missing.push(`${item.id}: ${src}`);
  }
  assert.deepEqual(missing, []);
});

test('no active markup survives sanitising', () => {
  const html = [
    ...questions.flatMap((q) => [q.prompt.html, q.explanationHtml, ...q.options.map((o) => o.html)]),
    ...lessons.map((l) => l.html),
    ...cards.flatMap((c) => [c.front, c.back]),
  ];
  const active = /<(script|iframe|object|embed|form)\b|\son[a-z]+\s*=\s*["']|(href|src)\s*=\s*["']\s*(javascript|data|vbscript):/i;
  assert.deepEqual(html.filter((h) => active.test(h)).slice(0, 3), []);
});

test('book questions never carry invented objective mappings', () => {
  for (const q of questions.filter((x) => x.source === 'sybex')) {
    assert.equal(q.objective, null, q.id);
    assert.equal(q.mapping, 'domain-only', q.id);
  }
});

test('detection-metric errata are applied', () => {
  const q = questions.find((x) => x.id === 'D4-058');
  assert.match(q.explanation, /TP\/\(TP\+FP\)/);
  const lesson = lessons.find((l) => l.title === 'Incident Response Metrics and KPIs');
  assert.match(lesson.html, /FP\/\(FP\+TN\)/);
});

test('trainers and library files exist', () => {
  for (const t of catalog.trainers) assert.ok(existsSync(path.join(dist, t.path)), t.path);
  for (const l of catalog.library) assert.ok(existsSync(path.join(dist, l.path)), l.path);
  assert.equal(catalog.trainers.length, 13);
});

const original = load('original');

test('original content covers every objective with a guide, questions and balanced answers', () => {
  assert.equal(original.guides.length, 15);
  assert.equal(original.cases.length, 3);
  const perObjective = {};
  for (const q of original.questions) perObjective[q.objective] = (perObjective[q.objective] ?? 0) + 1;
  for (const id of OBJECTIVES) assert.ok(perObjective[id] >= 1, `objective ${id} has an original question`);
  for (const g of original.guides) assert.ok(g.know.length >= 3 && g.traps.length >= 1 && g.decide && g.core, g.objective);
  for (const q of original.questions) {
    assert.equal(q.options.length, 4, q.id);
    assert.equal(q.correct_answers.length, 1, q.id);
    assert.equal(q.mapping, 'original', q.id);
    assert.equal(new Set(q.options.map((o) => o.text)).size, 4, `${q.id} has duplicate options`);
  }
});

test('original questions do not leak the answer through option length', () => {
  const longest = original.questions.filter((q) => {
    const lengths = q.options.map((o) => o.text.length), max = Math.max(...lengths);
    const correct = lengths[q.correct_answers[0].charCodeAt(0) - 65];
    return correct === max && lengths.filter((l) => l === max).length === 1;
  }).length;
  assert.ok(longest / original.questions.length <= 0.35, `correct option is uniquely longest in ${longest} of ${original.questions.length}`);
});

test('case and PBQ answers point at real options', () => {
  for (const c of original.cases) for (const s of c.steps) assert.ok(s.answer >= 0 && s.answer < s.options.length, c.id);
  for (const p of load('pbqs')) for (const f of p.fields) assert.ok(f.answer >= 0 && f.answer < f.options.length, p.id);
  for (const lab of load('labs')) for (const c of lab.console.configs ?? []) assert.ok(c.options.includes(c.correct), lab.id);
});
