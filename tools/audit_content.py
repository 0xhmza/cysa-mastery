"""Audit generated content for duplicates and write dist/data/duplicates.json plus docs/content_audit.json.

A question is a duplicate of another when the stems are near-identical AND the correct answers agree, so a
question that merely reuses a stem with a different answer is kept. Cards are duplicates when their fronts
match. The preferred copy keeps the best-trusted objective mapping, then the richest explanation.

Usage: python -X utf8 tools/audit_content.py
"""
from __future__ import annotations
import json
import re
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'dist' / 'data'
STEM_THRESHOLD = 0.82
ANSWER_THRESHOLD = 0.6
CARD_THRESHOLD = 0.88
TRUST = {'original': 0, 'reviewed': 1, 'source': 2, 'domain-only': 3}
STOP = set('a an and are as at be by for from in is it of on or that the this to which with what who your you will would can could should following most best'.split())


def load(name):
    return json.loads((DATA / f'{name}.json').read_text(encoding='utf-8'))


def tokens(text):
    words = re.findall(r"[a-z0-9][a-z0-9.+/_-]*", re.sub(r'<[^>]+>', ' ', text or '').lower())
    return frozenset(w for w in words if w not in STOP)


def jaccard(a, b):
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def clusters(items, similar):
    """Union-find over index pairs the `similar` predicate accepts, using an inverted index to avoid all-pairs work."""
    parent = list(range(len(items)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    index = defaultdict(list)
    for i, it in enumerate(items):
        for t in it['tok']:
            index[t].append(i)
    seen = set()
    for i, it in enumerate(items):
        counts = Counter()
        for t in it['tok']:
            if len(index[t]) <= 400:  # ignore ubiquitous tokens
                counts.update(index[t])
        for j, c in counts.items():
            if j <= i or (i, j) in seen or c < max(3, 0.5 * min(len(it['tok']), len(items[j]['tok']))):
                continue
            seen.add((i, j))
            if similar(it, items[j]):
                parent[find(i)] = find(j)
    groups = defaultdict(list)
    for i in range(len(items)):
        groups[find(i)].append(i)
    return [g for g in groups.values() if len(g) > 1]


def correct_text(q):
    return ' '.join(o['text'] for o in q['options'] if o['label'] in q['correct_answers'])


def prefer(q):
    return (TRUST.get(q['mapping'], 3), -len(q.get('explanation') or ''), q['id'])


def main():
    questions = load('questions') + load('original')['questions'] + load('guide')['questions']
    cards = load('cards')
    items = [{'q': q, 'tok': tokens(q['prompt']['text']), 'ans': tokens(correct_text(q))} for q in questions]
    qgroups = clusters(items, lambda a, b: jaccard(a['tok'], b['tok']) >= STEM_THRESHOLD and jaccard(a['ans'], b['ans']) >= ANSWER_THRESHOLD)

    q_dupes, q_report = {}, []
    for g in qgroups:
        members = sorted((items[i]['q'] for i in g), key=prefer)
        keep, rest = members[0], members[1:]
        for r in rest:
            q_dupes[r['id']] = keep['id']
        q_report.append({'keep': keep['id'], 'drop': [r['id'] for r in rest], 'sources': sorted({m['source'] for m in members}), 'stem': keep['prompt']['text'][:140]})

    # Variants: same scenario or fact with different wording or names. Kept (re-seeing a fact in new words helps), but reported.
    q_variants = []
    kept = {id(it): it for it in items if it['q']['id'] not in q_dupes}
    vgroups = clusters(list(kept.values()), lambda a, b: 0.55 <= jaccard(a['tok'], b['tok']) < STEM_THRESHOLD and jaccard(a['ans'], b['ans']) >= 0.9)
    vlist = list(kept.values())
    for g in vgroups:
        q_variants.append([vlist[i]['q']['id'] for i in g])

    citems = [{'c': c, 'tok': tokens(c['front'])} for c in cards]
    cgroups = clusters(citems, lambda a, b: jaccard(a['tok'], b['tok']) >= CARD_THRESHOLD and (a['c']['source'], a['c']['source']) is not None)
    c_dupes, c_report = {}, []
    for g in cgroups:
        members = sorted((citems[i]['c'] for i in g), key=lambda c: (c['objective'] is None, -len(c['back']), c['id']))
        keep, rest = members[0], members[1:]
        for r in rest:
            c_dupes[r['id']] = keep['id']
        c_report.append({'keep': keep['id'], 'drop': [r['id'] for r in rest], 'sources': sorted({m['source'] for m in members}), 'front': re.sub(r'<[^>]+>', '', keep['front'])[:120]})

    cross = Counter('+'.join(r['sources']) for r in q_report)
    (DATA / 'duplicates.json').write_text(json.dumps({'questions': q_dupes, 'cards': c_dupes}, separators=(',', ':')) + '\n', encoding='utf-8')
    summary = {
        'questions_total': len(questions), 'question_duplicate_groups': len(q_report), 'question_duplicates_removed': len(q_dupes),
        'question_duplicates_by_source_mix': dict(cross), 'question_variant_groups_kept': len(q_variants), 'cards_total': len(cards), 'card_duplicate_groups': len(c_report), 'card_duplicates_removed': len(c_dupes),
        'card_duplicates_by_source_mix': dict(Counter('+'.join(r['sources']) for r in c_report)),
        'thresholds': {'stem': STEM_THRESHOLD, 'answer': ANSWER_THRESHOLD, 'card': CARD_THRESHOLD},
    }
    docs = ROOT / 'docs'
    docs.mkdir(exist_ok=True)
    (docs / 'content_audit.json').write_text(json.dumps({'summary': summary, 'questions': q_report, 'question_variants': q_variants, 'cards': c_report}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(json.dumps(summary, indent=1))


if __name__ == '__main__':
    main()
