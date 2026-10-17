import { domainStats, dueCards, misconceptions, newCards, objectiveEvidence, streak, todayCount } from './core.mjs';
import { loadSession } from './store.mjs';
import { esc, on, pct, statusChip } from './ui.mjs';

function evidenceLine(ev) {
  if (!ev.unique) return 'No tagged questions answered yet.';
  const parts = [];
  if (ev.trusted) parts.push(`${ev.trusted} with reviewed or original mappings`);
  if (ev.indicative) parts.push(`${ev.indicative} with indicative source tags`);
  return `${ev.unique} tagged question${ev.unique === 1 ? '' : 's'} answered (${parts.join(', ')}). Last ${Math.min(10, ev.attempts)} answers: ${pct(ev.accuracy)} correct.`;
}

function nextSteps(ctx) {
  const { data, state } = ctx;
  const steps = [];
  const session = loadSession();
  if (session && !session.finished) {
    const answered = Object.keys(session.answers).length;
    steps.push({ title: `Resume “${session.label}”`, why: `${answered} of ${session.ids.length} answered. Your place is saved.`, href: '#practice', cta: 'Resume' });
  }
  const due = dueCards(data.cards, state).length;
  if (due) steps.push({ title: `Review ${due} due card${due === 1 ? '' : 's'}`, why: 'Cards come back on a schedule. Reviewing on time is the cheapest way to keep what you learned.', href: '#review', cta: 'Start review' });
  const missed = misconceptions(state).length;
  if (missed) steps.push({ title: `Revisit ${missed} high-confidence miss${missed === 1 ? '' : 'es'}`, why: 'You were sure and wrong. These are the most valuable errors to correct.', href: '#practice?mode=missed&count=10&go=1', cta: 'Retry misses' });
  const byWeight = [...data.objectives].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  const fresh = byWeight.find((o) => objectiveEvidence(state, o.id).status === 'New');
  if (fresh) steps.push({ title: `Start objective ${fresh.id}`, why: `${fresh.title}. It is in a ${fresh.weight}% domain and has no activity yet.`, href: `#learn/${fresh.id}`, cta: 'Open guide' });
  const weak = data.objectives
    .map((o) => ({ o, ev: objectiveEvidence(state, o.id) }))
    .filter(({ ev }) => ev.attempts >= 3 && ev.accuracy !== null && ev.accuracy < 0.7)
    .sort((a, b) => a.ev.accuracy - b.ev.accuracy)[0];
  if (weak) steps.push({ title: `Strengthen objective ${weak.o.id}`, why: `Recent accuracy is ${pct(weak.ev.accuracy)}. Read the guide again, then practice this objective.`, href: `#practice?objective=${weak.o.id}&mode=adaptive&count=10&go=1`, cta: 'Practice it' });
  if (!steps.length) steps.push({ title: 'Take a weighted mixed mock', why: 'Everything is up to date. A timed mixed set tests recall across domains.', href: '#practice', cta: 'Choose a set' });
  return steps.slice(0, 4);
}

export function renderDashboard(ctx, root) {
  const { data, state } = ctx;
  const today = todayCount(state), goal = state.profile.dailyGoal;
  const due = dueCards(data.cards, state).length;
  const evs = data.objectives.map((o) => objectiveEvidence(state, o.id));
  const count = (s) => evs.filter((e) => e.status === s).length;
  const answered = new Set(state.attempts.map((a) => a.id)).size;
  const newToday = newCards(data.cards, state).length;
  root.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">CompTIA CySA+ · CS0-004 · V4</div>
      <h1>Welcome back, ${esc(state.profile.name)}.</h1>
      <p>Learn the objective, practice the decision, review on schedule. Your numbers below are evidence of what you have done, not a prediction of an exam score.</p>
    </div>
    <div class="grid cols-4">
      <div class="card stat"><b>${today}<small>/${goal}</small></b><span>learning actions today</span><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(today, goal)}" aria-label="Daily goal progress"><i style="width:${Math.min(100, (today / goal) * 100)}%"></i></div></div>
      <div class="card stat"><b>${streak(state)}</b><span>day streak</span></div>
      <div class="card stat"><b>${due}</b><span>cards due now · ${newToday} unseen</span></div>
      <div class="card stat"><b>${answered}</b><span>distinct questions answered</span></div>
    </div>
    <div class="grid cols-2" style="margin-top:16px">
      <section class="card" aria-labelledby="next-h">
        <h2 id="next-h">Suggested next steps</h2>
        <div class="stack">${nextSteps(ctx).map((s) => `
          <div class="row between"><div style="flex:1;min-width:200px"><b>${esc(s.title)}</b><br><small>${esc(s.why)}</small></div><a class="btn primary sm" href="${esc(s.href)}">${esc(s.cta)}</a></div>`).join('<hr style="border:0;border-top:1px solid var(--line);width:100%;margin:2px 0">')}
        </div>
      </section>
      <section class="card" aria-labelledby="obj-h">
        <h2 id="obj-h">Objective evidence</h2>
        <div class="row" style="gap:18px;margin-bottom:10px">
          <div class="stat"><b>${count('Strong')}</b><span>Strong</span></div>
          <div class="stat"><b>${count('Practicing')}</b><span>Practicing</span></div>
          <div class="stat"><b>${count('Learning')}</b><span>Learning</span></div>
          <div class="stat"><b>${count('New')}</b><span>New</span></div>
        </div>
        <p class="muted" style="font-size:.85rem">“Strong” needs the guide read, at least 8 distinct tagged questions, and 80% or more on the most recent 10. See <a href="#progress">Progress</a> for how each objective is judged.</p>
      </section>
    </div>
    <h2 style="margin-top:26px">Exam domains</h2>
    <div class="grid cols-4">${data.catalog.domains.map((d) => {
      const ds = domainStats(state, d.id);
      const objs = data.objectives.filter((o) => o.domain === d.id);
      const strong = objs.filter((o) => objectiveEvidence(state, o.id).status === 'Strong').length;
      return `<a class="card objective-card" href="#learn"><span class="chip">${d.weight}% of exam</span><h3>${d.id}. ${esc(d.title)}</h3>
        <small>${strong} of ${objs.length} objectives strong · ${ds.attempts} answers${ds.attempts ? ` · ${pct(ds.accuracy)}` : ''}</small>
        <div class="bar" aria-hidden="true"><i style="width:${(strong / objs.length) * 100}%"></i></div></a>`;
    }).join('')}</div>
    <p class="muted" style="margin-top:20px;font-size:.85rem">Exam format (from the official objectives): up to 85 questions, 165 minutes, multiple-choice and performance-based, passing score 750 on a 100–900 scale. Scaled scores are not reproducible from practice percentages, so this workspace does not estimate one.</p>`;
}

export function renderLearn(ctx, root) {
  const { data, state } = ctx;
  root.innerHTML = `
    <div class="page-head"><div class="eyebrow">Learning path</div><h1>Fifteen objectives, one at a time</h1>
    <p>Each objective has a concise guide that explains how to decide, followed by the deeper imported reading. Start with the highest-weight domain or follow your next steps.</p></div>
    ${data.catalog.domains.map((d) => `
      <section class="domain-block" aria-labelledby="d${d.id}"><div class="row between"><h2 id="d${d.id}">Domain ${d.id}: ${esc(d.title)}</h2><span class="chip">${d.weight}% of exam</span></div>
      <p class="muted">${esc(d.short)}</p>
      <div class="grid cols-3">${d.objectives.map((o) => {
        const ev = objectiveEvidence(state, o.id);
        const ls = data.lessons.filter((l) => l.objectives.includes(o.id));
        const read = ls.filter((l) => state.lessons[l.id]?.read).length;
        return `<a class="card objective-card" href="#learn/${o.id}"><div class="row between"><span class="id">${o.id}</span>${statusChip(ev.status)}</div>
          <b>${esc(o.title)}</b><small>${state.objectives[o.id]?.read ? '✓ Guide read' : 'Guide not read'} · ${read}/${ls.length} readings</small></a>`;
      }).join('')}</div></section>`).join('')}`;
}

export function renderObjective(ctx, root, { arg }) {
  const { data, state } = ctx;
  const obj = data.objectives.find((o) => o.id === arg);
  if (!obj) { root.innerHTML = `<div class="empty"><h3>Objective not found</h3><a class="btn" href="#learn">Back to the learning path</a></div>`; return; }
  const guide = data.guideByObjective.get(obj.id);
  const ev = objectiveEvidence(state, obj.id);
  const lessons = data.lessons.filter((l) => l.objectives.includes(obj.id));
  const cards = data.cards.filter((c) => c.objective === obj.id);
  const cases = data.cases.filter((c) => c.objectives.includes(obj.id));
  const qCount = data.questions.filter((q) => q.objective === obj.id).length;
  const idx = data.objectives.findIndex((o) => o.id === obj.id);
  const prev = data.objectives[idx - 1], next = data.objectives[idx + 1];
  root.innerHTML = `
    <div class="page-head"><div class="eyebrow"><a href="#learn">Learning path</a> · Domain ${obj.domain}: ${esc(obj.domainTitle)}</div>
      <div class="row between"><h1>${obj.id} ${esc(obj.title)}</h1>${statusChip(ev.status)}</div>
      <p>${esc(evidenceLine(ev))}</p></div>
    <div class="row" style="margin-bottom:18px">
      <a class="btn primary" href="#practice?objective=${obj.id}&mode=adaptive&count=10&go=1">Practice this objective (${qCount} tagged)</a>
      <button class="btn" data-act="toggle-guide">${state.objectives[obj.id]?.read ? '✓ Guide marked read (undo)' : 'Mark guide as read'}</button>
      ${cards.length ? `<a class="btn" href="#review?objective=${obj.id}">Flashcards (${cards.length})</a>` : ''}
    </div>
    ${guide ? `<article class="card">
      <div class="eyebrow">Concise guide · written for this workspace</div>
      <p style="font-size:1.05rem">${esc(guide.core)}</p>
      <section class="guide-section"><h3>What to know</h3><ul>${guide.know.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></section>
      <section class="guide-section callout-box"><h3>How to decide</h3><p style="margin:0">${esc(guide.decide)}</p></section>
      <section class="guide-section callout-box trap"><h3>Common traps</h3><ul>${guide.traps.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>
    </article>` : ''}
    <h2 style="margin-top:24px">Deeper reading (${lessons.length})</h2>
    <p class="muted">Imported from the cysa-plus curriculum (CC BY-NC-SA 4.0). Technical corrections have been applied; see the <a href="#library">library</a> for the list.</p>
    ${lessons.map((l) => `<details data-lesson="${esc(l.id)}"><summary>${esc(l.title)} ${state.lessons[l.id]?.read ? '<span class="chip strong">read</span>' : ''}</summary>
      <div class="body"><div class="rich">${l.html}</div><button class="btn sm" data-act="toggle-lesson" data-id="${esc(l.id)}">${state.lessons[l.id]?.read ? 'Mark unread' : 'Mark as read'}</button></div></details>`).join('') || '<div class="empty">No imported reading maps to this objective.</div>'}
    ${cases.length ? `<h2 style="margin-top:24px">Apply it</h2><div class="row">${cases.map((c) => `<a class="btn" href="#cases/${c.id}">${esc(c.title)}</a>`).join('')}</div>` : ''}
    <div class="row between" style="margin-top:28px">${prev ? `<a class="btn ghost" href="#learn/${prev.id}">← ${prev.id}</a>` : '<span></span>'}${next ? `<a class="btn ghost" href="#learn/${next.id}">${next.id} →</a>` : '<span></span>'}</div>
    <section class="card" style="margin-top:22px"><h3>Your notes on ${obj.id}</h3><textarea id="note" aria-label="Notes for objective ${obj.id}" placeholder="What would you want to remember? Saved in this browser.">${esc(state.notes[obj.id] || '')}</textarea></section>`;

  on(root, 'click', '[data-act="toggle-guide"]', () => {
    const now = !state.objectives[obj.id]?.read;
    state.objectives[obj.id] = { read: now, at: Date.now() };
    if (now) ctx.activity('guide');
    ctx.save(); ctx.toast(now ? 'Guide marked as read.' : 'Guide marked unread.'); ctx.rerender();
  });
  on(root, 'click', '[data-act="toggle-lesson"]', (_, btn) => {
    const id = btn.dataset.id, now = !state.lessons[id]?.read;
    state.lessons[id] = { read: now, at: Date.now() };
    if (now) ctx.activity('lesson');
    ctx.save();
    const open = [...root.querySelectorAll('details[open]')].map((d) => d.dataset.lesson);
    const y = window.scrollY;
    ctx.rerender();
    open.forEach((lid) => document.querySelector(`details[data-lesson="${lid}"]`)?.setAttribute('open', ''));
    window.scrollTo(0, y);
  });
  let timer;
  root.querySelector('#note').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.notes[obj.id] = e.target.value; ctx.save(); }, 400);
  });
  ctx.onLeave(() => { const t = root.querySelector('#note'); if (t && state.notes[obj.id] !== t.value) { state.notes[obj.id] = t.value; ctx.save(); } clearTimeout(timer); });
}
