import { MASTERED_RULE, STRONG_RULE, dayKey, domainStats, dueCards, masteredProgress, misconceptions, newCards, objectiveEvidence, streak, strongProgress, studyPlan, todayCount } from './core.mjs';
import { loadSession } from './store.mjs';
import { bindReadingToggle, readingDetails } from './view-guide.mjs';
import { esc, fmt, meter, on, pct, statusChip } from './ui.mjs';

function evidenceLine(ev) {
  if (!ev.unique) return 'No tagged questions answered yet.';
  const parts = [];
  if (ev.trusted) parts.push(`${ev.trusted} with reviewed or original mappings`);
  if (ev.indicative) parts.push(`${ev.indicative} with indicative source tags`);
  return `Based on ${ev.unique} tagged question${ev.unique === 1 ? '' : 's'} (${parts.join(', ')}).`;
}

const shortTitle = (t) => t.replace(/^(Given a scenario, |Explain (the importance of )?|Summarize )/i, '').replace(/^./, (c) => c.toUpperCase());

function newAllowance(state) {
  const started = Object.values(state.reviews).filter((r) => r.first === dayKey()).length;
  return Math.max(0, state.profile.newPerDay - started);
}

function nextSteps(ctx) {
  const { data, state } = ctx;
  const steps = [];
  const session = loadSession();
  if (session && !session.finished) {
    const answered = Object.keys(session.answers).length;
    steps.push({ title: `Resume “${session.label}”`, why: `${answered} of ${session.ids.length} answered. Your place is saved.`, href: '#practice/session', cta: 'Resume' });
  }
  const due = dueCards(data.cards, state).length;
  if (due) steps.push({ title: `Review ${fmt(due)} due card${due === 1 ? '' : 's'}`, why: 'Cards come back on a schedule. Reviewing on time is the cheapest way to keep what you learned.', href: '#review', cta: 'Start review' });
  const missed = misconceptions(state).length;
  if (missed) steps.push({ title: `Revisit ${missed} high-confidence miss${missed === 1 ? '' : 'es'}`, why: 'You were sure and wrong. These are the most valuable errors to correct.', href: '#practice?mode=missed&count=10&go=1', cta: 'Retry misses' });
  const weak = data.objectives
    .map((o) => ({ o, ev: objectiveEvidence(state, o.id) }))
    .filter(({ ev }) => ev.attempts >= 3 && ev.accuracy !== null && ev.accuracy < 0.7)
    .sort((a, b) => a.ev.accuracy - b.ev.accuracy)[0];
  if (weak) steps.push({ title: `Strengthen objective ${weak.o.id}`, why: `Recent accuracy is ${pct(weak.ev.accuracy)}. Re-read the guide, then practice this objective.`, href: `#learn/${weak.o.id}`, cta: 'Open objective' });
  const byWeight = [...data.objectives].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  const fresh = byWeight.find((o) => objectiveEvidence(state, o.id).status === 'New');
  if (fresh) steps.push({ title: `Start objective ${fresh.id}`, why: `${shortTitle(fresh.title)}. It is in a ${fresh.weight}% domain and has no activity yet.`, href: `#learn/${fresh.id}`, cta: 'Open guide' });
  if (!steps.length) steps.push({ title: 'Take a weighted mixed mock', why: 'Everything is up to date. A timed mixed set tests recall across domains.', href: '#practice', cta: 'Choose a set' });
  return steps.slice(0, 4);
}

function objectiveMap(ctx) {
  const { data, state } = ctx;
  return `<div class="obj-map">${data.catalog.domains.map((d) => {
    const objs = data.objectives.filter((o) => o.domain === d.id);
    const strong = objs.filter((o) => objectiveEvidence(state, o.id).strong).length;
    const mastered = objs.filter((o) => objectiveEvidence(state, o.id).mastered).length;
    const ds = domainStats(state, d.id);
    return `<section class="obj-col" aria-label="Domain ${d.id}"><header><b>${d.id}. ${esc(d.title)}</b><small>${d.weight}% of exam · ${strong}/${objs.length} strong${mastered ? ` (${mastered} mastered)` : ''}${ds.attempts ? ` · ${pct(ds.accuracy)} of ${fmt(ds.attempts)}` : ''}</small></header>
      ${objs.map((o) => {
        const ev = objectiveEvidence(state, o.id), sp = ev.strong ? masteredProgress(ev) : strongProgress(ev);
        return `<a class="obj-tile s-${ev.status.toLowerCase()}" href="#learn/${o.id}" title="${esc(o.title)}"><span class="row between"><span class="id">${o.id}</span><span class="tile-status">${esc(ev.status)}</span></span><span class="t">${esc(shortTitle(o.title))}</span>${meter(sp.overall, `Objective ${o.id} progress toward ${ev.strong ? 'Mastered' : 'Strong'}`)}</a>`;
      }).join('')}</section>`;
  }).join('')}</div>`;
}

function planCard(ctx) {
  const { data, state } = ctx;
  const plan = studyPlan(data, state, state.profile.examDate);
  if (!plan) return `<section class="card plan row between"><div><b>Plan your run-up to the exam</b><br><small class="muted">Set your exam date and get a daily workload that fits the time you have.</small></div><a class="btn" href="#settings">Set exam date</a></section>`;
  if (plan.past) return `<section class="card plan"><b>Your exam date has passed.</b> <a href="#settings">Update it in settings</a> when you book a new one.</section>`;
  return `<section class="card plan" aria-labelledby="plan-h"><div class="row between"><h2 id="plan-h" style="margin:0">${plan.daysLeft} day${plan.daysLeft === 1 ? '' : 's'} to your exam</h2><span class="chip">${plan.usableDays} study days, then final review</span></div>
    <div class="grid cols-4" style="margin-top:12px">
      <div class="stat"><b>${plan.questionsPerDay}</b><span>questions a day to reach Mastered everywhere (${fmt(plan.toMastered)} in total)</span></div>
      <div class="stat"><b>${plan.guidesPerDay}</b><span>guides a day (${plan.unreadGuides} unread)</span></div>
      <div class="stat"><b>${plan.newCardsPerDay}</b><span>new cards a day (${fmt(plan.unseenCards)} unseen)</span></div>
      <div class="stat"><b>${fmt(plan.toStrong)}</b><span>questions to reach Strong everywhere</span></div>
    </div>
    ${plan.cardsFit ? '' : `<div class="notice warn" style="margin-top:12px">At your limit of ${state.profile.newPerDay} new cards a day you will see about ${fmt(Math.min(plan.unseenCards, state.profile.newPerDay * plan.usableDays))} of the ${fmt(plan.unseenCards)} unseen cards (${pct(Math.min(1, (state.profile.newPerDay * plan.usableDays) / plan.unseenCards))}) before the exam. Covering them all needs ${plan.newCardsPerDay} a day, which is heavy: consider ${Math.min(40, plan.newCardsPerDay)} a day in <a href="#settings">settings</a> and spend the rest of your time on questions, which the exam actually tests.</div>`}
    <p class="muted" style="font-size:.82rem;margin:10px 0 0">A workload estimate, not a score prediction. Keep the last days for full-length sets and review of misses.</p></section>`;
}

export function renderDashboard(ctx, root) {
  const { data, state } = ctx;
  const today = todayCount(state), goal = state.profile.dailyGoal;
  const due = dueCards(data.cards, state).length;
  const newToday = Math.min(newCards(data.cards, state).length, newAllowance(state));
  const answered = new Set(state.attempts.map((a) => a.id)).size;
  const recent = state.attempts.slice(-50), recentAcc = recent.length ? recent.filter((a) => a.correct).length / recent.length : null;
  const days = streak(state), studiedToday = today > 0;
  const [first, ...rest] = nextSteps(ctx);
  root.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">CompTIA CySA+ · CS0-004 · V4</div>
      <h1>Welcome back, ${esc(state.profile.name)}.</h1>
      <p>Learn the objective, practice the decision, review on schedule. These numbers show what you have done, not a predicted exam score.</p>
    </div>
    <section class="card hero" aria-labelledby="up-next">
      <div class="hero-main"><div class="eyebrow">Up next</div><h2 id="up-next">${esc(first.title)}</h2><p>${esc(first.why)}</p><a class="btn primary lg" href="${esc(first.href)}">${esc(first.cta)} →</a></div>
      ${rest.length ? `<div class="hero-side"><div class="eyebrow">Also worth doing</div><ul class="link-list">${rest.map((s) => `<li><a href="${esc(s.href)}"><b>${esc(s.title)}</b><small>${esc(s.why)}</small></a></li>`).join('')}</ul></div>` : ''}
    </section>
    ${planCard(ctx)}
    <div class="grid cols-4 stats">
      <div class="card stat"><span class="stat-label">Today</span><b>${today}<small> / ${goal}</small></b>${meter(today / goal, 'Daily goal progress')}<span>${today >= goal ? 'Daily goal reached' : `${goal - today} learning action${goal - today === 1 ? '' : 's'} to go`}</span></div>
      <div class="card stat"><span class="stat-label">Streak</span><b>${days}<small> day${days === 1 ? '' : 's'}</small></b><span>${days && !studiedToday ? 'Study today to keep it going' : days ? 'Keep it going tomorrow' : 'Start one today'}</span></div>
      <a class="card stat link-card" href="#review"><span class="stat-label">Flashcards</span><b>${fmt(due)}<small> due</small></b><span>${newToday ? `+ ${newToday} new available today` : 'No new cards left today'}</span></a>
      <a class="card stat link-card" href="#progress"><span class="stat-label">Questions</span><b>${fmt(answered)}<small> answered</small></b><span>${recentAcc == null ? 'None answered yet' : `${pct(recentAcc)} correct in your last ${recent.length}`}</span></a>
    </div>
    <div class="row between" style="margin-top:28px"><h2 style="margin:0">Objective map</h2>
      <div class="legend" aria-label="Status legend"><span class="s-new">New</span><span class="s-learning">Learning</span><span class="s-practicing">Practicing</span><span class="s-strong">Strong</span><span class="s-mastered">Mastered</span></div></div>
    <p class="muted" style="font-size:.85rem;margin:6px 0 12px"><b>Strong</b>: guide read, ${STRONG_RULE.unique} distinct tagged questions, ${pct(STRONG_RULE.accuracy)} on your last 10. <b>Mastered</b>: ${MASTERED_RULE.unique} distinct questions, ${pct(MASTERED_RULE.accuracy)} on your last ${MASTERED_RULE.recent}, and no unresolved misses. Select an objective to see what is missing.</p>
    ${objectiveMap(ctx)}
    <p class="muted" style="margin-top:20px;font-size:.85rem">Exam format (from the official objectives): up to 85 questions, 165 minutes, multiple-choice and performance-based, passing score 750 on a 100–900 scale. Scaled scores cannot be derived from practice percentages, so this workspace does not estimate one.</p>`;
}

export function renderLearn(ctx, root) {
  const { data, state } = ctx;
  root.innerHTML = `
    <div class="page-head"><div class="eyebrow">Learning path</div><h1>Fifteen objectives, one at a time</h1>
    <p>Each objective has a concise guide that explains how to decide, followed by deeper imported reading. Start with the highest-weight domain or follow <a href="#dashboard">Up next</a>.</p></div>
    ${data.catalog.domains.map((d) => {
      const strong = d.objectives.filter((o) => objectiveEvidence(state, o.id).strong).length;
      return `
      <section class="domain-block" aria-labelledby="d${d.id}"><div class="row between"><h2 id="d${d.id}" style="margin:0">Domain ${d.id}: ${esc(d.title)}</h2><span class="row" style="gap:8px"><span class="chip">${strong}/${d.objectives.length} strong</span><span class="chip">${d.weight}% of exam</span></span></div>
      <p class="muted" style="margin:8px 0 14px">${esc(d.short)}</p>
      <div class="grid cols-3">${d.objectives.map((o) => {
        const ev = objectiveEvidence(state, o.id), sp = strongProgress(ev);
        const ls = data.lessons.filter((l) => l.objectives.includes(o.id));
        const read = ls.filter((l) => state.lessons[l.id]?.read).length;
        return `<a class="card objective-card" href="#learn/${o.id}"><div class="row between"><span class="id">${o.id}</span>${statusChip(ev.status)}</div>
          <b>${esc(o.title)}</b>${meter(sp.overall, `Objective ${o.id} progress toward Strong`)}
          <small>${state.objectives[o.id]?.read ? '✓ Guide' : '○ Guide'} · ${Math.min(ev.unique, STRONG_RULE.unique)}/${STRONG_RULE.unique} questions${ev.accuracy != null ? ` · ${pct(ev.accuracy)} recent` : ''} · ${read}/${ls.length} readings</small></a>`;
      }).join('')}</div></section>`;
    }).join('')}`;
}

function pathToStrong(obj, ev) {
  const strongSoFar = ev.strong;
  const sp = strongSoFar ? masteredProgress(ev) : strongProgress(ev);
  const row = (done, title, detail, action = '') => `<li class="${done ? 'done' : ''}"><span class="tick" aria-hidden="true">${done ? '✓' : ''}</span><div><b>${title}</b><small>${detail}</small></div>${done ? '' : action}</li>`;
  const practice = `<a class="btn sm" href="#practice?objective=${obj.id}&mode=adaptive&count=10&go=1">Practice</a>`;
  const accDone = ev.recent >= STRONG_RULE.recent && ev.accuracy >= STRONG_RULE.accuracy;
  const strongRows = [
    row(ev.read, 'Read the guide', ev.read ? 'Done.' : 'The concise guide below takes about five minutes.', '<button class="btn sm" data-act="toggle-guide">Mark as read</button>'),
    row(ev.unique >= STRONG_RULE.unique, `Answer ${STRONG_RULE.unique} distinct tagged questions`, `${Math.min(ev.unique, STRONG_RULE.unique)} of ${STRONG_RULE.unique} so far.`, practice),
    row(accDone, `Score ${pct(STRONG_RULE.accuracy)} or more on your last 10`, ev.accuracy == null ? 'No answers yet.' : `${pct(ev.accuracy)} across your last ${ev.recent} answer${ev.recent === 1 ? '' : 's'}${ev.recent < STRONG_RULE.recent ? ` (needs at least ${STRONG_RULE.recent})` : ''}.`, practice),
  ].join('');
  const masteredRows = [
    row(ev.unique >= MASTERED_RULE.unique, `Answer ${MASTERED_RULE.unique} distinct tagged questions`, `${Math.min(ev.unique, MASTERED_RULE.unique)} of ${MASTERED_RULE.unique} so far.`, practice),
    row(ev.recent20 >= MASTERED_RULE.recent && ev.accuracy20 >= MASTERED_RULE.accuracy, `Score ${pct(MASTERED_RULE.accuracy)} or more on your last ${MASTERED_RULE.recent}`, ev.accuracy20 == null ? 'No answers yet.' : `${pct(ev.accuracy20)} across your last ${ev.recent20}.`, practice),
    row(ev.openMisses === 0, 'Correct every question you have missed', ev.openMisses ? `${ev.openMisses} question${ev.openMisses === 1 ? ' is' : 's are'} still wrong on the latest attempt.` : 'No unresolved misses.', '<a class="btn sm" href="#practice?mode=missed&count=10&go=1">Retry misses</a>'),
  ].join('');
  return `<section class="card path" aria-labelledby="path-h">
    <div class="row between"><h2 id="path-h" style="margin:0">Path to ${strongSoFar ? 'Mastered' : 'Strong'}</h2>${statusChip(ev.status)}</div>
    ${meter(sp.overall, `Overall progress toward ${strongSoFar ? 'Mastered' : 'Strong'}`, 'lg')}
    <ul class="task-list path-list">${strongSoFar ? masteredRows : strongRows}</ul>
    ${strongSoFar ? '<small class="muted">Strong is reached. Mastered asks for a longer, higher-accuracy record with no open misses.</small>' : `<small class="muted">${esc(evidenceLine(ev))}</small>`}
  </section>`;
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
  const readCount = lessons.filter((l) => state.lessons[l.id]?.read).length;
  const sgSections = data.studyGuide.flatMap((c) => c.readings.filter((r) => r.objectives.includes(obj.id)).map((r) => ({ ...r, chapter: c.number })));
  const sgRead = sgSections.filter((r) => state.lessons[r.id]?.read).length;
  root.innerHTML = `
    <div class="page-head"><div class="eyebrow"><a href="#learn">Learning path</a> · Domain ${obj.domain}: ${esc(obj.domainTitle)}</div>
      <h1>${obj.id} ${esc(obj.title)}</h1></div>
    ${pathToStrong(obj, ev)}
    <div class="row" style="margin:16px 0 18px">
      <a class="btn primary" href="#practice?objective=${obj.id}&mode=adaptive&count=10&go=1">Practice 10 questions <small>(${qCount} tagged)</small></a>
      ${cards.length ? `<a class="btn" href="#review?objective=${obj.id}">Flashcards (${cards.length})</a>` : ''}
      ${cases.map((c) => `<a class="btn ghost" href="#cases/${c.id}">Case: ${esc(c.title)}</a>`).join('')}
    </div>
    ${guide ? `<article class="card">
      <div class="eyebrow">Concise guide · written for this workspace</div>
      <p style="font-size:1.05rem">${esc(guide.core)}</p>
      <section class="guide-section"><h3>What to know</h3><ul>${guide.know.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></section>
      <section class="guide-section callout-box"><h3>How to decide</h3><p style="margin:0">${esc(guide.decide)}</p></section>
      <section class="guide-section callout-box trap"><h3>Common traps</h3><ul>${guide.traps.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>
      ${guide.deep?.length ? `<h3 style="margin-top:20px">Deep dives</h3>${guide.deep.map((d) => `<details><summary>${esc(d.title)}</summary><div class="body"><ul>${d.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div></details>`).join('')}` : ''}
      <div class="guide-foot row between">${state.objectives[obj.id]?.read
        ? '<span class="muted">✓ You have read this guide.</span><button class="btn sm ghost" data-act="toggle-guide">Mark unread</button>'
        : '<span class="muted">Finished reading?</span><button class="btn primary sm" data-act="toggle-guide">Mark guide as read</button>'}</div>
    </article>` : ''}
    ${sgSections.length ? `<div class="row between" style="margin-top:26px"><h2 style="margin:0">Study guide sections</h2><span class="chip">${sgRead}/${sgSections.length} read</span></div>
    <p class="muted">From the Chapple and Seidl study guide. <a href="#guide">Open the full study guide</a>.</p>
    ${sgSections.map((r) => readingDetails(state, r, ` <span class="chip">ch ${r.chapter}</span>`)).join('')}` : ''}
    <div class="row between" style="margin-top:26px"><h2 style="margin:0">Deeper reading</h2><span class="chip">${readCount}/${lessons.length} read</span></div>
    <p class="muted">Imported from the cysa-plus curriculum (CC BY-NC-SA 4.0). Technical corrections have been applied; see the <a href="#library">library</a> for the list.</p>
    ${lessons.map((l) => readingDetails(state, l)).join('') || '<div class="empty">No imported reading maps to this objective.</div>'}
    <section class="card" style="margin-top:22px"><h3>Your notes on ${obj.id}</h3><textarea id="note" aria-label="Notes for objective ${obj.id}" placeholder="What would you want to remember? Saved in this browser as you type.">${esc(state.notes[obj.id] || '')}</textarea><small class="muted" id="noteStatus" role="status"></small></section>
    <nav class="row between pager" aria-label="Objective navigation" style="margin-top:22px">${prev ? `<a class="btn ghost" href="#learn/${prev.id}">← ${prev.id} ${esc(shortTitle(prev.title).slice(0, 40))}</a>` : '<span></span>'}${next ? `<a class="btn ghost" href="#learn/${next.id}">${next.id} ${esc(shortTitle(next.title).slice(0, 40))} →</a>` : '<span></span>'}</nav>`;

  on(root, 'click', '[data-act="toggle-guide"]', () => {
    const now = !state.objectives[obj.id]?.read;
    state.objectives[obj.id] = { read: now, at: Date.now() };
    if (now) ctx.activity('guide');
    ctx.save(); ctx.toast(now ? 'Guide marked as read.' : 'Guide marked unread.');
    const y = window.scrollY;
    ctx.rerender();
    window.scrollTo(0, y);
  });
  bindReadingToggle(ctx, root);
  let timer;
  const status = root.querySelector('#noteStatus');
  root.querySelector('#note').addEventListener('input', (e) => {
    clearTimeout(timer);
    status.textContent = 'Saving…';
    timer = setTimeout(() => { state.notes[obj.id] = e.target.value; ctx.save(); status.textContent = 'Saved'; }, 400);
  });
  ctx.onLeave(() => { const t = root.querySelector('#note'); if (t && (state.notes[obj.id] || '') !== t.value) { state.notes[obj.id] = t.value; ctx.save(); } clearTimeout(timer); });
}
