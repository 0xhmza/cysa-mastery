"""Import the CySA+ Study Guide EPUB (4th edition, CS0-004) into dist/data/guide.json.

Produces chapters (readings split by heading, Exam Essentials, objectives covered) and the assessment-test
plus chapter review questions with their explanations. Questions carry domain-level mapping only unless the
source chapter lists exactly one objective, in which case that objective is recorded as an indicative tag.
"""
from __future__ import annotations
import glob
import re
import zipfile
from pathlib import Path
from bs4 import BeautifulSoup

import import_content as ic

DOMAIN_OF_CHAPTER = {**{c: 1 for c in range(1, 6)}, **{c: 2 for c in range(6, 9)}, **{c: 3 for c in range(9, 12)}, 12: 4}
# Section id -> official objective(s), decided from each section title against the CS0-004 objective titles.
# Sections left out (general background such as CIA basics or SAMM) stay at domain level.
SECTION_OBJECTIVES = {
    'sg-01-07': ['1.5'], 'sg-01-08': ['1.6'],
    **{f'sg-02-{i:02}': ['1.1'] for i in range(1, 9)},
    'sg-03-01': ['1.2'], 'sg-03-02': ['1.2'], 'sg-03-03': ['1.2'], 'sg-03-04': ['1.3'],
    **{f'sg-04-{i:02}': ['1.4'] for i in range(1, 4)},
    'sg-05-01': ['2.1'], 'sg-05-02': ['2.1'],
    'sg-06-01': ['2.1'], 'sg-06-02': ['2.1'], 'sg-06-03': ['2.3'], 'sg-06-04': ['2.1'], 'sg-06-05': ['2.2'],
    'sg-07-01': ['2.2'], 'sg-07-02': ['2.2'], 'sg-07-03': ['2.3'], 'sg-07-04': ['2.3'],
    'sg-08-01': ['2.4'], 'sg-08-02': ['2.4'], 'sg-08-04': ['2.4'], 'sg-08-06': ['2.4'],
    'sg-08-05': ['2.3'], 'sg-08-07': ['2.3'], 'sg-08-08': ['2.3'], 'sg-08-09': ['2.1'],
    'sg-09-01': ['3.2'], 'sg-09-02': ['3.2'], 'sg-09-03': ['3.2'], 'sg-09-04': ['3.2'], 'sg-09-05': ['3.2'], 'sg-09-06': ['3.1'],
    'sg-10-01': ['3.3'], 'sg-10-02': ['3.3'],
    **{f'sg-11-{i:02}': ['3.3'] for i in range(1, 5)},
    'sg-12-01': ['4.1'], 'sg-12-02': ['4.2'],
}
SKIP_SECTIONS = ('Exam Essentials', 'Lab Exercises', 'Review Questions', 'Answers to Review Questions', 'Answers to Lab Exercises')
LETTERS = r'([A-F](?:\s*(?:,|and|&)\s*[A-F])*)'
# Strict form is 'B. text'. The only observed typo is an en space instead of the period ('A Hashing…').
ANSWER = re.compile(r'^\s*' + LETTERS + r'\.\s*')
ANSWER_TYPO = re.compile(r'^\s*' + LETTERS + ' ' + r'\s*')


def sections_of(soup):
    """Split a chapter into (title, [elements]) at each h2, whether or not the h2 sits inside a <header>."""
    sections = []
    for h in soup.find_all('h2'):
        title = h.get_text(' ', strip=True)
        node = h.parent if h.parent.name == 'header' else h
        elements = []
        for sib in node.find_next_siblings():
            if sib.name == 'header' and sib.find('h2') or sib.name == 'h2':
                break
            elements.append(sib)
        sections.append((title, elements))
    return sections


def top_lists(elements):
    for el in elements:
        if getattr(el, 'name', None) == 'ol':
            yield el
        elif getattr(el, 'find_all', None):
            yield from (o for o in el.find_all('ol', recursive=True) if o.find_parent('li') is None and 'decimal' in (o.get('class') or []))


def parse_questions(elements):
    out = []
    for ol in top_lists(elements):
        start = int(ol.get('start', 1))
        for i, li in enumerate(ol.find_all('li', recursive=False)):
            opts = li.find('ol', class_='upper-alpha')
            if not opts:
                continue
            options = [(chr(65 + k), o) for k, o in enumerate(opts.find_all('li', recursive=False))]
            opts.extract()
            out.append((start + i, li, options))
    return out


def parse_answers(elements):
    answers = {}
    for ol in top_lists(elements):
        start = int(ol.get('start', 1))
        for i, li in enumerate(ol.find_all('li', recursive=False)):
            answers[start + i] = li
    return answers


def split_answer(li):
    raw = li.get_text(' ', strip=True)
    pattern = ANSWER if ANSWER.match(raw) else ANSWER_TYPO if ANSWER_TYPO.match(raw) else None
    if not pattern:
        return None, raw
    letters = re.findall(r'[A-F]', pattern.match(raw).group(1).upper())
    # Drop the "B. " lead from the explanation HTML as well as the text.
    lead = r'^<li[^>]*>\s*(<[^>]+>\s*)*?' + LETTERS + (r'\.' if pattern is ANSWER else ' ') + r'\s*'
    html = re.sub(r'</li>\s*$', '', re.sub(lead, '', str(li), count=1))
    return letters, html


def build_question(qid, source_chapter, number, li, options, answer_li, domain, label, objective_hint):
    letters, expl_html = split_answer(answer_li)
    if not letters:
        return None
    stem = ic.safe_html(''.join(str(c) for c in li.contents), 'guide')
    opts = [{'label': lab, 'text': ic.text(str(o)), 'html': ic.safe_html(''.join(str(c) for c in o.contents), 'guide'), 'images': []} for lab, o in options]
    if not set(letters) <= {o['label'] for o in opts}:
        return None
    for o in opts:
        o['images'] = [{'path': a['src'], 'alt': a.get('alt', '')} for a in BeautifulSoup(o['html'], 'html.parser').find_all('img')]
    expl_html = ic.safe_html(expl_html, 'guide')
    return {
        'id': qid, 'domain': domain, 'objective': objective_hint, 'mapping': 'source' if objective_hint else 'domain-only', 'source': 'guide',
        'sourceLabel': label, 'number': number, 'sourceChapter': source_chapter,
        'prompt': {'text': ic.text(stem), 'html': stem, 'images': [{'path': a['src'], 'alt': a.get('alt', '')} for a in BeautifulSoup(stem, 'html.parser').find_all('img')]},
        'options': opts, 'correct_answers': letters, 'explanation': ic.text(expl_html), 'explanationHtml': expl_html, 'source_pages': [],
    }


def export_images(z, dest):
    dest.mkdir(parents=True, exist_ok=True)
    count = 0
    for name in z.namelist():
        if name.startswith('OEBPS/images/') and not name.endswith('/'):
            (dest / Path(name).name).write_bytes(z.read(name))
            count += 1
    return count


def import_studyguide(input_dir: Path, dist: Path):
    path = glob.glob(str(input_dir / 'CompTIA*Study Guide*.epub'))
    if not path:
        return None
    z = zipfile.ZipFile(path[0])
    images = export_images(z, dist / 'media/guide')
    chapters, questions = [], []

    for n in range(1, 13):
        soup = BeautifulSoup(z.read(f'OEBPS/c{n:03}.xhtml'), 'html.parser')
        title = re.sub(r'^Chapter\s+\d+\s*', '', soup.find('h1').get_text(' ', strip=True))
        domain = DOMAIN_OF_CHAPTER[n]
        secs = sections_of(soup)
        objectives = sorted(set(re.findall(r'\b([1-4]\.[1-6])\s+(?:Given|Explain|Summarize|Compare)', secs[0][0] + ' '.join(e.get_text(' ') for e in secs[0][1]))))
        by_title = {t: els for t, els in secs}
        readings = []
        for t, els in secs[1:]:
            if t in SKIP_SECTIONS:
                continue
            rid = f'sg-{n:02}-{len(readings) + 1:02}'
            readings.append({'id': rid, 'title': t, 'objectives': SECTION_OBJECTIVES.get(rid, []), 'html': ic.safe_html(''.join(str(e) for e in els), 'guide')})
        essentials = ic.safe_html(''.join(str(e) for e in by_title.get('Exam Essentials', [])), 'guide')
        hint = objectives[0] if len(objectives) == 1 else None
        qs = parse_questions(by_title.get('Review Questions', []))
        ans = parse_answers(by_title.get('Answers to Review Questions', []))
        for num, li, options in qs:
            q = build_question(f'sg{n:02}_q{num:03}', n, num, li, options, ans[num], domain, 'Chapple & Seidl · study guide', hint) if num in ans else None
            if q:
                q['chapterTitle'] = f'Chapter {n}: {title}'
                questions.append(q)
        chapters.append({'number': n, 'title': title, 'domain': domain, 'objectives': objectives, 'essentials': essentials, 'readings': readings})

    # Assessment test: each explanation ends with "see Chapter N", which gives the domain.
    a = BeautifulSoup(z.read('OEBPS/f09.xhtml'), 'html.parser')
    k = BeautifulSoup(z.read('OEBPS/f10.xhtml'), 'html.parser')
    ans = parse_answers(list(k.find('body').find_all(recursive=False)) or [k])
    for num, li, options in parse_questions(list(a.find('body').find_all(recursive=False)) or [a]):
        if num not in ans:
            continue
        chap = re.findall(r'Chapter\s+(\d+)', ans[num].get_text(' ', strip=True))
        chap_n = int(chap[-1]) if chap else None
        domain = DOMAIN_OF_CHAPTER.get(chap_n)
        q = build_question(f'sgat_q{num:03}', chap_n, num, li, options, ans[num], domain, 'Chapple & Seidl · study guide assessment test', None)
        if q:
            q['chapterTitle'] = 'Assessment test'
            questions.append(q)
    return {'chapters': chapters, 'questions': questions, 'images': images}


if __name__ == '__main__':
    import json
    import sys
    root = Path(__file__).resolve().parents[1]
    data = import_studyguide(root.parent, root / 'dist')
    print(json.dumps({'chapters': len(data['chapters']), 'questions': len(data['questions']), 'images': data['images'],
                      'readings': sum(len(c['readings']) for c in data['chapters']), 'objectives': {c['number']: c['objectives'] for c in data['chapters']}}, indent=1))
    sys.exit(0)
