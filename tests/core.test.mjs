import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canShuffleOptions, dayKey, domainStats, dueCards, freshState, isCorrect, misconceptions, missedCount, newCards, objectiveEvidence,
  pickQuestions, prepareQuestion, scheduleReview, shuffle, streak, strongProgress, validateProgress, weightedCounts,
} from '../dist/core.mjs';

const DOMAINS = [{ id: 1, weight: 34 }, { id: 2, weight: 26 }, { id: 3, weight: 24 }, { id: 4, weight: 16 }];
const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const q = (id, domain, extra = {}) => ({
  id, domain, objective: `${domain}.1`, source: 'community', sourceChapter: null,
  options: ['A', 'B', 'C', 'D'].map((label, i) => ({ label, text: `Option ${i}` })), correct_answers: ['B'], explanation: 'because', ...extra,
});
const bank = DOMAINS.flatMap((d) => Array.from({ length: 40 }, (_, i) => q(`d${d.id}-${i}`, d.id)));
const attempt = (id, correct, extra = {}) => ({ id, domain: 1, objective: '1.1', hint: null, correct, at: Date.now(), confidence: 'medium', mode: 'practice', sessionId: 's', ...extra });

test('weighted counts always sum to the requested total and follow the domain weights', () => {
  for (const total of [85, 10, 7, 1, 100]) {
    const counts = weightedCounts(total, DOMAINS);
    assert.equal(counts.reduce((n, c) => n + c.count, 0), total, `total ${total}`);
  }
  assert.deepEqual(weightedCounts(100, DOMAINS).map((c) => c.count), [34, 26, 24, 16]);
  assert.deepEqual(weightedCounts(85, DOMAINS).map((c) => c.count), [29, 22, 20, 14]);
});

test('weighted exam selection honours the allocation without duplicates', () => {
  const picked = pickQuestions(bank, { count: 85, mode: 'exam', domains: DOMAINS, random: seeded(3) });
  assert.equal(picked.length, 85);
  assert.equal(new Set(picked.map((x) => x.id)).size, 85);
  const per = (d) => picked.filter((x) => x.domain === d).length;
  assert.deepEqual([1, 2, 3, 4].map(per), [29, 22, 20, 14]);
});

test('selection returns fewer questions, not errors, when the pool is too small', () => {
  assert.equal(pickQuestions(bank, { count: 500, random: seeded() }).length, bank.length);
  assert.equal(pickQuestions(bank, { count: 10, objective: '9.9' }).length, 0);
  assert.equal(pickQuestions([], { count: 10 }).length, 0);
});

test('filters by domain, objective and source', () => {
  assert.ok(pickQuestions(bank, { count: 100, domain: 2 }).every((x) => x.domain === 2));
  assert.ok(pickQuestions(bank, { count: 100, objective: '3.1' }).every((x) => x.objective === '3.1'));
  assert.equal(pickQuestions(bank, { count: 100, source: 'sybex' }).length, 0);
});

test('mixed mode shows unseen questions before ones already answered', () => {
  const state = freshState();
  const seen = bank.filter((x) => x.domain === 1).slice(0, 35);
  state.attempts = seen.map((x) => attempt(x.id, true));
  const picked = pickQuestions(bank, { count: 10, domain: 1, state, random: seeded(5) });
  assert.equal(picked.length, 10);
  const unseen = bank.filter((x) => x.domain === 1 && !seen.some((s) => s.id === x.id)).map((x) => x.id).sort();
  assert.deepEqual(picked.slice(0, 5).map((x) => x.id).sort(), unseen, 'the 5 unseen questions come first');
  assert.ok(picked.slice(5).every((x) => seen.some((s) => s.id === x.id)));
});

test('missed mode uses the latest attempt per question', () => {
  const state = freshState();
  state.attempts = [attempt('d1-0', false), attempt('d1-0', true), attempt('d1-1', true), attempt('d1-1', false), attempt('d1-2', false)];
  const ids = pickQuestions(bank, { count: 10, mode: 'missed', state }).map((x) => x.id).sort();
  assert.deepEqual(ids, ['d1-1', 'd1-2']);
});

test('bookmark mode returns only bookmarked questions', () => {
  const state = freshState();
  state.bookmarks = ['d2-3', 'd4-4'];
  assert.deepEqual(pickQuestions(bank, { count: 10, mode: 'bookmarks', state }).map((x) => x.id).sort(), ['d2-3', 'd4-4']);
});

test('adaptive mode favours previously missed questions', () => {
  const state = freshState();
  const missed = bank.filter((x) => x.domain === 1).slice(0, 5);
  state.attempts = [...missed.map((x) => attempt(x.id, false)), ...bank.filter((x) => x.domain === 1).slice(5, 30).map((x) => attempt(x.id, true))];
  let hits = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const picked = pickQuestions(bank, { count: 5, domain: 1, mode: 'adaptive', state, random: seeded(seed) });
    hits += picked.filter((x) => missed.some((m) => m.id === x.id)).length;
  }
  // Uniform selection would hit a missed question 5/40 of the time: about 37 hits over 60 draws of 5.
  assert.ok(hits > 56, `expected adaptive weighting to favour misses well above the uniform baseline of ~37, got ${hits}`);
});

test('shuffling keeps answer identity: the correct key is judged by key, not position', () => {
  const question = q('x', 1);
  for (let seed = 1; seed <= 25; seed++) {
    const prepared = prepareQuestion(question, seeded(seed));
    assert.equal(prepared.options.length, 4);
    assert.deepEqual(prepared.options.map((o) => o.key).sort(), ['A', 'B', 'C', 'D']);
    const shownForB = prepared.options.find((o) => o.key === 'B').shown;
    assert.ok(['A', 'B', 'C', 'D'].includes(shownForB));
    assert.equal(isCorrect(question, ['B']), true);
    assert.equal(isCorrect(question, [prepared.options.find((o) => o.key === 'A').key]), false);
  }
  const orders = new Set(Array.from({ length: 25 }, (_, s) => prepareQuestion(question, seeded(s + 1)).options.map((o) => o.key).join('')));
  assert.ok(orders.size > 3, 'options are actually shuffled');
});

test('multi-answer questions need the exact set', () => {
  const multi = q('m', 1, { correct_answers: ['A', 'C'] });
  assert.equal(isCorrect(multi, ['C', 'A']), true);
  assert.equal(isCorrect(multi, ['A']), false);
  assert.equal(isCorrect(multi, ['A', 'B', 'C']), false);
});

test('order-dependent options and letter-citing explanations are not shuffled', () => {
  const all = q('o', 1, { options: [{ label: 'A', text: 'Phishing' }, { label: 'B', text: 'Smishing' }, { label: 'C', text: 'Both A and B' }, { label: 'D', text: 'None of the above' }] });
  assert.equal(canShuffleOptions(all), false);
  assert.equal(canShuffleOptions(q('e', 1, { explanation: 'As noted in option B, the flag differs.' })), false);
  assert.equal(canShuffleOptions(q('ok', 1)), true);
  assert.deepEqual(prepareQuestion(all).options.map((o) => o.key), ['A', 'B', 'C', 'D']);
});

test('objective evidence needs reading, volume and recent accuracy before it is Strong', () => {
  const state = freshState();
  assert.equal(objectiveEvidence(state, '1.1').status, 'New');
  state.objectives['1.1'] = { read: true };
  assert.equal(objectiveEvidence(state, '1.1').status, 'Learning');
  state.attempts = Array.from({ length: 7 }, (_, i) => attempt(`q${i}`, true));
  assert.equal(objectiveEvidence(state, '1.1').status, 'Practicing', 'only 7 distinct questions');
  state.attempts.push(attempt('q7', true));
  assert.equal(objectiveEvidence(state, '1.1').status, 'Strong');
  state.objectives['1.1'].read = false;
  assert.equal(objectiveEvidence(state, '1.1').status, 'Practicing', 'unread guide blocks Strong');
});

test('repeating the same question does not inflate evidence', () => {
  const state = freshState();
  state.objectives['1.1'] = { read: true };
  state.attempts = Array.from({ length: 12 }, () => attempt('same', true));
  const ev = objectiveEvidence(state, '1.1');
  assert.equal(ev.unique, 1);
  assert.notEqual(ev.status, 'Strong');
});

test('recent accuracy below 80% blocks Strong; trusted and indicative evidence are separated', () => {
  const state = freshState();
  state.objectives['2.2'] = { read: true };
  state.attempts = [
    ...Array.from({ length: 4 }, (_, i) => attempt(`t${i}`, i < 1, { objective: '2.2', domain: 2 })),
    ...Array.from({ length: 6 }, (_, i) => attempt(`h${i}`, true, { objective: null, hint: '2.2', domain: 2 })),
  ];
  const ev = objectiveEvidence(state, '2.2');
  assert.equal(ev.trusted, 4);
  assert.equal(ev.indicative, 6);
  assert.equal(ev.unique, 10);
  assert.equal(ev.strong, false, '7 of the last 10 is 70%');
  state.attempts[1].correct = true;
  assert.equal(objectiveEvidence(state, '2.2').strong, true, '8 of the last 10 is exactly 80%');
});

test('untagged attempts never count toward an objective but do count toward the domain', () => {
  const state = freshState();
  state.attempts = [attempt('b1', true, { objective: null, hint: null, domain: 3 })];
  assert.equal(objectiveEvidence(state, '3.1').attempts, 0);
  assert.equal(domainStats(state, 3).attempts, 1);
});

test('scheduling: Again returns within minutes, intervals grow, Hard is shorter than Good', () => {
  const now = Date.UTC(2026, 9, 17, 12);
  const again = scheduleReview(null, 'again', now);
  assert.equal(again.due - now, 10 * 60 * 1000);
  const good1 = scheduleReview(null, 'good', now);
  assert.equal(good1.interval, 1);
  const good2 = scheduleReview(good1, 'good', now);
  assert.equal(good2.interval, 3);
  const good3 = scheduleReview(good2, 'good', now);
  assert.ok(good3.interval > good2.interval);
  assert.ok(scheduleReview(null, 'hard', now).interval < good1.interval);
  assert.ok(scheduleReview(good2, 'easy', now).interval > scheduleReview(good2, 'good', now).interval);
  assert.ok(scheduleReview({ interval: 10, ease: 1.3, reps: 4 }, 'again', now).ease >= 1.3, 'ease has a floor');
  assert.throws(() => scheduleReview(null, 'bogus', now));
});

test('due cards are limited to reviewed cards whose due time has arrived, oldest first', () => {
  const state = freshState();
  const cards = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  state.reviews = { a: { due: 100 }, b: { due: 50 }, c: { due: 9999 } };
  assert.deepEqual(dueCards(cards, state, 200).map((c) => c.id), ['b', 'a']);
  assert.deepEqual(newCards(cards, state).map((c) => c.id), ['d']);
  assert.equal(newCards(cards, freshState(), 2).length, 2);
});

test('streak counts consecutive local days and tolerates a day not yet studied', () => {
  const state = freshState();
  const now = new Date(2026, 9, 17, 9, 0);
  const day = (offset) => { const d = new Date(now); d.setDate(d.getDate() + offset); return dayKey(d); };
  state.activities = [{ day: day(-2), type: 'x' }, { day: day(-1), type: 'x' }];
  assert.equal(streak(state, now), 2, 'today not yet studied keeps yesterday’s streak');
  state.activities.push({ day: day(0), type: 'x' });
  assert.equal(streak(state, now), 3);
  state.activities = [{ day: day(-3), type: 'x' }];
  assert.equal(streak(state, now), 0);
});

test('day keys use local calendar dates, not UTC', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(dayKey(new Date(2026, 11, 31, 0, 1)), '2026-12-31');
});

test('misconceptions are high-confidence misses that are still wrong', () => {
  const state = freshState();
  state.attempts = [attempt('a', false, { confidence: 'high' }), attempt('b', false, { confidence: 'low' }), attempt('c', false, { confidence: 'high' }), attempt('c', true, { confidence: 'high' })];
  assert.deepEqual(misconceptions(state).map((a) => a.id), ['a']);
});

test('progress import rejects foreign files and sanitises hostile content', () => {
  for (const bad of [null, undefined, 'x', {}, { version: 2, attempts: [], activities: [] }, { version: 1, attempts: {}, activities: [] }]) {
    assert.throws(() => validateProgress(bad), /not a CySA Mastery/);
  }
  const hostile = {
    version: 1, profile: { name: 'x'.repeat(500), dailyGoal: 9999, newPerDay: -5 },
    attempts: [{ id: 'ok', correct: true, at: 1, objective: '9.9', hint: '1.2', confidence: 'bogus' }, { id: 5, correct: true, at: 1 }, null],
    activities: [{ day: '2026-10-17', type: 't', at: 1 }, { day: 'yesterday', type: 't' }],
    reviews: { __proto__: { due: 1 }, constructor: { due: 1 }, card1: { due: 5, interval: 2 }, bad: { due: 'soon' }, str: 'x' },
    notes: { general: 'hi', big: 'y'.repeat(50000), n: 4 }, bookmarks: ['a', 7], exams: [{ at: 1, total: 85, correct: 100 }, { at: 2, total: 85, correct: 60 }],
  };
  const s = validateProgress(hostile);
  assert.equal(s.profile.name.length, 40);
  assert.equal(s.profile.dailyGoal, 100);
  assert.equal(s.profile.newPerDay, 0);
  assert.equal(s.attempts.length, 1);
  assert.equal(s.attempts[0].objective, null);
  assert.equal(s.attempts[0].hint, '1.2');
  assert.equal(s.attempts[0].confidence, 'medium');
  assert.equal(s.activities.length, 1);
  assert.deepEqual(Object.keys(s.reviews), ['card1']);
  assert.equal(({}).due, undefined, 'prototype was not polluted');
  assert.equal(s.notes.big.length, 20000);
  assert.deepEqual(s.bookmarks, ['a']);
  assert.equal(s.exams.length, 1);
});

test('a state survives export and re-import unchanged', () => {
  const state = freshState();
  state.attempts = [attempt('q1', true), attempt('q2', false, { confidence: 'high', objective: null, hint: '2.1', domain: 2 })];
  state.reviews = { c1: { interval: 3, ease: 2.5, reps: 2, due: 1000, last: 500, first: '2026-10-01' } };
  state.objectives = { '1.1': { read: true, at: 5 } };
  state.lessons = { 'lesson-1-01': { read: true, at: 6 } };
  state.cases = { 'CASE-1': { correct: 2, total: 3, at: 7 } };
  state.notes = { general: 'keep' };
  state.bookmarks = ['q1'];
  state.activities = [{ day: '2026-10-17', type: 'question', at: 9 }];
  state.exams = [{ at: 10, total: 85, correct: 60, kind: 'mock', label: 'Mock', seconds: 100 }];
  assert.deepEqual(validateProgress(JSON.parse(JSON.stringify(state))), state);
});

test('shuffle is a permutation and does not mutate its input', () => {
  const input = [1, 2, 3, 4, 5, 6];
  const copy = [...input];
  const out = shuffle(input, seeded(9));
  assert.deepEqual(input, copy);
  assert.deepEqual([...out].sort(), copy);
});

test('progress toward Strong tracks each criterion and only reaches 1 when Strong', () => {
  const state = freshState();
  assert.deepEqual(strongProgress(objectiveEvidence(state, '1.1')), { guide: 0, volume: 0, accuracy: 0, overall: 0 });
  state.objectives['1.1'] = { read: true };
  state.attempts = Array.from({ length: 4 }, (_, i) => attempt(`q${i}`, true));
  const half = strongProgress(objectiveEvidence(state, '1.1'));
  assert.equal(half.guide, 1);
  assert.equal(half.volume, 0.5);
  assert.equal(half.accuracy, 0.5, 'perfect accuracy but only 4 of the 8 required recent answers');
  assert.ok(half.overall > 0.6 && half.overall < 0.7);
  state.attempts.push(...Array.from({ length: 4 }, (_, i) => attempt(`r${i}`, true)));
  assert.equal(strongProgress(objectiveEvidence(state, '1.1')).overall, 1);
  state.objectives['1.1'].read = false;
  assert.ok(strongProgress(objectiveEvidence(state, '1.1')).overall < 1, 'never full without the guide');
});

test('missed count uses the latest answer per question', () => {
  const state = freshState();
  state.attempts = [attempt('a', false), attempt('a', true), attempt('b', false), attempt('c', true), attempt('c', false)];
  assert.equal(missedCount(state), 2);
  assert.equal(missedCount(freshState()), 0);
});
