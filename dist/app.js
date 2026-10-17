import { dayKey, dueCards, streak, todayCount, validateProgress } from './core.mjs';
import { loadState, saveState, storage } from './store.mjs';
import { esc, toast } from './ui.mjs';
import { renderDashboard, renderLearn, renderObjective } from './view-learn.mjs';
import { renderPractice } from './view-practice.mjs';
import { renderReview } from './view-review.mjs';
import { renderCases } from './view-lab.mjs';
import { renderTrainers, renderProgress, renderLibrary, renderSettings } from './view-misc.mjs';

const TITLES = {
  dashboard: 'Overview', learn: 'Learning path', practice: 'Practice', review: 'Spaced review', cases: 'Analyst lab',
  trainers: 'Skill trainers', progress: 'Progress & notes', library: 'Resource library', settings: 'Settings',
};
const ROUTES = {
  dashboard: renderDashboard, learn: (c, r, p) => (p.arg ? renderObjective(c, r, p) : renderLearn(c, r, p)),
  practice: renderPractice, review: renderReview, cases: renderCases, trainers: renderTrainers,
  progress: renderProgress, library: renderLibrary, settings: renderSettings,
};

const main = document.getElementById('main');
let ctx = null;
let cleanups = [];

async function loadJson(name) {
  const response = await fetch(`data/${name}.json`);
  if (!response.ok) throw new Error(`Could not load data/${name}.json (${response.status})`);
  return response.json();
}

async function loadData() {
  const [catalog, book, lessons, cards, original, pbqs, labs, guide] = await Promise.all(
    ['catalog', 'questions', 'lessons', 'cards', 'original', 'pbqs', 'labs', 'guide'].map(loadJson),
  );
  const dupes = await loadJson('duplicates');
  const questions = [...original.questions, ...book, ...guide.questions].filter((q) => !dupes.questions[q.id]);
  const liveCards = cards.filter((c) => !dupes.cards[c.id]);
  const objectives = catalog.domains.flatMap((d) => d.objectives.map((o) => ({ ...o, domain: d.id, weight: d.weight, domainTitle: d.title })));
  return {
    catalog, questions, lessons, cards: liveCards, objectives, studyGuide: guide.chapters, guides: original.guides, cases: original.cases, pbqs, labs,
    qById: new Map(questions.map((q) => [q.id, q])),
    cardById: new Map(liveCards.map((c) => [c.id, c])),
    guideByObjective: new Map(original.guides.map((g) => [g.objective, g])),
  };
}

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || 'dashboard';
  const [path, query = ''] = raw.split('?');
  const [route, ...rest] = path.split('/');
  return { route: ROUTES[route] ? route : 'dashboard', arg: rest.length ? decodeURIComponent(rest.join('/')) : null, query: Object.fromEntries(new URLSearchParams(query)) };
}

function updateChrome(route) {
  const due = dueCards(ctx.data.cards, ctx.state).length;
  document.getElementById('dueBadge').textContent = due;
  const days = streak(ctx.state);
  document.getElementById('streakLabel').textContent = `${days} day streak`;
  const today = todayCount(ctx.state), goal = ctx.state.profile.dailyGoal;
  document.getElementById('goalText').textContent = `${today} / ${goal} today`;
  document.getElementById('goalRing').style.setProperty('--p', Math.min(1, today / goal));
  document.getElementById('dailyChip').classList.toggle('met', today >= goal);
  document.getElementById('profileName').firstChild.textContent = ctx.state.profile.name;
  document.getElementById('pageTitle').textContent = TITLES[route];
  document.title = `${TITLES[route]} · CySA Mastery`;
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === route));
  document.body.classList.remove('nav-open');
}

function render() {
  cleanups.splice(0).forEach((fn) => { try { fn(); } catch { /* teardown must never block navigation */ } });
  const params = parseHash();
  const container = document.createElement('div');
  main.replaceChildren(container);
  try {
    ROUTES[params.route](ctx, container, params);
  } catch (error) {
    console.error(error);
    container.innerHTML = `<div class="notice bad"><b>Something went wrong showing this page.</b><br>${esc(error.message)}</div>`;
  }
  updateChrome(params.route);
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

function createContext(data) {
  const context = {
    data,
    state: loadState(),
    save() {
      if (!saveState(context.state)) context.warnStorage();
    },
    warnStorage() {
      if (!context.warned) { context.warned = true; toast('Progress cannot be saved in this browser. Export a backup from Settings.'); }
    },
    activity(type) {
      const before = todayCount(context.state);
      context.state.activities.push({ day: dayKey(), type, at: Date.now() });
      if (context.state.activities.length > 50000) context.state.activities.splice(0, 10000);
      if (before + 1 === context.state.profile.dailyGoal) toast('Daily goal reached. Nice work.');
      queueMicrotask(() => updateChrome(parseHash().route));
    },
    onLeave(fn) { cleanups.push(fn); },
    refreshChrome() { updateChrome(parseHash().route); },
    rerender: render,
    go(hash) { if (location.hash === hash) render(); else location.hash = hash; },
    toast,
  };
  return context;
}

function openShortcuts() {
  const dialog = document.getElementById('shortcuts');
  if (!dialog.open) dialog.showModal();
}

function bindShell() {
  document.getElementById('menuToggle').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.body.classList.remove('nav-open');
    if (e.key === '?' && !e.target.closest?.('input,textarea,select') && !e.ctrlKey && !e.metaKey) { e.preventDefault(); openShortcuts(); }
  });
  const dialog = document.getElementById('shortcuts');
  document.getElementById('helpButton').addEventListener('click', openShortcuts);
  dialog.addEventListener('click', (e) => { if (e.target === dialog || e.target.closest('[data-close]')) dialog.close(); });
  document.getElementById('progressImport').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('That file is too large to be a progress backup.');
      const imported = validateProgress(JSON.parse(await file.text()));
      if (!window.confirm(`Replace the progress in this browser with the backup (${imported.attempts.length} answers, ${Object.keys(imported.reviews).length} reviewed cards)?`)) return;
      ctx.state = imported;
      ctx.save();
      toast('Progress restored from backup.');
      render();
    } catch (error) {
      toast(error.message || 'That file could not be imported.');
    }
  });
}

async function boot() {
  try {
    const data = await loadData();
    ctx = createContext(data);
    window.__cysa = ctx; // handy for debugging and browser tests
    bindShell();
    window.addEventListener('hashchange', render);
    if (storage.recovered) toast('Saved progress was unreadable and has been kept aside. Starting fresh.');
    if (!storage.ok) ctx.warnStorage();
    render();
  } catch (error) {
    console.error(error);
    main.innerHTML = `<div class="notice bad"><b>The study data could not be loaded.</b><br>${esc(error.message)}<br>Run <code>npm start</code> and open <code>http://localhost:8114</code>. Opening index.html directly from disk blocks data loading.</div>`;
  }
}

boot();
