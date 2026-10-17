import { shuffle } from './core.mjs';
import { esc, on, safeExhibit } from './ui.mjs';

const mark = (ctx, id, patch) => {
  ctx.state.cases[id] = { ...ctx.state.cases[id], ...patch, at: Date.now() };
  ctx.save();
};
const withIdentity = (options, answerIndex) => shuffle(options.map((text, i) => ({ text, ok: i === answerIndex })));

/* ---------- list ---------- */

function renderList(ctx, root) {
  const { data, state } = ctx;
  const done = (id) => state.cases[id];
  const score = (id) => (done(id)?.total ? ` · ${done(id).correct}/${done(id).total}` : done(id) ? ' · completed' : '');
  root.innerHTML = `
    <div class="page-head"><div class="eyebrow">Analyst lab</div><h1>Apply it to evidence</h1>
    <p>Work from logs, scan output and incident data the way an analyst would: read the exhibit, decide, then check your reasoning against the explanation.</p></div>
    <h2>Multi-step cases <span class="chip strong">original</span></h2>
    <div class="grid cols-3">${data.cases.map((c) => `<a class="card objective-card" href="#cases/${c.id}"><div class="row between"><span class="id">${esc(c.objectives.join(' · '))}</span>${done(c.id) ? `<span class="chip strong">done${score(c.id)}</span>` : ''}</div><b>${esc(c.title)}</b><small>${c.steps.length} decisions</small></a>`).join('')}</div>
    <h2 style="margin-top:28px">Performance-based practice (${data.pbqs.length})</h2>
    <p class="muted">Community-authored exhibits with several linked decisions, similar in shape to performance-based questions.</p>
    ${data.catalog.domains.map((d) => {
      const items = data.pbqs.filter((p) => p.domain === d.id);
      return items.length ? `<h3>Domain ${d.id}: ${esc(d.title)}</h3><div class="grid cols-3" style="margin-bottom:14px">${items.map((p) => `<a class="card objective-card" href="#cases/${esc(p.id)}"><div class="row between"><span class="id">${esc(p.id)}</span>${done(p.id) ? `<span class="chip strong">done${score(p.id)}</span>` : ''}</div><b>${esc(p.title)}</b><small>${p.fields.length} decisions</small></a>`).join('')}</div>` : '';
    }).join('')}
    <h2 style="margin-top:28px">Guided lab simulations (${data.labs.length})</h2>
    <div class="notice warn">These are scripted exercises. Commands return pre-written output; there is no real shell, scanner or SIEM behind them. Use them to rehearse the reasoning, not the tool syntax.</div>
    <div class="grid cols-3" style="margin-top:14px">${data.labs.map((l) => `<a class="card objective-card" href="#cases/${encodeURIComponent(l.id)}"><div class="row between"><span class="id">${esc(l.id)}</span>${done(l.id) ? '<span class="chip strong">completed</span>' : '<span class="chip">simulation</span>'}</div><b>${esc(l.title)}</b><small>${esc(l.group || '')}</small></a>`).join('')}</div>`;
}

/* ---------- multi-step cases ---------- */

function renderCase(ctx, root, c) {
  let step = 0;
  const results = [];
  const prepared = c.steps.map((s) => ({ ...s, shown: withIdentity(s.options, s.answer) }));
  const draw = () => {
    if (step >= prepared.length) {
      const correct = results.filter(Boolean).length;
      mark(ctx, c.id, { correct, total: prepared.length });
      root.innerHTML = `<div class="page-head"><div class="eyebrow"><a href="#cases">Analyst lab</a></div><h1>${esc(c.title)}: complete</h1></div>
        <div class="card"><div class="stat"><b>${correct}/${prepared.length}</b><span>decisions correct on this attempt</span></div></div>
        <div class="callout-box" style="margin:16px 0"><b>Takeaway.</b> ${esc(c.summary)}</div>
        <div class="row"><button class="btn primary" data-act="again">Try again</button><a class="btn" href="#cases">Back to the lab</a>${c.objectives.map((o) => `<a class="btn ghost" href="#learn/${o}">Objective ${o}</a>`).join('')}</div>`;
      return;
    }
    const s = prepared[step];
    const answered = results[step] !== undefined;
    root.innerHTML = `<div class="page-head"><div class="eyebrow"><a href="#cases">Analyst lab</a> · ${esc(c.objectives.join(' · '))}</div><h1>${esc(c.title)}</h1><p>${esc(c.brief)}</p></div>
      <h3>${esc(c.exhibitTitle)}</h3><pre class="exhibit" tabindex="0" aria-label="Exhibit">${esc(c.exhibit)}</pre>
      <article class="card" style="margin-top:16px"><div class="eyebrow">Decision ${step + 1} of ${prepared.length}</div><h2>${esc(s.label)}</h2>
        <div class="options" role="radiogroup" aria-label="Choices">${s.shown.map((o, i) => `<button class="option ${answered ? (o.ok ? 'correct' : o.picked ? 'wrong' : '') : ''}" role="radio" aria-checked="${!!o.picked}" data-i="${i}" ${answered ? 'disabled' : ''}><span class="letter">${String.fromCharCode(65 + i)}</span><span>${esc(o.text)}</span></button>`).join('')}</div>
        ${answered ? `<div class="feedback ${results[step] ? 'good' : 'miss'}" role="status"><b>${results[step] ? 'Correct.' : 'Not the best choice.'}</b><p style="margin:6px 0 0">${esc(s.explain)}</p></div><div class="row" style="margin-top:14px"><button class="btn primary" data-act="next">${step === prepared.length - 1 ? 'Finish case' : 'Next decision'}</button></div>` : ''}
      </article>`;
  };
  on(root, 'click', '.option', (_, b) => {
    const s = prepared[step];
    if (results[step] !== undefined) return;
    const pick = s.shown[Number(b.dataset.i)];
    pick.picked = true;
    results[step] = pick.ok;
    ctx.activity('case'); ctx.save();
    draw();
  });
  on(root, 'click', '[data-act="next"]', () => { step++; draw(); });
  on(root, 'click', '[data-act="again"]', () => ctx.rerender());
  draw();
}

/* ---------- performance-based exercises ---------- */

function renderPbq(ctx, root, p) {
  const fields = p.fields.map((f) => ({ ...f, shown: withIdentity(f.options, f.answer), choice: null }));
  let checked = false;
  const draw = () => {
    const allChosen = fields.every((f) => f.choice !== null);
    const correct = fields.filter((f) => f.choice !== null && f.shown[f.choice].ok).length;
    root.innerHTML = `<div class="page-head"><div class="eyebrow"><a href="#cases">Analyst lab</a> · Domain ${p.domain} · ${esc(p.id)}</div><h1>${esc(p.title)}</h1><p>${esc(p.brief)}</p></div>
      <h3>${esc(p.exhibitTitle || 'Exhibit')}</h3><pre class="exhibit" tabindex="0" aria-label="Exhibit">${safeExhibit(p.exhibit)}</pre>
      <form class="card stack" style="margin-top:16px" id="pbq">${fields.map((f, i) => {
        const ok = checked && f.shown[f.choice]?.ok;
        return `<div class="field-check ${checked ? (ok ? 'ok' : 'bad') : ''}"><label class="field">${esc(f.label)}
          <select data-i="${i}" ${checked ? 'disabled' : ''}><option value="">Choose…</option>${f.shown.map((o, j) => `<option value="${j}"${f.choice === j ? ' selected' : ''}>${esc(o.text)}</option>`).join('')}</select></label>
          ${!checked && f.hint ? `<small class="muted">Hint: ${esc(f.hint)}</small>` : ''}
          ${checked ? `<p style="margin:6px 0 0;font-size:.9rem"><b>${ok ? 'Correct.' : `Better answer: ${esc(f.shown.find((o) => o.ok).text)}.`}</b> ${esc(f.explain)}</p>` : ''}</div>`;
      }).join('')}
      ${checked ? `<div class="callout-box"><b>${correct}/${fields.length} correct.</b> ${esc(p.summary || '')}</div><div class="row"><button class="btn primary" type="button" data-act="again">Try again</button><a class="btn" href="#cases">Back to the lab</a></div>`
        : `<div class="row"><button class="btn primary" type="submit" ${allChosen ? '' : 'disabled'}>Check my answers</button>${allChosen ? '' : '<span class="muted">Answer every decision to check.</span>'}</div>`}</form>`;
  };
  on(root, 'change', 'select', (_, s) => { fields[Number(s.dataset.i)].choice = s.value === '' ? null : Number(s.value); draw(); root.querySelector(`select[data-i="${s.dataset.i}"]`)?.focus(); });
  root.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!fields.every((f) => f.choice !== null)) return;
    checked = true;
    mark(ctx, p.id, { correct: fields.filter((f) => f.shown[f.choice].ok).length, total: fields.length });
    ctx.activity('case'); ctx.save();
    draw();
  });
  on(root, 'click', '[data-act="again"]', () => ctx.rerender());
  draw();
}

/* ---------- scripted labs ---------- */

function renderLab(ctx, root, lab) {
  const con = lab.console || {};
  const tasks = con.tasks || [];
  const done = new Set();
  const simulated = new Set();
  const log = [...(con.boot || []).map((t) => ({ t }))];
  const graded = () => tasks.filter((t) => !(con.payload && con.payload.task === t.id));

  const draw = () => {
    const finished = graded().every((t) => done.has(t.id));
    root.innerHTML = `<div class="page-head"><div class="eyebrow"><a href="#cases">Analyst lab</a> · ${esc(lab.group || '')} · ${esc(lab.id)}</div><h1>${esc(lab.title)}</h1><p>${esc(lab.desc || '')}</p></div>
      <div class="notice warn">Guided simulation: outputs are scripted for teaching. This is not a live shell, scanner or SIEM, and typed commands must match the offered ones.</div>
      <div class="grid cols-2" style="margin-top:16px">
        <section class="card"><h3>Objectives</h3><ul>${(lab.objectives || []).map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
          <h3>Tasks</h3><ul class="task-list">${tasks.map((t) => `<li class="${done.has(t.id) ? 'done' : ''} ${simulated.has(t.id) ? 'sim' : ''}"><span class="tick" aria-hidden="true">${done.has(t.id) ? '✓' : ''}${simulated.has(t.id) ? '~' : ''}</span><span>${esc(t.label)}${simulated.has(t.id) ? ' <small class="muted">(simulated, not graded)</small>' : ''}${done.has(t.id) ? '<span class="sr-only"> completed</span>' : ''}</span></li>`).join('')}</ul>
          ${finished ? '<div class="notice ok">All graded tasks complete.</div>' : ''}
          ${(con.configs || []).length ? `<h3 style="margin-top:14px">Decisions</h3><div class="stack">${con.configs.map((c) => `<div class="field-check"><label class="field">${esc(c.label)}<select data-cfg="${esc(c.id)}"><option value="">Choose…</option>${c.options.map((o) => `<option>${esc(o)}</option>`).join('')}</select></label></div>`).join('')}</div>` : ''}
        </section>
        <section class="card"><h3>Console · ${esc(con.host || 'lab')}</h3>
          <div class="console" id="console" role="log" aria-live="polite">${log.map((l) => `<div class="${l.c || ''}">${esc(l.t)}</div>`).join('')}</div>
          <form class="row" id="cmdform" style="margin-top:10px"><input type="text" id="cmd" aria-label="Command" placeholder="Type or pick a command" style="flex:1" autocomplete="off"><button class="btn primary" type="submit">Run</button></form>
          <div class="row" style="margin-top:8px">${(con.commands || []).map((c) => `<button type="button" class="btn sm ghost" data-cmd="${esc(c.cmd)}">${esc(c.cmd.length > 40 ? `${c.cmd.slice(0, 40)}…` : c.cmd)}</button>`).join('')}</div>
          ${con.payload ? `<h3 style="margin-top:14px">${esc(con.payload.label || 'Input')}</h3><textarea id="payload" aria-label="${esc(con.payload.label || 'Input')}" placeholder="${esc(con.payload.placeholder || '')}"></textarea><div class="row" style="margin-top:8px"><button class="btn" type="button" data-act="payload">${esc(con.payload.button || 'Apply')}</button><small class="muted">Scripted response only; your input is not evaluated.</small></div>` : ''}
        </section></div>`;
    const consoleEl = root.querySelector('#console');
    consoleEl.scrollTop = consoleEl.scrollHeight;
  };
  const say = (t, c) => log.push({ t, c });
  const complete = (id) => {
    if (!id || done.has(id)) return;
    done.add(id);
    ctx.activity('case'); ctx.save();
    if (graded().every((t) => done.has(t.id))) mark(ctx, lab.id, { completed: true });
  };
  const run = (text) => {
    const input = text.trim();
    if (!input) return;
    say(`> ${input}`, 'cmd');
    const hit = (con.commands || []).find((c) => c.cmd.toLowerCase() === input.toLowerCase());
    if (hit) { say(hit.out); complete(hit.task); }
    else say('[SYS] Not recognised in this simulation. Use one of the offered commands.', 'warn');
    draw();
    root.querySelector('#cmd')?.focus();
  };
  root.addEventListener('submit', (e) => { e.preventDefault(); if (e.target.id === 'cmdform') run(root.querySelector('#cmd').value); });
  on(root, 'click', '[data-cmd]', (_, b) => run(b.dataset.cmd));
  on(root, 'click', '[data-act="payload"]', () => {
    const v = root.querySelector('#payload').value.trim();
    if (!v) { say('[ERR] Enter something first.', 'err'); draw(); return; }
    say(`> ${v}`, 'cmd'); say(con.payload.response || '[SYS] Accepted.', 'ok');
    if (con.payload.task) simulated.add(con.payload.task), done.add(con.payload.task);
    draw();
  });
  on(root, 'change', '[data-cfg]', (_, sel) => {
    const cfg = con.configs.find((c) => c.id === sel.dataset.cfg);
    if (!sel.value) return;
    if (sel.value === cfg.correct) { say(`[OK] ${cfg.label}: ${sel.value}`, 'ok'); complete(cfg.task); }
    else say(`[CHECK] ${cfg.label}: “${sel.value}” does not fit the evidence. Re-read the scenario and try again.`, 'warn');
    draw();
    const el = root.querySelector(`[data-cfg="${cfg.id}"]`);
    if (el) { el.value = sel.value; el.focus(); el.closest('.field-check').classList.add(sel.value === cfg.correct ? 'ok' : 'bad'); }
  });
  draw();
}

export function renderCases(ctx, root, { arg }) {
  if (!arg) return renderList(ctx, root);
  const { data } = ctx;
  const found = data.cases.find((c) => c.id === arg) ? ['case', data.cases.find((c) => c.id === arg)]
    : data.pbqs.find((p) => p.id === arg) ? ['pbq', data.pbqs.find((p) => p.id === arg)]
      : data.labs.find((l) => l.id === arg) ? ['lab', data.labs.find((l) => l.id === arg)] : null;
  if (!found) { root.innerHTML = '<div class="empty"><h3>Exercise not found</h3><a class="btn" href="#cases">Back to the lab</a></div>'; return; }
  return { case: renderCase, pbq: renderPbq, lab: renderLab }[found[0]](ctx, root, found[1]);
}
