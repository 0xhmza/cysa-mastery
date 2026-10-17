import { dayKey, dueCards, newCards, scheduleReview } from './core.mjs';
import { esc, kbd, meter, on } from './ui.mjs';

const GRADES = [['again', 'Again', '1'], ['hard', 'Hard', '2'], ['good', 'Good', '3'], ['easy', 'Easy', '4']];
const LONG_ANSWER_CHARS = 700;

function formatInterval(next, now) {
  const minutes = (next.due - now) / 60000;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  const days = minutes / 1440;
  if (days < 1) return `${Math.round(minutes / 60)} h`;
  if (days < 30) return `${Math.round(days * 10) / 10} d`.replace('.0 ', ' ');
  return `${Math.round(days / 30)} mo`;
}

const plain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export function renderReview(ctx, root, { query }) {
  const { data, state } = ctx;
  const filter = { domain: query.domain || '', objective: query.objective || '', source: query.source || '' };
  const pool = data.cards.filter((c) => (!filter.domain || c.domain === Number(filter.domain)) && (!filter.objective || c.objective === filter.objective) && (!filter.source || c.source === filter.source));
  const startedToday = () => Object.values(state.reviews).filter((r) => r.first === dayKey()).length;
  const allowance = () => Math.max(0, state.profile.newPerDay - startedToday());

  let queue = null;
  let revealed = false;
  let againSeen = new Set();
  let extraNew = 0;
  let reviewed = 0;

  const startQueue = (includeExtra = 0) => {
    const due = dueCards(pool, state).map((c) => c.id);
    const fresh = newCards(pool, state, allowance() + includeExtra).map((c) => c.id);
    queue = [...due, ...fresh];
    revealed = false;
    reviewed = 0;
  };

  const header = () => `<div class="page-head"><div class="eyebrow">Spaced review</div><h1>Flashcards on a schedule</h1>
    <p>Cards you rate Again return in minutes; the rest come back after growing intervals. Rate honestly: the schedule is only as good as your ratings.</p></div>`;

  const filterForm = () => `<form class="card row" id="filters" style="margin-bottom:16px">
    <label class="field">Domain<select name="domain"><option value="">All</option>${data.catalog.domains.map((d) => `<option value="${d.id}"${String(d.id) === filter.domain ? ' selected' : ''}>${d.id}. ${esc(d.title)}</option>`).join('')}</select></label>
    <label class="field">Objective<select name="objective"><option value="">All</option>${data.objectives.map((o) => `<option value="${o.id}"${o.id === filter.objective ? ' selected' : ''}>${o.id}</option>`).join('')}</select></label>
    <label class="field">Deck<select name="source"><option value="">All</option><option value="community"${filter.source === 'community' ? ' selected' : ''}>Community flashcards</option><option value="anki"${filter.source === 'anki' ? ' selected' : ''}>Anki deck</option></select></label>
    <span class="muted" style="align-self:flex-end;font-size:.82rem">Filters apply immediately</span></form>`;

  const bindFilters = () => {
    const form = root.querySelector('#filters');
    form?.addEventListener('change', () => {
      const f = Object.fromEntries(new FormData(form));
      const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
      ctx.go(`#review${q ? `?${q}` : ''}`);
    });
  };

  const drawSummary = () => {
    const due = dueCards(pool, state);
    const fresh = newCards(pool, state).length;
    const upcoming = pool.filter((c) => state.reviews[c.id] && state.reviews[c.id].due > Date.now()).sort((a, b) => state.reviews[a.id].due - state.reviews[b.id].due)[0];
    const newToday = startedToday(), todayNew = Math.min(fresh, allowance());
    root.innerHTML = `${header()}${filterForm()}
      <div class="grid cols-3"><div class="card stat"><b>${due.length}</b><span>due now</span></div><div class="card stat"><b>${todayNew}</b><span>new cards available today (limit ${state.profile.newPerDay}/day, ${newToday} started)</span></div><div class="card stat"><b>${pool.length}</b><span>cards in this selection · ${fresh} unseen</span></div></div>
      <div class="row" style="margin:18px 0">${due.length + todayNew ? '<button class="btn primary" data-act="start">Start review</button>' : ''}${!todayNew && fresh ? `<button class="btn" data-act="extra">Study 10 extra new cards</button>` : ''}</div>
      ${!due.length && !todayNew ? `<div class="empty"><h3>You are caught up</h3>${upcoming ? `Next card is due ${new Date(state.reviews[upcoming.id].due).toLocaleString()}.` : pool.length ? 'Start with a few new cards when you are ready.' : 'No cards match these filters.'}</div>` : ''}
      <p class="muted" style="font-size:.85rem">Anki-deck answers can be long. Long answers are collapsed until you choose to expand them, so you can attempt recall first.</p>`;
    bindFilters();
  };

  const drawCard = () => {
    if (!queue.length) { drawDone(); return; }
    const card = data.cardById.get(queue[0]);
    if (!card) { queue.shift(); drawCard(); return; }
    const prev = state.reviews[card.id];
    const now = Date.now();
    const long = plain(card.back).length > LONG_ANSWER_CHARS;
    root.innerHTML = `<div class="session-head"><div class="row between"><div><div class="eyebrow">Spaced review</div><b>${reviewed} reviewed · ${queue.length} to go</b> <span class="muted">· ${prev ? 'review' : 'new'} card</span></div><button class="btn sm ghost" data-act="stop">End session</button></div>
      ${meter(reviewed / (reviewed + queue.length), 'Review session progress', 'thin')}</div>
      <article class="card flash" aria-live="polite">
        <div class="q-meta">${card.objective ? `<span class="chip ${card.mapping === 'source' ? 'indicative' : ''}">Objective ${esc(card.objective)}</span>` : card.domain ? `<span class="chip">Domain ${card.domain}</span>` : '<span class="chip">Untagged</span>'}<span class="chip">${card.source === 'anki' ? 'Anki deck' : 'Community'}</span></div>
        <div class="face rich">${card.front}</div>
        ${revealed ? `<hr style="border:0;border-top:1px solid var(--line);width:100%"><div class="rich ${long ? 'clamp' : ''}" id="back">${card.back}</div>${long ? '<button class="btn sm" data-act="expand">Show full answer</button>' : ''}` : ''}
      </article>
      <div class="row" style="margin-top:14px;justify-content:center">${revealed
        ? `<div class="grade-row" style="width:100%;max-width:560px" role="group" aria-label="Rate your recall">${GRADES.map(([g, label, key]) => `<button class="btn grade-${g}" data-grade="${g}"><b>${label} ${kbd(key)}</b><small>next in ${formatInterval(scheduleReview(prev, g, now), now)}</small></button>`).join('')}</div>`
        : `<button class="btn primary lg" data-act="reveal">Show answer ${kbd('Space')}</button>`}</div>
      <p class="keys">${revealed ? `${kbd('1')}–${kbd('4')} rate your recall` : 'Try to recall the answer before revealing it.'} · ${kbd('?')} all shortcuts</p>`;
    root.querySelector('[data-act="reveal"]')?.focus();
  };

  const drawDone = () => {
    root.innerHTML = `${header()}<div class="empty"><h3>Session complete</h3>You reviewed ${reviewed} card${reviewed === 1 ? '' : 's'}. Your next reviews are scheduled. ${againSeen.size ? `${againSeen.size} card${againSeen.size === 1 ? '' : 's'} will return soon.` : ''}<div class="row" style="justify-content:center;margin-top:14px"><a class="btn primary" href="#dashboard">Back to overview</a><button class="btn" data-act="summary">Review options</button></div></div>`;
    ctx.refreshChrome();
  };

  const grade = (g) => {
    const id = queue[0], card = data.cardById.get(id);
    if (!card || !revealed) return;
    const prev = state.reviews[id];
    const next = scheduleReview(prev, g, Date.now());
    state.reviews[id] = { ...next, first: prev?.first || dayKey() };
    ctx.activity('card');
    ctx.save();
    reviewed++;
    queue.shift();
    if (g === 'again') { queue.splice(Math.min(queue.length, 4), 0, id); againSeen.add(id); }
    revealed = false;
    ctx.refreshChrome();
    drawCard();
  };

  on(root, 'click', '[data-act]', (_, b) => {
    const act = b.dataset.act;
    if (act === 'start') { startQueue(); drawCard(); }
    else if (act === 'extra') { extraNew = 10; startQueue(extraNew); drawCard(); }
    else if (act === 'reveal') { revealed = true; drawCard(); root.querySelector('[data-grade="good"]')?.focus(); }
    else if (act === 'expand') { root.querySelector('#back').classList.remove('clamp'); b.remove(); }
    else if (act === 'stop' || act === 'summary') { queue = null; drawSummary(); }
  });
  on(root, 'click', '[data-grade]', (_, b) => grade(b.dataset.grade));
  const keys = (e) => {
    if (!queue || e.target.closest?.('input,textarea,select,dialog') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!revealed && (e.key === ' ' || e.key === 'Enter') && !e.target.closest?.('button')) { e.preventDefault(); revealed = true; drawCard(); }
    else if (revealed) { const hit = GRADES.find(([, , k]) => k === e.key); if (hit) grade(hit[0]); }
  };
  document.addEventListener('keydown', keys);
  ctx.onLeave(() => document.removeEventListener('keydown', keys));
  drawSummary();
}
