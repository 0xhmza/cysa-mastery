import { isCorrect, missedCount, pickQuestions, prepareQuestion, shuffle } from './core.mjs';
import { clearSession, loadSession, saveSession } from './store.mjs';
import { esc, formatDuration, kbd, mappingChip, meter, on, pct } from './ui.mjs';

const EXAM_MINUTES = 165;
const CONF = [['low', 'Guessing'], ['medium', 'Fairly sure'], ['high', 'Certain']];
const TRUSTED = new Set(['reviewed', 'original']);
const LEADING_LETTER = /^\s*[A-D](,\s*[A-D])*\.\s+/;

const newId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function buildSession(ctx, cfg) {
  const { data, state } = ctx;
  let ids;
  if (cfg.chapter && cfg.fixedOrder) {
    ids = data.questions.filter((q) => q.source === 'sybex' && q.sourceChapter === cfg.chapter).sort((a, b) => a.number - b.number).map((q) => q.id);
  } else if (cfg.weighted) {
    ids = pickQuestions(data.questions.filter((q) => q.domain), { count: cfg.count, mode: 'exam', domains: data.catalog.domains }).map((q) => q.id);
  } else {
    ids = pickQuestions(data.questions, { count: cfg.count, mode: cfg.mode, state, domain: cfg.domain, objective: cfg.objective, source: cfg.source }).map((q) => q.id);
  }
  if (!ids.length) return null;
  const order = {};
  for (const id of ids) order[id] = prepareQuestion(data.qById.get(id)).options.map((o) => o.key);
  return {
    id: newId(), kind: cfg.exam ? 'exam' : 'practice', examKind: cfg.examKind || null, label: cfg.label, mode: cfg.mode || 'mixed', ids, order, answers: {}, flags: [],
    idx: 0, startedAt: Date.now(), elapsedMs: 0, limitSec: cfg.limitSec || null, finished: false, requested: cfg.count || ids.length,
  };
}

function recordAttempt(ctx, session, q, answer) {
  ctx.state.attempts.push({
    id: q.id, domain: q.domain, objective: TRUSTED.has(q.mapping) ? q.objective : null, hint: q.mapping === 'source' ? q.objective : null,
    correct: answer.correct, at: answer.at, confidence: answer.conf, mode: session.kind === 'exam' ? 'exam' : session.mode, sessionId: session.id,
  });
  ctx.activity('question');
}

function finishSession(ctx, session) {
  if (session.finished) return;
  const { data, state } = ctx;
  let correct = 0;
  const byDomain = {};
  session.ids.forEach((id) => {
    const q = data.qById.get(id), a = session.answers[id];
    const ok = !!a && isCorrect(q, a.sel);
    if (session.kind === 'exam' && a) {
      a.correct = ok; a.conf = a.conf || 'medium'; a.at = a.at || Date.now();
      recordAttempt(ctx, session, q, a);
    }
    if (ok) correct++;
    const key = q.domain || 0;
    byDomain[key] = byDomain[key] || { total: 0, correct: 0 };
    byDomain[key].total++; if (ok) byDomain[key].correct++;
  });
  session.finished = true;
  session.result = { correct, total: session.ids.length, answered: Object.keys(session.answers).length, byDomain, seconds: Math.round(session.elapsedMs / 1000) };
  if (session.kind === 'exam' && session.result.answered > 0) {
    state.exams.push({ at: Date.now(), total: session.ids.length, correct, kind: session.examKind || 'mock', label: session.label, seconds: session.result.seconds });
    ctx.activity('exam');
  }
  ctx.save();
  saveSession(session);
}

/* ---------- setup screen ---------- */

function field(label, name, options, value) {
  return `<label class="field">${label}<select name="${name}">${options.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
}

function renderHome(ctx, root, query) {
  const { data, state } = ctx;
  const session = loadSession();
  const live = session && !session.finished ? session : null;
  const history = [...state.exams].reverse().slice(0, 8);
  const bookTest = (n) => data.questions.filter((q) => q.source === 'sybex' && q.sourceChapter === n).length;
  const missed = missedCount(state), marked = state.bookmarks.length;
  const originals = data.questions.filter((q) => q.source === 'original').length;
  const quick = (key, title, detail, enabled = true) => `<button class="card quick" data-quick="${key}" ${enabled ? '' : 'disabled'}><b>${title}</b><small>${detail}</small></button>`;
  root.innerHTML = `
    <div class="page-head"><div class="eyebrow">Practice</div><h1>Practice with explanations</h1>
    <p>Pick an answer, say how sure you are, then read why. Answers you were sure about but got wrong are tracked as misconceptions. Options are shuffled, and the right answer is tracked by identity, not position.</p></div>
    ${live ? `<div class="notice ok row between" style="margin-bottom:16px"><div><b>Unfinished session:</b> ${esc(live.label)} · ${Object.keys(live.answers).length} of ${live.ids.length} answered${live.limitSec ? ` · ${formatDuration(Math.max(0, live.limitSec - live.elapsedMs / 1000))} left` : ''}</div>
      <div class="row"><button class="btn primary sm" data-act="resume">Resume</button><button class="btn ghost sm" data-act="discard">Discard</button></div></div>` : ''}
    ${session && session.finished ? `<div class="notice row between" style="margin-bottom:16px"><div>Results from “${esc(session.label)}” are ready.</div><button class="btn sm" data-act="resume">View results</button></div>` : ''}
    <h2>Quick start</h2>
    <div class="quick-row">
      ${quick('adaptive', '10 adaptive questions', 'Weighted toward questions you missed or have not seen')}
      ${quick('missed', `Retry missed${missed ? ` (${missed})` : ''}`, missed ? 'Questions whose latest answer was wrong' : 'Nothing missed yet', missed > 0)}
      ${quick('bookmarks', `Bookmarked${marked ? ` (${marked})` : ''}`, marked ? 'Questions you starred while practicing' : 'Star questions while practicing to collect them here', marked > 0)}
      ${quick('original', 'Original scenarios', `${originals} written for this workspace: AI, metrics, CVSS, evidence handling`)}
    </div>
    <div class="row between" style="margin-top:28px"><h2 style="margin:0">Full-length sets</h2><label class="switch"><input type="checkbox" id="timed" checked><span>Timed (${EXAM_MINUTES} min)</span></label></div>
    <p class="muted" style="font-size:.88rem;margin:6px 0 12px">No feedback until you submit. The clock pauses while you are away from the page and auto-submits at zero.</p>
    <div class="grid cols-3">
      <div class="card preset"><h3>Book Practice Test 1</h3><p class="muted">${bookTest(5)} mixed questions from the practice book, in book order.</p><button class="btn primary" data-preset="book5">Start test</button></div>
      <div class="card preset"><h3>Book Practice Test 2</h3><p class="muted">${bookTest(6)} mixed questions from the book's second practice exam.</p><button class="btn primary" data-preset="book6">Start test</button></div>
      <div class="card preset"><h3>Weighted mixed mock</h3><p class="muted">85 questions across domains in exam proportions (34/26/24/16).</p><button class="btn primary" data-preset="mock">Start mock</button></div>
    </div>
    <h2 style="margin-top:28px">Build a custom set</h2>
    <form class="card" id="custom"><div class="form-grid">
      ${field('Mode', 'mode', [['mixed', 'Mixed (unseen first)'], ['adaptive', 'Adaptive (focus on weak spots)'], ['missed', 'Missed questions'], ['bookmarks', 'Bookmarked']], query.mode || 'mixed')}
      ${field('Source', 'source', [['', 'All sources'], ['original', 'Original scenarios'], ['community', 'Community curriculum'], ['sybex', 'Practice book']], query.source || '')}
      ${field('Domain', 'domain', [['', 'All domains'], ...data.catalog.domains.map((d) => [d.id, `${d.id}. ${d.title}`])], query.domain || '')}
      ${field('Objective', 'objective', [['', 'Any (book questions have no tag)'], ...data.objectives.map((o) => [o.id, `${o.id} ${o.title.slice(0, 48)}`])], query.objective || '')}
      ${field('Questions', 'count', [5, 10, 20, 40, 85].map((n) => [n, n]), query.count || 10)}
      ${field('Feedback', 'style', [['each', 'After each answer'], ['end', 'Exam style: at the end']], query.style || 'each')}
    </div><div class="row" style="margin-top:16px"><button class="btn primary" type="submit">Start set</button><span id="formMsg" class="muted" role="status"></span></div></form>
    ${history.length ? `<h2 style="margin-top:28px">Recent full-length results</h2><div class="card table-wrap"><table><thead><tr><th>Date</th><th>Set</th><th>Score</th><th>Time</th></tr></thead><tbody>${history.map((e) => `<tr><td>${new Date(e.at).toLocaleDateString()}</td><td>${esc(e.label)}</td><td>${e.correct}/${e.total} (${pct(e.correct / e.total)})</td><td>${e.seconds != null ? formatDuration(e.seconds) : '—'}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted" style="font-size:.85rem">Percent correct on practice sets is not a CompTIA scaled score and is not a pass prediction.</p>` : ''}`;

  const start = (cfg) => {
    const built = buildSession(ctx, cfg);
    const msg = root.querySelector('#formMsg');
    if (!built) { if (msg) msg.textContent = 'No questions match those filters yet. Loosen a filter or try a different mode.'; ctx.toast('No questions match those filters.'); return; }
    if (cfg.count && built.ids.length < cfg.count) ctx.toast(`Only ${built.ids.length} questions match; starting with those.`);
    saveSession(built);
    ctx.go('#practice/session');
  };
  const timed = () => root.querySelector('#timed').checked;
  on(root, 'click', '[data-preset]', (_, btn) => {
    const p = btn.dataset.preset;
    const limitSec = timed() ? EXAM_MINUTES * 60 : null;
    if (p === 'book5') start({ label: 'Book Practice Test 1', chapter: 5, fixedOrder: true, exam: true, examKind: 'book-test-1', limitSec });
    if (p === 'book6') start({ label: 'Book Practice Test 2', chapter: 6, fixedOrder: true, exam: true, examKind: 'book-test-2', limitSec });
    if (p === 'mock') start({ label: 'Weighted mixed mock', weighted: true, count: 85, exam: true, examKind: 'weighted-mock', limitSec });
  });
  root.querySelector('#custom').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const count = Number(f.count);
    const exam = f.style === 'end';
    start({ label: `${{ mixed: 'Mixed', adaptive: 'Adaptive', missed: 'Missed', bookmarks: 'Bookmarked' }[f.mode]} set${f.objective ? ` · ${f.objective}` : f.domain ? ` · domain ${f.domain}` : ''}`, mode: f.mode, count, domain: f.domain || null, objective: f.objective || null, source: f.source || null, exam, examKind: 'custom', limitSec: exam && timed() ? Math.round((EXAM_MINUTES * 60 * count) / 85) : null });
  });
  on(root, 'click', '[data-quick]', (_, btn) => {
    const k = btn.dataset.quick;
    if (k === 'adaptive') start({ label: 'Adaptive set', mode: 'adaptive', count: 10 });
    if (k === 'missed') start({ label: 'Missed questions', mode: 'missed', count: 20 });
    if (k === 'bookmarks') start({ label: 'Bookmarked questions', mode: 'bookmarks', count: 40 });
    if (k === 'original') start({ label: 'Original scenarios', mode: 'mixed', count: 10, source: 'original' });
  });
  on(root, 'click', '[data-act="resume"]', () => ctx.go('#practice/session'));
  on(root, 'click', '[data-act="discard"]', () => { clearSession(); ctx.toast('Session discarded.'); ctx.rerender(); });
  if (query.go === '1' && query.mode) {
    const count = Number(query.count) || 10;
    start({ label: query.mode === 'missed' ? 'Missed questions' : `Adaptive set${query.objective ? ` · ${query.objective}` : ''}`, mode: query.mode, count, domain: query.domain || null, objective: query.objective || null, source: query.source || null });
  }
}

/* ---------- running a session ---------- */

function renderSession(ctx, root) {
  const { data, state } = ctx;
  const session = loadSession();
  if (!session) { ctx.go('#practice'); return; }
  session.ids = session.ids.filter((id) => data.qById.has(id));
  const persist = () => saveSession(session);
  if (session.finished) { renderResults(ctx, root, session); return; }
  const exam = session.kind === 'exam';
  let last = Date.now();
  let timerId = null;
  let confirmFinish = false;

  const tick = () => {
    const now = Date.now();
    session.elapsedMs += now - last; last = now;
    if (session.limitSec) {
      const left = session.limitSec - session.elapsedMs / 1000;
      const el = root.querySelector('#timer');
      if (el) { el.textContent = formatDuration(left); el.classList.toggle('low', left < 300); }
      if (left <= 0) { finishSession(ctx, session); ctx.toast('Time is up. Your answers were submitted.'); ctx.rerender(); }
    }
  };
  const stop = () => { if (timerId) clearInterval(timerId); timerId = null; tick(); persist(); document.removeEventListener('keydown', keyHandler); };
  ctx.onLeave(stop);

  const finish = () => { tick(); finishSession(ctx, session); ctx.rerender(); };

  const visible = () => data.qById.get(session.ids[session.idx]);
  const ordered = (q) => (session.order[q.id] || q.options.map((o) => o.label)).map((key, i) => ({ ...q.options.find((o) => o.label === key), key, shown: String.fromCharCode(65 + i) }));

  let mapOpen = !window.matchMedia('(max-width: 820px)').matches;

  const draw = () => {
    const q = visible();
    if (!q) { finish(); return; }
    const opts = ordered(q);
    const answer = session.answers[q.id] || { sel: [], conf: null };
    const checked = !exam && answer.checked;
    const multi = q.correct_answers.length > 1;
    const flagged = session.flags.includes(q.id), marked = state.bookmarks.includes(q.id);
    const answers = Object.values(session.answers);
    const answeredCount = answers.length;
    const checkedAnswers = answers.filter((a) => a.checked), rightSoFar = checkedAnswers.filter((a) => a.correct).length;
    const correctShown = opts.filter((o) => q.correct_answers.includes(o.key)).map((o) => o.shown).join(', ');
    const explanation = (q.explanationHtml || esc(q.explanation)).replace(LEADING_LETTER, '');
    const last = session.idx === session.ids.length - 1;
    const progress = exam ? answeredCount / session.ids.length : checkedAnswers.length / session.ids.length;
    const lastLetter = opts[opts.length - 1]?.shown || 'D';
    const studyLink = q.objective
      ? `<a href="#learn/${esc(q.objective)}">Review the ${esc(q.objective)} guide</a>`
      : q.domain ? `<a href="#learn">Browse domain ${q.domain} objectives</a>` : '';
    root.innerHTML = `
      <div class="session-head">
        <div class="row between"><div><div class="eyebrow">${esc(session.label)}</div><b>Question ${session.idx + 1} of ${session.ids.length}</b>
          <span class="muted">· ${exam ? `${answeredCount} answered` : checkedAnswers.length ? `${rightSoFar} of ${checkedAnswers.length} correct` : 'first question'}</span></div>
          <div class="row">${session.limitSec ? `<span class="timer" id="timer" role="timer" aria-label="Time remaining">${formatDuration(session.limitSec - session.elapsedMs / 1000)}</span>` : ''}
          <button class="btn sm ghost" data-act="end">${exam ? 'Submit exam…' : 'End session'}</button></div></div>
        ${meter(progress, 'Session progress', 'thin')}
      </div>
      ${confirmFinish ? `<div class="notice warn row between" style="margin-bottom:12px"><span>${session.ids.length - answeredCount ? `${session.ids.length - answeredCount} unanswered question${session.ids.length - answeredCount === 1 ? '' : 's'} will count as incorrect. ` : ''}${session.flags.length ? `${session.flags.length} question${session.flags.length === 1 ? ' is' : 's are'} still flagged for review. ` : ''}Submit anyway?</span><span class="row"><button class="btn sm primary" data-act="finish-now">Yes, submit</button><button class="btn sm" data-act="keep-going">Keep working</button></span></div>` : ''}
      ${exam ? `<details class="q-map" ${mapOpen ? 'open' : ''}><summary>Question map · ${answeredCount}/${session.ids.length} answered${session.flags.length ? ` · ${session.flags.length} flagged` : ''}</summary>
        <div class="q-nav" role="navigation" aria-label="Question navigator">${session.ids.map((id, i) => `<button data-goto="${i}" class="${session.answers[id] ? 'answered' : ''} ${i === session.idx ? 'current' : ''} ${session.flags.includes(id) ? 'flagged' : ''}" aria-label="Question ${i + 1}${session.answers[id] ? ', answered' : ''}${session.flags.includes(id) ? ', flagged' : ''}" aria-current="${i === session.idx}">${i + 1}</button>`).join('')}</div></details>` : ''}
      <article class="card question">
        <div class="q-meta">${mappingChip(q)}<span class="chip">${esc(q.sourceLabel)}</span>${q.difficulty ? `<span class="chip">${esc(q.difficulty)}</span>` : ''}${multi ? '<span class="chip warn">Select all that apply</span>' : ''}</div>
        <div class="q-prompt rich">${q.prompt.html}</div>
        <div class="options" role="${multi ? 'group' : 'radiogroup'}" aria-label="Answer choices">${opts.map((o) => {
          const sel = answer.sel.includes(o.key), isRight = q.correct_answers.includes(o.key);
          const cls = checked ? (isRight ? 'correct' : sel ? 'wrong' : 'dim') : '';
          const mark = checked ? (isRight ? '<span class="mark" aria-label="Correct answer">✓</span>' : sel ? '<span class="mark" aria-label="Your answer, incorrect">✗</span>' : '') : '';
          return `<button class="option ${cls}" role="${multi ? 'checkbox' : 'radio'}" aria-checked="${sel}" data-key="${esc(o.key)}" ${checked ? 'disabled' : ''}><span class="letter">${o.shown}</span><span class="rich">${o.html}</span>${checked && sel ? '<span class="tag">Your answer</span>' : ''}${mark}</button>`;
        }).join('')}</div>
        ${!exam && !checked ? (answer.sel.length
          ? `<div class="check-row" role="group" aria-label="Check your answer by saying how sure you are"><span class="muted">Check answer · how sure are you?</span>${CONF.map(([v, t], i) => `<button class="btn ${v === 'medium' ? 'primary' : ''}" data-check="${v}">${t} ${kbd(String(i + 1))}</button>`).join('')}</div>`
          : `<p class="hint">Choose an answer${multi ? 's' : ''} (${kbd('A')}–${kbd(lastLetter)}), then say how sure you are to check it.</p>`) : ''}
        ${checked ? `<div class="feedback ${answer.correct ? 'good' : 'miss'}" role="status" aria-live="polite">
          <div class="row between"><b class="verdict">${answer.correct ? '✓ Correct.' : `✗ Not quite. The answer is ${esc(correctShown)}.`}</b>${!answer.correct && answer.conf === 'high' ? '<span class="chip bad" title="Saved to your misconceptions list">High-confidence miss</span>' : ''}</div>
          ${q.mapping === 'domain-only' && q.source === 'sybex' ? `<p class="muted" style="margin:6px 0 0;font-size:.85rem">Book page ${esc((q.source_pages || []).join(', ') || '?')} · explanation page ${esc((q.answer_pages || []).join(', ') || '?')}</p>` : ''}
          <div class="rich" style="margin-top:10px">${explanation}</div>
          ${!answer.correct && studyLink ? `<p class="study-link">${studyLink}</p>` : ''}</div>` : ''}
        <div class="row between q-foot">
          <div class="row"><button class="btn sm ghost" data-act="bookmark" aria-pressed="${marked}">${marked ? '★ Bookmarked' : '☆ Bookmark'}</button>${exam ? `<button class="btn sm ghost" data-act="flag" aria-pressed="${flagged}">${flagged ? '⚑ Flagged' : '⚐ Flag for review'}</button>` : ''}</div>
          <div class="row">${exam ? `<button class="btn" data-act="prev" ${session.idx === 0 ? 'disabled' : ''}>← Previous</button>${last ? '<button class="btn primary" data-act="end">Submit exam…</button>' : '<button class="btn primary" data-act="next">Next →</button>'}`
            : checked ? `<button class="btn primary" data-act="next">${last ? 'See results' : 'Next question →'}</button>` : ''}</div>
        </div>
      </article>
      <p class="keys">${exam ? `${kbd('A')}–${kbd(lastLetter)} choose · ${kbd('←')} ${kbd('→')} move · ${kbd('?')} all shortcuts` : `${kbd('A')}–${kbd(lastLetter)} choose · ${kbd('1')}–${kbd('3')} check · ${kbd('Enter')} next · ${kbd('?')} all shortcuts`}</p>`;
    root.querySelector('.q-map')?.addEventListener('toggle', (e) => { mapOpen = e.target.open; });
    if (session.limitSec) tick();
  };

  const select = (key) => {
    const q = visible(); const a = session.answers[q.id] || { sel: [], conf: null };
    if (a.checked) return;
    const multi = q.correct_answers.length > 1;
    a.sel = multi ? (a.sel.includes(key) ? a.sel.filter((k) => k !== key) : [...a.sel, key]) : [key];
    if (!a.sel.length) delete session.answers[q.id]; else session.answers[q.id] = a;
    persist(); draw();
    if (!exam) {
      root.querySelector('[data-check="medium"]')?.focus({ preventScroll: true });
      root.querySelector('.check-row')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };
  const check = (conf) => {
    const q = visible(); const a = session.answers[q.id];
    if (!a || !a.sel.length || a.checked) return;
    a.conf = conf; a.checked = true; a.at = Date.now(); a.correct = isCorrect(q, a.sel);
    recordAttempt(ctx, session, q, a); ctx.save(); persist(); draw();
    root.querySelector('.feedback')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    root.querySelector('[data-act="next"]')?.focus({ preventScroll: true });
  };
  const go = (i) => { session.idx = Math.max(0, Math.min(session.ids.length - 1, i)); confirmFinish = false; persist(); draw(); window.scrollTo(0, 0); };
  const next = () => { if (!exam && session.idx === session.ids.length - 1) { finish(); } else go(session.idx + 1); };

  on(root, 'click', '.option', (_, b) => select(b.dataset.key));
  on(root, 'click', '[data-check]', (_, b) => check(b.dataset.check));
  on(root, 'click', '[data-goto]', (_, b) => go(Number(b.dataset.goto)));
  on(root, 'click', '[data-act]', (_, b) => {
    const act = b.dataset.act, q = visible();
    if (act === 'next') next();
    else if (act === 'prev') go(session.idx - 1);
    else if (act === 'bookmark') { state.bookmarks = state.bookmarks.includes(q.id) ? state.bookmarks.filter((x) => x !== q.id) : [...state.bookmarks, q.id]; ctx.save(); draw(); ctx.toast(state.bookmarks.includes(q.id) ? 'Bookmarked. Find it under Practice > Bookmarked.' : 'Bookmark removed.'); }
    else if (act === 'flag') { session.flags = session.flags.includes(q.id) ? session.flags.filter((x) => x !== q.id) : [...session.flags, q.id]; persist(); draw(); }
    else if (act === 'end') {
      if (exam && (Object.keys(session.answers).length < session.ids.length || session.flags.length)) { confirmFinish = true; draw(); window.scrollTo(0, 0); } else finish();
    } else if (act === 'finish-now') { finish(); }
    else if (act === 'keep-going') { confirmFinish = false; draw(); }
  });
  const keyHandler = (e) => {
    if (e.target.closest?.('input,textarea,select,dialog') || e.ctrlKey || e.metaKey || e.altKey) return;
    const q = visible(); if (!q) return;
    const a = session.answers[q.id];
    const hit = ordered(q).find((o) => o.shown === e.key.toUpperCase());
    if (hit && e.key.length === 1) { select(hit.key); return; }
    if (!exam && !a?.checked && a?.sel.length && ['1', '2', '3'].includes(e.key)) { check(CONF[Number(e.key) - 1][0]); return; }
    if (e.key === 'Enter' && !e.target.closest?.('button,a')) {
      if (!exam && a?.checked) next();
      else if (!exam && a?.sel.length) check('medium');
    }
    if (exam && e.key === 'ArrowRight') go(session.idx + 1);
    if (exam && e.key === 'ArrowLeft') go(session.idx - 1);
  };
  document.addEventListener('keydown', keyHandler);

  if (session.limitSec && session.limitSec - session.elapsedMs / 1000 <= 0) { finish(); return; }
  draw();
  if (session.limitSec) timerId = setInterval(tick, 1000);
}

/* ---------- results ---------- */

function renderResults(ctx, root, session) {
  const { data } = ctx;
  const r = session.result;
  const pctCorrect = r.total ? r.correct / r.total : 0;
  const missed = session.ids.filter((id) => !session.answers[id] || !isCorrect(data.qById.get(id), session.answers[id].sel));
  root.innerHTML = `
    <div class="page-head"><div class="eyebrow">Results</div><h1>${esc(session.label)}</h1></div>
    <div class="grid cols-4">
      <div class="card stat"><b>${r.correct}/${r.total}</b><span>correct (${pct(pctCorrect)})</span></div>
      <div class="card stat"><b>${r.answered}</b><span>answered${r.total - r.answered ? `, ${r.total - r.answered} skipped` : ''}</span></div>
      <div class="card stat"><b>${formatDuration(r.seconds)}</b><span>time used${session.limitSec ? ` of ${formatDuration(session.limitSec)}` : ''}</span></div>
      <div class="card stat"><b>${missed.length}</b><span>to revisit</span></div>
    </div>
    <p class="notice" style="margin-top:14px">This percentage describes this set only. CompTIA reports a scaled score (100–900) that cannot be derived from a practice percentage, so no pass estimate is given.</p>
    ${Object.keys(r.byDomain).length > 1 || !r.byDomain[0] ? `<h2 style="margin-top:22px">By domain</h2><div class="card table-wrap"><table><thead><tr><th>Domain</th><th>Correct</th><th>Share</th></tr></thead><tbody>${Object.entries(r.byDomain).map(([d, v]) => `<tr><td>${d === '0' ? 'Mixed exam (untagged)' : `${d}. ${esc(data.catalog.domains.find((x) => x.id === Number(d))?.title)}`}</td><td>${v.correct}/${v.total}</td><td>${pct(v.correct / v.total)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="row" style="margin:20px 0">${missed.length ? '<button class="btn primary" data-act="retry">Retry the questions I missed</button>' : ''}<button class="btn" data-act="done">Done</button></div>
    ${missed.length ? `<h2>Review what you missed</h2>${missed.slice(0, 60).map((id) => {
      const q = data.qById.get(id), a = session.answers[id];
      const right = q.options.filter((o) => q.correct_answers.includes(o.label)).map((o) => o.text).join(' / ');
      const mine = a ? q.options.filter((o) => a.sel.includes(o.label)).map((o) => o.text).join(' / ') : null;
      return `<details><summary>${esc(q.prompt.text.slice(0, 140))}${q.prompt.text.length > 140 ? '…' : ''}</summary><div class="body"><div class="q-meta">${mappingChip(q)}</div><div class="rich">${q.prompt.html}</div>
        <p><b>Your answer:</b> ${mine ? esc(mine) : '<em>not answered</em>'}<br><b>Correct:</b> ${esc(right)}</p><div class="rich">${(q.explanationHtml || esc(q.explanation)).replace(LEADING_LETTER, '')}</div></div></details>`;
    }).join('')}${missed.length > 60 ? `<p class="muted">Showing the first 60 of ${missed.length}.</p>` : ''}` : '<div class="empty"><h3>Clean sweep</h3>Nothing to revisit from this set.</div>'}`;
  on(root, 'click', '[data-act="done"]', () => { clearSession(); ctx.go('#practice'); });
  on(root, 'click', '[data-act="retry"]', () => {
    const ids = missed.slice(0, 85);
    const order = {};
    ids.forEach((id) => { order[id] = prepareQuestion(data.qById.get(id)).options.map((o) => o.key); });
    saveSession({ id: newId(), kind: 'practice', label: `Retry · ${session.label}`, mode: 'missed', ids: shuffle(ids), order, answers: {}, flags: [], idx: 0, startedAt: Date.now(), elapsedMs: 0, limitSec: null, finished: false });
    ctx.rerender();
  });
}

export function renderPractice(ctx, root, { arg, query }) {
  if (arg === 'session') renderSession(ctx, root);
  else renderHome(ctx, root, query);
}
