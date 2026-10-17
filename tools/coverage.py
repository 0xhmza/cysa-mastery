"""Measure how well the content covers each official CS0-004 objective sub-topic.

Reads the extracted objectives text (assessment/objectives.txt, outside this repo) and counts, for every
sub-topic, the lessons, study-guide readings, flashcards and questions that mention it. Writes
docs/coverage.json (committed) and prints the weakest topics.

Usage: python -X utf8 tools/coverage.py
"""
from __future__ import annotations
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'dist' / 'data'
OBJECTIVES = ROOT.parent / 'assessment' / 'objectives.txt'
STOP = set('a an and are as at be by for from in is it of on or that the to with using use based vs via per related type types'.split())
OBJ_ID = re.compile(r'^\s*([1-4]\.[1-6])\s{2,}(\S.*)$')
NOISE = re.compile(r'^(objectives?|examples?|domain|cysa|comptia|page|copyright|©|\d+)\b', re.I)


def load(name):
    return json.loads((DATA / f'{name}.json').read_text(encoding='utf-8'))


def plain(html):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html or '')).lower()


def words(text):
    return [w for w in re.findall(r"[a-z0-9][a-z0-9+.'-]*", text.lower()) if w not in STOP]


def stem(w):
    """Crude suffix stripping so that decode, decoding and decoded share one stem."""
    if len(w) <= 4:
        return w
    for suffix in ('ations', 'ation', 'ions', 'ion', 'ing', 'ers', 'er', 'ed', 'es', 'al', 's', 'e'):
        if w.endswith(suffix) and len(w) - len(suffix) >= 3:
            return w[:-len(suffix)]
    return w


def extract_topics(text):
    segments, current = {}, None
    for line in text.split('\n'):
        m = OBJ_ID.match(line)
        if m:
            current = m.group(1)
            segments.setdefault(current, [])
            continue
        if current and ('Acronym List' in line):
            break
        if current:
            segments[current].append(line)
    topics = {}
    for obj, lines in segments.items():
        found = []
        for line in lines:
            for frag in re.split(r'[•▪•■]|\s{3,}', line):
                frag = frag.strip(' -–\t')
                if len(frag) < 4 or NOISE.match(frag) or re.fullmatch(r'[\d\W]+', frag) or frag in ('Types', 'ain', 'Application/usage') or frag.startswith('Exam Objectives'):
                    continue
                found.append(frag)
        topics[obj] = list(dict.fromkeys(found))
    return topics


def variants(topic):
    """Match the full phrase, any parenthesised acronym, and the phrase without parentheses."""
    out = []
    for acr in re.findall(r'\(([A-Za-z0-9/+&. -]{2,12})\)', topic):
        out.append(acr.strip().lower())
    base = re.sub(r'\([^)]*\)', ' ', topic).strip().lower()
    if base:
        out.append(base)
    return [v for v in dict.fromkeys(out) if v]


def matcher(topic):
    """Each variant becomes ('acronym', raw) for short upper-case tokens, else ('phrase', stems)."""
    out = []
    for acr in re.findall(r'\(([A-Za-z0-9/+&. -]{2,12})\)', topic):
        out.append(('acronym', acr.strip().lower()))
    base = re.sub(r'\([^)]*\)', ' ', topic).strip()
    if base:
        ws = words(base)
        if len(ws) == 1 and base.isupper() and len(base) <= 6:
            out.append(('acronym', base.lower()))
        elif ws:
            out.append(('phrase', [stem(w) for w in ws]))
    return out


def hit(doc_stems, doc_text, compiled, topic):
    for kind, value in compiled:
        if kind == 'acronym':
            if re.search(r'(?<![a-z0-9])' + re.escape(value) + r'(?![a-z0-9])', doc_text):
                return True
        elif sum(w in doc_stems for w in value) >= (len(value) if len(value) <= 2 else max(2, round(0.75 * len(value)))):
            return True
    return False


def doc_index(text):
    t = plain(text)
    return {stem(w) for w in words(t)}, t


def main():
    if not OBJECTIVES.exists():
        raise SystemExit(f'Missing {OBJECTIVES}; the objectives text lives next to the project folder.')
    topics = extract_topics(OBJECTIVES.read_text(encoding='utf-8', errors='replace'))
    guide = load('guide')
    original = load('original')
    corpus = {
        'lessons': [doc_index(l['html']) for l in load('lessons')],
        'guide': [doc_index(r['html']) for c in guide['chapters'] for r in c['readings']] + [doc_index(c['essentials']) for c in guide['chapters']],
        'original': [doc_index(' '.join([g['core'], *g['know'], g['decide'], *g['traps']])) for g in original['guides']]
                    + [doc_index(d['title'] + ' ' + ' '.join(d['points'])) for g in original['guides'] for d in g.get('deep', [])],
        'cards': [doc_index(c['front'] + ' ' + c['back']) for c in load('cards')],
        'questions': [doc_index(q['prompt']['text'] + ' ' + ' '.join(o['text'] for o in q['options']) + ' ' + q['explanation'])
                      for q in load('questions') + original['questions'] + guide['questions']],
    }
    report, weak = {}, []
    for obj, items in sorted(topics.items()):
        rows = []
        for topic in items:
            compiled = matcher(topic)
            counts = {k: sum(1 for s, t in docs if hit(s, t, compiled, topic)) for k, docs in corpus.items()}
            teach = counts['lessons'] + counts['guide'] + counts['original']
            rows.append({'topic': topic, **counts, 'teach': teach})
            if teach == 0 or (counts['questions'] + counts['cards']) < 3:
                weak.append((obj, topic, counts))
        report[obj] = rows
    out = ROOT / 'docs' / 'coverage.json'
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({'objectives': report, 'weak': [{'objective': o, 'topic': t, **c} for o, t, c in weak]}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    total = sum(len(v) for v in report.values())
    print(f'{total} sub-topics across {len(report)} objectives; {len(weak)} weakly covered (no reading, or fewer than 3 questions/cards)')
    for o, t, c in weak:
        print(f"  {o}  {t[:70]:70}  read={c['lessons'] + c['guide'] + c['original']:<3} cards={c['cards']:<3} q={c['questions']}")


if __name__ == '__main__':
    main()
