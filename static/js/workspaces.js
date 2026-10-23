/* Server-backed table state; schemas and authorization remain on the server. */
(() => {
 'use strict';
 if(window.hrmsWorkspaces)return;window.hrmsWorkspaces=true;
 function element(tag,content,className){const n=document.createElement(tag);if(content!==undefined)n.textContent=content;if(className)n.className=className;return n;}
 function button(label,run){const b=element('button',label);b.type='button';if(run)b.onclick=run;return b;}
 function label(caption,input){const l=element('label',caption);l.append(input);return l;}
 function initialize(){
  const script=document.getElementById('workspace-data'),toolbar=document.querySelector('[data-workspace-controls]');
  if(!script||!toolbar||toolbar.dataset.ready)return;toolbar.dataset.ready='1';
  const data=JSON.parse(script.textContent),table=document.querySelector('table[data-server-workspace="'+data.key+'"]');if(!table)return;
  const region=toolbar.closest('#ui-list-region'),status=region.querySelector('[data-ws-status]');
  if(data.key==='employees'){const old=region.querySelector('button[popovertarget="employee-column-popover"]');if(old)old.hidden=true;}
  const say=message=>status.textContent=message;
  const endpoint='/workspaces/'+data.key+'/',columns=data.columns;
  const binding={'X-Workspace-Organization':String(data.organization_id),'X-Workspace-Actor':String(data.owner_id)};
  const aliases={'id':'employee_id','assignee':'name','employee':'name','employment type':'type','leave type':'leave_type',
    'from':'start','to':'end','start date':'start','end date':'end','date joined':'joined'};
  const headers=Array.from(table.tHead.rows[0].cells),keys=[];
  headers.forEach((h,i)=>{
    const raw=h.dataset.employeeColumn;
    const caption=(h.childNodes[0]?.textContent||h.textContent).trim().toLocaleLowerCase();
    let key=raw?(raw==='id'?'employee_id':raw):Object.keys(columns).find(k=>columns[k].label.toLocaleLowerCase()===caption)||aliases[caption];
    if(data.key==='report-leave'&&caption==='type')key='leave_type';
    if(key&&!columns[key])key=null;
    keys[i]=key;h.dataset.workspaceColumn=key||'__fixed_'+i;
  });
  Array.from(table.tBodies[0].rows).forEach(row=>{if(row.cells.length===headers.length)Array.from(row.cells).forEach((cell,i)=>cell.dataset.workspaceColumn=keys[i]||'__fixed_'+i);});
  let order=data.order.length?data.order.filter(k=>keys.includes(k)):keys.filter(Boolean);
  keys.filter(Boolean).forEach(k=>{if(!order.includes(k))order.push(k);});
  let hidden=new Set(data.hidden);
  if(data.key==='employees'&&!data.order.length&&!data.query._workspace_reset)headers.forEach((h,i)=>{if(h.hidden&&keys[i])hidden.add(keys[i]);});
  function query(){return Object.fromEntries(new URL(location.href).searchParams);}
  if(!location.search&&Object.keys(data.query).length){const u=new URL(location.href);u.search=new URLSearchParams(data.query).toString();history.replaceState(null,'',u);}
  async function api(path,body){
    const initial=await boot;
    const response=await fetch(endpoint+path+'/',{method:'POST',credentials:'same-origin',headers:{...binding,'Content-Type':'application/json','X-CSRFToken':initial.csrf},body:JSON.stringify(body)});
    const result=await response.json().catch(()=>({error:'Request failed ('+response.status+').'}));
    if(!response.ok||result.error)throw Error(result.error||'The request was rejected. Nothing was changed.');return result;
  }
  const boot=fetch(endpoint+'views/',{credentials:'same-origin',headers:binding,cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Saved views are unavailable for this role or organization. Reload if you switched accounts.');return r.json().catch(()=>{throw Error('Session expired. Reload the page and retry.');});});
  let rememberTimer;
  function remember(){clearTimeout(rememberTimer);rememberTimer=setTimeout(()=>{api('views',{operation:'remember',query:query()}).catch(e=>say(e.message));},300);}
  function move(params){
    params={...params};for(const name of ['w_columns','w_hidden'])if(params[name])params[name]=params[name].split(',').filter(k=>columns[k]).join(',');
    const u=new URL(location.href);u.search=new URLSearchParams(params).toString();
    const form=element('form');form.method='get';form.action=u.pathname;form.hidden=true;
    for(const [name,value]of u.searchParams){const input=element('input');input.type='hidden';input.name=name;input.value=value;form.append(input);}
    if(window.htmx){for(const [name,value]of Object.entries({'hx-get':u.pathname,'hx-target':'#ui-list-region','hx-select':'#ui-list-region','hx-swap':'outerHTML','hx-push-url':'true','hx-sync':'#ui-list-region:replace','data-ui-request':''}))form.setAttribute(name,value);}
    toolbar.append(form);window.htmx?.process(form);form.requestSubmit();
  }
  function update(key,value){const p=query();value?p[key]=value:delete p[key];delete p.page;move(p);}
  function layout(){
    Array.from(table.rows).forEach(row=>{
      const cells=new Map(Array.from(row.cells).filter(c=>c.dataset.workspaceColumn).map(c=>[c.dataset.workspaceColumn,c]));
      if(!cells.size)return;
      const fixed=Array.from(cells.keys()).filter(k=>k.startsWith('__fixed_'));
      if(cells.has('__selection'))row.append(cells.get('__selection'));
      order.forEach(k=>{if(cells.has(k)){cells.get(k).hidden=hidden.has(k);row.append(cells.get(k));}});
      fixed.forEach(k=>row.append(cells.get(k)));
    });
    const u=new URL(location.href);u.searchParams.set('w_columns',order.join(','));u.searchParams.set('w_hidden',Array.from(hidden).join(','));history.replaceState(null,'',u);
    region.querySelectorAll('form[data-ui-filter]').forEach(form=>{
      for(const [name,value]of u.searchParams){if(!name.startsWith('f_')&&!['w_columns','w_hidden','sort_key','sort_dir','per_page'].includes(name))continue;
        let control=form.elements.namedItem(name);if(!control){control=element('input');control.type='hidden';control.name=name;form.append(control);}if(control.type==='hidden')control.value=value;}
    });
  }
  function panel(title,trigger){
    const box=element('div',undefined,'ws-popover');box.setAttribute('popover','auto');box.setAttribute('role','dialog');box.setAttribute('aria-label',title);box.append(element('strong',title));document.body.append(box);
    const reposition=()=>{const r=trigger.getBoundingClientRect();box.style.left=Math.max(12,Math.min(r.left,innerWidth-box.offsetWidth-12))+'px';box.style.top=Math.max(12,Math.min(r.bottom+6,innerHeight-box.offsetHeight-12))+'px';};
    const observer=new ResizeObserver(reposition);observer.observe(box);
    box.addEventListener('toggle',e=>{if(e.newState==='closed'){observer.disconnect();box.remove();if(trigger.isConnected)trigger.focus();}});
    box.showPopover();reposition();return box;
  }
  headers.forEach((h,index)=>{
    const key=keys[index];if(!key||!columns[key].filterable)return;
    const title=columns[key].label;
    const sort=button('↕',()=>{const p=query();p.sort_dir=p.sort_key===key&&p.sort_dir!=='desc'?'desc':'asc';p.sort_key=key;delete p.page;move(p);});
    sort.className='ws-header-button';sort.setAttribute('aria-label','Sort '+title+' across all records');
    if(data.query.sort_key===key){h.setAttribute('aria-sort',data.query.sort_dir==='desc'?'descending':'ascending');sort.textContent=data.query.sort_dir==='desc'?'↓':'↑';}
    h.append(sort);
    // Employee Directory already has its validated server-filter controls.
    if(data.key==='employees')return;
    const filter=button('');filter.className='ws-header-button';filter.setAttribute('aria-label','Filter '+title+' across all records');filter.setAttribute('aria-haspopup','dialog');
    filter.innerHTML='<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 4h18l-7 8v7l-4 2v-9z"/></svg>';
    filter.classList.toggle('is-active',Boolean(data.query['f_'+key]));
    filter.onclick=()=>{const box=panel('Filter '+title,filter);box.append(element('p','All matching records and exports. '+columns[key].hint));
      const form=element('form'),input=element('input');input.type='search';input.value=data.query['f_'+key]||'';input.setAttribute('aria-label',title+' contains');
      const apply=button('Apply server filter');apply.type='submit';const clear=button('Clear column',()=>{box.hidePopover();update('f_'+key,'');});form.append(input,apply,clear);box.append(form);
      form.onsubmit=e=>{e.preventDefault();box.hidePopover();update('f_'+key,input.value.trim());};input.focus();};h.append(filter);
  });
  toolbar.querySelector('[data-ws-columns]').onclick=function(){
    const box=panel('View columns',this),list=element('div');box.append(list);
    function draw(){list.replaceChildren();order.forEach((key,index)=>{const row=element('div',undefined,'ws-column-row'),check=element('input');check.type='checkbox';check.checked=!hidden.has(key);check.setAttribute('aria-label','Show '+columns[key].label);
      check.onchange=()=>{if(!check.checked&&order.filter(k=>!hidden.has(k)).length===1){check.checked=true;return;}check.checked?hidden.delete(key):hidden.add(key);layout();remember();};
      const left=button('←',()=>{[order[index-1],order[index]]=[order[index],order[index-1]];layout();draw();remember();});left.disabled=index===0;left.setAttribute('aria-label','Move '+columns[key].label+' left');
      const right=button('→',()=>{[order[index+1],order[index]]=[order[index],order[index+1]];layout();draw();remember();});right.disabled=index===order.length-1;right.setAttribute('aria-label','Move '+columns[key].label+' right');
      row.append(label(columns[key].label,check),left,right);list.append(row);});}draw();
  };
  toolbar.querySelector('[data-ws-views]').onclick=async function(){
    const box=panel('Saved views',this),list=element('div'),message=element('p','Loading your views…');box.append(message,list);
    async function draw(bucket){list.replaceChildren();message.textContent='Private to your account and the selected organization.';
      for(const view of bucket.views||[]){const row=element('div',undefined,'ws-view-row');const open=button(view.name+(bucket.default===view.id?' (default)':''),()=>{box.hidePopover();move(view.query);});
        const remove=button('Delete',async()=>{try{const result=await api('views',{operation:'delete',id:view.id});draw(result.bucket);}catch(e){message.textContent=e.message;}});row.append(open,remove);list.append(row);}
      if(bucket.default)list.append(button('Use last view instead of a default',async()=>{try{const r=await api('views',{operation:'default',id:null});draw(r.bucket);}catch(e){message.textContent=e.message;}}));
    }
    const name=element('input');name.maxLength=48;name.required=true;name.setAttribute('aria-label','View name');name.placeholder='Name this view';
    const isDefault=element('input');isDefault.type='checkbox';const save=button('Save current view',async()=>{if(!name.reportValidity())return;try{const r=await api('views',{operation:'save',name:name.value,query:query(),default:isDefault.checked});draw(r.bucket);say('View saved.');}catch(e){message.textContent=e.message;}});
    box.append(name,label('Use as default',isDefault),save);
    try{const result=await fetch(endpoint+'views/',{headers:binding,cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();});if(box.isConnected)draw(result.bucket||{});}catch(e){message.textContent='Could not load saved views. Reload if you switched accounts or organizations.';}
  };
  if(data.bulk.length){
    const selection=new Set(),heading=element('th');heading.dataset.workspaceColumn='__selection';const all=element('input');all.type='checkbox';all.setAttribute('aria-label','Select records on this server page');heading.append(all);table.tHead.rows[0].prepend(heading);
    const checkboxes=[];
    table.querySelectorAll('tbody tr[data-workspace-id]').forEach(row=>{const td=element('td'),check=element('input');td.dataset.workspaceColumn='__selection';if(row.dataset.workspaceSelectable==='0'){row.prepend(td);return;}check.type='checkbox';check.setAttribute('aria-label','Select '+row.textContent.trim().replace(/\s+/g,' ').slice(0,80));
      check.onchange=()=>{check.checked?selection.add(Number(row.dataset.workspaceId)):selection.delete(Number(row.dataset.workspaceId));count.textContent=selection.size+' selected';};td.append(check);row.prepend(td);checkboxes.push(check);});
    const bulk=element('div',undefined,'ws-bulk'),count=element('span','0 selected'),action=element('select');action.setAttribute('aria-label','Bulk action');data.bulk.forEach(a=>{const o=element('option',a==='archive'?'Archive employees':'Change asset status');o.value=a;action.append(o);});
    const value=element('select');value.setAttribute('aria-label','New asset status');['available','assigned','repair','retired'].forEach(v=>{const o=element('option',v);o.value=v;value.append(o);});value.hidden=data.key!=='assets';
    all.onchange=()=>{checkboxes.forEach(c=>{c.checked=all.checked;c.dispatchEvent(new Event('change'));});};
    const preview=button('Preview selected action',async()=>{try{const plan=await api('bulk',{ids:Array.from(selection),action:action.value,value:value.value});
      const dialog=element('dialog',undefined,'ws-confirm');dialog.setAttribute('aria-label','Confirm bulk action');dialog.append(element('h2','Confirm '+plan.action+' · '+plan.count+' records'),element('p',plan.impact));
      const names=element('ul');plan.summary.forEach(item=>names.append(element('li',item.name+' / '+item.organization)));dialog.append(names);
      const cancel=button('Cancel',()=>dialog.close()),confirm=button('Confirm changes',async()=>{confirm.disabled=true;try{const result=await api('bulk',{token:plan.token});dialog.close();say(result.message);move(query());}catch(e){dialog.append(element('p',e.message));confirm.disabled=false;}});
      dialog.append(cancel,confirm);dialog.addEventListener('close',()=>{dialog.remove();preview.focus();});document.body.append(dialog);dialog.showModal();cancel.focus();
    }catch(e){say(e.message);}});
    bulk.append(count,action,value,preview,element('small','Up to 50 records; permissions are rechecked when confirming.'));toolbar.after(bulk);
  }
  layout();
  boot.then(()=>remember()).catch(e=>say(e.message));
 }
 document.addEventListener('DOMContentLoaded',initialize);document.addEventListener('htmx:afterSettle',initialize);
})();
