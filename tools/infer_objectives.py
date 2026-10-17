"""Infer likely objectives for questions that carry only a domain, and measure how reliable that is.

Method: TF-IDF centroids per objective built from readings that are mapped to objectives (original guides,
community lessons, study-guide sections), compared with each question's text by cosine similarity, restricted
to the objectives of the question's domain. Validation uses study-guide questions from chapters that cover a
single objective, with that chapter's own text removed from the corpus (leave-chapter-out).

A label is only written when its score and margin pass a threshold chosen so validation precision is at least
TARGET_PRECISION. Output: dist/data/inferred.json (id -> {o, s, m}) and docs/objective_inference.json (metrics).

Usage: python -X utf8 tools/infer_objectives.py
"""
from __future__ import annotations
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'dist' / 'data'
TARGET_PRECISION = 0.85
STOP = set('a an and are as at be by for from in is it of on or that the this to which with what who your you will would can could should following most best not no do does did has have had their they them its it\'s been being were was there these those than then also other into over such may more any all each about'.split())


def load(name):
    return json.loads((DATA / f'{name}.json').read_text(encoding='utf-8'))


def stem(w):
    if len(w) <= 4:
        return w
    for suffix in ('ations', 'ation', 'ions', 'ion', 'ing', 'ers', 'er', 'ed', 'es', 'al', 's', 'e'):
        if w.endswith(suffix) and len(w) - len(suffix) >= 3:
            return w[:-len(suffix)]
    return w


def tokens(text):
    text = re.sub(r'<[^>]+>', ' ', text or '').lower()
    return [stem(w) for w in re.findall(r"[a-z][a-z0-9+'-]{2,}", text) if w not in STOP]


def vectorize(counts, idf):
    vec = {t: (1 + math.log(c)) * idf.get(t, 0.0) for t, c in counts.items() if t in idf}
    norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
    return {t: v / norm for t, v in vec.items()}


def cosine(a, b):
    if len(a) > len(b):
        a, b = b, a
    return sum(v * b.get(t, 0.0) for t, v in a.items())


def passages(html, size=140):
    words = re.sub(r'<[^>]+>', ' ', html or '').split()
    return [' '.join(words[i:i + size]) for i in range(0, len(words), size)] or ['']


def build_corpus(exclude_chapter=None):
    """Labelled passages: (objective, token Counter)."""
    guide, original = load('guide'), load('original')
    out = []
    for g in original['guides']:
        text = ' '.join([g['title'], g['core'], *g['know'], g['decide'], *g['traps'], *[d['title'] + ' ' + ' '.join(d['points']) for d in g.get('deep', [])]])
        out.append((g['objective'], Counter(tokens(text))))
    for lesson in load('lessons'):
        for obj in lesson['objectives']:
            for p in passages(lesson['html']):
                out.append((obj, Counter(tokens(p))))
    # Already-tagged questions are training examples too. Validation questions come from the study guide, a
    # different source, so none of them are included here.
    for q in load('questions') + original['questions']:
        if q['objective'] and q['source'] in ('community', 'original'):
            out.append((q['objective'], Counter(tokens(question_text(q)))))
    for ch in guide['chapters']:
        if ch['number'] == exclude_chapter:
            continue
        for r in ch['readings']:
            for obj in r['objectives']:
                for p in passages(r['html']):
                    out.append((obj, Counter(tokens(p))))
    return out


def centroids(corpus, idf):
    sums = defaultdict(Counter)
    for obj, counts in corpus:
        for t, v in vectorize(counts, idf).items():
            sums[obj][t] += v
    result = {}
    for obj, vec in sums.items():
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
        result[obj] = {t: v / norm for t, v in vec.items()}
    return result


def question_text(q):
    return ' '.join([q['prompt']['text'], ' '.join(o['text'] for o in q['options'] if o['label'] in q['correct_answers']), q['explanation']])


def classify(q, cents, candidates):
    qv = vectorize(Counter(tokens(question_text(q))), IDF)
    scored = sorted(((cosine(qv, cents[o]), o) for o in candidates if o in cents), reverse=True)
    if len(scored) < 2:
        return None
    (s1, o1), (s2, _) = scored[0], scored[1]
    return o1, s1, (s1 / s2 if s2 else 9.9)


def main():
    global IDF
    guide = load('guide')
    questions = load('questions') + load('original')['questions'] + guide['questions']
    domain_objs = defaultdict(list)
    for q in load('catalog')['domains']:
        domain_objs[q['id']] = [o['id'] for o in q['objectives']]

    # IDF over all passages and questions.
    full = build_corpus()
    df = Counter()
    docs = [c for _, c in full] + [Counter(tokens(question_text(q))) for q in questions]
    for c in docs:
        df.update(c.keys())
    n = len(docs)
    IDF = {t: math.log(1 + n / d) for t, d in df.items() if d >= 2}

    # Validation: single-objective chapters, with that chapter removed from the corpus.
    single = {ch['number']: ch['objectives'][0] for ch in guide['chapters'] if len(ch['objectives']) == 1}
    rows = []
    for chapter, truth in single.items():
        cents = centroids(build_corpus(exclude_chapter=chapter), IDF)
        for q in guide['questions']:
            if q['sourceChapter'] != chapter or q['chapterTitle'] == 'Assessment test':
                continue
            r = classify(q, cents, domain_objs[q['domain']])
            if r:
                rows.append((r[0] == truth, r[1], r[2], q['id']))
    base = len(rows)
    sweep = []
    for margin in (1.0, 1.1, 1.2, 1.3, 1.5, 1.8, 2.2):
        kept = [r for r in rows if r[2] >= margin]
        sweep.append({'min_margin': margin, 'coverage': round(len(kept) / base, 3), 'precision': round(sum(r[0] for r in kept) / len(kept), 3) if kept else None, 'n': len(kept)})
    chosen = next((s for s in sweep if s['precision'] is not None and s['precision'] >= TARGET_PRECISION and s['n'] >= 15), None)

    cents = centroids(full, IDF)
    inferred = {}
    if chosen:
        for q in questions:
            if q['mapping'] != 'domain-only' or not q['domain']:
                continue
            r = classify(q, cents, domain_objs[q['domain']])
            if r and r[2] >= chosen['min_margin']:
                inferred[q['id']] = {'o': r[0], 's': round(r[1], 3), 'm': round(r[2], 2)}

    report = {'validation_questions': base, 'overall_top1_accuracy': round(sum(r[0] for r in rows) / base, 3), 'sweep': sweep, 'chosen': chosen,
              'target_precision': TARGET_PRECISION, 'candidates': sum(1 for q in questions if q['mapping'] == 'domain-only' and q['domain']),
              'labelled': len(inferred), 'by_objective': dict(sorted(Counter(v['o'] for v in inferred.values()).items()))}
    (DATA / 'inferred.json').write_text(json.dumps(inferred, separators=(',', ':')) + '\n', encoding='utf-8')
    (ROOT / 'docs').mkdir(exist_ok=True)
    (ROOT / 'docs' / 'objective_inference.json').write_text(json.dumps(report, indent=1) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
