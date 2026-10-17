import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  MASTERED_RULE, freshState, masteredProgress, objectiveEvidence, pickQuestions, studyPlan, validateProgress, weakestObjectives,
} from '../dist/core.mjs';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const load = (name) => JSON.parse(readFileSync(path.join(dist, 'data', `${name}.json`), 'utf8'));
const attempt = (id, correct, objective = '1.1') => ({ id, domain: 1, objective, hint: null, correct, at: Date.now(), confidence: 'medium', mode: 'practice', sessionId: 's' });
const objectives = ['1.1', '1.2', '2.1'].map((id) => ({ id }));

function readyFor(count, correctFrom = 0) {
  const state = freshState();
  state.objectives['1.1'] = { read: true };
  state.attempts = Array.from({ length: count }, (_, i) => attempt(`q${i}`, i >= correctFrom));
  return state;
}

test('Mastered needs 20 distinct questions, 90% over the last 20, and no open misses', () => {
  assert.equal(objectiveEvidence(readyFor(19), '1.1').status, 'Strong', '19 questions is not enough');
  assert.equal(objectiveEvidence(readyFor(20), '1.1').status, 'Mastered');
  const sloppy = readyFor(20);
  // One wrong answer in the last 10 keeps Strong (90%), but three wrong in the last 20 is 85%.
  [2, 5, 12].forEach((i) => { sloppy.attempts[i].correct = false; });
  const ev = objectiveEvidence(sloppy, '1.1');
  assert.equal(ev.status, 'Strong');
  assert.equal(ev.mastered, false);
});

test('an unresolved miss blocks Mastered until the question is answered correctly', () => {
  const state = readyFor(22);
  state.attempts[3].correct = false;
  state.attempts.push(...Array.from({ length: 0 }, () => null));
  assert.equal(objectiveEvidence(state, '1.1').openMisses, 1);
  assert.equal(objectiveEvidence(state, '1.1').mastered, false);
  state.attempts.push(attempt('q3', true));
  assert.equal(objectiveEvidence(state, '1.1').openMisses, 0);
  assert.equal(objectiveEvidence(state, '1.1').status, 'Mastered');
});

test('mastered progress reports each criterion and only completes when mastered', () => {
  const half = masteredProgress(objectiveEvidence(readyFor(10), '1.1'));
  assert.equal(half.volume, 0.5);
  assert.ok(half.overall < 1);
  assert.equal(masteredProgress(objectiveEvidence(readyFor(MASTERED_RULE.unique), '1.1')).overall, 1);
});

test('weak spots rank unfinished objectives by least progress and skip mastered ones', () => {
  const state = readyFor(20); // 1.1 is mastered
  state.attempts.push(attempt('r1', false, '1.2'), attempt('r2', true, '1.2'));
  const weak = weakestObjectives(objectives, state, 3).map((w) => w.id);
  assert.ok(!weak.includes('1.1'), 'mastered objectives are excluded');
  assert.deepEqual(weak, ['2.1', '1.2'], 'an untouched objective ranks before a started one');
  assert.equal(weakestObjectives(objectives, state, 1).length, 1);
});

test('selection can be limited to several objectives at once', () => {
  const bank = ['1.1', '1.2', '2.1'].flatMap((o) => Array.from({ length: 5 }, (_, i) => ({ id: `${o}-${i}`, domain: Number(o[0]), objective: o, source: 'original', options: [], correct_answers: ['A'] })));
  const picked = pickQuestions(bank, { count: 50, objectives: ['1.2', '2.1'] });
  assert.equal(picked.length, 10);
  assert.ok(picked.every((q) => ['1.2', '2.1'].includes(q.objective)));
  assert.equal(pickQuestions(bank, { count: 50, objectives: [] }).length, 0);
});

test('study plan counts workload from the exam date and warns when new cards cannot fit', () => {
  const data = { objectives, cards: Array.from({ length: 300 }, (_, i) => ({ id: `c${i}` })) };
  const state = freshState();
  const plan = studyPlan(data, state, '2026-11-01', new Date(2026, 9, 17, 22, 30));
  assert.equal(plan.daysLeft, 15, 'late in the evening still counts whole calendar days');
  assert.equal(plan.usableDays, 12);
  assert.equal(plan.unreadGuides, 3);
  assert.equal(plan.toStrong, 24);
  assert.equal(plan.toMastered, 60);
  assert.equal(plan.questionsPerDay, 5);
  assert.equal(plan.cardsFit, false, '10 new cards a day over 12 days is 120, not 300');
  state.profile.newPerDay = 25;
  assert.equal(studyPlan(data, state, '2026-11-01', new Date(2026, 9, 17)).cardsFit, true);
});

test('study plan handles missing, invalid, past and same-day exam dates', () => {
  const data = { objectives, cards: [] };
  const state = freshState();
  const now = new Date(2026, 9, 17);
  assert.equal(studyPlan(data, state, '', now), null);
  assert.equal(studyPlan(data, state, 'next week', now), null);
  assert.equal(studyPlan(data, state, '2026-10-01', now).past, true);
  const today = studyPlan(data, state, '2026-10-17', now);
  assert.equal(today.daysLeft, 0);
  assert.equal(today.usableDays, 1, 'never divides by zero');
});

test('exam date survives backup and is dropped when malformed', () => {
  const ok = validateProgress({ version: 1, attempts: [], activities: [], profile: { examDate: '2026-12-01' } });
  assert.equal(ok.profile.examDate, '2026-12-01');
  const bad = validateProgress({ version: 1, attempts: [], activities: [], profile: { examDate: '<script>' } });
  assert.equal(bad.profile.examDate, '');
});

/* ---------- generated data ---------- */

const guide = load('guide');
const catalog = load('catalog');
const objectiveIds = new Set(catalog.domains.flatMap((d) => d.objectives.map((o) => o.id)));
const strings = (v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);

test('study guide: 12 chapters, 260 questions with valid answers and explanations', () => {
  assert.equal(guide.chapters.length, 12);
  assert.equal(guide.questions.length, 260);
  assert.equal(new Set(guide.questions.map((q) => q.id)).size, 260);
  for (const q of guide.questions) {
    const labels = new Set(q.options.map((o) => o.label));
    assert.equal(q.options.length, 4, q.id);
    assert.ok(q.correct_answers.length >= 1 && q.correct_answers.every((a) => labels.has(a)), q.id);
    assert.ok(q.explanation.length > 20, `${q.id} explanation`);
    assert.ok(q.domain >= 1 && q.domain <= 4, `${q.id} domain`);
    assert.ok(q.objective === null || objectiveIds.has(q.objective), q.id);
  }
});

test('study guide: sections map only to real objectives and cover all 15', () => {
  const covered = new Set();
  for (const c of guide.chapters) {
    assert.ok(c.readings.length >= 1 && c.essentials.length > 100, `chapter ${c.number}`);
    for (const r of c.readings) for (const o of r.objectives) { assert.ok(objectiveIds.has(o), r.id); covered.add(o); }
  }
  assert.deepEqual([...objectiveIds].filter((o) => !covered.has(o)), [], 'every objective has at least one study-guide section');
});

test('study guide: images resolve and no active markup survives', () => {
  const missing = [];
  const html = [];
  for (const c of guide.chapters) { html.push(c.essentials); for (const r of c.readings) html.push(r.html); }
  for (const q of guide.questions) html.push(q.prompt.html, q.explanationHtml, ...q.options.map((o) => o.html));
  for (const h of html) {
    for (const m of h.matchAll(/src="([^"]+)"/g)) if (!existsSync(path.join(dist, m[1]))) missing.push(m[1]);
    assert.ok(!/<(script|iframe|object|embed|form)|<[a-z][^>]*\son[a-z]+\s*=/i.test(h), 'active markup');
    assert.ok(!h.includes('[Image unavailable]'));
  }
  assert.deepEqual([...new Set(missing)], []);
});

test('duplicates: every drop and keep exists, and no question is both kept and dropped', () => {
  const dupes = load('duplicates');
  const ids = new Set([...load('questions'), ...load('original').questions, ...guide.questions].map((q) => q.id));
  const cardIds = new Set(load('cards').map((c) => c.id));
  for (const [drop, keep] of Object.entries(dupes.questions)) {
    assert.ok(ids.has(drop) && ids.has(keep), `${drop} -> ${keep}`);
    assert.ok(!dupes.questions[keep], `${keep} is kept but also dropped`);
  }
  for (const [drop, keep] of Object.entries(dupes.cards)) {
    assert.ok(cardIds.has(drop) && cardIds.has(keep), `${drop} -> ${keep}`);
    assert.ok(!dupes.cards[keep], `${keep} is kept but also dropped`);
  }
  assert.ok(Object.keys(dupes.questions).length >= 5, 'the audit found the known duplicates');
});

test('duplicates: the audit keeps the better-mapped copy', () => {
  const dupes = load('duplicates');
  const rank = { original: 0, reviewed: 1, source: 2, 'domain-only': 3 };
  const byId = new Map([...load('questions'), ...load('original').questions, ...guide.questions].map((q) => [q.id, q]));
  for (const [drop, keep] of Object.entries(dupes.questions)) assert.ok(rank[byId.get(keep).mapping] <= rank[byId.get(drop).mapping], `${keep} should not be less trusted than ${drop}`);
});

test('inferred objectives only label domain-only questions, inside their own domain', () => {
  const inferred = load('inferred');
  const byId = new Map([...load('questions'), ...guide.questions].map((q) => [q.id, q]));
  const entries = Object.entries(inferred);
  assert.ok(entries.length > 100);
  for (const [id, v] of entries) {
    const q = byId.get(id);
    assert.ok(q, id);
    assert.equal(q.mapping, 'domain-only', `${id} already had a mapping`);
    assert.ok(objectiveIds.has(v.o) && Number(v.o[0]) === q.domain, `${id}: ${v.o} is outside domain ${q.domain}`);
    assert.ok(v.m >= 1.5, `${id} below the validated margin`);
  }
});

test('inference was validated and its measured accuracy is recorded', () => {
  const report = JSON.parse(readFileSync(path.join(dist, '..', 'docs', 'objective_inference.json'), 'utf8'));
  assert.ok(report.validation_questions >= 80);
  assert.ok(report.chosen && report.chosen.precision >= report.target_precision);
});

test('original deep dives cover the thin official topics and every objective keeps 3+ original questions', () => {
  const original = load('original');
  const titles = original.guides.flatMap((g) => (g.deep ?? []).map((d) => d.title.toLowerCase())).join(' | ');
  for (const topic of ['decoding', 'whois', 'pyramid of pain', 'stride', 'playbooks', 'secure coding', 'isolation', 'handing over']) assert.ok(titles.includes(topic), topic);
  const per = {};
  for (const q of original.questions) per[q.objective] = (per[q.objective] ?? 0) + 1;
  for (const id of objectiveIds) assert.ok(per[id] >= 3, `${id} has ${per[id]} original questions`);
  assert.ok(strings(original.guides).every((s) => !/[<>]/.test(s)), 'guide text is plain text');
});

test('coverage report shows the official topics are covered, with few weak spots left', () => {
  const report = JSON.parse(readFileSync(path.join(dist, '..', 'docs', 'coverage.json'), 'utf8'));
  const total = Object.values(report.objectives).reduce((n, rows) => n + rows.length, 0);
  assert.ok(total > 300);
  assert.ok(report.weak.length / total < 0.05, `${report.weak.length} of ${total} topics remain weakly covered`);
});

test('equally untouched objectives are ranked by exam weight, then id', () => {
  const list = [{ id: '4.1', weight: 16 }, { id: '1.1', weight: 34 }, { id: '2.1', weight: 26 }, { id: '1.2', weight: 34 }];
  assert.deepEqual(weakestObjectives(list, freshState(), 4).map((w) => w.id), ['1.1', '1.2', '2.1', '4.1']);
});
