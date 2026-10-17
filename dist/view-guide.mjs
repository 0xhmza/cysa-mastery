import { esc, fmt, meter, on } from './ui.mjs';

export const readingDetails = (state, r, extra = '') => `<details data-lesson="${esc(r.id)}"><summary>${state.lessons[r.id]?.read ? '<span class="read-dot done" aria-label="Read">✓</span>' : '<span class="read-dot" aria-label="Not read"></span>'}${esc(r.title)}${extra}</summary>
  <div class="body"><div class="rich">${r.html}</div><div class="guide-foot row between"><span class="muted">${state.lessons[r.id]?.read ? '✓ Read' : 'Done with this section?'}</span><button class="btn sm ${state.lessons[r.id]?.read ? 'ghost' : 'primary'}" data-act="toggle-lesson" data-id="${esc(r.id)}">${state.lessons[r.id]?.read ? 'Mark unread' : 'Mark as read'}</button></div></div></details>`;

/** Shared handler: toggle a reading's read flag, keep open sections open and scroll position steady. */
export function bindReadingToggle(ctx, root) {
  const { state } = ctx;
  on(root, 'click', '[data-act="toggle-lesson"]', (_, btn) => {
    const id = btn.dataset.id, now = !state.lessons[id]?.read;
    state.lessons[id] = { read: now, at: Date.now() };
    if (now) ctx.activity('lesson');
    ctx.save();
    const open = [...root.querySelectorAll('details[open]')].map((d) => d.dataset.lesson).filter((lid) => lid && !(now && lid === id));
    const y = window.scrollY;
    ctx.rerender();
    open.forEach((lid) => document.querySelector(`details[data-lesson="${lid}"]`)?.setAttribute('open', ''));
    window.scrollTo(0, y);
    if (now) ctx.toast('Section marked as read.');
  });
}

const readCount = (state, ch) => ch.readings.filter((r) => state.lessons[r.id]?.read).length;

export function renderGuide(ctx, root, { arg }) {
  const { data, state } = ctx;
  if (arg) return renderChapter(ctx, root, Number(arg));
  const totalSections = data.studyGuide.reduce((n, c) => n + c.readings.length, 0);
  const totalRead = data.studyGuide.reduce((n, c) => n + readCount(state, c), 0);
  root.innerHTML = `
    <div class="page-head"><div class="eyebrow">Study guide</div><h1>CompTIA CySA+ Study Guide, chapter by chapter</h1>
    <p>The full fourth-edition study guide: 12 chapters of reading, Exam Essentials for each, and 260 review questions with explanations. Sections are linked from the objectives they cover, so you can also reach them from the <a href="#learn">learning path</a>.</p></div>
    <div class="card row between" style="margin-bottom:16px"><div><b>${totalRead}</b> of <b>${totalSections}</b> sections read</div><div style="flex:1;min-width:180px;max-width:360px">${meter(totalRead / totalSections, 'Study guide sections read')}</div></div>
    ${data.catalog.domains.map((d) => {
      const chapters = data.studyGuide.filter((c) => c.domain === d.id);
      return `<section class="domain-block"><div class="row between"><h2 style="margin:0">Domain ${d.id}: ${esc(d.title)}</h2><span class="chip">${chapters.length} chapters</span></div>
        <div class="grid cols-2" style="margin-top:12px">${chapters.map((c) => {
          const qs = data.questions.filter((q) => q.source === 'guide' && q.sourceChapter === c.number).length;
          const done = readCount(state, c);
          return `<a class="card objective-card" href="#guide/${c.number}"><div class="row between"><span class="id">Chapter ${c.number}</span><span class="chip">${c.objectives.map(esc).join(' · ') || 'domain'}</span></div>
            <b>${esc(c.title)}</b>${meter(done / c.readings.length, `Chapter ${c.number} reading progress`)}<small>${done}/${c.readings.length} sections read · ${qs} review questions</small></a>`;
        }).join('')}</div></section>`;
    }).join('')}`;
}

function renderChapter(ctx, root, number) {
  const { data, state } = ctx;
  const ch = data.studyGuide.find((c) => c.number === number);
  if (!ch) { root.innerHTML = '<div class="empty"><h3>Chapter not found</h3><a class="btn" href="#guide">Back to the study guide</a></div>'; return; }
  const qs = data.questions.filter((q) => q.source === 'guide' && q.sourceChapter === ch.number);
  const answered = new Set(state.attempts.map((a) => a.id));
  const done = qs.filter((q) => answered.has(q.id)).length;
  const prev = data.studyGuide.find((c) => c.number === number - 1), next = data.studyGuide.find((c) => c.number === number + 1);
  root.innerHTML = `
    <div class="page-head"><div class="eyebrow"><a href="#guide">Study guide</a> · Domain ${ch.domain}</div><h1>Chapter ${ch.number}: ${esc(ch.title)}</h1>
    <p>Covers ${ch.objectives.length ? `objectives ${ch.objectives.map((o) => `<a href="#learn/${esc(o)}">${esc(o)}</a>`).join(', ')}` : 'this domain'}. ${readCount(state, ch)} of ${ch.readings.length} sections read.</p></div>
    <div class="row" style="margin-bottom:18px"><a class="btn primary" href="#practice?source=guide&chapter=${ch.number}&count=${Math.min(20, qs.length)}&go=1">Practice this chapter's questions</a><span class="muted">${fmt(qs.length)} questions · ${done} attempted</span></div>
    ${ch.essentials ? `<details open><summary><b>Exam Essentials</b> <span class="muted">· the chapter in one page</span></summary><div class="body rich">${ch.essentials}</div></details>` : ''}
    <h2 style="margin-top:22px">Sections</h2>
    ${ch.readings.map((r) => readingDetails(state, r, r.objectives.length ? ` <span class="chip">${r.objectives.map(esc).join(' · ')}</span>` : '')).join('')}
    <nav class="row between pager" aria-label="Chapter navigation" style="margin-top:22px">${prev ? `<a class="btn ghost" href="#guide/${prev.number}">← Chapter ${prev.number}</a>` : '<span></span>'}${next ? `<a class="btn ghost" href="#guide/${next.number}">Chapter ${next.number} →</a>` : '<span></span>'}</nav>`;
  bindReadingToggle(ctx, root);
}
