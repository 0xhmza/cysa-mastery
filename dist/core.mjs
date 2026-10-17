export const STORAGE_KEY = 'cysa-mastery.v1';
export function freshState() {
  return {version:1, profile:{name:'Hamza',dailyGoal:20,newPerDay:10}, attempts:[], reviews:{}, lessons:{}, objectives:{}, cases:{}, bookmarks:[], exams:[], activities:[], notes:{}};
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
export function pickQuestions(bank,{count=10,domain=null,objective=null,mode='mixed',state=freshState(),domains=[],random=Math.random,source=null,chapter=null}={}) {
  let pool=bank.filter(q=>(!domain||q.domain===Number(domain))&&(!objective||q.objective===objective)&&(!source||q.source===source)&&(!chapter||q.sourceChapter===Number(chapter)));
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
  const read=!!state.objectives[id]?.read;
  const strong=read&&unique.size>=8&&recent.length>=8&&accuracy>=.8;
  return {attempts:attempts.length,unique:unique.size,trusted:trusted.size,indicative:unique.size-trusted.size,accuracy,read,strong,status:strong?'Strong':attempts.length?'Practicing':read?'Learning':'New'};
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
  state.profile={name:String(input.profile?.name||'Hamza').slice(0,40),dailyGoal:Math.min(100,Math.max(5,Number(input.profile?.dailyGoal)||20)),newPerDay:Math.min(100,Math.max(0,Number.isFinite(Number(input.profile?.newPerDay))?Number(input.profile.newPerDay):10))};
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
