'use strict';
const APP_VERSION='4.7.0';
const STORAGE_KEY='turni-ferie-2026-v2';
const SUPABASE_URL='https://ztamohdnmpivcojxyvcv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_4YeUzoSUbtWq57ylQPBIqw_mvCcJsHd';
if(!window.supabase?.createClient){
  document.addEventListener('DOMContentLoaded',()=>{
    const status=document.querySelector('#loginStatus');
    if(status){status.textContent='Impossibile caricare il collegamento al database. Controlla la connessione e ricarica la pagina.';status.classList.add('error')}
  });
  throw new Error('Libreria Supabase non caricata');
}
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
  global:{headers:{'x-client-info':`turni-ferie/${APP_VERSION}`}}
});
let operatorIds=new Map(), gipPenaleIds=new Map(), gipCivileIds=new Map();
async function loadRemoteState(){
  const [opRes,gipRes,turnRes,leaveRes,noteRes,auditRes,profileRes]=await Promise.all([
    supabaseClient.from('operatori').select('id,nome,attivo,ordine').eq('attivo',true).order('ordine').order('nome'),
    supabaseClient.from('gip').select('id,nome,tipo,attivo,ordine').eq('attivo',true).order('ordine').order('nome'),
    supabaseClient.from('turni_sabato').select('id,data_turno,note,confermato,operatore:operatori(id,nome),gip_penale:gip!turni_sabato_gip_penale_id_fkey(id,nome),gip_civile:gip!turni_sabato_gip_civile_id_fkey(id,nome)').order('data_turno'),
    supabaseClient.from('ferie').select('id,data_inizio,data_fine,stato,tipologia,note,operatore:operatori(id,nome)').order('data_inizio'),
    supabaseClient.from('note_giornaliere').select('id,data_nota,testo,autore_id,created_at,updated_at').order('data_nota'),
    supabaseClient.from('registro_modifiche').select('id,tabella,operazione,record_id,eseguito_il').order('eseguito_il',{ascending:false}).limit(100),
    supabaseClient.from('profili').select('id,nome,email,ruolo,attivo').eq('id',(await supabaseClient.auth.getUser()).data.user?.id).maybeSingle()
  ]);
  for(const r of [opRes,gipRes,turnRes,leaveRes,noteRes]) if(r.error) throw r.error;
  operatorIds=new Map((opRes.data||[]).map(x=>[x.nome,x.id]));
  gipPenaleIds=new Map((gipRes.data||[]).filter(x=>x.tipo==='PENALE').map(x=>[x.nome,x.id]));
  gipCivileIds=new Map((gipRes.data||[]).filter(x=>x.tipo==='CIVILE').map(x=>[x.nome,x.id]));
  state={
    users:[],
    operators:[...operatorIds.keys()],
    gipPenale:[...gipPenaleIds.keys()],
    gipCivile:[...gipCivileIds.keys()],
    turns:(turnRes.data||[]).map(x=>({id:String(x.id),date:x.data_turno,operator:x.operatore?.nome||'',gipPenale:x.gip_penale?.nome||'',gipCivile:x.gip_civile?.nome||'',notes:x.note||''})),
    leaves:(leaveRes.data||[]).map(x=>({id:String(x.id),operator:x.operatore?.nome||'',start:x.data_inizio,end:x.data_fine,status:({richiesta:'Richiesta',approvata:'Approvata',rifiutata:'Rifiutata'})[x.stato]||x.stato,notes:x.note||''})),
    notes:(noteRes.data||[]).map(x=>({id:String(x.id),date:x.data_nota,text:x.testo||'',authorId:x.autore_id||''})),
    audit:(auditRes.data||[]).map(x=>({id:String(x.id),when:x.eseguito_il,user:'Sistema',action:`${x.operazione} · ${x.tabella}`}))
  };
  const user=(await supabaseClient.auth.getUser()).data.user;
  const pr=profileRes.data||{};
  currentUser={id:user.id,name:pr.nome||user.email.split('@')[0],email:user.email,role:pr.ruolo||'operatore',attivo:pr.attivo!==false};
}
async function getId(map,name){return name?map.get(name)||null:null}

const initialState={
  users:[{id:'u1',name:'Amministratore',email:'admin@demo.it',password:'demo123',role:'Amministratore'},{id:'u2',name:'Michele Doris',email:'michele@demo.it',password:'demo123',role:'Operatore'}],
  operators:['Michele Doris','Ivan Murelli','Piero Canteri'],
  gipPenale:['Dott. Rossi','Dott.ssa Bianchi','Dott. Verdi'],
  gipCivile:['Dott.ssa Fontana','Dott. Neri'],
  turns:[
    {id:'t1',date:'2026-07-18',operator:'Michele Doris',gipPenale:'Dott. Rossi',gipCivile:'Dott.ssa Fontana',notes:'Copertura ordinaria'},
    {id:'t2',date:'2026-07-25',operator:'Ivan Murelli',gipPenale:'Dott.ssa Bianchi',gipCivile:'Dott. Neri',notes:''},
    {id:'t3',date:'2026-08-01',operator:'Michele Doris',gipPenale:'Dott. Verdi',gipCivile:'',notes:'GIP Civile da definire'}
  ],
  leaves:[
    {id:'l1',operator:'Piero Canteri',start:'2026-07-13',end:'2026-07-24',status:'Approvata',notes:'Ferie estive'},
    {id:'l2',operator:'Michele Doris',start:'2026-08-10',end:'2026-08-16',status:'Approvata',notes:''},
    {id:'l3',operator:'Ivan Murelli',start:'2026-09-07',end:'2026-09-11',status:'Richiesta',notes:''}
  ],
  notes:[],
  audit:[{id:'a1',when:new Date().toISOString(),user:'Sistema',action:'Ambiente demo inizializzato'}]
};
let state=loadState(); let currentUser=null; let calendarMonth=6; const selectedLeaveIds=new Set();
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
function clone(v){return JSON.parse(JSON.stringify(v))}
function loadState(){try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));if(!saved)return clone(initialState);return {...clone(initialState),...saved,operators:Array.isArray(saved.operators)?saved.operators:clone(initialState.operators),gipPenale:Array.isArray(saved.gipPenale)?saved.gipPenale:clone(initialState.gipPenale),gipCivile:Array.isArray(saved.gipCivile)?saved.gipCivile:clone(initialState.gipCivile),turns:Array.isArray(saved.turns)?saved.turns:[],leaves:Array.isArray(saved.leaves)?saved.leaves:[],audit:Array.isArray(saved.audit)?saved.audit:[]}}catch{return clone(initialState)}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function uid(p){return p+Math.random().toString(36).slice(2,9)}
function fmtDate(v,opt={day:'2-digit',month:'2-digit',year:'numeric'}){return new Intl.DateTimeFormat('it-IT',opt).format(new Date(v+'T12:00:00'))}
function daysInclusive(a,b){return Math.floor((new Date(b)-new Date(a))/86400000)+1}
function between(d,a,b){return d>=a&&d<=b}
function audit(action){state.audit.unshift({id:uid('a'),when:new Date().toISOString(),user:currentUser?.name||'Sistema',action});saveState()}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function initials(name=''){return name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'U'}
function refreshProfileUi(){if(!currentUser)return;$('#currentUserLabel').textContent=`${currentUser.name} · ${currentUser.role}`;$('#profileFabInitials').textContent=initials(currentUser.name)}
function openProfile(){if(!currentUser)return;$('#profileName').value=currentUser.name||'';$('#profileEmail').value=currentUser.email||'';$('#profilePassword').value='';$('#profilePasswordConfirm').value='';$('#profileRoleLabel').textContent=currentUser.role||'Utente';$('#profileModalAvatar').textContent=initials(currentUser.name);const status=$('#profileStatus');if(status){status.textContent='';status.className='form-status'}$('#profileDialog').showModal();setTimeout(()=>$('#profileName').focus(),50)}

function getConflict(turn){return state.leaves.some(l=>l.status==='Approvata'&&l.operator===turn.operator&&between(turn.date,l.start,l.end))}
function turnStatus(t){if(getConflict(t))return 'Conflitto';if(!t.operator||(!t.gipPenale&&!t.gipCivile))return 'Da completare';return 'Assegnato'}
function badge(status){const c=status==='Assegnato'||status==='Approvata'?'green':status==='Conflitto'||status==='Rifiutata'?'red':'yellow';return `<span class="badge ${c}">${status}</span>`}
function assignmentValue(value,label='Da assegnare'){return value||`<span class="unassigned">${label}</span>`}
function operatorClass(name=''){const n=name.toLowerCase();if(n.includes('michele'))return 'op-michele';if(n.includes('ivan'))return 'op-ivan';if(n.includes('piero'))return 'op-piero';return 'op-altro'}
function operatorColor(name=''){const c=operatorClass(name);return ({'op-michele':'#5a9bd5','op-ivan':'#69b578','op-piero':'#e19a4b','op-altro':'#9aa7a8'})[c]}
function leaveCellBackground(names=[]){const unique=[...new Set(names)].slice(0,3);if(!unique.length)return '';if(unique.length===1)return operatorColor(unique[0]);if(unique.length===2)return `linear-gradient(90deg,${operatorColor(unique[0])} 0 50%,${operatorColor(unique[1])} 50% 100%)`;return `linear-gradient(90deg,${operatorColor(unique[0])} 0 33.333%,${operatorColor(unique[1])} 33.333% 66.666%,${operatorColor(unique[2])} 66.666% 100%)`}
function operatorNameHtml(name){return name?`<span class="operator-name ${operatorClass(name)}"><i></i>${name}</span>`:'<span class="unassigned">Da assegnare</span>'}
function optionList(items,selected='',placeholder='Nessuno'){return `<option value="">${placeholder}</option>`+items.map(x=>`<option ${x===selected?'selected':''}>${x}</option>`).join('')}
function renderAll(){renderDashboard();renderUpcoming();renderTurns();renderLeaves();renderLeaveVisuals();renderPeople();renderAudit();renderCalendar();fillSelects();fillLeaveEntrySelect();renderLeaveEntryPreview()}
function renderDashboard(){
 const conflicts=state.turns.filter(getConflict).length;
 const today=new Date().toISOString().slice(0,10);
 const updateOperatorKpi=(name,totalId,doneId,futureId)=>{
   const assigned=state.turns.filter(t=>t.operator===name&&t.date>='2026-01-01'&&t.date<='2026-12-31');
   const done=assigned.filter(t=>t.date<today).length;
   const future=assigned.filter(t=>t.date>=today).length;
   $(totalId).textContent=assigned.length;
   $(doneId).textContent=done;
   $(futureId).textContent=future;
 };
 updateOperatorKpi('Ivan Murelli','#kpiIvanTotal','#kpiIvanDone','#kpiIvanFuture');
 updateOperatorKpi('Michele Doris','#kpiMicheleTotal','#kpiMicheleDone','#kpiMicheleFuture');
 updateOperatorKpi('Piero Canteri','#kpiPieroTotal','#kpiPieroDone','#kpiPieroFuture');
 $('#kpiConflicts').textContent=conflicts;
 $('#alerts').innerHTML=conflicts?`<div class="alert red">Attenzione: sono presenti ${conflicts} conflitti tra turni e ferie approvate.</div>`:`<div class="alert green">Nessun conflitto rilevato tra turni e ferie approvate.</div>`;
 const next=state.turns.filter(t=>t.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0];
 $('#nextSaturdayCard').innerHTML=next?`<div class="next-date">${fmtDate(next.date,{weekday:'long',day:'2-digit',month:'long'})}</div><div class="assignment-grid"><div class="assignment"><span>Operatore</span><strong>${operatorNameHtml(next.operator)}</strong></div><div class="assignment"><span>GIP Penale</span><strong>${assignmentValue(next.gipPenale)}</strong></div><div class="assignment"><span>GIP Civile</span><strong>${assignmentValue(next.gipCivile)}</strong></div></div>${next.notes?`<p class="muted">${next.notes}</p>`:''}`:'<p>Nessun turno futuro inserito.</p>';
 const counts=state.operators.map(o=>({name:o,value:state.turns.filter(t=>t.operator===o).length})); renderBars('#operatorBars',counts);
 const leaveCounts=state.operators.map(o=>({name:o,value:state.leaves.filter(l=>l.operator===o&&l.status!=='Rifiutata').reduce((s,l)=>s+daysInclusive(l.start,l.end),0)}));renderBars('#leaveBars',leaveCounts);
 $('#dashboardUpcoming').innerHTML=upcomingCardsHtml(getUpcomingTurns(4));
 $('#dashboardLeaves').innerHTML=leaveCardsHtml(getUpcomingLeaves(4));
 $('#recentAudit').innerHTML=timelineHtml(state.audit.slice(0,5));
}

function getUpcomingTurns(limit=8){
 const today=new Date().toISOString().slice(0,10);
 return state.turns.filter(t=>t.date>=today).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,limit===99?undefined:limit);
}
function upcomingClass(t){return getConflict(t)?'conflict':turnStatus(t)==='Da completare'?'incomplete':''}
function upcomingCardsHtml(items){return items.map(t=>`<article class="upcoming-card ${upcomingClass(t)}"><div class="upcoming-date">${fmtDate(t.date,{weekday:'long',day:'2-digit',month:'long'})}</div><dl><div><dt>Operatore</dt><dd>${operatorNameHtml(t.operator)}</dd></div><div><dt>GIP Penale</dt><dd>${assignmentValue(t.gipPenale)}</dd></div><div><dt>GIP Civile</dt><dd>${assignmentValue(t.gipCivile)}</dd></div></dl><div style="margin-top:12px">${badge(turnStatus(t))}</div></article>`).join('')||'<p class="muted">Non ci sono turni futuri inseriti.</p>'}
function getUpcomingLeaves(limit=4){
 const today=new Date().toISOString().slice(0,10);
 return state.leaves.filter(l=>l.status!=='Rifiutata'&&l.end>=today).sort((a,b)=>a.start.localeCompare(b.start)).slice(0,limit);
}
function leaveHasConflict(l){return state.turns.some(t=>t.operator===l.operator&&between(t.date,l.start,l.end))}
function leaveTiming(l){const today=new Date().toISOString().slice(0,10);if(between(today,l.start,l.end))return 'In corso';if(l.start>today)return 'Programmata';return 'Conclusa'}
function leaveCardsHtml(items){return items.map(l=>`<article class="leave-card ${operatorClass(l.operator)} ${leaveHasConflict(l)?'has-conflict':''}"><div class="leave-card-head"><div><span class="leave-person operator-name ${operatorClass(l.operator)}"><i></i>${l.operator}</span><strong>${fmtDate(l.start,{day:'2-digit',month:'short'})} → ${fmtDate(l.end,{day:'2-digit',month:'short',year:'numeric'})}</strong></div>${badge(l.status)}</div><div class="leave-card-meta"><span>${daysInclusive(l.start,l.end)} giorni</span><span>${leaveTiming(l)}</span>${leaveHasConflict(l)?'<span class="conflict-text">Conflitto con turno</span>':''}</div>${l.notes?`<p>${l.notes}</p>`:''}</article>`).join('')||'<p class="muted">Non ci sono ferie future inserite.</p>'}
function renderUpcoming(){
 const limit=Number($('#upcomingCount')?.value||8);
 const items=getUpcomingTurns(limit);
 $('#upcomingList').innerHTML=items.map(t=>`<div class="upcoming-row ${upcomingClass(t)}"><div class="upcoming-cell"><span>Sabato</span><strong>${fmtDate(t.date,{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</strong></div><div class="upcoming-cell"><span>Operatore</span><strong>${operatorNameHtml(t.operator)}</strong></div><div class="upcoming-cell"><span>GIP Penale</span><strong>${assignmentValue(t.gipPenale)}</strong></div><div class="upcoming-cell civil-cell"><span>GIP Civile</span><strong>${assignmentValue(t.gipCivile)}</strong></div><div class="upcoming-cell status-cell">${badge(turnStatus(t))}</div></div>`).join('')||'<p class="muted">Non ci sono turni futuri inseriti.</p>';
}

function renderBars(sel,data){const max=Math.max(...data.map(x=>x.value),1);$(sel).innerHTML=data.map(x=>`<div class="bar-row ${operatorClass(x.name)}"><span class="operator-name ${operatorClass(x.name)}"><i></i>${x.name.split(' ')[0]}</span><div class="bar-track"><div class="bar-fill" style="width:${x.value/max*100}%"></div></div><strong>${x.value}</strong></div>`).join('')}
function renderTurns(){const q=$('#turnSearch')?.value?.toLowerCase()||'';const type=$('#turnTypeFilter')?.value||'';const status=$('#turnStatusFilter')?.value||'';const rows=state.turns.filter(t=>[t.operator,t.gipPenale,t.gipCivile].join(' ').toLowerCase().includes(q)).filter(t=>!type||(type==='Penale'?t.gipPenale:t.gipCivile)).filter(t=>!status||turnStatus(t)===status).sort((a,b)=>a.date.localeCompare(b.date));$('#turnsBody').innerHTML=rows.map(t=>`<tr><td><strong>${fmtDate(t.date)}</strong></td><td>${t.operator?operatorNameHtml(t.operator):'—'}</td><td>${t.gipPenale||'—'}</td><td>${t.gipCivile||'—'}</td><td>${badge(turnStatus(t))}</td><td>${t.notes||''}</td><td><div class="row-actions"><button class="btn ghost edit-turn" data-id="${t.id}">Modifica</button><button class="btn ghost delete-turn" data-id="${t.id}">Elimina</button></div></td></tr>`).join('')||'<tr><td colspan="7">Nessun turno trovato.</td></tr>'}
function renderLeaves(){
 const today=new Date().toISOString().slice(0,10);
 const q=$('#leaveSearch')?.value?.toLowerCase()||'';
 const operator=$('#leaveOperatorFilter')?.value||'';
 const status=$('#leaveStatusFilter')?.value||'';
 const timing=$('#leaveTimeFilter')?.value||'future';
 const rows=state.leaves.filter(l=>[l.operator,l.notes].join(' ').toLowerCase().includes(q)).filter(l=>!operator||l.operator===operator).filter(l=>!status||l.status===status).filter(l=>timing==='all'||(timing==='current'&&between(today,l.start,l.end))||(timing==='future'&&l.end>=today)||(timing==='past'&&l.end<today)).sort((a,b)=>a.start.localeCompare(b.start));
 $('#leavePeriodsKpi').textContent=state.leaves.length;
 $('#leaveDaysKpi').textContent=state.leaves.filter(l=>l.status==='Approvata').reduce((n,l)=>n+daysInclusive(l.start,l.end),0);
 $('#leaveTodayKpi').textContent=state.leaves.filter(l=>l.status==='Approvata'&&between(today,l.start,l.end)).length;
 $('#leaveConflictsKpi').textContent=state.leaves.filter(leaveHasConflict).length;
 $('#leaveOverview').innerHTML=rows.map(l=>`<article class="leave-wide-row ${operatorClass(l.operator)} ${leaveHasConflict(l)?'has-conflict':''} ${selectedLeaveIds.has(l.id)?'is-selected':''}"><label class="leave-select" title="Seleziona questo periodo per la richiesta email"><input class="leave-request-check" type="checkbox" data-id="${l.id}" ${selectedLeaveIds.has(l.id)?'checked':''}><span></span></label><div class="leave-avatar ${operatorClass(l.operator)}">${l.operator.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div class="leave-main"><span>Operatore</span><strong class="operator-name ${operatorClass(l.operator)}"><i></i>${l.operator}</strong>${l.notes?`<small>${l.notes}</small>`:''}</div><div><span>Periodo</span><strong>${fmtDate(l.start,{day:'2-digit',month:'long'})} – ${fmtDate(l.end,{day:'2-digit',month:'long',year:'numeric'})}</strong></div><div><span>Durata</span><strong>${daysInclusive(l.start,l.end)} ${daysInclusive(l.start,l.end)===1?'giorno':'giorni'}</strong></div><div><span>Situazione</span><strong>${leaveTiming(l)}</strong>${leaveHasConflict(l)?'<small class="conflict-text">Turno durante le ferie</small>':''}</div><div>${badge(l.status)}</div><div class="row-actions"><button class="btn ghost edit-leave" data-id="${l.id}">Modifica</button><button class="btn ghost delete-leave" data-id="${l.id}">Elimina</button></div></article>`).join('')||'<p class="muted">Nessun periodo di ferie corrisponde ai filtri.</p>';
 $('#leaveBody').innerHTML=rows.map(l=>`<tr class="${selectedLeaveIds.has(l.id)?'is-selected':''}"><td><input class="leave-request-check" type="checkbox" data-id="${l.id}" aria-label="Seleziona periodo" ${selectedLeaveIds.has(l.id)?'checked':''}></td><td>${l.operator}</td><td>${fmtDate(l.start)}</td><td>${fmtDate(l.end)}</td><td>${daysInclusive(l.start,l.end)}</td><td>${badge(l.status)}</td><td>${l.notes||''}</td><td><div class="row-actions"><button class="btn ghost edit-leave" data-id="${l.id}">Modifica</button><button class="btn ghost delete-leave" data-id="${l.id}">Elimina</button></div></td></tr>`).join('')||'<tr><td colspan="8">Nessuna ferie trovata.</td></tr>';
 updateLeaveRequestToolbar();
}
function visualLeaves(){
 const operator=$('#leaveVisualOperator')?.value||'';
 return state.leaves.filter(l=>l.status!=='Rifiutata'&&(!operator||l.operator===operator));
}
function leaveDayInfo(iso,leaves){
 const absent=leaves.filter(l=>between(iso,l.start,l.end));
 const conflicts=state.turns.filter(t=>t.date===iso&&absent.some(l=>l.operator===t.operator));
 return {absent,conflicts};
}

function updateLeaveRequestToolbar(){
  const n=selectedLeaveIds.size;
  const count=$('#selectedLeavesCount');
  const btn=$('#generateLeaveRequestBtn');
  const clear=$('#clearLeaveSelectionBtn');
  if(count) count.textContent=n===1?'1 periodo selezionato':`${n} periodi selezionati`;
  if(btn) btn.disabled=n===0;
  if(clear) clear.hidden=n===0;
}
function selectedLeaves(){
  return state.leaves.filter(l=>selectedLeaveIds.has(l.id)).sort((a,b)=>a.start.localeCompare(b.start));
}
function italianLongDate(v){return fmtDate(v,{day:'numeric',month:'long',year:'numeric'})}
function buildLeaveRequest(){
  const periods=selectedLeaves();
  if(!periods.length) return null;
  const ownerNames=[...new Set(periods.map(x=>x.operator))];
  const signer=currentUser?.name||ownerNames[0]||'';
  const lines=periods.map(l=>{
    const days=daysInclusive(l.start,l.end);
    if(l.start===l.end) return `- il giorno ${italianLongDate(l.start)} (${days} giorno);`;
    return `- dal ${italianLongDate(l.start)} al ${italianLongDate(l.end)} (${days} giorni);`;
  });
  lines[lines.length-1]=lines[lines.length-1].replace(/;$/,'.');
  const intro=periods.length===1?'del seguente periodo di ferie:':'dei seguenti periodi di ferie:';
  const text=`Buongiorno,\n\ncon la presente chiedo di poter usufruire ${intro}\n\n${lines.join('\n')}\n\nResto in attesa di cortese conferma.\n\nCordiali saluti\n${signer}`;
  const years=[...new Set(periods.map(l=>l.start.slice(0,4)))];
  const subject=`Richiesta ferie${years.length===1?' – '+years[0]:''} – ${signer}`;
  return {subject,text};
}
function openLeaveRequestDialog(){
  const built=buildLeaveRequest();
  if(!built) return toast('Seleziona almeno un periodo di ferie');
  $('#leaveRequestRecipient').value=localStorage.getItem('leave-request-recipient')||'';
  $('#leaveRequestSubject').value=built.subject;
  $('#leaveRequestText').value=built.text;
  $('#leaveRequestStatus').textContent='';
  $('#leaveRequestStatus').className='form-status';
  $('#leaveRequestDialog').showModal();
}
async function copyLeaveRequest(){
  const subject=$('#leaveRequestSubject').value.trim();
  const text=$('#leaveRequestText').value.trim();
  try{await navigator.clipboard.writeText(`Oggetto: ${subject}\n\n${text}`);toast('Testo copiato negli appunti')}
  catch{ $('#leaveRequestText').select(); document.execCommand('copy'); toast('Testo copiato') }
}
function openLeaveRequestEmail(){
  const recipient=$('#leaveRequestRecipient').value.trim();
  const subject=$('#leaveRequestSubject').value.trim();
  const text=$('#leaveRequestText').value.trim();
  if(recipient) localStorage.setItem('leave-request-recipient',recipient);
  const href=`mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  window.location.href=href;
}

function renderLeaveVisuals(){
 const histogram=$('#leaveHistogram'),calendar=$('#leaveAnnualCalendar'),filter=$('#leaveVisualOperator'),daily=$('#leaveDailyHistogram'),detailMonth=$('#leaveDetailMonth');
 if(!histogram||!calendar||!filter||!daily||!detailMonth)return;
 const current=filter.value;
 filter.innerHTML='<option value="">Tutti gli operatori</option>'+state.operators.map(x=>`<option ${x===current?'selected':''}>${x}</option>`).join('');
 const leaves=visualLeaves();
 const monthTotals=Array.from({length:12},(_,month)=>{
   let total=0;
   const end=new Date(2026,month+1,0).getDate();
   for(let day=1;day<=end;day++){
     const iso=`2026-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
     total+=leaveDayInfo(iso,leaves).absent.length;
   }
   return total;
 });
 const maxValue=Math.max(1,...monthTotals);
 const tickStep=maxValue<=12?1:Math.ceil(maxValue/8);
 const chartMax=Math.max(1,Math.ceil(maxValue/tickStep)*tickStep);
 const ticks=[];
 for(let v=chartMax;v>=0;v-=tickStep)ticks.push(v);
 const monthDetails=months.map((_,month)=>{
   const byOperator={};
   const daysInMonth=new Date(2026,month+1,0).getDate();
   for(let day=1;day<=daysInMonth;day++){
     const iso=`2026-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
     leaveDayInfo(iso,leaves).absent.forEach(l=>{byOperator[l.operator]=(byOperator[l.operator]||0)+1});
   }
   return byOperator;
 });
 histogram.innerHTML=`
   <div class="histogram-axis-title">Giorni di ferie per mese</div>
   <div class="histogram-y-axis">${ticks.map(v=>`<span style="top:${(chartMax-v)/chartMax*100}%">${v}</span>`).join('')}</div>
   <div class="histogram-plot">
     <div class="histogram-grid">${ticks.map(v=>`<i style="top:${(chartMax-v)/chartMax*100}%"></i>`).join('')}</div>
     <div class="histogram-bars">${months.map((m,i)=>{
       const total=monthTotals[i];
       const height=total?Math.max(4,total/chartMax*100):0;
       const detail=Object.entries(monthDetails[i]).sort((a,b)=>b[1]-a[1]).map(([name,value])=>`${name}: ${value} ${value===1?'giorno':'giorni'}`).join(' · ');
       const tooltip=`${m}: ${total} ${total===1?'giorno':'giorni'}${detail?' — '+detail:''}`;
       const segments=Object.entries(monthDetails[i]).filter(([,value])=>value>0).map(([name,value])=>`<span class="histogram-segment ${operatorClass(name)}" style="height:${value/chartMax*100}%" title="${name}: ${value} ${value===1?'giorno':'giorni'}"></span>`).join('');
       return `<div class="histogram-col" tabindex="0" title="${tooltip.replace(/"/g,'&quot;')}" aria-label="${tooltip.replace(/"/g,'&quot;')}"><div class="histogram-value">${total||''}</div><div class="histogram-track"><div class="histogram-stack" style="height:${height}%">${segments}</div></div><div class="histogram-label">${m.slice(0,3)}</div></div>`;
     }).join('')}</div>
   </div>`;

 const selectedMonth=Math.max(0,Math.min(11,Number(detailMonth.value||6)));
 detailMonth.innerHTML=months.map((m,i)=>`<option value="${i}" ${i===selectedMonth?'selected':''}>${m} 2026</option>`).join('');
 const daysInSelectedMonth=new Date(2026,selectedMonth+1,0).getDate();
 const dailyValues=[];
 for(let day=1;day<=daysInSelectedMonth;day++){
   const iso=`2026-${String(selectedMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
   const info=leaveDayInfo(iso,leaves);
   const turn=state.turns.find(t=>t.date===iso);
   const byOperator={};
   info.absent.forEach(l=>{byOperator[l.operator]=(byOperator[l.operator]||0)+1});
   dailyValues.push({day,total:info.absent.length,byOperator,turn,conflict:info.conflicts.length>0});
 }
 const dailyMax=Math.max(1,...dailyValues.map(x=>x.total));
 const dailyTicks=[];
 for(let v=dailyMax;v>=0;v--)dailyTicks.push(v);
 daily.innerHTML=`
   <div class="daily-axis-title">Persone assenti per giorno · ${months[selectedMonth]} 2026</div>
   <div class="daily-y-axis">${dailyTicks.map(v=>`<span style="top:${(dailyMax-v)/dailyMax*100}%">${v}</span>`).join('')}</div>
   <div class="daily-plot">
     <div class="daily-grid">${dailyTicks.map(v=>`<i style="top:${(dailyMax-v)/dailyMax*100}%"></i>`).join('')}</div>
     <div class="daily-bars">${dailyValues.map(item=>{
       const height=item.total?Math.max(8,item.total/dailyMax*100):2;
       const detail=Object.entries(item.byOperator).map(([name,value])=>`${name}: ${value}`).join(' · ');
       const turnText=item.turn?`Turno del sabato: ${item.turn.operator||'da assegnare'}${item.turn.gipPenale?` · GIP Penale: ${item.turn.gipPenale}`:''}${item.turn.gipCivile?` · GIP Civile: ${item.turn.gipCivile}`:''}`:'';
       const tooltip=`${item.day} ${months[selectedMonth]} 2026 — ${item.total} ${item.total===1?'persona assente':'persone assenti'}${detail?` — ${detail}`:''}${turnText?` — ${turnText}`:''}${item.conflict?' — Conflitto ferie/turno':''}`;
       const segments=Object.entries(item.byOperator).map(([name,value])=>`<span class="histogram-segment ${operatorClass(name)}" style="height:${value/dailyMax*100}%"></span>`).join('');
       const saturdayClass=item.turn?' has-saturday':'';
       const conflictClass=item.conflict?' has-conflict':'';
       return `<div class="daily-col${saturdayClass}${conflictClass}" tabindex="0" title="${tooltip.replace(/"/g,'&quot;')}" aria-label="${tooltip.replace(/"/g,'&quot;')}"><div class="daily-value">${item.total||''}</div><div class="daily-track"><div class="histogram-stack" style="height:${height}%">${segments||'<span class="daily-empty-bar"></span>'}</div></div><div class="daily-label">${item.day}</div>${item.turn?'<span class="daily-saturday-marker">S</span>':''}</div>`;
     }).join('')}</div>
   </div>`;

 calendar.innerHTML=months.map((monthName,month)=>{
   const first=new Date(2026,month,1),days=new Date(2026,month+1,0).getDate(),offset=(first.getDay()+6)%7;
   let cells=['L','M','M','G','V','S','D'].map(d=>`<span class="annual-weekday">${d}</span>`).join('');
   cells+='<span class="annual-empty"></span>'.repeat(offset);
   for(let day=1;day<=days;day++){
     const iso=`2026-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
     const info=leaveDayInfo(iso,leaves);
     const count=info.absent.length;
     const turn=state.turns.find(t=>t.date===iso);
     const absentNames=info.absent.map(l=>l.operator);
     const cls=[info.conflicts.length?'conflict':'',count>=3?'many':count===2?'two':count===1?'one':'',turn?'has-saturday':'',turn&&count?'mixed':''].filter(Boolean).join(' ');
     const dayNote=state.notes?.find(n=>n.date===iso);
     const details={date:`${day} ${monthName} 2026`,absent:absentNames,conflict:info.conflicts.length>0,operator:turn?.operator||'',gipPenale:turn?.gipPenale||'',gipCivile:turn?.gipCivile||'',note:dayNote?.text||''};
     const dots=[...new Set(absentNames)].map(name=>`<i class="operator-dot ${operatorClass(name)}"></i>`).join('');
     const cellBackground=leaveCellBackground(absentNames);
     cells+=`<span class="annual-day ${cls}${count?' has-operator-color':''}" data-iso="${iso}" data-details="${encodeURIComponent(JSON.stringify(details))}" style="${cellBackground?`background:${cellBackground}`:''}" tabindex="0" aria-label="Dettagli ${day} ${monthName}"><b>${day}</b>${turn?'<u class="annual-saturday-flag"></u>':''}${dayNote?'<u class="annual-note-flag" title="Nota presente"></u>':''}${dots?`<em class="annual-operator-dots">${dots}</em>`:''}${count?`<small>${count}</small>`:''}</span>`;
   }
   return `<article class="annual-month"><h4>${monthName}</h4><div class="annual-month-grid">${cells}</div></article>`;
 }).join('');
 setupAnnualDayTooltips();
}

let selectedCalendarDate='';
function addDaysIso(iso,days){
 const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);
}
function openDayAction(iso){
 selectedCalendarDate=iso;
 const d=new Date(iso+'T12:00:00');
 const isSaturday=d.getDay()===6;
 const turn=state.turns.find(t=>t.date===iso);
 const absent=state.leaves.filter(l=>l.status!=='Rifiutata'&&between(iso,l.start,l.end));
 $('#dayActionTitle').textContent=fmtDate(iso,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 const ferie=absent.length?`${absent.length} ${absent.length===1?'periodo presente':'periodi presenti'}`:'nessuna ferie inserita';
 const turno=turn?`turno di ${turn.operator||'operatore da assegnare'}`:'nessun turno inserito';
 $('#dayActionSummary').textContent=`Ferie: ${ferie}${isSaturday?' · '+turno:''}`;
 $('#dayTurnSection').hidden=!isSaturday;
 const turnBtn=$('#dayManageTurnBtn');
 turnBtn.textContent=turn?'Modifica turno del sabato':'Inserisci turno del sabato';
 const deleteTurnBtn=$('#dayDeleteTurnBtn');
 deleteTurnBtn.hidden=!turn;
 $('#dayTurnDetails').innerHTML=isSaturday?(turn?`<div class="day-existing-item"><div><strong>${operatorNameHtml(turn.operator)}</strong><small>GIP Penale: ${turn.gipPenale||'da assegnare'}${turn.gipCivile?` · GIP Civile: ${turn.gipCivile}`:''}</small></div></div>`:'<p class="muted">Nessun turno presente per questo sabato.</p>'):'';
 $('#dayLeaveActions').innerHTML=absent.length?absent.map(l=>`<div class="day-existing-item ${operatorClass(l.operator)}"><div><strong>${operatorNameHtml(l.operator)}</strong><small>${fmtDate(l.start)} – ${fmtDate(l.end)} · ${l.status}</small></div><div class="row-actions"><button class="btn ghost small day-edit-leave" type="button" data-id="${l.id}">Modifica</button><button class="btn danger small day-remove-leave" type="button" data-id="${l.id}">Togli da questo giorno</button></div></div>`).join(''):'<p class="muted">Nessuna ferie presente in questa data.</p>';
 const note=state.notes?.find(n=>n.date===iso);
 $('#dayNoteText').value=note?.text||'';
 $('#dayDeleteNoteBtn').hidden=!note;
 $('#dayActionDialog').showModal();
}
function openLeaveForSelectedDay(){
 $('#dayActionDialog').close();
 openLeave();
 $('#leaveStart').value=selectedCalendarDate;
 $('#leaveEnd').value=selectedCalendarDate;
 if(currentUser?.name&&state.operators.includes(currentUser.name))$('#leaveOperator').value=currentUser.name;
}
function openTurnForSelectedDay(){
 const existing=state.turns.find(t=>t.date===selectedCalendarDate);
 $('#dayActionDialog').close();
 if(existing)openTurn(existing.id);else{openTurn();$('#turnDate').value=selectedCalendarDate}
}
async function deleteTurnForSelectedDay(){
 const turn=state.turns.find(t=>t.date===selectedCalendarDate);
 if(!turn)return;
 if(!confirm(`Eliminare il turno di sabato ${fmtDate(selectedCalendarDate)}?`))return;
 const {error}=await supabaseClient.from('turni_sabato').delete().eq('id',turn.id);
 if(error)return toast(`Errore: ${error.message}`);
 await loadRemoteState();renderAll();openDayAction(selectedCalendarDate);toast('Turno del sabato eliminato');
}
async function removeLeaveFromSelectedDay(id){
 const l=state.leaves.find(x=>x.id===id);
 if(!l)return;
 const label=l.start===l.end?`Eliminare le ferie di ${l.operator} del ${fmtDate(l.start)}?`:`Togliere ${fmtDate(selectedCalendarDate)} dal periodo ferie di ${l.operator}?`;
 if(!confirm(label))return;
 let error=null;
 if(l.start===l.end){
   ({error}=await supabaseClient.from('ferie').delete().eq('id',l.id));
 }else if(selectedCalendarDate===l.start){
   ({error}=await supabaseClient.from('ferie').update({data_inizio:addDaysIso(l.start,1),updated_by:currentUser.id}).eq('id',l.id));
 }else if(selectedCalendarDate===l.end){
   ({error}=await supabaseClient.from('ferie').update({data_fine:addDaysIso(l.end,-1),updated_by:currentUser.id}).eq('id',l.id));
 }else{
   const oldEnd=l.end;
   const first=await supabaseClient.from('ferie').update({data_fine:addDaysIso(selectedCalendarDate,-1),updated_by:currentUser.id}).eq('id',l.id);
   if(first.error)error=first.error;
   else{
     const second=await supabaseClient.from('ferie').insert({operatore_id:operatorIds.get(l.operator),data_inizio:addDaysIso(selectedCalendarDate,1),data_fine:oldEnd,stato:({Richiesta:'richiesta',Approvata:'approvata',Rifiutata:'rifiutata'})[l.status]||'approvata',tipologia:'Ferie',note:l.notes||null,created_by:currentUser.id,updated_by:currentUser.id});
     error=second.error;
   }
 }
 if(error)return toast(`Errore: ${error.message}`);
 await loadRemoteState();renderAll();openDayAction(selectedCalendarDate);toast('Ferie aggiornate');
}
function renderPeople(){renderPeopleList('#operatorsList',state.operators,'operator');renderPeopleList('#criminalList',state.gipPenale,'gipPenale');renderPeopleList('#civilList',state.gipCivile,'gipCivile')}
function renderPeopleList(sel,items,type){$(sel).innerHTML=items.map((x,i)=>`<div class="person-row"><span>${x}</span><button class="icon-btn delete-person" data-type="${type}" data-index="${i}">×</button></div>`).join('')}
function timelineHtml(items){return items.map(a=>`<div class="timeline-item"><strong>${a.action}</strong><small>${a.user} · ${new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short'}).format(new Date(a.when))}</small></div>`).join('')||'<p class="muted">Nessuna modifica registrata.</p>'}
function renderAudit(){$('#auditList').innerHTML=timelineHtml(state.audit)}

function setupAnnualDayTooltips(){
 const tooltip=$('#calendarTooltip');if(!tooltip)return;
 const show=(el,e)=>{
   let details;try{details=JSON.parse(decodeURIComponent(el.dataset.details||''))}catch{return}
   const ferie=details.absent?.length?`<div><strong>In ferie</strong>${details.absent.map(n=>`<span>${n}</span>`).join('')}</div>`:'<div><strong>Ferie</strong><span>Nessuna persona assente</span></div>';
   const turno=(details.operator||details.gipPenale||details.gipCivile)?`<div class="tooltip-turn"><strong>Sabato/Turno</strong><span>Operatore: ${details.operator||'da assegnare'}</span><span>GIP Penale: ${details.gipPenale||'da assegnare'}</span>${details.gipCivile?`<span>GIP Civile: ${details.gipCivile}</span>`:''}</div>`:'';
   const note=details.note?`<div class="tooltip-note"><strong>Nota</strong><span>${details.note}</span></div>`:'';
   const conflict=details.conflict?'<div class="tooltip-conflict">⚠ Conflitto tra turno e ferie</div>':'';
   tooltip.innerHTML=`<b class="tooltip-date">${details.date}</b>${ferie}${turno}${note}${conflict}`;
   tooltip.classList.add('show');positionCalendarTooltip(e,el,tooltip);
 };
 const hide=()=>tooltip.classList.remove('show');
 $$('.annual-day[data-details]').forEach(el=>{
   el.addEventListener('mouseenter',e=>show(el,e));
   el.addEventListener('mousemove',e=>positionCalendarTooltip(e,el,tooltip));
   el.addEventListener('mouseleave',hide);
   el.addEventListener('focus',e=>show(el,e));
   el.addEventListener('blur',hide);
   el.addEventListener('click',e=>{e.preventDefault();hide();openDayAction(el.dataset.iso)});
 });
}
function positionCalendarTooltip(e,el,tooltip){
 const pad=14,rect=el.getBoundingClientRect();let x=(e?.clientX||rect.left+rect.width/2)+14;let y=(e?.clientY||rect.top)-12;
 const w=tooltip.offsetWidth||230,h=tooltip.offsetHeight||120;
 if(x+w>window.innerWidth-pad)x=Math.max(pad,(e?.clientX||rect.left)-w-14);
 if(y+h>window.innerHeight-pad)y=Math.max(pad,window.innerHeight-h-pad);
 if(y<pad)y=pad;
 tooltip.style.left=`${x}px`;tooltip.style.top=`${y}px`;
}

function renderCalendar(){const year=2026,month=calendarMonth;$('#monthSelect').value=String(month);const first=new Date(year,month,1),last=new Date(year,month+1,0);const start=(first.getDay()+6)%7;let html=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(x=>`<div class="calendar-cell calendar-head">${x}</div>`).join('');for(let i=0;i<42;i++){const day=i-start+1;const d=new Date(year,month,day);const inMonth=day>=1&&day<=last.getDate();const iso=d.toISOString().slice(0,10);const turn=state.turns.find(t=>t.date===iso);const leaves=state.leaves.filter(l=>l.status!=='Rifiutata'&&between(iso,l.start,l.end));let pills='';if(turn){pills+=`<div class="event-pill ${getConflict(turn)?'conflict':'turn'}">${turn.operator||'<span class="unassigned">Turno da assegnare</span>'}</div>`;if(turn.gipPenale)pills+=`<div class="event-pill turn">P: ${turn.gipPenale}</div>`;if(turn.gipCivile)pills+=`<div class="event-pill civil">C: ${turn.gipCivile}</div>`}leaves.forEach(l=>pills+=`<div class="event-pill leave ${operatorClass(l.operator)}"><i></i>Ferie: ${l.operator.split(' ')[0]}</div>`);html+=`<div class="calendar-cell ${inMonth?'':'muted-day'}"><div class="day-number">${d.getDate()}</div>${pills}</div>`}$('#calendarGrid').innerHTML=html}
function fillSelects(){$('#turnOperator').innerHTML=optionList(state.operators,'','Seleziona operatore');$('#turnCriminal').innerHTML=optionList(state.gipPenale);$('#turnCivil').innerHTML=optionList(state.gipCivile);$('#leaveOperator').innerHTML=optionList(state.operators,'','Seleziona operatore');const f=$('#leaveOperatorFilter');if(f){const current=f.value;f.innerHTML='<option value="">Tutti gli operatori</option>'+state.operators.map(x=>`<option ${x===current?'selected':''}>${x}</option>`).join('')}}
function fillLeaveEntrySelect(){
 const el=$('#leaveEntryOperator');if(!el)return;
 const current=el.value;
 el.innerHTML=optionList(state.operators,current,'Seleziona operatore');
 if(!current&&currentUser?.name&&state.operators.includes(currentUser.name))el.value=currentUser.name;
}
function renderLeaveEntryPreview(){
 const box=$('#leaveEntryPreview');if(!box)return;
 const start=$('#leaveEntryStart')?.value,end=$('#leaveEntryEnd')?.value,operator=$('#leaveEntryOperator')?.value;
 if(!start||!end||end<start){box.innerHTML='<p class="muted">Seleziona un periodo valido per visualizzare il riepilogo.</p>';return}
 const days=daysInclusive(start,end);
 const sabati=state.turns.filter(t=>between(t.date,start,end));
 const conflicts=sabati.filter(t=>t.operator===operator);
 box.innerHTML=`<div class="entry-summary-grid"><div><span>Durata</span><strong>${days} ${days===1?'giorno':'giorni'}</strong></div><div><span>Sabati compresi</span><strong>${sabati.length}</strong></div><div><span>Conflitti potenziali</span><strong class="${conflicts.length?'danger-text':''}">${conflicts.length}</strong></div></div>${sabati.length?`<div class="entry-saturdays">${sabati.map(t=>`<div><strong>${fmtDate(t.date,{weekday:'long',day:'numeric',month:'long'})}</strong><span>${t.operator||'Operatore da assegnare'} · GIP Penale: ${t.gipPenale||'da assegnare'}</span></div>`).join('')}</div>`:'<p class="muted">Nel periodo non risultano turni del sabato inseriti.</p>'}`;
}
function resetLeaveEntry(){
 ['leaveEntryStart','leaveEntryEnd','leaveEntryNotes'].forEach(id=>{const el=$('#'+id);if(el)el.value=''});
 $('#leaveEntryStatus').value='Richiesta';
 fillLeaveEntrySelect();renderLeaveEntryPreview();
}
async function saveLeaveEntry(prepareRequest=false){
 const operator=$('#leaveEntryOperator').value,start=$('#leaveEntryStart').value,end=$('#leaveEntryEnd').value;
 if(!operator||!start||!end)return toast('Compila operatore e periodo');
 if(end<start)return toast('La data finale non può precedere quella iniziale');
 const stato=({Richiesta:'richiesta',Approvata:'approvata',Rifiutata:'rifiutata'})[$('#leaveEntryStatus').value];
 const payload={operatore_id:operatorIds.get(operator),data_inizio:start,data_fine:end,stato,tipologia:'Ferie',note:$('#leaveEntryNotes').value.trim()||null,created_by:currentUser.id,updated_by:currentUser.id};
 const {data,error}=await supabaseClient.from('ferie').insert(payload).select('id').single();
 if(error)return toast(`Errore: ${error.message}`);
 await loadRemoteState();renderAll();
 if(prepareRequest&&data?.id){selectedLeaveIds.clear();selectedLeaveIds.add(String(data.id));openLeaveRequestDialog()}
 else toast('Ferie salvate');
 resetLeaveEntry();
}
async function saveDayNote(){
 if(!selectedCalendarDate)return;
 const text=$('#dayNoteText').value.trim();
 const existing=state.notes?.find(n=>n.date===selectedCalendarDate);
 if(!text){if(existing)return deleteDayNote();return toast('Scrivi una nota')}
 const payload={data_nota:selectedCalendarDate,testo:text,autore_id:currentUser.id,updated_by:currentUser.id};
 const res=existing?await supabaseClient.from('note_giornaliere').update(payload).eq('id',existing.id):await supabaseClient.from('note_giornaliere').insert({...payload,created_by:currentUser.id});
 if(res.error)return toast(`Errore: ${res.error.message}`);
 await loadRemoteState();renderAll();openDayAction(selectedCalendarDate);toast('Nota salvata');
}
async function deleteDayNote(){
 const existing=state.notes?.find(n=>n.date===selectedCalendarDate);if(!existing)return;
 if(!confirm(`Eliminare la nota del ${fmtDate(selectedCalendarDate)}?`))return;
 const {error}=await supabaseClient.from('note_giornaliere').delete().eq('id',existing.id);
 if(error)return toast(`Errore: ${error.message}`);
 await loadRemoteState();renderAll();openDayAction(selectedCalendarDate);toast('Nota eliminata');
}
function openTurn(id){const t=state.turns.find(x=>x.id===id)||{id:'',date:'',operator:'',gipPenale:'',gipCivile:'',notes:''};$('#turnDialogTitle').textContent=id?'Modifica turno':'Nuovo turno';$('#turnId').value=t.id;$('#turnDate').value=t.date;$('#turnOperator').innerHTML=optionList(state.operators,t.operator,'Seleziona operatore');$('#turnCriminal').innerHTML=optionList(state.gipPenale,t.gipPenale);$('#turnCivil').innerHTML=optionList(state.gipCivile,t.gipCivile);$('#turnNotes').value=t.notes;$('#turnDialog').showModal()}
function openLeave(id){const l=state.leaves.find(x=>x.id===id)||{id:'',operator:'',start:'',end:'',status:'Richiesta',notes:''};$('#leaveDialogTitle').textContent=id?'Modifica ferie':'Inserisci ferie';$('#leaveId').value=l.id;$('#leaveOperator').innerHTML=optionList(state.operators,l.operator,'Seleziona operatore');$('#leaveStart').value=l.start;$('#leaveEnd').value=l.end;$('#leaveStatus').value=l.status;$('#leaveNotes').value=l.notes;$('#leaveDialog').showModal()}
const requiredIds=['loginForm','loginEmail','loginPassword','forgotPasswordBtn','forgotPasswordDialog','forgotPasswordForm','forgotPasswordEmail','forgotPasswordStatus','recoveryPasswordDialog','recoveryPasswordForm','recoveryPassword','recoveryPasswordConfirm','profileDialog','profileForm'];
for(const id of requiredIds){if(!document.getElementById(id))throw new Error(`Elemento interfaccia mancante: ${id}`)}

$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=e.submitter||$('#loginForm button[type="submit"]');
  const status=$('#loginStatus');
  const email=$('#loginEmail').value.trim().toLowerCase();
  const password=$('#loginPassword').value;
  status.textContent=''; status.classList.remove('error','success');
  btn.disabled=true; btn.textContent='Accesso in corso…';
  try{
    const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
    if(error) throw error;
    if(!data.session) throw new Error('Sessione non creata');
    await loadRemoteState();
    $('#loginView').classList.add('hidden');
    $('#appView').classList.remove('hidden');
    refreshProfileUi(); renderAll(); toast('Accesso effettuato');
  }catch(err){
    console.error('Login error',err);
    const message=err?.message==='Invalid login credentials'
      ? 'Email o password non corrette.'
      : `Accesso non riuscito: ${err?.message||'errore sconosciuto'}`;
    status.textContent=message; status.classList.add('error');
  }finally{
    btn.disabled=false; btn.textContent='Accedi';
  }
});

$('#profileFab').onclick=openProfile;
$$('.close-profile').forEach(b=>b.addEventListener('click',()=>$('#profileDialog').close()));
$('#profileForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!currentUser)return;
  const name=$('#profileName').value.trim();
  const email=$('#profileEmail').value.trim().toLowerCase();
  const oldEmail=currentUser.email;
  const password=$('#profilePassword').value;
  const confirmPassword=$('#profilePasswordConfirm').value;
  const status=$('#profileStatus');
  const saveBtn=$('#profileSaveBtn');
  const setStatus=(message,type='')=>{status.textContent=message;status.className=`form-status ${type}`.trim()};
  if(!name||!email)return setStatus('Inserisci nome ed email.','error');
  if(password&&password.length<8)return setStatus('La nuova password deve avere almeno 8 caratteri.','error');
  if(password!==confirmPassword)return setStatus('Le due password non coincidono.','error');
  saveBtn.disabled=true;
  saveBtn.textContent='Salvataggio…';
  setStatus('Aggiornamento dell’account in corso…');
  try{
    const authChanges={};
    if(email!==oldEmail)authChanges.email=email;
    if(password)authChanges.password=password;
    if(Object.keys(authChanges).length){
      const {error:aErr}=await supabaseClient.auth.updateUser(authChanges);
      if(aErr)throw new Error(`Account: ${aErr.message}`);
    }
    const {error:pErr}=await supabaseClient.from('profili').update({nome,email}).eq('id',currentUser.id);
    if(pErr)throw new Error(`Profilo: ${pErr.message}`);
    currentUser.name=name;
    currentUser.email=email;
    refreshProfileUi();
    if(password){
      setStatus('Password modificata correttamente. Tra pochi secondi verrai disconnesso: rientra usando la nuova password.','success');
      saveBtn.textContent='Password aggiornata';
      $('#profilePassword').value='';
      $('#profilePasswordConfirm').value='';
      setTimeout(async()=>{await supabaseClient.auth.signOut();location.reload()},2500);
      return;
    }
    if(email!==oldEmail){
      setStatus('Richiesta di cambio email registrata. Controlla la nuova casella di posta per confermare.','success');
    }else{
      setStatus('Profilo aggiornato correttamente.','success');
    }
    saveBtn.textContent='Salvato';
    setTimeout(()=>$('#profileDialog').close(),1400);
  }catch(err){
    console.error('Profile update error',err);
    setStatus(`Modifica non riuscita: ${err.message||'errore sconosciuto'}`,'error');
  }finally{
    if(!password){saveBtn.disabled=false;setTimeout(()=>saveBtn.textContent='Salva profilo',1500)}
  }
});
$('#changePasswordBtn').addEventListener('click',async()=>{
  if(!currentUser)return;
  const password=$('#profilePassword').value;
  const confirmPassword=$('#profilePasswordConfirm').value;
  const status=$('#profileStatus');
  const btn=$('#changePasswordBtn');
  const setStatus=(message,type='')=>{status.textContent=message;status.className=`form-status ${type}`.trim()};
  if(!password)return setStatus('Inserisci la nuova password.','error');
  if(password.length<8)return setStatus('La nuova password deve avere almeno 8 caratteri.','error');
  if(password!==confirmPassword)return setStatus('Le due password non coincidono.','error');
  btn.disabled=true;btn.textContent='Aggiornamento password…';
  setStatus('Modifica della password in corso…');
  try{
    const {error}=await supabaseClient.auth.updateUser({password});
    if(error)throw error;
    $('#profilePassword').value='';
    $('#profilePasswordConfirm').value='';
    setStatus('Password modificata correttamente. Ora verrai disconnesso.','success');
    btn.textContent='Password aggiornata';
    setTimeout(async()=>{await supabaseClient.auth.signOut();window.location.replace(window.location.origin)},1800);
  }catch(err){
    console.error('Password update error',err);
    setStatus(`Cambio password non riuscito: ${err?.message||'errore sconosciuto'}`,'error');
    btn.disabled=false;btn.textContent='Cambia password';
  }
});

$('#forgotPasswordBtn').addEventListener('click',()=>{
  const dialog=$('#forgotPasswordDialog');
  const email=$('#loginEmail').value.trim().toLowerCase();
  $('#forgotPasswordEmail').value=email;
  const status=$('#forgotPasswordStatus');
  status.textContent='';status.className='form-status';
  dialog.showModal();
  setTimeout(()=>$('#forgotPasswordEmail').focus(),50);
});
$$('.close-forgot-password').forEach(button=>button.addEventListener('click',()=>$('#forgotPasswordDialog').close()));
$('#forgotPasswordForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const email=$('#forgotPasswordEmail').value.trim().toLowerCase();
  const status=$('#forgotPasswordStatus');
  const button=$('#sendResetLinkBtn');
  const setStatus=(message,type='')=>{status.textContent=message;status.className=`form-status ${type}`.trim()};
  if(!email)return setStatus('Inserisci l’indirizzo email associato al tuo account.','error');
  button.disabled=true;button.textContent='Invio in corso…';
  setStatus('Preparazione del messaggio di ripristino…');
  try{
    const redirectTo=`${window.location.origin}${window.location.pathname}`;
    const {error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo});
    if(error)throw error;
    setStatus(`Email inviata a ${email}. Controlla anche la cartella Spam.`, 'success');
    $('#loginEmail').value=email;
    button.textContent='Email inviata';
  }catch(error){
    setStatus(`Invio non riuscito: ${error?.message||'errore sconosciuto'}`,'error');
    button.disabled=false;button.textContent='Invia link di ripristino';
  }
});

let recoveryMode=false;
supabaseClient.auth.onAuthStateChange(async(event)=>{
  if(event==='PASSWORD_RECOVERY'){
    recoveryMode=true;
    $('#loginView').classList.remove('hidden');
    $('#appView').classList.add('hidden');
    const status=$('#recoveryPasswordStatus');
    status.textContent='';status.className='form-status';
    if(!$('#recoveryPasswordDialog').open)$('#recoveryPasswordDialog').showModal();
    setTimeout(()=>$('#recoveryPassword').focus(),50);
  }
});
$('#recoveryPasswordForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const password=$('#recoveryPassword').value;
  const confirmPassword=$('#recoveryPasswordConfirm').value;
  const status=$('#recoveryPasswordStatus');
  const button=$('#saveRecoveryPasswordBtn');
  const setStatus=(message,type='')=>{status.textContent=message;status.className=`form-status ${type}`.trim()};
  if(password.length<8)return setStatus('La password deve contenere almeno 8 caratteri.','error');
  if(password!==confirmPassword)return setStatus('Le due password non coincidono.','error');
  button.disabled=true;button.textContent='Salvataggio…';
  try{
    const {error}=await supabaseClient.auth.updateUser({password});
    if(error)throw error;
    setStatus('Password aggiornata. Ora puoi accedere con la nuova password.','success');
    button.textContent='Password aggiornata';
    await new Promise(resolve=>setTimeout(resolve,1400));
    await supabaseClient.auth.signOut();
    recoveryMode=false;
    window.history.replaceState({},document.title,window.location.pathname);
    window.location.replace(window.location.origin+window.location.pathname);
  }catch(error){
    setStatus(`Aggiornamento non riuscito: ${error?.message||'errore sconosciuto'}`,'error');
    button.disabled=false;button.textContent='Salva nuova password';
  }
});

$('#logoutBtn').onclick=async()=>{await supabaseClient.auth.signOut();location.reload()};
$('#mainNav').onclick=e=>{const b=e.target.closest('.nav-item');if(!b)return;if(b.dataset.action==='profile'){openProfile();return}$$('.nav-item').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.view').forEach(x=>x.classList.remove('active-view'));const view=$('#'+b.dataset.view);if(view)view.classList.add('active-view');$('#pageTitle').textContent=b.textContent};
$('#addTurnBtn').onclick=()=>openTurn();$('#addLeaveBtn').onclick=()=>openLeave();
$('#turnForm').addEventListener('submit',async e=>{e.preventDefault();const date=$('#turnDate').value;if(new Date(date+'T12:00:00').getDay()!==6)return toast('La data deve essere un sabato');const id=$('#turnId').value;const operator=$('#turnOperator').value,gp=$('#turnCriminal').value,gc=$('#turnCivil').value;if(!gp&&!gc)return toast('Assegna almeno un GIP Penale o Civile');const payload={data_turno:date,operatore_id:await getId(operatorIds,operator),gip_penale_id:await getId(gipPenaleIds,gp),gip_civile_id:await getId(gipCivileIds,gc),note:$('#turnNotes').value.trim()||null,updated_by:currentUser.id};let res=id?await supabaseClient.from('turni_sabato').update(payload).eq('id',id):await supabaseClient.from('turni_sabato').insert({...payload,created_by:currentUser.id});if(res.error)return toast(`Errore: ${res.error.message}`);await loadRemoteState();$('#turnDialog').close();renderAll();toast('Turno salvato')});
$('#leaveForm').addEventListener('submit',async e=>{e.preventDefault();if($('#leaveEnd').value<$('#leaveStart').value)return toast('La data finale non può precedere quella iniziale');const id=$('#leaveId').value;const stato=({Richiesta:'richiesta',Approvata:'approvata',Rifiutata:'rifiutata'})[$('#leaveStatus').value];const payload={operatore_id:await getId(operatorIds,$('#leaveOperator').value),data_inizio:$('#leaveStart').value,data_fine:$('#leaveEnd').value,stato,tipologia:'Ferie',note:$('#leaveNotes').value.trim()||null,updated_by:currentUser.id};let res=id?await supabaseClient.from('ferie').update(payload).eq('id',id):await supabaseClient.from('ferie').insert({...payload,created_by:currentUser.id});if(res.error)return toast(`Errore: ${res.error.message}`);await loadRemoteState();$('#leaveDialog').close();renderAll();toast('Ferie salvate')});
document.addEventListener('click',async e=>{let b;if(b=e.target.closest('.edit-turn'))openTurn(b.dataset.id);if(b=e.target.closest('.delete-turn')){if(confirm('Eliminare questo turno?')){const {error}=await supabaseClient.from('turni_sabato').delete().eq('id',b.dataset.id);if(error)return toast(`Errore: ${error.message}`);await loadRemoteState();renderAll();toast('Turno eliminato')}}if(b=e.target.closest('.edit-leave'))openLeave(b.dataset.id);if(b=e.target.closest('.delete-leave')){if(confirm('Eliminare queste ferie?')){selectedLeaveIds.delete(b.dataset.id);const {error}=await supabaseClient.from('ferie').delete().eq('id',b.dataset.id);if(error)return toast(`Errore: ${error.message}`);await loadRemoteState();renderAll();toast('Ferie eliminate')}}if(b=e.target.closest('.add-person')){const labels={operator:'operatore',gipPenale:'GIP Penale',gipCivile:'GIP Civile'};$('#personType').value=b.dataset.type;$('#personName').value='';$('#personDialogTitle').textContent=`Aggiungi ${labels[b.dataset.type]}`;$('#personHelp').textContent=`Il nominativo sarà disponibile nei menu dei turni come ${labels[b.dataset.type]}.`;$('#personDialog').showModal();setTimeout(()=>$('#personName').focus(),50)}if(b=e.target.closest('.delete-person')){const type=b.dataset.type,arr=state[type],name=arr[+b.dataset.index];if(confirm(`Disattivare ${name}?`)){const table=type==='operator'?'operatori':'gip';const map=type==='operator'?operatorIds:(type==='gipPenale'?gipPenaleIds:gipCivileIds);const {error}=await supabaseClient.from(table).update({attivo:false}).eq('id',map.get(name));if(error)return toast(`Errore: ${error.message}`);await loadRemoteState();renderAll();toast('Nominativo disattivato')}}});
$('#personForm').addEventListener('submit',async e=>{e.preventDefault();const type=$('#personType').value,name=$('#personName').value.trim();if(!['operator','gipPenale','gipCivile'].includes(type)||!name)return toast('Inserisci un nominativo valido');if(state[type].some(x=>x.toLowerCase()===name.toLowerCase()))return toast('Il nominativo è già presente');const table=type==='operator'?'operatori':'gip';const payload=type==='operator'?{nome:name,created_by:currentUser.id}:{nome:name,tipo:type==='gipPenale'?'PENALE':'CIVILE',created_by:currentUser.id};const {error}=await supabaseClient.from(table).insert(payload);if(error)return toast(`Errore: ${error.message}`);await loadRemoteState();$('#personDialog').close();renderAll();toast('Nominativo aggiunto correttamente')});
$$('.close-person').forEach(b=>b.addEventListener('click',()=>$('#personDialog').close()));
['turnSearch','turnTypeFilter','turnStatusFilter'].forEach(id=>$('#'+id).addEventListener('input',renderTurns));['leaveSearch','leaveOperatorFilter','leaveStatusFilter','leaveTimeFilter'].forEach(id=>$('#'+id)?.addEventListener('input',renderLeaves));$('#leaveVisualOperator')?.addEventListener('input',renderLeaveVisuals);
$('#leaveDetailMonth')?.addEventListener('input',renderLeaveVisuals);
['leaveEntryStart','leaveEntryEnd','leaveEntryOperator'].forEach(id=>$('#'+id)?.addEventListener('input',renderLeaveEntryPreview));
$('#leaveEntryReset')?.addEventListener('click',resetLeaveEntry);
$('#leaveEntryForm')?.addEventListener('submit',e=>{e.preventDefault();saveLeaveEntry(false)});
$('#leaveEntrySaveRequest')?.addEventListener('click',()=>saveLeaveEntry(true));

document.addEventListener('change',e=>{
  const c=e.target.closest('.leave-request-check');
  if(!c)return;
  if(c.checked)selectedLeaveIds.add(c.dataset.id);else selectedLeaveIds.delete(c.dataset.id);
  renderLeaves();
});
$('#generateLeaveRequestBtn')?.addEventListener('click',openLeaveRequestDialog);
$('#clearLeaveSelectionBtn')?.addEventListener('click',()=>{selectedLeaveIds.clear();renderLeaves()});
$('#copyLeaveRequestBtn')?.addEventListener('click',copyLeaveRequest);
$('#openLeaveEmailBtn')?.addEventListener('click',openLeaveRequestEmail);
$$('.close-leave-request').forEach(b=>b.addEventListener('click',()=>$('#leaveRequestDialog').close()));

$('#dayAddLeaveBtn')?.addEventListener('click',openLeaveForSelectedDay);
$('#dayManageTurnBtn')?.addEventListener('click',openTurnForSelectedDay);
$('#dayDeleteTurnBtn')?.addEventListener('click',deleteTurnForSelectedDay);
$('#daySaveNoteBtn')?.addEventListener('click',saveDayNote);
$('#dayDeleteNoteBtn')?.addEventListener('click',deleteDayNote);
document.addEventListener('click',e=>{
 const edit=e.target.closest('.day-edit-leave');
 if(edit){$('#dayActionDialog').close();openLeave(edit.dataset.id);return}
 const remove=e.target.closest('.day-remove-leave');
 if(remove){removeLeaveFromSelectedDay(remove.dataset.id);return}
});
$$('.close-day-action').forEach(b=>b.addEventListener('click',()=>$('#dayActionDialog').close()));
$('#upcomingCount').addEventListener('change',renderUpcoming);
document.addEventListener('click',e=>{const b=e.target.closest('.goto-upcoming');if(!b)return;$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view==='upcoming'));$$('.view').forEach(x=>x.classList.remove('active-view'));$('#upcoming').classList.add('active-view');$('#pageTitle').textContent='Prossimi sabati';});document.addEventListener('click',e=>{const b=e.target.closest('.goto-leave');if(!b)return;$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view==='leave'));$$('.view').forEach(x=>x.classList.remove('active-view'));$('#leave').classList.add('active-view');$('#pageTitle').textContent='Ferie';});
$('#prevMonth').onclick=()=>{calendarMonth=(calendarMonth+11)%12;renderCalendar()};$('#nextMonth').onclick=()=>{calendarMonth=(calendarMonth+1)%12;renderCalendar()};$('#monthSelect').onchange=e=>{calendarMonth=+e.target.value;renderCalendar()};
$('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='turni-ferie-2026-backup.json';a.click();URL.revokeObjectURL(a.href);audit('Esportato backup dati');toast('Backup esportato')};
const months=['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];$('#monthSelect').innerHTML=months.map((m,i)=>`<option value="${i}">${m} 2026</option>`).join('');$('#todayLabel').textContent=new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
(async()=>{
  try{
    const {data:{session},error}=await supabaseClient.auth.getSession();
    if(error) throw error;
    if(session&&!recoveryMode){
      await loadRemoteState();
      if(currentUser?.attivo===false){await supabaseClient.auth.signOut();throw new Error('Account disattivato')}
      $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden');
      refreshProfileUi(); renderAll();
    }
  }catch(err){
    console.error('Avvio app',err);
    const status=$('#loginStatus');
    if(status){status.textContent=`Impossibile caricare la sessione: ${err?.message||'errore'}`;status.classList.add('error')}
  }
})();

// Nessun service worker: evita che vecchie versioni blocchino login e aggiornamenti.
if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(items=>items.forEach(item=>item.unregister())).catch(()=>{})}
if('caches' in window){caches.keys().then(keys=>keys.forEach(key=>caches.delete(key))).catch(()=>{})}
