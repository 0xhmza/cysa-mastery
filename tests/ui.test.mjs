import test from 'node:test';
import assert from 'node:assert/strict';
import { esc, formatDuration, mappingChip, pct, safeExhibit } from '../dist/ui.mjs';

test('esc neutralises markup and quotes', () => {
  assert.equal(esc('<img src=x onerror="a()">&\''), '&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;');
  assert.equal(esc(null), '');
});

test('lab exhibits keep only the highlight spans', () => {
  const html = safeExhibit("<span class='hl'>fail</span> <script>alert(1)</script> <span class='x' onclick='a()'>no</span> <img src=x>");
  assert.match(html, /<span class="hl">fail<\/span>/);
  assert.ok(!/<(?!\/?span)/.test(html), 'no raw tags other than the allowed span');
  assert.ok(!/<span[^>]*onclick/i.test(html));
  assert.match(html, /&lt;span class=&#39;x&#39;/);
});

test('durations render as mm:ss or h:mm:ss and never go negative', () => {
  assert.equal(formatDuration(59), '00:59');
  assert.equal(formatDuration(165 * 60), '2:45:00');
  assert.equal(formatDuration(-20), '00:00');
});

test('percentages handle missing data', () => {
  assert.equal(pct(null), '—');
  assert.equal(pct(0.8), '80%');
});

test('mapping chips distinguish trusted, indicative and untagged questions', () => {
  assert.match(mappingChip({ mapping: 'original', objective: '1.6' }), /original/);
  assert.match(mappingChip({ mapping: 'reviewed', objective: '1.3' }), /reviewed/);
  assert.match(mappingChip({ mapping: 'source', objective: '2.1' }), /indicative/);
  assert.match(mappingChip({ mapping: 'domain-only', source: 'sybex', sourceChapter: 5 }), /Mixed exam/);
  assert.match(mappingChip({ mapping: 'domain-only', source: 'sybex', sourceChapter: 2, domain: 2 }), /Domain 2/);
});
