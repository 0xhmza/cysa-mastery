export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);

export function on(root, type, selector, handler) {
  root.addEventListener(type, (event) => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  });
}

let toastTimer;
export function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// Imported lab exhibits are plain text with a few highlight spans. Escape everything, then restore only those.
export function safeExhibit(text) {
  return esc(text)
    .replace(/&lt;span class=&#39;(ok|hl|dim|warnc|cy|lbl)&#39;&gt;/g, '<span class="$1">')
    .replace(/&lt;\/span&gt;/g, '</span>');
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const two = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(sec)}` : `${two(m)}:${two(sec)}`;
}

export function statusChip(status) {
  return `<span class="chip ${status.toLowerCase()}">${esc(status)}</span>`;
}

// Says how much to trust a question's objective tag.
export function mappingChip(q) {
  if (q.mapping === 'original') return `<span class="chip strong" title="Written for this workspace and mapped by hand">Objective ${esc(q.objective)} · original</span>`;
  if (q.mapping === 'reviewed') return `<span class="chip strong" title="Source tag checked and corrected during the content review">Objective ${esc(q.objective)} · reviewed</span>`;
  if (q.mapping === 'inferred') return `<span class="chip indicative" title="Objective inferred by text similarity to the readings, about 80% reliable; not verified">Objective ${esc(q.objective)} · inferred</span>`;
  if (q.mapping === 'source') return `<span class="chip indicative" title="Tag supplied by the source author; not independently verified">Objective ${esc(q.objective)} · indicative tag</span>`;
  if (q.source === 'sybex' && q.sourceChapter >= 5) return `<span class="chip" title="Mixed practice exam; questions are not tagged to objectives">Mixed exam · no objective tag</span>`;
  return `<span class="chip" title="Only a domain-level association is available">${q.domain ? `Domain ${q.domain}` : 'Untagged'} · domain only</span>`;
}

export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const domainName = (catalog, id) => catalog.domains.find((d) => d.id === id)?.title ?? 'Unassigned';

export const fmt = (n) => Number(n).toLocaleString('en-US');
export const kbd = (key) => `<kbd>${esc(key)}</kbd>`;

export function meter(fraction, label, cls = '') {
  const p = Math.round(Math.max(0, Math.min(1, fraction || 0)) * 100);
  return `<div class="bar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="${esc(label)}"><i style="width:${p}%"></i></div>`;
}
