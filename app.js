'use strict';
const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const forms=['контрольная работа','Проверочная работа','самостоятельная работа','решение задач','устный счет','математический диктант','зачет','комбинированная работа','тест','учебное задание'];
const statuses=['Результат','Не участвовал','Не оценено','Уточнить'];
const key='school1273-kom-v1';let data=structuredClone(window.INITIAL_DATA),storageOK=true;
try{const saved=localStorage.getItem(key);if(saved){const d=JSON.parse(saved);validate(d);if(!d.students.length&&!d.results.length&&window.INITIAL_DATA.students.length){data=structuredClone(window.INITIAL_DATA);data.events.push(...d.events.filter(e=>!data.events.some(base=>base.id===e.id)));data.thresholds=d.thresholds;}else data=d;}}catch(e){storageOK=false;}
// Correct source metadata once, preserving scores and any teacher-edited task labels.
if(data.seedRevision!==window.INITIAL_DATA.seedRevision){
 for(const fix of window.INITIAL_DATA.metadataCorrections||[]){
  const e=data.events.find(e=>e.id===fix.event&&e.date===fix.date),t=e?.tasks.find(t=>t.id===fix.task);
  if(t&&t.code===fix.previousCode&&t.skill===fix.previousSkill)Object.assign(t,structuredClone(fix.replacement));
 }
 data.seedRevision=window.INITIAL_DATA.seedRevision;
}
// Merge the journal import once, including in browsers with a saved copy of the matrix.
const journalImport = window.INITIAL_DATA.seedImport;
if (journalImport && !data.appliedImports?.includes(journalImport.id)) {
 const source = window.INITIAL_DATA;
 const studentIds = new Map();
 for (const student of source.students) {
  const existing = data.students.find(item => item.id === student.id || item.name === student.name ||
   (student.id.startsWith('ejd-') && item.name.startsWith(student.name + ' ')));
  if (existing) studentIds.set(student.id, existing.id);
  else if (student.id.startsWith('ejd-')) {
   data.students.push(structuredClone(student));
   studentIds.set(student.id, student.id);
  }
 }
 for (const id of journalImport.events) {
  const event = structuredClone(source.events.find(item => item.id === id));
  const existing = data.events.find(item => item.id === id);
  if (existing && existing.date !== event.date) continue;
  const assessments = Object.fromEntries(Object.entries(event.assessments)
   .filter(([student]) => studentIds.has(student))
   .map(([student, mark]) => [studentIds.get(student), mark]));
  if (existing) {
   existing.assessments = {...assessments, ...existing.assessments};
   existing.assessmentSource = 'ЭЖД';
  } else {
   event.assessments = assessments;
   data.events.push(event);
  }
 }
 data.appliedImports = [...(data.appliedImports || []), journalImport.id];
}
const originalGroup = '6БГИ · Для увлечённых';
const eventGroup = event => event.group || originalGroup;
function mergeStrata(target) {
 const source = window.INITIAL_DATA;
 const entry = source.strataImport;
 for (const student of target.students) {
  if (student.group === '6БГИ') student.group = originalGroup;
 }
 if (!entry || target.appliedImports?.includes(entry.id)) return;
 const newEvents = source.events.filter(event => entry.groups.includes(event.group) &&
  !target.events.some(saved => saved.id === event.id));
 const eventIds = new Set(newEvents.map(event => event.id));
 for (const student of source.students.filter(item => entry.groups.includes(item.group))) {
  if (!target.students.some(saved => saved.id === student.id)) target.students.push(structuredClone(student));
 }
 target.events.push(...structuredClone(newEvents));
 target.results.push(...structuredClone(source.results.filter(result => eventIds.has(result.event))));
 target.appliedImports = [...(target.appliedImports || []), entry.id];
}
function mergeNovember(target) {
 const source = window.INITIAL_DATA;
 const entry = source.novemberImport;
 if (!entry || target.appliedImports?.includes(entry.id)) return;
 target.events = target.events.filter(event => !(event.id === 'УЗ-29.09-ИНТ' && event.gradeOnly));
 for (const student of source.students.filter(item => entry.students.includes(item.id))) {
  if (!target.students.some(saved => saved.id === student.id)) target.students.push(structuredClone(student));
 }
 for (const event of source.events.filter(item => entry.events.includes(item.id))) {
  const existing = target.events.find(item => item.id === event.id);
  if (!existing) target.events.push(structuredClone(event));
  else if (existing.gradeOnly) {
   const assessments = {...event.assessments, ...existing.assessments};
   Object.assign(existing, structuredClone(event), {assessments});
  }
 }
 target.appliedImports = [...(target.appliedImports || []), entry.id];
}
mergeStrata(data);
mergeNovember(data);
let selected=new Set(data.events.map(e=>e.id)),editId=null,scoreId=null,csvRows=[];
const sorted=()=>[...data.events].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id,'ru'));
const groupEvents=()=>sorted().filter(event=>eventGroup(event)===$('group').value);
const chosen=()=>groupEvents().filter(event=>selected.has(event.id));
const date=d=>d?d.split('-').reverse().join('.'):'Без даты';
const pct=v=>Math.round(v)+'%';const avg=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
function validate(d){
 if(!d||d.version!==1||!Array.isArray(d.events)||!Array.isArray(d.students)||!Array.isArray(d.results)||!Array.isArray(d.catalog)||!d.catalog.length)throw Error('Неизвестный формат файла');
 for(const field of ['students','events','catalog']){const seen=new Set;for(const x of d[field]){let id=field==='catalog'?x.code:x.id;if(typeof id!=='string'||!id||seen.has(id))throw Error('Повтор или пустой идентификатор');seen.add(id);}}
 if(d.students.some(s=>typeof s.name!=='string'||!s.name.trim()||typeof s.group!=='string'))throw Error('Проверьте список учеников');
 const codes=new Set(d.catalog.map(c=>c.code));
 for(const e of d.events){if((e.date!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(e.date))||!forms.includes(e.form)||!e.title||!Array.isArray(e.tasks)||(!e.tasks.length&&!e.gradeOnly))throw Error('Проверьте мероприятия');const seen=new Set;for(const t of e.tasks){if(!t.id||seen.has(t.id)||!codes.has(t.code)||t.max!==null&&(!Number.isFinite(t.max)||t.max<=0)||!t.skill)throw Error('Проверьте задания');seen.add(t.id);}}
 const seen=new Set;for(const r of d.results){const e=d.events.find(e=>e.id===r.event),t=e?.tasks.find(t=>t.id===r.task),k=JSON.stringify([r.student,r.event,r.task]);if(!t||!d.students.some(s=>s.id===r.student)||seen.has(k)||!statuses.includes(r.status)||r.score!==null&&(!Number.isFinite(r.score)||t.max===null||r.score<0||r.score>t.max)||r.status==='Результат'&&r.score===null||r.status!=='Результат'&&r.score!==null)throw Error('Проверьте результаты: связи, статусы или баллы');seen.add(k);}
 if(!d.thresholds||!Number.isFinite(d.thresholds.good)||!Number.isFinite(d.thresholds.partial)||d.thresholds.good>100||d.thresholds.partial<0||d.thresholds.partial>=d.thresholds.good)throw Error('Проверьте пороги');
}
function save(){try{localStorage.setItem(key,JSON.stringify(data));storageOK=true;}catch{storageOK=false;notify('Браузер не смог сохранить изменения. Скачайте резервную копию перед закрытием.');}}
function notify(s){$('notice').textContent=s;}
function missingOutcome(student,event){
 const mark = event.assessments?.[student];
 if (event.assessmentSource !== 'ЭЖД') return {value:null,text:'Нет данных'};
 if (['Н','Б','Н · Б'].includes(mark?.status)) return {value:null,text:mark.status};
 return {value:null,text:'Нет баллов'};
}
function mastery(student,event,code){
 const tasks=event.tasks.filter(t=>code==='__all'||t.code===code);if(!tasks.length)return {value:null,text:'Не проверялся'};
 const rr=tasks.map(t=>data.results.filter(r=>r.student===student&&r.event===event.id&&r.task===t.id));
 if(rr.some(a=>a.length>1))return {value:null,text:'Уточнить'};
 const rs=rr.map(a=>a[0]);if(rs.every(r=>!r||r.status==='Не оценено'))return missingOutcome(student,event);
 if(rs.some(r=>r?.status==='Уточнить'))return {value:null,text:'Уточнить'};
 if(rs.every(r=>r?.status==='Не участвовал'))return {value:null,text:'Н'};
 if(rs.some((r,i)=>r?.status!=='Результат'||!Number.isFinite(r.score)||r.score<0||r.score>tasks[i].max))return {value:null,text:'Не все задания оценены'};
 return {value:rs.reduce((a,r)=>a+r.score,0)/tasks.reduce((a,t)=>a+t.max,0)*100,text:''};
}
const skillFamilies = [
 ['Определять взаимно простые числа', [['ПР-29.09','1','5'],['КР-01','5']]],
 ['Находить наибольший общий делитель двух чисел', [['ПР-29.09','2','3'],['КР-01','3']]],
 ['Разлагать натуральное число на простые множители', [['ПР-29.09','4'],['КР-01','2']]],
 ['Применять признаки делимости', [['КР-01','1','6'],['КР-02-ИНТ','1','6'],['КР-01-6АТ','1.1','1.2','6']]],
 ['Сравнивать обыкновенные дроби', [['ПР-15.10','1','2']]]
];
const skillAliases = new Map();
for (const [label, mappings] of skillFamilies) {
 for (const [eventId, ...taskIds] of mappings) {
  const event = window.INITIAL_DATA.events.find(item => item.id === eventId);
  for (const task of event?.tasks || []) {
   if (taskIds.includes(task.id)) skillAliases.set(task.skill, label);
  }
 }
}
const skillName = task => skillAliases.get(task.skill) || task.skill.trim();
const mckoBaseline = window.MCKO_BASELINE;
const startModel = window.START_MODEL;
const mckoSkills = mckoBaseline?.skills || [];
const mckoByKomSkill = new Map(mckoSkills.flatMap((skill,index) =>
 skill.komSkill ? [[skill.komSkill,{...skill,index}]] : []));
const gradeFiveCodifier = [
 ['2.5','Действия с десятичными дробями'],['3.4','Основные задачи на дроби'],
 ['1.5','Буква в записи неизвестного компонента'],['3.5','Данные на столбчатой диаграмме'],
 ['3.5','Данные на столбчатой диаграмме'],['4.5','Площадь фигур на клетчатой бумаге'],
 ['1.1','Натуральные числа на координатном луче'],['3.1','Арифметическое решение текстовых задач'],
 ['4.7','Объём прямоугольного параллелепипеда'],['1.6','Признаки делимости'],
 ['2.2','Сравнение обыкновенных дробей'],['3.3','Задачи на зависимости между величинами']
];
const gradeTransitions = [
 {name:'Арифметические действия с дробями', section:'Числа и вычисления', federal:'элемент содержания 2.4', index:0, codes:['1.2.1','1.2.3'],
  skills:['Складывать и вычитать обыкновенные дроби с разными знаменателями',
   'Умножать обыкновенные дроби и смешанные числа','Вычислять значение выражения с дробями, скобками и степенью',
   'Складывать и вычитать смешанные числа','Складывать и вычитать десятичные дроби','Умножать и делить десятичные дроби']},
 {name:'Сравнение обыкновенных дробей',federal:'элемент содержания 2.1',index:10,codes:['1.2.1'],skills:['Сравнивать обыкновенные дроби']},
 {name:'Признаки делимости',federal:'требование к результатам 2.2',index:9,codes:['1.1.6'],skills:['Применять признаки делимости']},
 {name:'Нахождение части от целого',federal:'элемент содержания 2.2',index:1,codes:['1.2.2'],skills:['Находить часть от целого']},
 {name:'Площадь фигур',federal:'элемент содержания 4.2',index:5,codes:['4.1.6'],skills:['Находить площадь прямоугольника по периметру и стороне']},
 {name:'Объём прямоугольного параллелепипеда',federal:'элемент содержания 6.13',index:8,codes:['4.2.2'],
  skills:['Вычислять объём прямоугольного параллелепипеда по данным о его измерениях']}
];
function provisionalPoints(student,event){
 const grade = event.assessments?.[student]?.grade;
 if (event.assessmentSource !== 'ЭЖД' || !Number.isInteger(grade) || grade < 1 || grade > 5) return null;
 const skills = [...new Set((event.originalTasks || event.tasks).map(skillName))];
 if (!skills.length) return null;
 let hash = 0;
 for (const character of student+'|'+event.id) hash = (Math.imul(hash,31)+character.codePointAt(0)) >>> 0;
 const zero = grade < 5 ? skills[hash % skills.length] : null;
 return new Map(skills.map(skill => [skill,skill === zero ? 0 : 1]));
}
function elementResult(student,event,code){
 const actual = mastery(student,event,code);
 if (actual.text !== 'Нет баллов') return actual;
 const points = provisionalPoints(student,event);
 if (!points) return actual;
 const skills = [...new Set(event.tasks.filter(t => code==='__all'||t.code===code).map(skillName))];
 const score = skills.reduce((total,skill) => total + points.get(skill),0);
 return {value:score / skills.length * 100,score,max:skills.length,estimated:true};
}
function skillResult(student,event,skill){
 const tasks = event.tasks.filter(task => skillName(task) === skill);
 const result = elementResult(student,{...event,tasks,originalTasks:event.tasks},'__all');
 if (result.value === null) return result;
 return {...result,score:Number(result.value >= 100 - 1e-8),max:1};
}
function progressionPoint(score,estimated=false){
 const kind=score===1?'mastered':score===0?'practice':'missing';
 return `<span class="skillPoint ${kind}">${score??'—'}${estimated?'<sup>*</sup>':''}</span>`;
}
function renderGradeTransitions(student,events,code){
 const baseline=mckoBaseline?.students[student];
 const modelChanges=new Set(startModel?.changedSkills[student]);
 const rows=gradeTransitions.filter(row=>code==='__all'||row.codes.includes(code)).map(row=>{
  const mcko=mckoSkills[row.index];
  if (!mcko) return '';
  const spring=baseline?.[row.index];
  const september=modelChanges.has(row.index)?1-spring:spring;
  const checks=events.flatMap(event=>{
   const tasks=event.tasks.filter(task=>row.skills.includes(skillName(task)));
   if (!tasks.length) return [];
   const result=elementResult(student,{...event,tasks,originalTasks:event.tasks},'__all');
   return [{event,tasks,result}];
  });
  const last=checks.findLast(check=>check.result.value!==null&&!check.result.estimated)
   ||checks.findLast(check=>check.result.value!==null)||checks.at(-1);
  const result=last?.result;
  const score=result?.value==null?undefined:Number(result.value>=100-1e-8);
  let movement='—';
  if (spring!==undefined&&score!==undefined) {
   if (result.estimated) movement='<small>Ждёт проверки</small>';
   else {
    const kind=spring===score?'missing':spring<score?'mastered':'practice';
    const label=spring===score?'Без изменений':spring<score?'Рост':'Снижение';
    movement=`<span class="skillPoint ${kind}">${spring} → ${score}</span><small>${label}</small>`;
   }
  }
  const tested=last?[...new Set(last.tasks.map(task=>task.skill))].map(label=>`<small>${esc(label)}</small>`).join(''):'';
  const komSource=last?`<small>${esc(last.event.id)} · ${date(last.event.date)}</small>`:'<small>Нет выбранной проверки</small>';
  const mckoCode=gradeFiveCodifier[row.index][0];
  return `<tr><th scope="row">${esc(row.name)}${row.section?`<small>Раздел «${esc(row.section)}»</small>`:''}</th>
   <td class="mckoSkill">${progressionPoint(spring)}<small>${esc(mcko.name)}</small><small>ФРП · элемент содержания ${mckoCode}</small></td>
   ${startModel?`<td class="startModel">${progressionPoint(september)}<small>Тот же материал</small></td>`:''}
   <td>${progressionPoint(score,result?.estimated)}${komSource}${tested}<small>ФРП · ${esc(row.federal)}</small></td><td>${movement}</td></tr>`;
 }).join('');
 if (!rows) return '';
 return `<section class="gradeProgression"><h3>Проверяемые элементы содержания и требования к результатам · 5 и 6 классы</h3>
 <p class="muted">Сравнивается выполнение на материале каждого класса. Состав проверок различается, поэтому переход показывает результат на этих проверках. Звёздочка обозначает результат, который требует проверки.</p>
 <div class="skillScroll"><table class="skillTable"><thead><tr><th scope="col">Что сопоставляем</th>
 <th scope="col" class="mckoSkill">5 класс · МЦКО<small>${date(mckoBaseline.date)}</small></th>
 ${startModel?`<th scope="col" class="startModel">6 класс · Стартовая<small>${date(startModel.date)} · модель</small></th>`:''}
 <th scope="col">6 класс · КОМ</th><th scope="col">МЦКО → КОМ</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
function skillHistory(student,events,code){
 const skills = new Map();
 for (const event of events) for (const task of event.tasks) {
  const name = skillName(task);
  if (!skills.has(name)) skills.set(name,new Set());
  skills.get(name).add(task.code);
 }
 const baseline = mckoBaseline?.students[student];
 const rows = [...skills.entries()].filter(([,codes]) => code==='__all'||codes.has(code)).map(([name,codes]) => {
  const history = events.map(event => skillResult(student,event,name));
  const mcko = mckoByKomSkill.get(name);
  return {name,codes:[...codes],history,mcko,baseline:baseline?.[mcko?.index],
   latest:history.findLast(result=>result.value!==null),
   confirmed:history.findLastIndex(result=>result.value!==null&&!result.estimated)};
 });
 if (baseline) mckoSkills.forEach((mcko,index) => {
  if ((code==='__all'||mcko.code===code) && !rows.some(row=>row.mcko?.index===index)) {
   rows.push({name:mcko.name,codes:mcko.code?[mcko.code]:[],mcko,baseline:baseline[index],confirmed:-1});
  }
 });
 return rows;
}
function renderSkillHistory(student,events,code){
 events = events.filter(event=>event.tasks.length);
 const skills = skillHistory(student,events,code);
 const order = item => item.history ? item.latest?.score ?? 2 : 3;
 skills.sort((a,b) => order(a)-order(b));
 if (!skills.length) return '<p class="muted">Выберите работы и проверяемый элемент.</p>';
 const head = events.map(event => `<th scope="col">${event.date?date(event.date).slice(0,5):'Без даты'}<small>${esc(event.id)} · 6 класс</small></th>`).join('');
 const hasMcko = Boolean(mckoBaseline);
 const mckoHead = hasMcko ? `<th scope="col" class="mckoSkill">МЦКО · 5 класс<small>${date(mckoBaseline.date)}</small></th>` : '';
 const modelHead = startModel ? `<th scope="col" class="startModel">Стартовая работа<small>${date(startModel.date)} · 6 класс</small><small>Модель</small></th>` : '';
 const modelChanges = new Set(startModel?.changedSkills[student]);
 const rows = skills.map(skill => {
  const history = skill.history ? skill.history.map(result => {
   if (result.value===null) return `<td><span class="skillPoint missing" title="${esc(result.text)}">—</span></td>`;
   const kind = result.score ? 'mastered' : 'practice';
   const note = result.estimated ? 'Результат требует проверки' : 'По фактическим баллам';
   return `<td><span class="skillPoint ${kind}" title="${note}">${result.score}${result.estimated?'<sup>*</sup>':''}</span></td>`;
  }).join('') : '<td><span class="skillPoint missing" title="Умение пока не проверялось в выбранных КОМ">—</span></td>'.repeat(events.length);
  const start = skill.baseline;
  const end = skill.history?.[skill.confirmed]?.score;
  const mckoPoint = hasMcko ? `<td class="mckoSkill"><span class="skillPoint ${start===1?'mastered':start===0?'practice':start==='partial'?'partial':'missing'}" title="${esc(skill.mcko?.name || 'Умение не сопоставлено с МЦКО')}">${start==='partial'?'Частично':start??'—'}</span></td>` : '';
  const modeled = modelChanges.has(skill.mcko?.index) ? 1-start : start;
  const transition = modeled!==start ? `<small>${start} → ${modeled}</small>` : '';
  const modelPoint = startModel ? `<td class="startModel"><span class="skillPoint ${modeled===1?'mastered':modeled===0?'practice':modeled==='partial'?'partial':'missing'}" title="Модельное значение">${modeled==='partial'?'Частично':modeled??'—'}</span>${transition}</td>` : '';
  let change = '—';
  if (start===0||start===1) {
   if (end!==undefined) {
    const label = start<end?'Рост':start>end?'Снижение':'Без изменений';
    change = `<span class="skillPoint ${start<end?'mastered':start>end?'practice':'missing'}">${start} → ${end}</span><small>${label} · ${esc(events[skill.confirmed].id)}</small>`;
   } else if (skill.history) change = '<small>Ждёт проверки по КОМ</small>';
  }
  const current = skill.latest;
  let action = skill.history ? 'Пока нет результата' : 'Проверить в 6 классе';
  if (current) action = current.score ? 'Пока не давать' : 'Дать задание';
  const kind = current ? (current.score ? 'mastered' : 'practice') : 'missing';
  const scope = skill.history && skill.mcko?.note ? `<small>${esc(skill.mcko.note)}</small>` : '';
  return `<tr><th scope="row">${esc(skill.name)}<small>${esc(skill.codes.join(' · ')||'МЦКО')}</small>${scope}</th>
   ${mckoPoint}${modelPoint}${history}${hasMcko?`<td>${change}</td>`:''}<td><span class="skillAction ${kind}">${action}</span></td></tr>`;
 }).join('');
 const changeHead = hasMcko ? '<th scope="col">МЦКО → КОМ<small>По подтверждённым данным</small></th>' : '';
 const coverage = hasMcko && !mckoBaseline.students[student] ? '<p class="muted">В протоколах МЦКО за 5 класс ученик не найден.</p>' : '';
 const modelNote = startModel ? '<p class="muted">Стартовая работа показана как модель. Переходы в её колонке отсчитываются от весеннего МЦКО. Подтверждённая динамика и подсказки по отработке рассчитываются отдельно.</p>' : '';
 return `${renderGradeTransitions(student,events,code)}${coverage}${modelNote}<div class="skillScroll"><table class="skillTable"><thead><tr><th scope="col">Проверяемое умение</th>${mckoHead}${modelHead}${head}${changeHead}<th scope="col">Что дать дальше</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function renderSkillPanel(students,events,code){
 const select = $('skillStudent');
 const previous = select.value;
 select.innerHTML = students.map(student=>`<option value="${esc(student.id)}">${esc(student.name)}</option>`).join('');
 if (students.some(student=>student.id===previous)) select.value = previous;
 const student = students.find(item=>item.id===select.value) || students[0];
 $('skillOverview').innerHTML = student ? renderSkillHistory(student.id,events,code) : '<p class="muted">По этому фильтру учеников нет.</p>';
 $('gradeFiveCrosswalk').innerHTML = mckoSkills.map((skill,index)=>{
  const [sourceCode,topic]=gradeFiveCodifier[index];
  const schoolCode=skill.code||'—';
  return `<tr><td>${esc(skill.name)}</td><td>${sourceCode} · ${esc(topic)}</td><td>${esc(schoolCode)}</td></tr>`;
 }).join('');
}
function level(v){return v>=data.thresholds.good?'good':v>=data.thresholds.partial?'mid':'bad';}
function cell(r,delta){return `<span class="cell ${r.value===null?'neutral':level(r.value)}">${r.value===null?esc(r.text):pct(r.value)}</span>${delta!==null?`<span class="delta ${delta>0?'positive':delta<0?'negative':''}">${delta>0?'+':''}${delta.toFixed(1)} п.п.</span>`:''}`;}
function renderChoices(){ $('eventChoices').innerHTML=groupEvents().map(e=>`<label class="choice"><input type="checkbox" data-event="${esc(e.id)}" ${selected.has(e.id)?'checked':''}><span><b>${esc(e.id)}</b> · ${date(e.date)}<small>${esc(e.form)} · ${esc(e.title)}</small></span></label>`).join('')||'<p class="muted">Добавьте первое мероприятие на вкладке «Мероприятия».</p>'; }
function outcomeCell(r,summary=false){
 if(r.estimated)return `<span class="cell neutral">${r.score} / ${r.max} б.<sup title="Требуется проверка">*</sup></span><small>${pct(r.value)}</small>`;
 if(r.value===null)return `<span class="cell neutral">${esc(r.text)}</span>`;
 const full=r.value>=100-1e-8,zero=r.value===0;
 const label=summary?(full?'✓ Освоен':zero?'✕ Не освоен':'◐ Частично освоен'):(full?'✓ Выполнено':zero?'✕ Не выполнено':'◐ Частично выполнено');
 return `<span class="cell ${full?'good':zero?'bad':'mid'}">${label}</span><small>${summary?pct(r.value)+' баллов по элементу':esc(r.score)+' / '+esc(r.max)+' б.'}</small>`;
}
function elementChange(student, col, result){
 if (!col.previous) return '';
 const previous = elementResult(student, col.previous, col.c.code);
 if (result.value === null || previous.value === null) return 'Δ —';
 const delta = result.value - previous.value;
 const label = result.estimated || previous.estimated ? '*' : '';
 return `Δ ${delta > 0 ? '+' : ''}${delta.toFixed(1).replace('.', ',')} п. п.${label}`;
}
function renderJournalGrades(students, events){
 const journalEvents = events.filter(event => event.assessmentSource === 'ЭЖД');
 $('journalGrades').hidden = !journalEvents.length;
 $('journalGradeTable').innerHTML = journalEvents.length ? `<thead><tr><th>ФИО обучающегося</th>
  ${journalEvents.map(event => `<th>${date(event.date)}<br><small>${esc(event.form)}</small></th>`).join('')}
  </tr></thead><tbody>${students.map(student => `<tr><td>${esc(student.name)}</td>
  ${journalEvents.map(event => `<td>${esc(journalMark(student.id,event))}</td>`).join('')}</tr>`).join('')}</tbody>` : '';
}
function journalMark(student, event){
 const mark = event.assessments?.[student];
 return mark?.grade ?? mark?.status ?? 'Нет отметки';
}
function renderElementMatrix(students,events,code,filter){
 const codes=data.catalog.filter(c=>(code==='__all'||c.code===code)&&events.some(e=>e.tasks.some(t=>t.code===c.code)));
 const groups=[],cols=[];
 for(const c of codes){
  const start=cols.length;
  let previous;
  for(const e of events){
   const tasks=e.tasks.filter(t=>t.code===c.code);
   if(!tasks.length)continue;
   cols.push({e,c,previous});
   previous=e;
  }
  groups.push({c,count:cols.length-start});
 }
 const outcome=(s,col)=>elementResult(s.id,col.e,col.c.code);
 const rows=students.map(s=>({s,rs:cols.map(col=>outcome(s,col))})).filter(({s,rs})=>filter==='all'||filter==='risk'&&rs.some(r=>r.value!==null&&r.value<100)||filter==='check'&&rs.some(r=>['Уточнить','Не все задания оценены','Не оценено'].includes(r.text))||filter==='down'&&codes.some(c=>{const ee=events.filter(e=>e.tasks.some(t=>t.code===c.code));return ee.some((e,i)=>{if(!i)return false;const a=elementResult(s.id,ee[i-1],c.code),b=elementResult(s.id,e,c.code);return a.value!==null&&b.value!==null&&b.value<a.value;});}));
 $('matrixTitle').textContent=`Поэлементная матрица · ${rows.length} из ${students.length} учеников`;
 $('elementName').textContent='В таблице показаны итоги по элементам содержания и изменение между проверками.';
 const head=groups.map(g=>`<th colspan="${g.count}" class="elementGroup">${esc(g.c.code)} · ${esc(g.c.name)}</th>`).join('');
 $('heatmap').innerHTML=cols.length?`<thead><tr><th rowspan="2">ФИО обучающегося</th>${head}</tr><tr>${cols.map(col=>`<th class="elementTotal"><b>${esc(col.e.id)} · ${date(col.e.date)}</b><small>Итог по элементу</small></th>`).join('')}</tr></thead><tbody>${rows.map(({s,rs})=>`<tr><td><button class="nameButton" data-student="${esc(s.id)}">${esc(s.name)}</button><small>${esc(s.group)}</small></td>${rs.map((r,i)=>`<td class="elementTotal">${outcomeCell(r,true)}${cols[i].previous?`<small title="Изменение к ${date(cols[i].previous.date)}. Сравниваются баллы по этому же элементу.">${esc(elementChange(s.id,cols[i],r))}</small>`:''}</td>`).join('')}</tr>`).join('')}<tr class="mean"><td>Полное выполнение<small>Среди оценённых, по показанным ученикам</small></td>${cols.map((col,i)=>{const rr=rows.map(x=>x.rs[i]).filter(r=>r.value!==null&&!r.estimated);return `<td>${rr.filter(r=>r.value>=100-1e-8).length} / ${rr.length}</td>`;}).join('')}</tr></tbody>`:'<tbody><tr><td class="noData">В выбранных КОМ нет заданий по этому элементу. Выберите другой элемент или мероприятие.</td></tr></tbody>';
 const journalEvents = events.filter(event => event.assessmentSource === 'ЭЖД');
 const header = ['ФИО','Класс',...journalEvents.map(event => 'Отметка ЭЖД · '+date(event.date))];
 for (const col of cols) {
  const label = col.c.code+' · '+col.e.id+' · '+date(col.e.date);
  header.push(label+' · Итог по элементу');
  if (col.previous) header.push(label+' · Δ к '+date(col.previous.date));
 }
 csvRows = [header,...rows.map(({s,rs}) => {
  const row = [s.name,s.group,...journalEvents.map(event => journalMark(s.id,event))];
  rs.forEach((r,i) => {
   const col = cols[i];
   if (r.estimated) row.push(r.score+'/'+r.max+' ('+pct(r.value)+')*');
   else if (r.value === null) row.push(r.text);
   else row.push((r.value>=100-1e-8?'Освоен':r.value===0?'Не освоен':'Частично освоен')+' ('+r.value.toFixed(1)+'%)');
   if (col.previous) row.push(elementChange(s.id,col,r));
  });
  return row;
 })];
}
function renderMatrix(){
 const events=chosen(),code=$('element').value,group=$('group').value,q=$('search').value.toLocaleLowerCase('ru'),filter=$('level').value;
 const students=data.students.filter(s=>s.group===group&&s.name.toLocaleLowerCase('ru').includes(q));
 const scoredEvents = events.filter(event=>event.tasks.length);
 const all=students.map(s=>({s,rs:scoredEvents.map(e=>elementResult(s.id,e,code))}));
 const vals=all.map(x=>x.rs.at(-1)?.value).filter(v=>typeof v==='number');const mean=avg(vals),good=vals.filter(v=>v>=data.thresholds.good).length,unclear=all.filter(x=>x.rs.at(-1)?.text==='Уточнить').length;
 $('kpis').innerHTML=[['Учеников',students.length,'В выбранном классе и поиске'],['Есть результат',vals.length,'По последнему выбранному КОМ'],['Средняя доля баллов',mean===null?'—':pct(mean),'По доступным результатам'],['Достигли порога',good,`Сводный показатель: ${data.thresholds.good}%`],['Требуют уточнения',unclear,'Спорные исходные данные']].map(a=>`<div class="kpi"><span>${a[0]}</span><strong>${a[1]}</strong><small>${a[2]}</small></div>`).join('');
 const means=scoredEvents.map((e,i)=>avg(all.map(x=>x.rs[i].value).filter(v=>v!==null)));
 const estimated=scoredEvents.map((e,i)=>all.some(x=>x.rs[i].estimated));
 $('trend').innerHTML=scoredEvents.length?scoredEvents.map((e,i)=>`<div class="barItem"><b>${means[i]===null?'Нет баллов':pct(means[i])}</b><div class="bar" style="height:${means[i]===null?2:Math.max(3,means[i]*1.05)}px"></div><span>${esc(e.id)}</span><small>${date(e.date)}${estimated[i]?' *':''}</small></div>`).join(''):'<p class="noData">Выберите мероприятия</p>';
 const dist=[[`≥ ${data.thresholds.good}% баллов`,good,''],[`${data.thresholds.partial}–<${data.thresholds.good}% баллов`,vals.filter(v=>v>=data.thresholds.partial&&v<data.thresholds.good).length,'midline'],[`< ${data.thresholds.partial}% баллов`,vals.filter(v=>v<data.thresholds.partial).length,'badline'],['Нет результата',students.length-vals.length,'neutral']];
 $('distribution').innerHTML=dist.map(([name,n,cls])=>`<div class="distRow ${cls}"><span>${name}</span><div class="track"><i style="width:${students.length?n/students.length*100:0}%"></i></div><b>${n}</b></div>`).join('');
 renderSkillPanel(students,events,code);
 renderJournalGrades(students,events);
 renderElementMatrix(students,events,code,filter);
}
function renderEvents(){
 $('eventList').innerHTML=groupEvents().map(e=>`<article class="panel eventCard"><div class="panelHead"><div><span class="eyebrow">${esc(e.id)} · ${date(e.date)}</span><h2>${esc(e.title)}</h2><p class="muted">${esc(e.form)} · ${e.gradeOnly?'Только отметки ЭЖД':e.tasks.length+' заданий · '+(e.tasks.some(t=>t.max===null)?'Максимальные баллы не указаны':e.tasks.reduce((a,t)=>a+t.max,0)+' баллов')}</p>${e.sourceNote?`<p class="muted">${esc(e.sourceNote.replace('Для работ без читаемых баллов применяются условные 0 и 1 по отметке.', 'Звёздочка отмечает результат, который требует проверки.'))}</p>`:''}</div><div class="eventTools"><button class="button" data-scores="${esc(e.id)}" ${e.gradeOnly?'disabled':''}>Внести результаты</button><button class="linkButton" data-edit="${esc(e.id)}">Изменить</button><button class="linkButton" data-copy="${esc(e.id)}">Создать похожий</button><button class="linkButton negative" data-delete="${esc(e.id)}">Удалить</button></div></div><div class="tableWrap"><table class="taskTable"><thead><tr><th>Задание</th><th>Элемент содержания</th><th>Проверяемое умение</th><th>Макс. балл</th></tr></thead><tbody>${e.tasks.map(t=>`<tr><td>${esc(t.id)}</td><td><b>${esc(t.code)}</b> · ${esc(data.catalog.find(c=>c.code===t.code)?.name)}</td><td>${esc(t.skill)}${t.roadmapLabel?'<details class="sourceLabel"><summary>Формулировка в источнике</summary>'+esc(t.roadmapLabel)+'</details>':''}${t.mappingNote?'<small class="sourceLabel">'+esc(t.mappingNote)+'</small>':''}</td><td>${t.max??'—'}</td></tr>`).join('')}</tbody></table></div></article>`).join('')||'<div class="noData">Добавьте первое мероприятие</div>';
 $('roster').value=data.students.filter(s=>s.group===$('group').value).map(s=>s.name).join('\n');
}
function render(){renderChoices();renderMatrix();renderEvents();}
function boot(){const old=$('element').value;$('element').innerHTML='<option value="__all">Все проверяемые элементы</option>'+data.catalog.map(c=>`<option value="${esc(c.code)}">${esc(c.code)} · ${esc(c.name)}</option>`).join('');$('element').value=old==='__all'||data.catalog.some(c=>c.code===old)?old:'__all';if(!$('element').value)$('element').selectedIndex=0;const currentGroup=$('group').value;const groups=[...new Set([...data.students.map(s=>s.group),...data.events.map(eventGroup)])];$('group').innerHTML=groups.map(g=>`<option>${esc(g)}</option>`).join('');$('group').value=groups.includes(currentGroup)?currentGroup:(groups[0]||'');$('good').value=data.thresholds.good;$('partial').value=data.thresholds.partial;$('catalog').innerHTML=data.catalog.map(c=>`<p class="muted"><b>${esc(c.code)}</b> — ${esc(c.name)}</p>`).join('');render();}
function addTask(t={id:String($('taskRows').children.length+1),code:'1.1.5',skill:'',max:1}){const div=document.createElement('div');div.className='taskEdit';div.innerHTML=`<label>№ задания<input class="taskId" value="${esc(t.id)}" required></label><label>Элемент<select class="taskCode">${data.catalog.map(c=>`<option value="${esc(c.code)}" ${c.code===t.code?'selected':''}>${esc(c.code)} · ${esc(c.name)}</option>`).join('')}</select></label><label>Проверяемое умение<textarea class="taskSkill" required>${esc(t.skill)}</textarea></label><label>Макс. балл<input type="number" min="0.01" step="any" class="taskMax" value="${t.max??''}"></label><button type="button" class="linkButton negative removeTask" aria-label="Удалить задание">×</button>`;$('taskRows').append(div);}
function openEditor(id,copy=false){const e=data.events.find(e=>e.id===id);editId=copy?null:id||null;$('editorTitle').textContent=e&&!copy?'Изменить мероприятие':copy?'Новое КОМ по образцу':'Новое мероприятие';$('eventId').value=e&&!copy?e.id:'';$('eventDate').value=e&&!copy?e.date:new Date().toLocaleDateString('sv-SE');$('eventFormType').innerHTML=forms.map(f=>`<option ${f===e?.form?'selected':''}>${f}</option>`).join('');$('eventTitle').value=e?.title||'';$('taskRows').innerHTML='';(e?.tasks||[{id:'1',code:'1.1.5',skill:'',max:1}]).forEach(addTask);$('editorError').textContent='';$('editor').showModal();}
function openScores(id){scoreId=id;const e=data.events.find(e=>e.id===id);$('scoreTitle').textContent=e.id+' · '+e.title;$('scoreError').textContent='';$('scoreTable').innerHTML=`<thead><tr><th>Ученик</th>${e.tasks.map(t=>`<th>№${esc(t.id)} · ${esc(t.code)}<br>Макс. ${t.max??'—'}</th>`).join('')}</tr></thead><tbody>${data.students.filter(s=>s.group===eventGroup(e)).map(s=>`<tr><td>${esc(s.name)}</td>${e.tasks.map(t=>{const r=data.results.find(r=>r.student===s.id&&r.event===id&&r.task===t.id);return `<td><div class="scoreEntry" data-sid="${esc(s.id)}" data-tid="${esc(t.id)}"><input type="number" aria-label="Балл ${esc(s.name)} задание ${esc(t.id)}" min="0" max="${t.max??''}" ${t.max===null?'disabled title="Укажите максимум в карточке работы"':''} step="any" value="${r?.score??''}"><select aria-label="Статус ${esc(s.name)} задание ${esc(t.id)}">${statuses.map(st=>`<option ${st===(r?.status||'Не оценено')?'selected':''}>${st}</option>`).join('')}</select></div></td>`;}).join('')}</tr>`).join('')}</tbody>`;$('scores').showModal();}
function openStudent(id){
 const student = data.students.find(item => item.id === id);
 $('studentTitle').textContent = student.name;
 $('studentContent').innerHTML = renderSkillHistory(id,chosen(),$('element').value) +
  '<p class="muted">* — результат требует проверки.</p>';
 $('student').showModal();
}
function download(name,text,type){const u=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
for(const name of ['events','matrix'])$('tab-'+name).onclick=()=>{for(const n of ['events','matrix']){$(n).hidden=n!==name;$('tab-'+n).setAttribute('aria-selected',String(n===name));}};
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('group').onchange=()=>{ $('search').value=''; $('level').value='all'; $('element').value='__all'; render(); };
for(const id of ['element','level'])$(id).onchange=renderMatrix;$('search').oninput=renderMatrix;
$('skillStudent').onchange=renderMatrix;
$('eventChoices').onchange=e=>{const id=e.target.dataset.event;if(id){e.target.checked?selected.add(id):selected.delete(id);renderMatrix();}};
$('selectAll').onclick=()=>{for(const e of groupEvents()) selected.add(e.id);renderChoices();renderMatrix();};$('selectNone').onclick=()=>{for(const e of groupEvents()) selected.delete(e.id);renderChoices();renderMatrix();};
$('reset').onclick=()=>{$('search').value='';$('level').value='all';$('element').value='__all';for(const e of groupEvents()) selected.add(e.id);render();};
$('heatmap').onclick=e=>{const b=e.target.closest('[data-student]');if(b)openStudent(b.dataset.student);};
$('addEvent').onclick=()=>openEditor(null);$('addTask').onclick=()=>addTask();$('taskRows').onclick=e=>{if(e.target.closest('.removeTask'))e.target.closest('.taskEdit').remove();};
$('eventForm').onsubmit=e=>{e.preventDefault();try{const id=$('eventId').value.trim(),dateValue=$('eventDate').value,title=$('eventTitle').value.trim();if(data.events.some(x=>x.id===id&&x.id!==editId))throw Error('Такой ID уже существует');const tasks=[...$('taskRows').children].map(row=>({id:row.querySelector('.taskId').value.trim(),code:row.querySelector('.taskCode').value,skill:row.querySelector('.taskSkill').value.trim(),max:row.querySelector('.taskMax').value===''?null:Number(row.querySelector('.taskMax').value)}));const previousEvent=data.events.find(item=>item.id===editId);const event={...previousEvent,group:previousEvent?eventGroup(previousEvent):$('group').value,gradeOnly:Boolean(previousEvent?.gradeOnly&&!tasks.length),id,date:dateValue,title,form:$('eventFormType').value,tasks:tasks.map(task=>({...previousEvent?.tasks.find(old=>old.id===task.id),...task}))};const next=structuredClone(data);if(editId){next.events=next.events.map(x=>x.id===editId?event:x);next.results.forEach(r=>{if(r.event===editId)r.event=id;});if(next.results.some(r=>r.event===id&&!tasks.some(t=>t.id===r.task)))throw Error('У удаляемого задания есть результаты. Сначала очистите их или создайте новый КОМ.');}else next.events.push(event);validate(next);data=next;selected.delete(editId);selected.add(id);save();render();$('editor').close();notify('Мероприятие сохранено. Внесите результаты и выберите его для сравнения.');}catch(err){$('editorError').textContent=err.message;}};
$('eventList').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.edit)openEditor(b.dataset.edit);if(b.dataset.copy)openEditor(b.dataset.copy,true);if(b.dataset.scores)openScores(b.dataset.scores);if(b.dataset.delete&&confirm('Удалить КОМ '+b.dataset.delete+' и все его результаты?')){const id=b.dataset.delete;data.events=data.events.filter(e=>e.id!==id);data.results=data.results.filter(r=>r.event!==id);selected.delete(id);save();render();}};
$('scoreTable').oninput=e=>{if(e.target.type==='number'){const box=e.target.closest('.scoreEntry');if(e.target.value!=='')box.querySelector('select').value='Результат';}};
$('scoreTable').onchange=e=>{if(e.target.tagName==='SELECT'&&e.target.value!=='Результат')e.target.closest('.scoreEntry').querySelector('input').value='';};
$('saveScores').onclick=()=>{try{const next=structuredClone(data);next.results=next.results.filter(r=>r.event!==scoreId);for(const box of $('scoreTable').querySelectorAll('.scoreEntry')){const v=box.querySelector('input').value;next.results.push({student:box.dataset.sid,event:scoreId,task:box.dataset.tid,score:v===''?null:Number(v),status:box.querySelector('select').value});}validate(next);data=next;save();render();$('scores').close();notify('Результаты сохранены. Матрица пересчитана.');}catch(err){$('scoreError').textContent=err.message;}};
$('saveThresholds').onclick=()=>{const good=Number($('good').value),partial=Number($('partial').value);if(!Number.isFinite(good)||!Number.isFinite(partial)||partial<0||good>100||partial>=good){notify('Укажите пороги: 0 ≤ частично < освоено ≤ 100.');return;}data.thresholds={good,partial};save();renderMatrix();notify('Пороги освоения обновлены.');};
$('saveRoster').onclick=()=>{const names=$('roster').value.split('\n').map(n=>n.trim()).filter(Boolean);if(!names.length||new Set(names.map(n=>n.toLowerCase())).size!==names.length){notify('Список должен содержать неповторяющиеся ФИО, каждое с новой строки.');return;}const group=$('group').value;const inGroup=data.students.filter(s=>s.group===group);const removed=inGroup.filter(s=>!names.includes(s.name));if(removed.some(s=>data.results.some(r=>r.student===s.id))&&!confirm('У удаляемых учеников есть результаты. Удалить их из этого шаблона вместе с результатами?'))return;data.students=[...data.students.filter(s=>s.group!==group),...names.map(name=>inGroup.find(s=>s.name===name)||{id:crypto.randomUUID(),name,group})];const ids=new Set(data.students.map(s=>s.id));data.results=data.results.filter(r=>ids.has(r.student));save();boot();notify('Список учеников обновлён.');};
$('export').onclick=()=>download('Матрица_КОМ_резервная_копия.json',JSON.stringify(data,null,2),'application/json');
$('csv').onclick=()=>download('Матрица_КОМ.csv','\uFEFF'+csvRows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n'),'text/csv;charset=utf-8');
$('importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const next=JSON.parse(await file.text());validate(next);if(!confirm('Заменить текущие данные данными из файла? Перед заменой можно скачать резервную копию.'))return;data=next;mergeStrata(data);mergeNovember(data);selected=new Set(data.events.map(e=>e.id));save();boot();notify('Данные загружены.');}catch(err){notify('Файл не загружен: '+err.message);}finally{e.target.value='';}};
boot();if(!storageOK)notify('Сохранённые данные не удалось прочитать. Открыт исходный пример; скачайте резервную копию после работы.');
