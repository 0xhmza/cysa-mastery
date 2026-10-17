"""Deterministically import local study sources. Run from any directory.

Inputs remain outside this repository. Requires beautifulsoup4, and zstandard
for the modern Anki package (the local assessment/_deps folder is supported).
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import re
import shutil
import sys
import zipfile
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlsplit
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT.parent
DIST = ROOT / 'dist'
VALID = {f'{d}.{o}' for d, count in [(1,6),(2,4),(3,3),(4,2)] for o in range(1,count+1)}
MEDIA = {}

def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')

def safe_html(value, image_group=None):
    """Keep study markup while rejecting active content and remote media."""
    soup = BeautifulSoup(str(value or ''), 'html.parser')
    for tag in soup(['script','iframe','object','embed','form','input','button','textarea','link','meta','audio','video','source']):
        tag.decompose()
    for tag in soup.find_all(True):
        for key in list(tag.attrs):
            if key.lower().startswith('on') or key.lower() in ['srcset','formaction','action','background']:
                del tag.attrs[key]
        if tag.has_attr('style') and re.search(r'url\s*\(|expression\s*\(|@import',tag['style'],re.I):
            del tag['style']
        if tag.name == 'img':
            src = tag.get('src','')
            name = Path(unquote(urlsplit(src).path)).name
            path = f'media/{image_group}/{name}' if image_group in ('book', 'guide') else MEDIA.get(name)
            if re.match(r'\s*(https?:)?//', src, re.I):
                tag.replace_with(soup.new_string('[Remote image omitted for offline use]'))
            elif not path or not (DIST/path).is_file():
                tag.replace_with(soup.new_string('[Image unavailable]'))
            else:
                tag['src'] = path
                tag['loading'] = 'lazy'
        elif tag.has_attr('src'):
            del tag['src']
        if tag.has_attr('href'):
            href = re.sub(r'\s','',str(tag['href'])).lower()
            if href.startswith(('javascript:', 'data:', 'vbscript:')):
                del tag['href']
            elif href.startswith(('http:', 'https:')):
                tag['rel']='noopener noreferrer'
                tag['target']='_blank'
    return str(soup)

def text(value):
    return BeautifulSoup(str(value or ''),'html.parser').get_text(' ',strip=True)

def rich(value, group=None):
    body=safe_html(value.get('html',value.get('text','')) if isinstance(value,dict) else value,group)
    return {'text':text(body),'html':body,'images':[{'path':a['src'],'alt':a.get('alt','')} for a in BeautifulSoup(body,'html.parser').find_all('img')]}

def varint(data, pos):
    out=shift=0
    while True:
        b=data[pos];pos+=1;out|=(b&127)<<shift
        if not b&128:return out,pos
        shift+=7

def protobuf(data):
    pos=0
    while pos<len(data):
        key,pos=varint(data,pos);field,wire=key>>3,key&7
        if wire==2:
            size,pos=varint(data,pos);value=data[pos:pos+size];pos+=size
        elif wire==0:value,pos=varint(data,pos)
        else:raise ValueError(f'Unexpected protobuf wire type {wire}')
        yield field,value

def import_media():
    for path in sorted((INPUT/'cysa_practice_tests_images').rglob('*')):
        if path.is_file():shutil.copy2(path,DIST/'media/book'/path.name)
    sys.path.insert(0,str(INPUT/'assessment/_deps'))
    import zstandard
    def decompress(data):
        return zstandard.ZstdDecompressor().stream_reader(io.BytesIO(data)).read() if data.startswith(b'\x28\xb5\x2f\xfd') else data
    with zipfile.ZipFile(INPUT/'CySA-004/ScottsFreshDeckCySA-004.apkg') as archive:
        mapping=decompress(archive.read('media'))
        if mapping.startswith(b'{'):
            entries=json.loads(mapping).items()
        else:
            entries=[(str(i),dict(protobuf(entry))[1].decode('utf-8')) for i,(field,entry) in enumerate(protobuf(mapping)) if field==1]
        total=0
        for index,name in entries:
            if Path(name).name!=name:raise ValueError(f'Unsafe media filename: {name}')
            content=decompress(archive.read(index))
            if name.lower().endswith('.svg'):
                soup=BeautifulSoup(content,'xml')
                for tag in soup(['script','foreignObject']):tag.decompose()
                for tag in soup.find_all(True):
                    for key in list(tag.attrs):
                        if key.lower().startswith('on') or (key in ['href','xlink:href'] and not str(tag[key]).startswith('#')):del tag.attrs[key]
                content=str(soup).encode('utf-8')
            (DIST/'media/anki'/name).write_bytes(content)
            MEDIA[name]=f'media/anki/{name}'
            total+=1
    for path in sorted((INPUT/'CySA-004/images').glob('*.webp')):
        shutil.copy2(path,DIST/'media/references'/path.name)
    return total

def reviewed_objective(q):
    """Explicit reviewed fixes; uncertain source mappings remain visibly indicative."""
    n=int(q['id'].split('-')[1]);d=q['domain'];obj=q.get('obj')
    if d!=1:return obj,'source'
    fixes={**{i:'1.5' for i in range(21,29)},**{i:'1.3' for i in range(29,42)},**{i:'1.4' for i in range(42,49)},**{i:'1.6' for i in range(75,78)},97:'4.2',98:'4.2',99:'4.2',100:'1.4'}
    # Directly interpretable concepts; cross-cutting items stay at domain level.
    fixes.update({55:'1.3',56:'1.3',58:'1.3',61:'1.4',63:'1.4',64:'1.4',65:'1.4',66:'1.4',67:'1.4',68:'1.5',69:'1.5',70:'1.5',72:'1.5',73:'1.5',74:'1.5',79:'1.2',80:'1.2',83:'1.2',85:'1.2',87:'1.2',89:'1.2'})
    if n in [26,45,62,71,78,81,82,84,86,88,90,91,92]:return None,'domain-only'
    return (fixes[n],'reviewed') if n in fixes else (obj,'source')

def community_questions(data):
    out=[]
    for original in data['questions']:
        q=dict(original)
        if q['id']=='D4-058':
            q.update(q='A SOC manager wants a KPI showing what proportion of generated alerts turn out to be genuine threats: TP / (TP + FP). Which metric BEST provides this?',options=['False-positive rate: FP / (FP + TN)','Alert volume','Phishing campaign click rate','Precision: TP / (TP + FP)'],answer=3,explain='<p><strong>Precision</strong> is TP/(TP+FP), the fraction of positive alerts that are genuine. True-positive rate (recall) is TP/(TP+FN), the fraction of all real threats detected. False-positive rate is FP/(FP+TN), the fraction of benign cases incorrectly alerted on. Alert volume counts alerts; click rate measures user behavior.</p>')
        if q['id']=='D4-086':
            q.update(q='A review of 100 generated alerts finds 85 false positives and 15 true positives. Which conclusion and action are BEST supported?',explain='<p><strong>Detection rules are noisy; tune rules to reduce false positives.</strong> Precision is 15/(15+85) = 15%; the false-discovery proportion among alerts is 85%. These are complementary alert proportions. They are not the true-positive rate TP/(TP+FN) or false-positive rate FP/(FP+TN), which require the missed-threat and benign-case denominators. Do not disable logging or assume these alert counts establish either rate. Tune and validate detection coverage to avoid increasing false negatives.</p>')
        obj,mapping=reviewed_objective(q)
        explanation=safe_html(q['explain'])
        out.append({'id':q['id'],'domain':int(obj[0]) if obj else q['domain'],'objective':obj,'sourceObjective':q.get('obj'),'mapping':mapping,'source':'community','sourceLabel':'Rizwan Virani · community curriculum','number':int(q['id'].split('-')[1]),'prompt':rich(q['q']),'options':[{'label':chr(65+i),**rich(v)} for i,v in enumerate(q['options'])],'correct_answers':[chr(65+q['answer'])],'explanation':text(explanation),'explanationHtml':explanation,'source_pages':[],'difficulty':q.get('diff')})
    return out

def book_questions(book):
    out=[]
    for chapter in book['chapters']:
        for q in chapter['questions']:
            exp=safe_html(q['answer']['html'],'book')
            out.append({'id':q['id'],'domain':chapter['number'] if chapter['number']<=4 else None,'objective':None,'mapping':'domain-only','source':'sybex','sourceLabel':'Chapple & Seidl · practice book','number':q['number'],'prompt':rich(q['prompt'],'book'),'options':[{'label':a['label'],**rich(a,'book')} for a in q['options']],'correct_answers':q['correct_answers'],'explanation':q['explanation'],'explanationHtml':exp,'source_pages':q.get('source_pages',[]),'answer_pages':q['answer'].get('source_pages',[]),'sourceChapter':chapter['number'],'chapterTitle':chapter['title']})
    return out

def lessons(data):
    maps={1:[['1.1']]*8+[['1.2']]*3+[['1.3']]*3+[['1.4'],['1.5','1.6']],2:[['2.1']]*3+[['2.2']]*4+[['2.3']]*4+[['2.4']]*3,3:[['3.1']]*3+[['3.2']]*5+[['3.3']]*4,4:[['4.1']]*4+[['4.2']]*5}
    result=[]
    for domain,items in data['reading'].items():
        for i,item in enumerate(items):
            html=item['body']
            if domain=='2' and item['heading']=='CVSS Scoring':
                html=html.replace('combined with confidentiality, integrity, and availability impact, plus a scope indicator for whether impact crosses a security boundary.','plus <em>Attack Requirements</em> in CVSS v4.0, combined with separate confidentiality, integrity, and availability impacts for the vulnerable system and subsequent systems. CVSS v3.1 instead uses a Scope metric and Base, Temporal, and Environmental groups.')
                html=html.replace('meaning network attack vector, low complexity, no privileges, no user interaction &mdash; the worst, easiest-to-exploit combination.','meaning network attack vector, low complexity, no privileges, and no user interaction. This abbreviated vector omits required CVSS v4.0 metrics, including Attack Requirements and impact metrics; it cannot establish a complete score.')
                html=html.replace('CySA+ tracks the current standard, so know what CVSS v4.0 changed relative to the long-dominant v3.1.','Distinguish the vector version explicitly: CVSS v4.0 changes several concepts from v3.1.')
                html=html.replace('Memorize the four groups:','For CVSS v4.0, memorize the four groups:')
            if domain=='4':
                html=html.replace('environmental and temporal modifiers','environmental modifiers plus Temporal metrics in CVSS v3.1 or Threat metrics in CVSS v4.0')
                if item['heading']=='Incident Response Metrics and KPIs':
                    html=re.sub(r'<p>Before timing,.*?</p>','<p>Gauge detection quality using explicit denominators. <strong>Precision</strong> = TP/(TP+FP), the share of alerts that are genuine. The false-discovery proportion = FP/(TP+FP), the share of alerts that are benign. <strong>True-positive rate (recall)</strong> = TP/(TP+FN), the share of real threats detected. <strong>False-positive rate</strong> = FP/(FP+TN), the share of benign cases incorrectly alerted on. Precision and false-discovery proportion are complementary; true-positive rate and false-positive rate are not. High false-discovery proportion contributes to analyst fatigue. Tune noise while validating detection coverage and false negatives.</p>',html)
                    html=html.replace('Benign alerts / total alerts','FP / (FP + TN): alerted benign cases / all benign cases').replace('Genuine alerts / total alerts','TP / (TP + FN): detected threats / all real threats')
                    html=html.replace('Rising alert volume with a flat true-positive rate means new noise, not new threats, and points to a tuning problem.','Rising alert volume with falling precision suggests more noise; investigate the underlying counts and coverage before concluding that threat volume is unchanged.')
            result.append({'id':f'lesson-{domain}-{i+1:02}','domain':int(domain),'title':item['heading'],'html':safe_html(html),'objectives':maps[int(domain)][i],'mapping':'reviewed','source':'community'})
    return result

def cards(data,anki):
    result=[]
    for note in anki:
        front,back=note['fields'].split('\x1f',1)
        matches=set(re.findall(r'Obj([1-4]\.[1-6])',note['tags']))&VALID
        obj=next(iter(matches)) if len(matches)==1 else None
        domains=set(re.findall(r'Domain([1-4])',note['tags']))
        domain=int(obj[0]) if obj else int(next(iter(domains))) if len(domains)==1 else None
        result.append({'id':f'anki-{note["id"]}','domain':domain,'objective':obj,'mapping':'source' if obj else 'domain-only','front':safe_html(front),'back':safe_html(back),'source':'anki','tags':note['tags'].strip()})
    for items in data['flash'].values():
        for c in items:
            obj=c.get('obj') if c.get('obj') in VALID else None
            # Legacy shifted domain-1 tool tags are not used as objective mastery evidence.
            if c['d']==1:obj=None
            result.append({'id':c['id'],'domain':c['d'],'objective':obj,'mapping':'source' if obj else 'domain-only','sourceObjective':c.get('obj'),'front':safe_html(c['front']),'back':safe_html(c['back']),'source':'community'})
    return result

def original_content(domains):
    """Expand the compact, hand-authored enrichment file into the runtime schema."""
    from html import escape
    src=read_json(ROOT/'content/enrichment.json')
    titles={o['id']:o['title'] for d in domains for o in d['objectives']}
    def para(t):return ''.join(f'<p>{escape(x)}</p>' for x in t.splitlines() if x.strip())
    guides=[]
    for g in src['guides']:
        assert g['o'] in titles,g['o']
        guides.append({'objective':g['o'],'domain':int(g['o'][0]),'title':titles[g['o']],'core':g['core'],'know':g['know'],'decide':g['decide'],'traps':g['traps']})
    assert [g['objective'] for g in guides]==sorted(titles),'one guide per objective, in order'
    qs=[]
    gap=ROOT/'content/gapfill.json'
    gapfill=read_json(gap) if gap.exists() else {'deep':[],'questions':[]}
    for g in guides:
        g['deep']=[{'title':d['title'],'points':d['points']} for d in gapfill['deep'] if d['o']==g['objective']]
    for i,q in enumerate(src['questions']+gapfill['questions'],1):
        assert q['o'] in titles and len(q['opts'])==4 and 0<=q['a']<4 and len(set(q['opts']))==4,q['id']
        qs.append({'id':q['id'],'domain':int(q['o'][0]),'objective':q['o'],'mapping':'original','source':'original','sourceLabel':'Original · CySA Mastery','number':i,
            'prompt':{'text':q['q'],'html':escape(q['q']),'images':[]},
            'options':[{'label':chr(65+k),'text':t,'html':escape(t),'images':[]} for k,t in enumerate(q['opts'])],
            'correct_answers':[chr(65+q['a'])],'explanation':q['e'],'explanationHtml':para(q['e']),'source_pages':[]})
    assert len({q['id'] for q in qs})==len(qs),'duplicate original question ids'
    for c in src['cases']:
        assert all(0<=st['answer']<len(st['options']) for st in c['steps']),c['id']
        assert all(o in titles for o in c['objectives']),c['id']
    return {'guides':guides,'questions':qs,'cases':src['cases']}

def main():
    global INPUT
    parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,default=INPUT);args=parser.parse_args();INPUT=args.input.resolve()
    for name in ['data','media/book','media/anki','media/references','trainers','library','licenses']:(DIST/name).mkdir(parents=True,exist_ok=True)
    data=read_json(INPUT/'assessment/cysa-plus-data.json');book=read_json(INPUT/'cysa_practice_tests.json');anki=read_json(INPUT/'assessment/anki_notes.json')
    media_count=import_media()
    qs=community_questions(data)+book_questions(book);ls=lessons(data);cs=cards(data,anki)
    trainers=[]
    for path in sorted((INPUT/'CySA-004/Trainers').glob('*.html')):
        # Preserve trainer scripts exactly; only their favicon location is changed.
        html=path.read_text(encoding='utf-8').replace('../favicon.png','../media/references/favicon.png')
        (DIST/'trainers'/path.name).write_text(html,encoding='utf-8')
        trainers.append({'id':path.stem.lower(),'title':{'regex':'Regular expressions','SNORT':'Snort and IDS rules','CVSS_4-0':'CVSS 4.0','Soc_Roles':'SOC roles','OT':'OT and ICS','LOLBins':'Living off the land'}.get(path.stem,path.stem.replace('_',' ')),'path':'trainers/'+path.name,'source':'cysa004','type':'interactive trainer'})
    shutil.copy2(INPUT/'CySA-004/favicon.png',DIST/'media/references/favicon.png')
    library=[]
    for source,title,target in [(INPUT/'assessment/CompTIA_CS0-004_Exam_Objectives_v2.pdf','Official CS0-004 exam objectives','CS0-004-objectives.pdf'),(INPUT/'Comptia.CySA.004.Course.Notes.pdf','CS0-004 course notes (user-provided)','CS0-004-course-notes.pdf')]:
        if source.exists():
            shutil.copy2(source,DIST/'library'/target);library.append({'title':title,'path':'library/'+target})
    for repo,name in [('cysa-plus','cysa-plus-LICENSE.txt'),('CySA-004','CySA-004-LICENSE.txt')]:shutil.copy2(INPUT/repo/'LICENSE',DIST/'licenses'/name)
    domains=[{'id':d['id'],'title':d['title'],'weight':d['weight'],'short':d['short'],'objectives':[{'id':o['id'],'title':o['t']} for o in d['objectives']]} for d in data['domainMeta']]
    sources=[{'id':'community','label':'Rizwan Virani · cysa-plus','url':'https://github.com/0xhmza/cysa-plus','license':'CC BY-NC-SA 4.0 curriculum; MIT framework','notes':'51 reading sections, 400 original practice questions, 400 flashcards. Technical errata applied; some objective mappings remain source-supplied and indicative.'},{'id':'cysa004','label':'Scotty · CySA-004','url':'https://github.com/0xhmza/CySA-004','license':'Repository MIT notice retained; embedded Anki third-party excerpts retain their original rights.','notes':'13 standalone drill trainers, 11 visual reference images, and 1,939 Anki notes. Trainers and source Anki are community-authored study aids.'},{'id':'original','label':'Original · CySA Mastery','license':'Original work for this workspace','notes':'Objective guides, scenario questions and multi-step analyst cases written for this project, with explicit reasoning and plausible distractors.'},{'id':'sybex','label':'Mike Chapple and David Seidl · CySA+ Practice Tests, fourth edition','license':'Copyright Wiley; private user-provided study material','notes':'1,006 practice questions and 150 exported images. Chapters 1–4 have chapter-level domain mappings only; chapters 5–6 are untagged mixed exams. No invented objective mappings.'},{'id':'guide','label':'Mike Chapple and David Seidl · CompTIA CySA+ Study Guide, fourth edition','license':'Copyright Wiley; private user-provided study material','notes':'12 chapters of reading with Exam Essentials, 240 chapter review questions and a 20-question assessment test with explanations. Questions carry domain-level mapping; an objective is recorded as indicative only when the chapter covers exactly one.'}]
    catalog={'schemaVersion':1,'exam':{**data['exam'],'domains':4,'objectivesVersion':'CS0-004 v2.0'},'domains':domains,'stats':{'questions':len(qs),'bookQuestions':1006,'communityQuestions':400,'cards':len(cs),'ankiCards':len(anki),'communityCards':400,'lessons':len(ls),'trainers':len(trainers),'bookImages':len(list((DIST/'media/book').iterdir())),'ankiMedia':media_count,'referenceImages':len(list((DIST/'media/references').glob('*.webp')))},'trainers':trainers,'library':library,'references':[{'title':p.stem.replace('_',' '),'path':'media/references/'+p.name} for p in sorted((DIST/'media/references').glob('*.webp'))],'sources':sources,'mappingPolicy':'reviewed mappings may inform objective tracking; source mappings are indicative; domain-only mappings carry no objective evidence.'}
    import import_studyguide
    guide=import_studyguide.import_studyguide(INPUT,DIST)
    assert guide and len(guide['chapters'])==12 and len(guide['questions'])==260,'study guide import incomplete'
    original=original_content(domains)
    catalog['stats'].update(guideQuestions=len(guide['questions']),guideChapters=len(guide['chapters']),guideReadings=sum(len(c['readings']) for c in guide['chapters']),guideImages=guide['images'],originalQuestions=len(original['questions']),guides=len(original['guides']),cases=len(original['cases']),pbqs=len(data['pbqs']),labs=len(data['labs']))
    for name,value in [('catalog',catalog),('questions',qs),('lessons',ls),('cards',cs),('original',original),('guide',guide)]:write_json(DIST/'data'/f'{name}.json',value)
    # Carry over simulations as data only; they are scripted exercises, not a live shell.
    write_json(DIST/'data/pbqs.json',data['pbqs']);write_json(DIST/'data/labs.json',data['labs'])
    assert len(qs)==1406 and len(ls)==51 and len(cs)==2339 and len(trainers)==13
    assert len({q['id'] for q in qs})==len(qs)
    assert all(set(q['correct_answers']) <= {a['label'] for a in q['options']} for q in qs)
    assert all(q['objective'] is None or q['objective'] in VALID for q in qs)
    print(json.dumps(catalog['stats'],indent=2))

if __name__=='__main__':main()
