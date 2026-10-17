import { dayKey, domainStats, freshState, misconceptions, objectiveEvidence, validateProgress } from './core.mjs';
import { clearAll } from './store.mjs';
import { download, esc, fmt, formatDuration, on, pct, statusChip } from './ui.mjs';

const CORRECTIONS = [
  ['Study guide integrated', 'The Chapple and Seidl study guide (12 chapters, Exam Essentials, 240 review questions and a 20-question assessment test) was not part of the first build and is now included. Its questions carry domain-level mapping only. Sections are linked to objectives by title.'],
  ['Duplicates removed', 'Near-identical questions (same stem and same correct answer) and flashcards were detected across every source and removed from practice so the same item does not count twice. Re-worded variants are kept because they test the same fact in new words. Details are in docs/content_audit.json.'],
  ['Inferred objectives', 'About a thousand practice-book and study-guide questions have no objective. A text-similarity model assigns an objective to the ones where it is confident. Measured leave-one-chapter-out on study-guide questions it was right about 70% of the time overall and 89% at the confidence threshold used (27 test questions, so treat that as roughly 75 to 95%). These labels are shown as inferred, counted only as indicative evidence, and never treated as checked.'],
  ['Not integrated', 'A set of CS0-003 exam files (the retired version) was left out: the objectives changed in CS0-004, and numbered real-exam style question dumps are not a reliable or appropriate study source. The course-notes PDF is used only to check topic coverage, not copied into the app.'],
  ['Gap fill', 'Every official sub-topic was checked for readings, flashcards and questions. Thin areas (decoding and parsing, scripting languages, playbooks and tuning, scan planning, secure coding, enrichment and timelines, escalation and handover, AI usage policy, and more) received original deep-dive notes and scenario questions. Details are in docs/coverage.json.'],
  ['Detection metrics', 'The community reading and two questions (D4-058, D4-086) mixed up precision with true-positive rate and the false-discovery proportion with the false-positive rate. They were rewritten with explicit denominators: precision = TP/(TP+FP), false-discovery proportion = FP/(TP+FP), true-positive rate = TP/(TP+FN), false-positive rate = FP/(FP+TN).'],
  ['CVSS versions', 'The CVSS reading mixed CVSS v3.1 Scope wording with CVSS v4.0 metric groups. Versions are now named explicitly, and an abbreviated vector is described as incomplete.'],
  ['Objective tags', 'Many source objective tags were shifted (for example tool questions tagged 1.4 and threat-intelligence questions tagged 1.5). Selected domain 1 questions were remapped; uncertain ones are left at domain level. Source tags that were not reviewed are shown as “indicative”.'],
  ['Book questions', 'Chapters 1–4 of the practice book map to domains only, and chapters 5–6 are mixed exams. No objective tags were invented for them, so they inform domain statistics but not objective evidence.'],
  ['Readiness score', 'The source quiz converted raw percent into a 100–900 score and showed “Likely Pass”. That feature was not carried over: practice percentages cannot be converted into a scaled score.'],
  ['Simulations', 'Commands in the guided labs return scripted output. They are labeled as simulations, and the free-text step is shown as not graded.'],
  ['Impossible travel', 'One Anki note treats an impossible-travel alert as near-proof of credential compromise. Treat it as a lead and corroborate with VPN, device, token and authentication context (see original question ORG-27 and case 1).'],
  ['Reference graphics', 'The reference images are supplementary. At least one (cyber kill chain) contains lettering mistakes. Use official sources for exact terminology.'],
  ['Remote images', 'One Anki note linked to a remote diagram. Remote media is not loaded; a placeholder is shown instead.'],
];

/* ---------- trainers ---------- */

export function renderTrainers(ctx, root, { arg }) {
  const { catalog } = ctx.data;
  if (arg) {
    const t = catalog.trainers.find((x) => x.id === arg);
    if (!t) { root.innerHTML = '<div class="empty"><h3>Trainer not found</h3><a class="btn" href="#trainers">Back</a></div>'; return; }
    root.innerHTML = `<div class="page-head"><div class="eyebrow"><a href="#trainers">Skill trainers</a></div><div class="row between"><h1>${esc(t.title)}</h1><a class="btn" href="${esc(t.path)}" target="_blank" rel="noopener">Open in new tab</a></div></div>
      <div class="frame-wrap"><iframe title="${esc(t.title)} trainer" src="${esc(t.path)}" sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe></div>`;
    ctx.activity('trainer'); ctx.save();
    return;
  }
  root.innerHTML = `<div class="page-head"><div class="eyebrow">Skill trainers</div><h1>Hands-on drills</h1>
    <p>Standalone interactive trainers from the CySA-004 repository. They run their own logic and are not wired into your progress tracking. Treat them as drills, and check details against the official objectives.</p></div>
    <div class="grid cols-4">${catalog.trainers.map((t) => `<a class="card objective-card" href="#trainers/${esc(t.id)}"><b>${esc(t.title)}</b><small>Interactive trainer</small></a>`).join('')}</div>
    <h2 style="margin-top:28px">Reference graphics</h2>
    <div class="notice warn">Supplementary visuals from the same repository. At least one contains lettering errors, so use them for orientation, not exact terminology.</div>
    <div class="ref-grid" style="margin-top:12px">${catalog.references.map((r) => `<figure><img src="${esc(r.path)}" alt="${esc(r.title.replace(/[-_]/g, ' '))}" loading="lazy"><figcaption>${esc(r.title.replace(/[-_]/g, ' '))}</figcaption></figure>`).join('')}</div>`;
}

/* ---------- progress ---------- */

export function renderProgress(ctx, root) {
  const { data, state } = ctx;
  const missed = misconceptions(state);
  const exams = [...state.exams].reverse().slice(0, 12);
  const noted = data.objectives.filter((o) => state.notes[o.id]);
  root.innerHTML = `
    <div class="page-head"><div class="eyebrow">Progress & notes</div><h1>What the evidence says</h1>
    <p>Statuses reflect what you have done, not what you know for certain. They never predict an exam score.</p></div>
    <div class="grid cols-4">${data.catalog.domains.map((d) => { const s = domainStats(state, d.id); return `<div class="card stat"><b>${pct(s.accuracy)}</b><span>Domain ${d.id} accuracy · ${s.attempts} answers</span></div>`; }).join('')}</div>
    <h2 style="margin-top:24px">Objectives</h2>
    <div class="card table-wrap"><table><thead><tr><th>Objective</th><th>Status</th><th>Guide</th><th>Questions</th><th>Last 10</th></tr></thead><tbody>
      ${data.objectives.map((o) => { const e = objectiveEvidence(state, o.id); return `<tr><td><a href="#learn/${o.id}"><b>${o.id}</b></a> ${esc(o.title)}</td><td>${statusChip(e.status)}</td><td>${e.read ? '✓' : '—'}</td><td>${e.unique}${e.indicative ? ` <small class="muted">(${e.indicative} indicative)</small>` : ''}</td><td>${pct(e.accuracy)}</td></tr>`; }).join('')}
    </tbody></table></div>
    <details style="margin-top:12px"><summary>How statuses are decided</summary><div class="body"><ul>
      <li><b>New:</b> no guide read and no tagged answers.</li><li><b>Learning:</b> guide read, no tagged answers yet.</li><li><b>Practicing:</b> at least one tagged answer.</li>
      <li><b>Strong:</b> guide read, at least 8 distinct tagged questions, and 80% or more correct across the most recent 10 answers (minimum 8).</li>
      <li><b>Mastered:</b> Strong, plus at least 20 distinct tagged questions, 90% or more across the most recent 20 answers, and no question whose latest answer is still wrong.</li>
      <li>Tags come from three places. “Original” and “reviewed” mappings were checked. “Indicative” tags came from the source author and were not independently verified; they count, but are reported separately. Book questions carry no objective tags and do not count here.</li></ul></div></details>
    <h2 style="margin-top:24px">Misconceptions to fix (${missed.length})</h2>
    ${missed.length ? `<div class="card stack">${missed.slice(-12).reverse().map((a) => { const q = data.qById.get(a.id); return q ? `<div><b>${esc(q.prompt.text.slice(0, 150))}${q.prompt.text.length > 150 ? '…' : ''}</b><br><small class="muted">${a.objective || a.hint ? `Objective ${esc(a.objective || a.hint)} · ` : ''}answered with high confidence, and it was wrong</small></div>` : ''; }).join('')}<a class="btn primary" href="#practice?mode=missed&count=10&go=1" style="align-self:flex-start">Retry missed questions</a></div>` : '<div class="empty">No high-confidence misses. When you are sure and wrong, the question will appear here.</div>'}
    ${exams.length ? `<h2 style="margin-top:24px">Full-length results</h2><div class="card table-wrap"><table><thead><tr><th>Date</th><th>Set</th><th>Score</th><th>Time</th></tr></thead><tbody>${exams.map((e) => `<tr><td>${new Date(e.at).toLocaleString()}</td><td>${esc(e.label)}</td><td>${e.correct}/${e.total} (${pct(e.correct / e.total)})</td><td>${e.seconds != null ? formatDuration(e.seconds) : '—'}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <h2 style="margin-top:24px">Notes</h2>
    <div class="card"><label class="field">General study notes<textarea id="general" placeholder="Anything worth remembering, saved in this browser.">${esc(state.notes.general || '')}</textarea></label>
    ${noted.length ? `<h3 style="margin-top:14px">Objective notes</h3>${noted.map((o) => `<p><a href="#learn/${o.id}"><b>${o.id}</b></a> ${esc(state.notes[o.id].slice(0, 200))}${state.notes[o.id].length > 200 ? '…' : ''}</p>`).join('')}` : ''}</div>
    <h2 style="margin-top:24px">Backup</h2>
    <div class="card"><p>Your progress lives only in this browser. Clearing site data or switching browser or device loses it unless you export a backup.</p>
      <div class="row"><button class="btn primary" data-act="export">Export progress (JSON)</button><button class="btn" data-act="import">Import a backup…</button></div></div>`;
  wireBackup(ctx, root);
  let timer;
  root.querySelector('#general').addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => { state.notes.general = e.target.value; ctx.save(); }, 400); });
  ctx.onLeave(() => { clearTimeout(timer); const t = root.querySelector('#general'); if (t && (state.notes.general || '') !== t.value) { state.notes.general = t.value; ctx.save(); } });
}

function wireBackup(ctx, root) {
  on(root, 'click', '[data-act="export"]', () => {
    download(`cysa-mastery-progress-${dayKey()}.json`, JSON.stringify(ctx.state, null, 2));
    ctx.toast('Backup downloaded.');
  });
  on(root, 'click', '[data-act="import"]', () => document.getElementById('progressImport').click());
}

/* ---------- library ---------- */

export function renderLibrary(ctx, root) {
  const { catalog } = ctx.data;
  root.innerHTML = `<div class="page-head"><div class="eyebrow">Resource library</div><h1>Sources, licenses and corrections</h1>
    <p>Where everything in this workspace came from, what was changed, and what is still uncertain.</p></div>
    <h2>Official and reference documents</h2>
    <div class="card stack">${catalog.library.map((l) => `<div class="row between"><span>${esc(l.title)}</span><a class="btn sm" href="${esc(l.path)}" target="_blank" rel="noopener">Open PDF</a></div>`).join('')}
      <small class="muted">The official objectives document (CS0-004 v2.0) is the curriculum baseline: four domains weighted 34%, 26%, 24% and 16%, and fifteen numbered objectives.</small></div>
    <h2 style="margin-top:24px">Content sources</h2>
    <div class="card table-wrap"><table><thead><tr><th>Source</th><th>License / rights</th><th>Notes</th></tr></thead><tbody>${catalog.sources.map((s) => `<tr><td>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : esc(s.label)}</td><td>${esc(s.license)}</td><td>${esc(s.notes)}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted" style="font-size:.88rem;margin-top:8px">License texts: <a href="licenses/cysa-plus-LICENSE.txt" target="_blank" rel="noopener">cysa-plus</a> · <a href="licenses/CySA-004-LICENSE.txt" target="_blank" rel="noopener">CySA-004</a>. The cysa-plus curriculum is CC BY-NC-SA 4.0: attribution is required, use is non-commercial, and adaptations must be shared alike. The practice-book material is copyrighted and included for private personal study only, so this workspace should stay private.</p>
    <h2 style="margin-top:24px">How objective tags are trusted</h2><div class="notice">${esc(catalog.mappingPolicy)} Questions whose objective was inferred by text similarity (${fmt(ctx.data.audit.inferred)} of them) are counted as indicative evidence only.</div>
    <h2 style="margin-top:24px">Exam-day approach</h2>
    <details><summary>Time, pacing and question handling</summary><div class="body"><ul>
      <li>Official format: up to 85 questions in 165 minutes (about 1 minute 56 seconds each on average), multiple choice and performance-based. A passing score is 750 on a 100 to 900 scale.</li>
      <li>Performance-based questions usually appear first and take longer. A common approach is to flag them, answer the multiple-choice questions, then return with the time left. Check how your own session behaves before relying on this.</li>
      <li>Answer every question. A blank cannot earn credit, so make your best choice and flag it for review if unsure.</li>
      <li>Read for the qualifier: BEST, MOST likely, FIRST, EXCEPT. Then eliminate options that are wrong in this scenario, even if true in general.</li>
      <li>For choose-two questions, both selections must be right. Verify each against the scenario separately.</li>
      <li>Do not use a practice percentage as a pass prediction. CompTIA reports a scaled score, and question difficulty varies. Consistent results on full-length, unseen sets with a comfortable margin are the best evidence.</li>
    </ul></div></details>
    <h2 style="margin-top:24px">Corrections and limitations</h2>
    ${CORRECTIONS.map(([title, text]) => `<details><summary>${esc(title)}</summary><div class="body"><p>${esc(text)}</p></div></details>`).join('')}
    <p class="muted" style="font-size:.88rem">Assessment limits: content was inventoried in full, but technical accuracy was sampled rather than verified for every item. Passing the exam is not guaranteed by any score here.</p>`;
}

/* ---------- settings ---------- */

export function renderSettings(ctx, root) {
  const { state } = ctx;
  root.innerHTML = `<div class="page-head"><div class="eyebrow">Settings</div><h1>Your workspace</h1></div>
    <form class="card" id="profile"><div class="form-grid">
      <label class="field">Your name<input type="text" name="name" maxlength="40" value="${esc(state.profile.name)}"></label>
      <label class="field">Daily goal (learning actions)<input type="number" name="dailyGoal" min="5" max="100" value="${state.profile.dailyGoal}"></label>
      <label class="field">New flashcards per day<input type="number" name="newPerDay" min="0" max="100" value="${state.profile.newPerDay}"></label>
      <label class="field">Exam date (optional)<input type="date" name="examDate" value="${esc(state.profile.examDate || '')}"></label>
    </div><div class="row" style="margin-top:14px"><button class="btn primary" type="submit">Save settings</button></div></form>
    <h2 style="margin-top:24px">Backup and restore</h2>
    <div class="card"><p>Progress is stored in this browser only. Export a backup before clearing site data, switching browsers, or changing device.</p>
      <div class="row"><button class="btn primary" data-act="export">Export progress (JSON)</button><button class="btn" data-act="import">Import a backup…</button></div></div>
    <h2 style="margin-top:24px">Reset</h2>
    <form class="card" id="reset"><p>Deletes all progress, reviews, notes and bookmarks from this browser. Export a backup first if you might want them back.</p>
      <div class="row"><input type="text" name="confirm" aria-label="Type RESET to confirm" placeholder="Type RESET to confirm" autocomplete="off"><button class="btn danger" type="submit">Erase progress</button></div></form>`;
  wireBackup(ctx, root);
  root.querySelector('#profile').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    state.profile = { name: f.name.trim().slice(0, 40) || 'Hamza', dailyGoal: Math.min(100, Math.max(5, Number(f.dailyGoal) || 20)), newPerDay: Math.min(100, Math.max(0, Number(f.newPerDay) || 0)), examDate: /^\d{4}-\d{2}-\d{2}$/.test(f.examDate || '') ? f.examDate : '' };
    ctx.save(); ctx.toast('Settings saved.'); ctx.refreshChrome();
  });
  root.querySelector('#reset').addEventListener('submit', (e) => {
    e.preventDefault();
    if (new FormData(e.target).get('confirm') !== 'RESET') { ctx.toast('Type RESET (capitals) to confirm.'); return; }
    clearAll();
    ctx.state = validateProgress(freshState());
    ctx.save();
    ctx.toast('Progress erased.');
    ctx.go('#dashboard');
  });
}
