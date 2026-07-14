const STORAGE_KEY='turni-ferie-2026-v1';
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
  audit:[{id:'a1',when:new Date().toISOString(),user:'Sistema',action:'Ambiente demo inizializzato'}]
};
let state=loadState(); let currentUser=null; let calendarMonth=6;
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
function openProfile(){if(!currentUser)return;$('#profileName').value=currentUser.name||'';$('#profileEmail').value=currentUser.email||'';$('#profilePassword').value='';$('#profilePasswordConfirm').value='';$('#profileRoleLabel').textContent=currentUser.role||'Utente';$('#profileModalAvatar').textContent=initials(currentUser.name);$('#profileDialog').showModal();setTimeout(()=>$('#profileName').focus(),50)}

function getConflict(turn){return state.leaves.some(l=>l.status==='Approvata'&&l.operator===turn.operator&&between(turn.date,l.start,l.end))}
function turnStatus(t){if(getConflict(t))return 'Conflitto';if(!t.operator||(!t.gipPenale&&!t.gipCivile))return 'Da completare';return 'Assegnato'}
function badge(status){const c=status==='Assegnato'||status==='Approvata'?'green':status==='Conflitto'||status==='Rifiutata'?'red':'yellow';return `<span class="badge ${c}">${status}</span>`}
function optionList(items,selected='',placeholder='Nessuno'){return `<option value="">${placeholder}</option>`+items.map(x=>`<option ${x===selected?'selected':''}>${x}</option>`).join('')}
function renderAll(){renderDashboard();renderUpcoming();renderTurns();renderLeaves();renderLeaveVisuals();renderPeople();renderAudit();renderCalendar();fillSelects()}
function renderDashboard(){
 const conflicts=state.turns.filter(getConflict).length;$('#kpiTurns').textContent=state.turns.length;$('#kpiCriminal').textContent=state.turns.filter(t=>t.gipPenale).length;$('#kpiCivil').textContent=state.turns.filter(t=>t.gipCivile).length;$('#kpiConflicts').textContent=conflicts;
 $('#alerts').innerHTML=conflicts?`<div class="alert red">Attenzione: sono presenti ${conflicts} conflitti tra turni e ferie approvate.</div>`:`<div class="alert green">Nessun conflitto rilevato tra turni e ferie approvate.</div>`;
 const today=new Date().toISOString().slice(0,10); const next=state.turns.filter(t=>t.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0];
 $('#nextSaturdayCard').innerHTML=next?`<div class="next-date">${fmtDate(next.date,{weekday:'long',day:'2-digit',month:'long'})}</div><div class="assignment-grid"><div class="assignment"><span>Operatore</span><strong>${next.operator||'Da assegnare'}</strong></div><div class="assignment"><span>GIP Penale</span><strong>${next.gipPenale||'Da assegnare'}</strong></div><div class="assignment"><span>GIP Civile</span><strong>${next.gipCivile||'Da assegnare'}</strong></div></div>${next.notes?`<p class="muted">${next.notes}</p>`:''}`:'<p>Nessun turno futuro inserito.</p>';
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
function upcomingCardsHtml(items){return items.map(t=>`<article class="upcoming-card ${upcomingClass(t)}"><div class="upcoming-date">${fmtDate(t.date,{weekday:'long',day:'2-digit',month:'long'})}</div><dl><div><dt>Operatore</dt><dd>${t.operator||'Da assegnare'}</dd></div><div><dt>GIP Penale</dt><dd>${t.gipPenale||'Da assegnare'}</dd></div><div><dt>GIP Civile</dt><dd>${t.gipCivile||'Da assegnare'}</dd></div></dl><div style="margin-top:12px">${badge(turnStatus(t))}</div></article>`).join('')||'<p class="muted">Non ci sono turni futuri inseriti.</p>'}
function getUpcomingLeaves(limit=4){
 const today=new Date().toISOString().slice(0,10);
 return state.leaves.filter(l=>l.status!=='Rifiutata'&&l.end>=today).sort((a,b)=>a.start.localeCompare(b.start)).slice(0,limit);
}
function leaveHasConflict(l){return state.turns.some(t=>t.operator===l.operator&&between(t.date,l.start,l.end))}
function leaveTiming(l){const today=new Date().toISOString().slice(0,10);if(between(today,l.start,l.end))return 'In corso';if(l.start>today)return 'Programmata';return 'Conclusa'}
function leaveCardsHtml(items){return items.map(l=>`<article class="leave-card ${leaveHasConflict(l)?'has-conflict':''}"><div class="leave-card-head"><div><span class="leave-person">${l.operator}</span><strong>${fmtDate(l.start,{day:'2-digit',month:'short'})} → ${fmtDate(l.end,{day:'2-digit',month:'short',year:'numeric'})}</strong></div>${badge(l.status)}</div><div class="leave-card-meta"><span>${daysInclusive(l.start,l.end)} giorni</span><span>${leaveTiming(l)}</span>${leaveHasConflict(l)?'<span class="conflict-text">Conflitto con turno</span>':''}</div>${l.notes?`<p>${l.notes}</p>`:''}</article>`).join('')||'<p class="muted">Non ci sono ferie future inserite.</p>'}
function renderUpcoming(){
 const limit=Number($('#upcomingCount')?.value||8);
 const items=getUpcomingTurns(limit);
 $('#upcomingList').innerHTML=items.map(t=>`<div class="upcoming-row ${upcomingClass(t)}"><div class="upcoming-cell"><span>Sabato</span><strong>${fmtDate(t.date,{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</strong></div><div class="upcoming-cell"><span>Operatore</span><strong>${t.operator||'Da assegnare'}</strong></div><div class="upcoming-cell"><span>GIP Penale</span><strong>${t.gipPenale||'Da assegnare'}</strong></div><div class="upcoming-cell civil-cell"><span>GIP Civile</span><strong>${t.gipCivile||'Da assegnare'}</strong></div><div class="upcoming-cell status-cell">${badge(turnStatus(t))}</div></div>`).join('')||'<p class="muted">Non ci sono turni futuri inseriti.</p>';
}

function renderBars(sel,data){const max=Math.max(...data.map(x=>x.value),1);$(sel).innerHTML=data.map(x=>`<div class="bar-row"><span>${x.name.split(' ')[0]}</span><div class="bar-track"><div class="bar-fill" style="width:${x.value/max*100}%"></div></div><strong>${x.value}</strong></div>`).join('')}
function renderTurns(){const q=$('#turnSearch')?.value?.toLowerCase()||'';const type=$('#turnTypeFilter')?.value||'';const status=$('#turnStatusFilter')?.value||'';const rows=state.turns.filter(t=>[t.operator,t.gipPenale,t.gipCivile].join(' ').toLowerCase().includes(q)).filter(t=>!type||(type==='Penale'?t.gipPenale:t.gipCivile)).filter(t=>!status||turnStatus(t)===status).sort((a,b)=>a.date.localeCompare(b.date));$('#turnsBody').innerHTML=rows.map(t=>`<tr><td><strong>${fmtDate(t.date)}</strong></td><td>${t.operator||'—'}</td><td>${t.gipPenale||'—'}</td><td>${t.gipCivile||'—'}</td><td>${badge(turnStatus(t))}</td><td>${t.notes||''}</td><td><div class="row-actions"><button class="btn ghost edit-turn" data-id="${t.id}">Modifica</button><button class="btn ghost delete-turn" data-id="${t.id}">Elimina</button></div></td></tr>`).join('')||'<tr><td colspan="7">Nessun turno trovato.</td></tr>'}
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
 $('#leaveOverview').innerHTML=rows.map(l=>`<article class="leave-wide-row ${leaveHasConflict(l)?'has-conflict':''}"><div class="leave-avatar">${l.operator.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div class="leave-main"><span>Operatore</span><strong>${l.operator}</strong>${l.notes?`<small>${l.notes}</small>`:''}</div><div><span>Periodo</span><strong>${fmtDate(l.start,{day:'2-digit',month:'long'})} – ${fmtDate(l.end,{day:'2-digit',month:'long',year:'numeric'})}</strong></div><div><span>Durata</span><strong>${daysInclusive(l.start,l.end)} giorni</strong></div><div><span>Situazione</span><strong>${leaveTiming(l)}</strong>${leaveHasConflict(l)?'<small class="conflict-text">Turno durante le ferie</small>':''}</div><div>${badge(l.status)}</div><div class="row-actions"><button class="btn ghost edit-leave" data-id="${l.id}">Modifica</button><button class="btn ghost delete-leave" data-id="${l.id}">Elimina</button></div></article>`).join('')||'<p class="muted">Nessun periodo di ferie corrisponde ai filtri.</p>';
 $('#leaveBody').innerHTML=rows.map(l=>`<tr><td>${l.operator}</td><td>${fmtDate(l.start)}</td><td>${fmtDate(l.end)}</td><td>${daysInclusive(l.start,l.end)}</td><td>${badge(l.status)}</td><td>${l.notes||''}</td><td><div class="row-actions"><button class="btn ghost edit-leave" data-id="${l.id}">Modifica</button><button class="btn ghost delete-leave" data-id="${l.id}">Elimina</button></div></td></tr>`).join('')||'<tr><td colspan="7">Nessuna ferie trovata.</td></tr>';
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
function renderLeaveVisuals(){
 const histogram=$('#leaveHistogram'),calendar=$('#leaveAnnualCalendar'),filter=$('#leaveVisualOperator');
 if(!histogram||!calendar||!filter)return;
 const current=filter.value;
 filter.innerHTML='<option value="">Tutti gli operatori</option>'+state.operators.map(x=>`<option ${x===current?'selected':''}>${x}</option>`).join('');
 const leaves=visualLeaves();
 const monthTotals=Array.from({length:12},(_,month)=>{
   let total=0;const end=new Date(2026,month+1,0).getDate();
   for(let day=1;day<=end;day++){const iso=`2026-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;total+=leaveDayInfo(iso,leaves).absent.length}
   return total;
 });
 const max=Math.max(1,...monthTotals);
 histogram.innerHTML=months.map((m,i)=>`<div class="histogram-col"><div class="histogram-value">${monthTotals[i]}</div><div class="histogram-track"><div class="histogram-bar" style="height:${Math.max(monthTotals[i]?8:0,monthTotals[i]/max*100)}%"></div></div><div class="histogram-label">${m.slice(0,3)}</div></div>`).join('');
 calendar.innerHTML=months.map((monthName,month)=>{
   const first=new Date(2026,month,1),days=new Date(2026,month+1,0).getDate(),offset=(first.getDay()+6)%7;
   let cells=['L','M','M','G','V','S','D'].map(d=>`<span class="annual-weekday">${d}</span>`).join('');
   cells+='<span class="annual-empty"></span>'.repeat(offset);
   for(let day=1;day<=days;day++){
     const iso=`2026-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;const info=leaveDayInfo(iso,leaves);
     const count=info.absent.length;const cls=info.conflicts.length?'conflict':count>=3?'many':count===2?'two':count===1?'one':'';
     const names=info.absent.map(l=>l.operator).join(', ');const title=names?`${day} ${monthName}: ${names}${info.conflicts.length?' · CONFLITTO TURNO':''}`:`${day} ${monthName}: nessuna assenza`;
     cells+=`<span class="annual-day ${cls}" title="${title.replace(/"/g,'&quot;')}" tabindex="0"><b>${day}</b>${count?`<small>${count}</small>`:''}</span>`;
   }
   return `<article class="annual-month"><h4>${monthName}</h4><div class="annual-month-grid">${cells}</div></article>`;
 }).join('');
}
function renderPeople(){renderPeopleList('#operatorsList',state.operators,'operator');renderPeopleList('#criminalList',state.gipPenale,'gipPenale');renderPeopleList('#civilList',state.gipCivile,'gipCivile')}
function renderPeopleList(sel,items,type){$(sel).innerHTML=items.map((x,i)=>`<div class="person-row"><span>${x}</span><button class="icon-btn delete-person" data-type="${type}" data-index="${i}">×</button></div>`).join('')}
function timelineHtml(items){return items.map(a=>`<div class="timeline-item"><strong>${a.action}</strong><small>${a.user} · ${new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short'}).format(new Date(a.when))}</small></div>`).join('')||'<p class="muted">Nessuna modifica registrata.</p>'}
function renderAudit(){$('#auditList').innerHTML=timelineHtml(state.audit)}
function renderCalendar(){const year=2026,month=calendarMonth;$('#monthSelect').value=String(month);const first=new Date(year,month,1),last=new Date(year,month+1,0);const start=(first.getDay()+6)%7;let html=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(x=>`<div class="calendar-cell calendar-head">${x}</div>`).join('');for(let i=0;i<42;i++){const day=i-start+1;const d=new Date(year,month,day);const inMonth=day>=1&&day<=last.getDate();const iso=d.toISOString().slice(0,10);const turn=state.turns.find(t=>t.date===iso);const leaves=state.leaves.filter(l=>l.status!=='Rifiutata'&&between(iso,l.start,l.end));let pills='';if(turn){pills+=`<div class="event-pill ${getConflict(turn)?'conflict':'turn'}">${turn.operator||'Turno da assegnare'}</div>`;if(turn.gipPenale)pills+=`<div class="event-pill turn">P: ${turn.gipPenale}</div>`;if(turn.gipCivile)pills+=`<div class="event-pill civil">C: ${turn.gipCivile}</div>`}leaves.forEach(l=>pills+=`<div class="event-pill leave">Ferie: ${l.operator.split(' ')[0]}</div>`);html+=`<div class="calendar-cell ${inMonth?'':'muted-day'}"><div class="day-number">${d.getDate()}</div>${pills}</div>`}$('#calendarGrid').innerHTML=html}
function fillSelects(){$('#turnOperator').innerHTML=optionList(state.operators,'','Seleziona operatore');$('#turnCriminal').innerHTML=optionList(state.gipPenale);$('#turnCivil').innerHTML=optionList(state.gipCivile);$('#leaveOperator').innerHTML=optionList(state.operators,'','Seleziona operatore');const f=$('#leaveOperatorFilter');if(f){const current=f.value;f.innerHTML='<option value="">Tutti gli operatori</option>'+state.operators.map(x=>`<option ${x===current?'selected':''}>${x}</option>`).join('')}}
function openTurn(id){const t=state.turns.find(x=>x.id===id)||{id:'',date:'',operator:'',gipPenale:'',gipCivile:'',notes:''};$('#turnDialogTitle').textContent=id?'Modifica turno':'Nuovo turno';$('#turnId').value=t.id;$('#turnDate').value=t.date;$('#turnOperator').innerHTML=optionList(state.operators,t.operator,'Seleziona operatore');$('#turnCriminal').innerHTML=optionList(state.gipPenale,t.gipPenale);$('#turnCivil').innerHTML=optionList(state.gipCivile,t.gipCivile);$('#turnNotes').value=t.notes;$('#turnDialog').showModal()}
function openLeave(id){const l=state.leaves.find(x=>x.id===id)||{id:'',operator:'',start:'',end:'',status:'Richiesta',notes:''};$('#leaveDialogTitle').textContent=id?'Modifica ferie':'Inserisci ferie';$('#leaveId').value=l.id;$('#leaveOperator').innerHTML=optionList(state.operators,l.operator,'Seleziona operatore');$('#leaveStart').value=l.start;$('#leaveEnd').value=l.end;$('#leaveStatus').value=l.status;$('#leaveNotes').value=l.notes;$('#leaveDialog').showModal()}
$('#loginForm').addEventListener('submit',e=>{e.preventDefault();const u=state.users.find(x=>x.email===$('#loginEmail').value&&x.password===$('#loginPassword').value);if(!u)return toast('Credenziali non valide');currentUser=u;$('#loginView').classList.add('hidden');$('#appView').classList.remove('hidden');refreshProfileUi();renderAll()});

$('#profileFab').onclick=openProfile;
$$('.close-profile').forEach(b=>b.addEventListener('click',()=>$('#profileDialog').close()));
$('#profileForm').addEventListener('submit',e=>{e.preventDefault();if(!currentUser)return;const name=$('#profileName').value.trim();const email=$('#profileEmail').value.trim().toLowerCase();const password=$('#profilePassword').value;const confirmPassword=$('#profilePasswordConfirm').value;if(!name||!email)return toast('Inserisci nome ed email');if(state.users.some(u=>u.id!==currentUser.id&&u.email.toLowerCase()===email))return toast('Questa email è già utilizzata');if(password&&password.length<6)return toast('La password deve avere almeno 6 caratteri');if(password!==confirmPassword)return toast('Le password non coincidono');const oldName=currentUser.name;currentUser.name=name;currentUser.email=email;if(password)currentUser.password=password;const index=state.users.findIndex(u=>u.id===currentUser.id);if(index>=0)state.users[index]={...currentUser};saveState();audit(`Aggiornato profilo account${oldName!==name?` · ${oldName} → ${name}`:''}`);refreshProfileUi();$('#profileModalAvatar').textContent=initials(name);$('#profileDialog').close();toast('Profilo aggiornato')});
$('#logoutBtn').onclick=()=>location.reload();
$('#mainNav').onclick=e=>{const b=e.target.closest('.nav-item');if(!b)return;$$('.nav-item').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.view').forEach(x=>x.classList.remove('active-view'));$('#'+b.dataset.view).classList.add('active-view');$('#pageTitle').textContent=b.textContent};
$('#addTurnBtn').onclick=()=>openTurn();$('#addLeaveBtn').onclick=()=>openLeave();
$('#turnForm').addEventListener('submit',e=>{e.preventDefault();const date=$('#turnDate').value;if(new Date(date+'T12:00:00').getDay()!==6)return toast('La data deve essere un sabato');const id=$('#turnId').value;const obj={id:id||uid('t'),date,operator:$('#turnOperator').value,gipPenale:$('#turnCriminal').value,gipCivile:$('#turnCivil').value,notes:$('#turnNotes').value.trim()};if(!obj.gipPenale&&!obj.gipCivile)return toast('Assegna almeno un GIP Penale o Civile');if(id)state.turns[state.turns.findIndex(x=>x.id===id)]=obj;else state.turns.push(obj);audit(`${id?'Modificato':'Creato'} turno del ${fmtDate(date)} · ${obj.operator}`);saveState();$('#turnDialog').close();renderAll();toast('Turno salvato')});
$('#leaveForm').addEventListener('submit',e=>{e.preventDefault();if($('#leaveEnd').value<$('#leaveStart').value)return toast('La data finale non può precedere quella iniziale');const id=$('#leaveId').value;const obj={id:id||uid('l'),operator:$('#leaveOperator').value,start:$('#leaveStart').value,end:$('#leaveEnd').value,status:$('#leaveStatus').value,notes:$('#leaveNotes').value.trim()};if(id)state.leaves[state.leaves.findIndex(x=>x.id===id)]=obj;else state.leaves.push(obj);audit(`${id?'Modificate':'Inserite'} ferie di ${obj.operator} dal ${fmtDate(obj.start)} al ${fmtDate(obj.end)}`);saveState();$('#leaveDialog').close();renderAll();toast('Ferie salvate')});
document.addEventListener('click',e=>{let b;if(b=e.target.closest('.edit-turn'))openTurn(b.dataset.id);if(b=e.target.closest('.delete-turn')){if(confirm('Eliminare questo turno?')){const t=state.turns.find(x=>x.id===b.dataset.id);state.turns=state.turns.filter(x=>x.id!==b.dataset.id);audit(`Eliminato turno del ${fmtDate(t.date)}`);renderAll()}}if(b=e.target.closest('.edit-leave'))openLeave(b.dataset.id);if(b=e.target.closest('.delete-leave')){if(confirm('Eliminare queste ferie?')){const l=state.leaves.find(x=>x.id===b.dataset.id);state.leaves=state.leaves.filter(x=>x.id!==b.dataset.id);audit(`Eliminate ferie di ${l.operator}`);renderAll()}}if(b=e.target.closest('.add-person')){const labels={operator:'operatore',gipPenale:'GIP Penale',gipCivile:'GIP Civile'};$('#personType').value=b.dataset.type;$('#personName').value='';$('#personDialogTitle').textContent=`Aggiungi ${labels[b.dataset.type]}`;$('#personHelp').textContent=`Il nominativo sarà disponibile nei menu dei turni come ${labels[b.dataset.type]}.`;$('#personDialog').showModal();setTimeout(()=>$('#personName').focus(),50)}if(b=e.target.closest('.delete-person')){const arr=state[b.dataset.type];const name=arr[+b.dataset.index];if(confirm(`Eliminare ${name}?`)){arr.splice(+b.dataset.index,1);audit(`Eliminato nominativo: ${name}`);renderAll()}}});
$('#personForm').addEventListener('submit',e=>{e.preventDefault();const type=$('#personType').value,name=$('#personName').value.trim();if(!['operator','gipPenale','gipCivile'].includes(type)||!name)return toast('Inserisci un nominativo valido');if(state[type].some(x=>x.toLowerCase()===name.toLowerCase()))return toast('Il nominativo è già presente');state[type].push(name);saveState();audit(`Aggiunto nominativo: ${name}`);$('#personDialog').close();renderAll();toast('Nominativo aggiunto correttamente')});
$$('.close-person').forEach(b=>b.addEventListener('click',()=>$('#personDialog').close()));
['turnSearch','turnTypeFilter','turnStatusFilter'].forEach(id=>$('#'+id).addEventListener('input',renderTurns));['leaveSearch','leaveOperatorFilter','leaveStatusFilter','leaveTimeFilter'].forEach(id=>$('#'+id)?.addEventListener('input',renderLeaves));$('#leaveVisualOperator')?.addEventListener('input',renderLeaveVisuals);
$('#upcomingCount').addEventListener('change',renderUpcoming);
document.addEventListener('click',e=>{const b=e.target.closest('.goto-upcoming');if(!b)return;$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view==='upcoming'));$$('.view').forEach(x=>x.classList.remove('active-view'));$('#upcoming').classList.add('active-view');$('#pageTitle').textContent='Prossimi sabati';});document.addEventListener('click',e=>{const b=e.target.closest('.goto-leave');if(!b)return;$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view==='leave'));$$('.view').forEach(x=>x.classList.remove('active-view'));$('#leave').classList.add('active-view');$('#pageTitle').textContent='Ferie';});
$('#prevMonth').onclick=()=>{calendarMonth=(calendarMonth+11)%12;renderCalendar()};$('#nextMonth').onclick=()=>{calendarMonth=(calendarMonth+1)%12;renderCalendar()};$('#monthSelect').onchange=e=>{calendarMonth=+e.target.value;renderCalendar()};
$('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='turni-ferie-2026-backup.json';a.click();URL.revokeObjectURL(a.href);audit('Esportato backup dati');toast('Backup esportato')};
const months=['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];$('#monthSelect').innerHTML=months.map((m,i)=>`<option value="${i}">${m} 2026</option>`).join('');$('#todayLabel').textContent=new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
