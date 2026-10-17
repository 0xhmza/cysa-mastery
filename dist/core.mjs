export const STORAGE_KEY = 'cysa-mastery.v1';
export function freshState() {
  return {version:1, profile:{name:'Hamza',dailyGoal:20,newPerDay:10,examDate:''}, attempts:[], reviews:{}, lessons:{}, objectives:{}, cases:{}, bookmarks:[], exams:[], activities:[], notes:{}};
}
export function dayKey(date=new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function shuffle(items,random=Math.random) {
  const result=[...items];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
export function weightedCounts(total,domains) {
  const allocations=domains.map(d=>({id:d.id,count:Math.floor(total*d.weight/100),remainder:total*d.weight/100%1}));
  let rest=total-allocations.reduce((n,d)=>n+d.count,0);
  [...allocations].sort((a,b)=>b.remainder-a.remainder||a.id-b.id).slice(0,rest).forEach(d=>d.count++);
  return allocations.map(({id,count})=>({id,count}));
}
export function pickQuestions(bank,{count=10,domain=null,objective=null,objectives=null,mode='mixed',state=freshState(),domains=[],random=Math.random,source=null,chapter=null}={}) {
  let pool=bank.filter(q=>(!domain||q.domain===Number(domain))&&(!objective||q.objective===objective)&&(!objectives||objectives.includes(q.objective))&&(!source||q.source===source)&&(!chapter||q.sourceChapter===Number(chapter)));
  if(mode==='missed') {
    const latest=new Map();for(const attempt of state.attempts)latest.set(attempt.id,attempt);
    pool=pool.filter(q=>latest.has(q.id)&&!latest.get(q.id).correct);
  }
  if(mode==='bookmarks')pool=pool.filter(q=>state.bookmarks.includes(q.id));
  if(mode==='exam'&&domains.length&&!chapter){
    const selected=[];for(const allocation of weightedCounts(count,domains))selected.push(...shuffle(pool.filter(q=>q.domain===allocation.id),random).slice(0,allocation.count));
    return shuffle(selected,random);
  }
  if(mode==='adaptive'){
    const seen=new Map();for(const a of state.attempts){const v=seen.get(a.id)||{n:0,bad:0};v.n++;if(!a.correct)v.bad++;seen.set(a.id,v);}
    pool=pool.map(q=>{const a=seen.get(q.id);const weight=!a?2:(a.bad?3:0.5);return {q,key:-Math.log(Math.max(0.000001,random()))/weight};}).sort((a,b)=>a.key-b.key).map(v=>v.q);
    return pool.slice(0,count);
  }
  const answered=new Set(state.attempts.map(a=>a.id));
  return [...shuffle(pool.filter(q=>!answered.has(q.id)),random),...shuffle(pool.filter(q=>answered.has(q.id)),random)].slice(0,count);
}
export function objectiveEvidence(state,id) {
  // Reviewed/original mappings are trusted; source-supplied tags are indicative and reported separately.
  const attempts=state.attempts.filter(a=>(a.objective||a.hint)===id);
  const unique=new Set(attempts.map(a=>a.id)),trusted=new Set(attempts.filter(a=>a.objective===id).map(a=>a.id));
  const recent=attempts.slice(-10),accuracy=recent.length?recent.filter(a=>a.correct).length/recent.length:null;
  const recent20=attempts.slice(-MASTERED_RULE.recent),accuracy20=recent20.length?recent20.filter(a=>a.correct).length/recent20.length:null;
  const latest=new Map();for(const a of attempts)latest.set(a.id,a.correct);
  const openMisses=[...latest.values()].filter(c=>!c).length;
  const read=!!state.objectives[id]?.read;
  const strong=read&&unique.size>=STRONG_RULE.unique&&recent.length>=STRONG_RULE.recent&&accuracy>=STRONG_RULE.accuracy;
  const mastered=strong&&unique.size>=MASTERED_RULE.unique&&recent20.length>=MASTERED_RULE.recent&&accuracy20>=MASTERED_RULE.accuracy&&openMisses===0;
  return {attempts:attempts.length,unique:unique.size,trusted:trusted.size,indicative:unique.size-trusted.size,recent:recent.length,accuracy,recent20:recent20.length,accuracy20,openMisses,read,strong,mastered,status:mastered?'Mastered':strong?'Strong':attempts.length?'Practicing':read?'Learning':'New'};
}
export const STRONG_RULE={unique:8,recent:8,accuracy:.8};
// Mastered is deliberately stricter: more distinct questions, a higher bar over a longer window, and every miss since corrected.
export const MASTERED_RULE={unique:20,recent:20,accuracy:.9};
// How far an objective is along each of the three "Strong" criteria, for progress displays (0..1 each).
export function strongProgress(ev) {
  const guide=ev.read?1:0,volume=Math.min(1,ev.unique/STRONG_RULE.unique);
  const accuracy=ev.accuracy==null?0:Math.min(1,ev.accuracy/STRONG_RULE.accuracy)*Math.min(1,ev.recent/STRONG_RULE.recent);
  return {guide,volume,accuracy,overall:ev.strong?1:Math.min(.99,(guide+volume+accuracy)/3)};
}
export function missedCount(state) {
  const latest=new Map();for(const a of state.attempts)latest.set(a.id,a.correct);
  return [...latest.values()].filter(c=>!c).length;
}
export function dueCards(cards,state,now=Date.now()) {
  return cards.filter(c=>state.reviews[c.id]&&state.reviews[c.id].due<=now).sort((a,b)=>state.reviews[a.id].due-state.reviews[b.id].due);
}
export function scheduleReview(previous,grade,now=Date.now()) {
  const p=previous||{interval:0,ease:2.5,reps:0};let interval,ease=p.ease||2.5;
  if(grade==='again')return {interval:0,ease:Math.max(1.3,ease-.2),reps:0,due:now+10*60*1000,last:now};
  if(grade==='hard'){interval=p.interval?Math.max(1,p.interval*1.2):.5;ease=Math.max(1.3,ease-.15);}
  else if(grade==='easy'){interval=p.interval?Math.max(4,p.interval*(ease+.15)):4;ease+=.15;}
  else if(grade==='good')interval=p.interval?((p.reps||0)===1?3:Math.max(1,p.interval*ease)):1;
  else throw new Error('Unknown review grade');
  interval=Math.round(interval*10)/10;
  return {interval,ease,reps:(p.reps||0)+1,due:now+interval*86400000,last:now};
}
export function streak(state,now=new Date()) {
  const days=new Set(state.activities.map(a=>a.day));let d=new Date(now),n=0;
  if(!days.has(dayKey(d)))d.setDate(d.getDate()-1);
  while(days.has(dayKey(d))){n++;d.setDate(d.getDate()-1);}return n;
}
export function validateProgress(input) {
  if(!input||input.version!==1||!Array.isArray(input.attempts)||!Array.isArray(input.activities))throw new Error('This is not a CySA Mastery progress backup.');
  if(input.attempts.length>100000||input.activities.length>200000)throw new Error('Progress backup is too large.');
  const state=freshState();
  state.profile={name:String(input.profile?.name||'Hamza').slice(0,40),dailyGoal:Math.min(100,Math.max(5,Number(input.profile?.dailyGoal)||20)),newPerDay:Math.min(100,Math.max(0,Number.isFinite(Number(input.profile?.newPerDay))?Number(input.profile.newPerDay):10)),examDate:/^\d{4}-\d{2}-\d{2}$/.test(input.profile?.examDate||'')?input.profile.examDate:''};
  state.attempts=input.attempts.filter(a=>a&&typeof a.id==='string'&&typeof a.correct==='boolean'&&Number.isFinite(a.at)).map(a=>({id:a.id.slice(0,100),domain:Number(a.domain)||null,objective:/^[1-4]\.[1-6]$/.test(a.objective)?a.objective:null,hint:/^[1-4]\.[1-6]$/.test(a.hint)?a.hint:null,correct:a.correct,at:a.at,confidence:['low','medium','high'].includes(a.confidence)?a.confidence:'medium',mode:String(a.mode||'practice').slice(0,30),sessionId:String(a.sessionId||'import').slice(0,100)}));
  for(const key of ['reviews','lessons','objectives','cases','notes']){
    const value=input[key];if(value&&typeof value==='object'&&!Array.isArray(value)){
      for(const [id,item] of Object.entries(value)){
        if(['__proto__','constructor','prototype'].includes(id))continue;
        if(key==='notes'){if(typeof item==='string')state[key][id]=item.slice(0,20000);continue;}
        if(!item||typeof item!=='object')continue;
        if(key==='reviews'&&!Number.isFinite(item.due))continue;
        state[key][id]=JSON.parse(JSON.stringify(item));
      }
    }
  }
  state.activities=input.activities.filter(a=>a&&/^\d{4}-\d{2}-\d{2}$/.test(a.day)&&typeof a.type==='string').map(a=>({day:a.day,type:a.type.slice(0,30),at:Number(a.at)||0}));
  state.bookmarks=Array.isArray(input.bookmarks)?input.bookmarks.filter(x=>typeof x==='string').slice(0,10000):[];
  state.exams=Array.isArray(input.exams)?input.exams.filter(x=>x&&Number.isFinite(x.at)&&Number.isFinite(x.total)&&Number.isFinite(x.correct)&&x.total>0&&x.correct>=0&&x.correct<=x.total).slice(-1000).map(x=>({at:x.at,total:x.total,correct:x.correct,kind:String(x.kind||'practice').slice(0,40),label:String(x.label||'').slice(0,80),seconds:Number.isFinite(x.seconds)?x.seconds:null})):[];
  return state;
}

const ORDER_DEPENDENT=/\b(all|none|both)\s+of\s+the\s+(above|these)\b|\b(both|either)\s+[A-D]\b|\b[A-D]\s+(and|or)\s+[A-D]\b/i;
const EXPLANATION_LETTER_REFS=/\b[Oo]ptions?\s+\(?[A-D]\b|\b[Cc]hoices?\s+\(?[A-D]\b|\b[A-D]\s+(and|or)\s+[A-D]\b|\(\s*[A-D]\s*\)|\b[Bb]oth\s+[A-D]\b/;
export function canShuffleOptions(q) {
  // Shuffling would break answers that depend on option order or explanations that cite letters.
  return !q.options.some(o=>ORDER_DEPENDENT.test(o.text))&&!EXPLANATION_LETTER_REFS.test(q.explanation||'');
}
export function prepareQuestion(q,random=Math.random) {
  const options=(canShuffleOptions(q)?shuffle(q.options,random):[...q.options]).map((o,i)=>({...o,key:o.label,shown:String.fromCharCode(65+i)}));
  return {question:q,options,multi:q.correct_answers.length>1};
}
export function isCorrect(question,selectedKeys) {
  const want=[...question.correct_answers].sort().join(),got=[...selectedKeys].sort().join();
  return want===got;
}
export function newCards(cards,state,limit=Infinity) {
  return cards.filter(c=>!state.reviews[c.id]).slice(0,limit);
}
export function cardsDueToday(cards,state,now=Date.now()) {
  const end=new Date(now);end.setHours(23,59,59,999);
  return cards.filter(c=>state.reviews[c.id]&&state.reviews[c.id].due<=end.getTime());
}
export function domainStats(state,domain) {
  const a=state.attempts.filter(x=>x.domain===domain),right=a.filter(x=>x.correct).length;
  return {attempts:a.length,correct:right,accuracy:a.length?right/a.length:null};
}
export function misconceptions(state) {
  const latest=new Map();for(const a of state.attempts)latest.set(a.id,a);
  return [...latest.values()].filter(a=>!a.correct&&a.confidence==='high');
}
export function todayCount(state,now=new Date()) {
  const key=dayKey(now);return state.activities.filter(a=>a.day===key).length;
}

// Progress toward Mastered, shown once an objective is Strong.
export function masteredProgress(ev) {
  const volume=Math.min(1,ev.unique/MASTERED_RULE.unique);
  const accuracy=ev.accuracy20==null?0:Math.min(1,ev.accuracy20/MASTERED_RULE.accuracy)*Math.min(1,ev.recent20/MASTERED_RULE.recent);
  const misses=ev.openMisses===0?1:Math.max(0,1-ev.openMisses/5);
  return {volume,accuracy,misses,overall:ev.mastered?1:Math.min(.99,(volume+accuracy+misses)/3)};
}
// Objectives that most need work: not yet Mastered, least progress first, never-practiced ones before nearly-there ones.
export function weakestObjectives(objectives,state,count=3) {
  return objectives.map(o=>{const ev=objectiveEvidence(state,o.id);return {id:o.id,ev,weight:o.weight||0,score:ev.mastered?2:ev.strong?1+masteredProgress(ev).overall:strongProgress(ev).overall}})
    .filter(x=>!x.ev.mastered).sort((a,b)=>a.score-b.score||b.weight-a.weight||a.id.localeCompare(b.id)).slice(0,count);
}
// Daily workload to reach a goal by an exam date. Counts only; never a score prediction.
export function studyPlan(data,state,examDate,now=new Date()) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(examDate||''))return null;
  const [y,m,d]=examDate.split('-').map(Number),exam=new Date(y,m-1,d),today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const daysLeft=Math.round((exam-today)/864e5);
  const evs=data.objectives.map(o=>({o,ev:objectiveEvidence(state,o.id)}));
  const unreadGuides=evs.filter(x=>!x.ev.read).length;
  const toStrong=evs.reduce((n,x)=>n+Math.max(0,STRONG_RULE.unique-x.ev.unique),0);
  const toMastered=evs.reduce((n,x)=>n+Math.max(0,MASTERED_RULE.unique-x.ev.unique)+x.ev.openMisses,0);
  const unseenCards=newCards(data.cards,state).length;
  const usable=Math.max(1,daysLeft-3);// keep the last days for review and full-length sets
  return {daysLeft,past:daysLeft<0,unreadGuides,toStrong,toMastered,unseenCards,usableDays:usable,
    questionsPerDay:Math.ceil(toMastered/usable),guidesPerDay:Math.ceil(unreadGuides/usable),newCardsPerDay:Math.ceil(unseenCards/usable),
    cardsFit:state.profile.newPerDay*usable>=unseenCards};
}
