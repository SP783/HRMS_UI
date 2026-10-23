/* Progressive enhancements: scope is the authorized HTML already returned by Django. */
(() => {
  'use strict';
  if(window.hrmsUsabilityInitialized)return;
  window.hrmsUsabilityInitialized=true;
  const collator = new Intl.Collator(undefined, {numeric:true,sensitivity:'base'});
  let sequence=0;
  const text=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
  const visible=el=>!el.hidden&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';
  function button(label,caption=label){const b=document.createElement('button');b.type='button';b.textContent=caption;b.setAttribute('aria-label',label);return b;}
  function announce(message){const live=document.getElementById('ux-announcement');if(live)live.textContent=message;}
  function position(panel,trigger){const box=trigger.getBoundingClientRect();panel.style.left=Math.max(12,Math.min(box.left,innerWidth-panel.offsetWidth-12))+'px';panel.style.top=Math.max(12,Math.min(box.bottom+6,innerHeight-panel.offsetHeight-12))+'px';}
  function tableTools(table){
    if(table.hasAttribute('data-server-workspace')||table.dataset.uxTable||table.matches('.cu-table,.px-project-table,#employee-directory-table')||table.closest('[data-ux-exclude],.doc-sheet'))return;
    const head=table.tHead,body=table.tBodies[0];
    if(!head||head.rows.length!==1||!body||table.tBodies.length!==1)return;
    const headers=Array.from(head.rows[0].cells),rows=Array.from(body.rows);
    if(headers.length<2||headers.some(h=>h.colSpan!==1)||rows.some(r=>r.querySelector('input:not([type=hidden]),select,textarea')||r.cells.length>1&&r.cells.length!==headers.length))return;
    table.dataset.uxTable='1';table.classList.add('ux-table');
    const original=rows.filter(r=>r.cells.length===headers.length),filters=new Map(),serverFields=[];
    let page=1,size=25,sorted=original.slice(),sortIndex=-1,descending=false;
    let scroller=table.parentElement;
    if(!scroller.classList.contains('overflow-x-auto')&&!scroller.classList.contains('team-scroll')){
      scroller=document.createElement('div');table.before(scroller);scroller.append(table);
    }
    scroller.classList.add('ux-table-scroll');scroller.tabIndex=0;
    scroller.setAttribute('role','region');scroller.setAttribute('aria-label',(table.getAttribute('aria-label')||'Data table')+' — scroll to see more rows and columns');
    const tools=document.createElement('div');tools.className='ux-table-tools';
    const scope=document.createElement('span');scope.textContent='Quick filters/sorting: loaded rows. Report filters search matching records and apply to exports.';tools.append(scope);
    const reset=button('Reset table filters and sorting','Reset table');tools.append(reset);scroller.before(tools);
    const footer=document.createElement('div');footer.className='ux-pagination';
    const report=document.createElement('span');report.setAttribute('role','status');
    const perPage=document.createElement('select');perPage.setAttribute('aria-label','Rows per page');
    [25,50,100,0].forEach(n=>{const o=document.createElement('option');o.value=n;o.textContent=n?n+' rows':'All loaded rows';perPage.append(o);});
    const previous=button('Previous table page','Previous'),next=button('Next table page','Next');
    footer.append(report,perPage,previous,next);scroller.after(footer);
    const noMatches=document.createElement('tr'),empty=document.createElement('td');empty.colSpan=headers.length;empty.textContent='No loaded rows match these column filters.';noMatches.append(empty);noMatches.hidden=true;body.append(noMatches);
    const filterButtons=[];
    function render(){
      const matched=sorted.filter(row=>Array.from(filters).every(([index,value])=>text(row.cells[index]).toLocaleLowerCase().includes(value.toLocaleLowerCase())));
      const pages=Math.max(1,size?Math.ceil(matched.length/size):1);page=Math.min(page,pages);
      original.forEach(row=>{row.hidden=true;row.classList.add('ux-page-row');});
      (size?matched.slice((page-1)*size,page*size):matched).forEach(row=>row.hidden=false);
      noMatches.hidden=matched.length>0||original.length===0;
      report.textContent=matched.length+' of '+original.length+' loaded rows · Page '+page+' of '+pages;
      previous.disabled=page===1;next.disabled=page===pages;
      footer.hidden=original.length===0;
      filterButtons.forEach((b,index)=>{if(b){b.classList.toggle('is-active',filters.has(index)||Boolean(serverFields[index]?.value));b.setAttribute('aria-label','Filter '+b.dataset.label+(filters.has(index)?': '+filters.get(index):''));}});
    }
    previous.onclick=()=>{page--;render();};next.onclick=()=>{page++;render();};perPage.onchange=()=>{size=Number(perPage.value);page=1;render();};
    reset.onclick=()=>{filters.clear();sorted=original.slice();sorted.forEach(r=>body.insertBefore(r,noMatches));sortIndex=-1;headers.forEach(h=>h.removeAttribute('aria-sort'));page=1;render();};
    headers.forEach((header,index)=>{
      const label=text(header);if(!label||/^(actions?|details|handoffs|permission)$/i.test(label))return;
      const aliases={organization:['organization','org'],department:['department','dept'],employee:['employee'],name:['employee'],status:['status'],'leave type':['leave_type']};
      const names=aliases[label.toLocaleLowerCase()]||[];
      const region=table.closest('#ui-list-region')||document.getElementById('app-content');
      const sourceForm=Array.from(region.querySelectorAll('form[data-ui-filter]')).find(f=>names.some(n=>f.elements.namedItem(n)?.tagName==='SELECT'));
      const source=sourceForm&&names.map(n=>sourceForm.elements.namedItem(n)).find(el=>el?.tagName==='SELECT');serverFields[index]=source;
      header.scope='col';
      const sort=button('Sort '+label+' in loaded rows', '↕');sort.className='ux-header-button';sort.title='Sort '+label+' in loaded rows';
      sort.onclick=()=>{descending=sortIndex===index?!descending:false;sortIndex=index;headers.forEach(h=>h.removeAttribute('aria-sort'));header.setAttribute('aria-sort',descending?'descending':'ascending');
        sorted=original.slice().sort((a,b)=>{const va=text(a.cells[index]),vb=text(b.cells[index]);
          const datePattern=/^(\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})$/;
          const difference=datePattern.test(va)&&datePattern.test(vb)?Date.parse(va)-Date.parse(vb):collator.compare(va,vb);
          return (descending?-1:1)*(difference||0);});
        sorted.forEach(r=>body.insertBefore(r,noMatches));page=1;render();announce(label+' sorted '+(descending?'descending':'ascending'));};
      const filter=button('Filter '+label,'');filter.dataset.label=label;filter.className='ux-header-button ux-filter-button';
      filter.innerHTML='<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 4h18l-7 8v7l-4 2v-9z"/></svg>';
      filter.setAttribute('aria-haspopup','dialog');filterButtons[index]=filter;
      filter.onclick=()=>{
        const panel=document.createElement('div');panel.className='ux-column-popover';panel.setAttribute('popover','auto');panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Filter '+label);
        const title=document.createElement('strong');title.textContent='Filter '+label;
        const hint=document.createElement('p');hint.textContent=source?'Report filter · includes matching records beyond this table page':'Contains · loaded rows only';
        const form=document.createElement('form'),input=source?source.cloneNode(true):document.createElement('input');
        if(source){Array.from(input.attributes).filter(a=>a.name==='id'||a.name==='name'||a.name.startsWith('on')||a.name.startsWith('hx-')).forEach(a=>input.removeAttribute(a.name));input.value=source.value;input.setAttribute('aria-label',label+' report filter');}
        else{input.type='search';input.value=filters.get(index)||'';input.setAttribute('aria-label',label+' contains');}
        const apply=button('Apply column filter','Apply');apply.type='submit';const clear=button('Clear column filter','Clear');
        form.append(input,apply,clear);panel.append(title,hint,form);document.body.append(panel);
        function close(){panel.hidePopover();panel.remove();filter.focus();}
        form.onsubmit=e=>{e.preventDefault();if(source){source.value=input.value;close();sourceForm.requestSubmit();return;}const value=input.value.trim();value?filters.set(index,value):filters.delete(index);page=1;render();close();};
        clear.onclick=()=>{if(source){source.value='';close();sourceForm.requestSubmit();return;}filters.delete(index);page=1;render();close();};
        panel.addEventListener('toggle',e=>{if(e.newState==='closed'){panel.remove();if(document.contains(filter))filter.focus();}},{once:false});
        panel.showPopover();position(panel,filter);input.focus();
      };
      header.append(sort,filter);
    });
    render();
  }
  function profiles(){
    document.querySelectorAll('[data-employee-profile]:not([data-ux-profile])').forEach(root=>{
      root.dataset.uxProfile='1';const container=root.querySelector(':scope > main');if(!container)return;
      const panels=Array.from(container.children).filter(el=>el.tagName==='SECTION');if(!panels.length)return;
      const documents=document.createElement('section'),heading=document.createElement('h2'),link=document.createElement('a');
      heading.textContent='Documents';link.textContent='Open employee documents and previews';link.href=root.dataset.documentsUrl;link.className='ux-action';documents.append(heading,link);container.append(documents);panels.push(documents);
      const tabs=document.createElement('div');tabs.className='ux-profile-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Employee details');container.before(tabs);
      const buttons=[];
      panels.forEach((panel,i)=>{
        panel.id=panel.id||'ux-profile-'+(++sequence);panel.setAttribute('role','tabpanel');panel.tabIndex=0;
        const b=button(text(panel.querySelector('h2')));b.id=panel.id+'-tab';b.setAttribute('role','tab');b.setAttribute('aria-controls',panel.id);panel.setAttribute('aria-labelledby',b.id);buttons.push(b);tabs.append(b);
        b.onclick=()=>activate(i);
      });
      function activate(index){panels.forEach((p,i)=>p.hidden=i!==index);buttons.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;});}
      tabs.onkeydown=e=>{let i=buttons.indexOf(document.activeElement);if(i<0)return;if(e.key==='ArrowRight')i=(i+1)%buttons.length;else if(e.key==='ArrowLeft')i=(i-1+buttons.length)%buttons.length;else if(e.key==='Home')i=0;else if(e.key==='End')i=buttons.length-1;else return;e.preventDefault();activate(i);buttons[i].focus();};
      activate(0);
    });
  }
  const tracked=new Map();
  const fieldErrors=new WeakMap();
  function fingerprint(form){return JSON.stringify(Array.from(new FormData(form)).filter(([name])=>name!=='csrfmiddlewaretoken').map(([name,value])=>[name,value instanceof File?(value.name?value.name+':'+value.size+':'+value.lastModified:''):value]));}
  function forms(){
    for(const form of tracked.keys())if(!form.isConnected)tracked.delete(form);
    document.querySelectorAll('#app-content form[method=post],#app-content form[method=POST]').forEach(form=>{
      if(tracked.has(form)||form.hasAttribute('hx-post')||form.closest('table,dialog,[role=dialog],.cu-workspace')||form.matches('[data-ux-autosave],#uploadForm')||form.querySelectorAll('input:not([type=hidden]):not([type=submit]),textarea,select').length<2)return;
      tracked.set(form,{baseline:fingerprint(form),submitted:false});
      const notice=document.createElement('p');notice.className='ux-form-dirty';notice.hidden=true;notice.textContent='You have unsaved changes.';notice.setAttribute('role','status');form.append(notice);
      const update=()=>{const entry=tracked.get(form);entry.submitted=false;notice.hidden=fingerprint(form)===entry.baseline;};
      form.addEventListener('input',update);form.addEventListener('change',update);
      form.addEventListener('reset',()=>setTimeout(update,0));
      form.addEventListener('submit',e=>{const entry=tracked.get(form);entry.submitted=!e.defaultPrevented&&form.checkValidity();setTimeout(()=>{if(e.defaultPrevented)entry.submitted=false;},0);});
      form.addEventListener('invalid',e=>{
        const field=e.target;field.setAttribute('aria-invalid','true');
        let error=fieldErrors.get(field);
        if(!error){error=document.createElement('span');error.id='ux-field-error-'+(++sequence);error.className='ux-field-error';field.after(error);fieldErrors.set(field,error);
          field.setAttribute('aria-describedby',((field.getAttribute('aria-describedby')||'')+' '+error.id).trim());}
        error.textContent=field.validationMessage;
      },true);
      form.addEventListener('input',e=>{if(e.target.validity?.valid){const field=e.target,error=fieldErrors.get(field);field.removeAttribute('aria-invalid');if(error){field.setAttribute('aria-describedby',(field.getAttribute('aria-describedby')||'').split(' ').filter(id=>id!==error.id).join(' '));error.remove();fieldErrors.delete(field);}}});
    });
  }
  const dirty=()=>Array.from(tracked).some(([form,state])=>form.isConnected&&!state.submitted&&fingerprint(form)!==state.baseline);
  window.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue='';}});
  document.addEventListener('htmx:beforeRequest',e=>{
    const target=e.detail.target;
    if(target&&Array.from(tracked).some(([form,state])=>target.contains(form)&&form.isConnected&&!state.submitted&&fingerprint(form)!==state.baseline)&&!confirm('Leave this form and discard unsaved changes?'))e.preventDefault();
  });
  function labels(){
    document.querySelectorAll('dialog:not([aria-label]):not([aria-labelledby])').forEach(dialog=>{const heading=dialog.querySelector('h1,h2,h3,strong');if(heading){heading.id=heading.id||'ux-dialog-title-'+(++sequence);dialog.setAttribute('aria-labelledby',heading.id);}});
    document.querySelectorAll('#app-content input:not([type=hidden]),#app-content select,#app-content textarea').forEach(el=>{
      if(el.labels?.length||el.hasAttribute('aria-label')||el.hasAttribute('aria-labelledby'))return;
      const name=el.getAttribute('placeholder')||el.getAttribute('name')?.replace(/[_-]/g,' ');if(name)el.setAttribute('aria-label',name);
    });
    document.querySelectorAll('#app-content button[title],#app-content a[title],.app-topbar button[title],.app-topbar a[title]').forEach(el=>{if(!text(el)&&!el.hasAttribute('aria-label'))el.setAttribute('aria-label',el.title);});
  }
  let activeLegacy=null,returnFocus=null;
  function legacyDialogs(){
    const modal=document.querySelector('[data-ux-legacy-dialog]:not(.hidden)');
    if(modal&&visible(modal)&&modal!==activeLegacy){returnFocus=document.activeElement;activeLegacy=modal;modal.tabIndex=-1;const first=modal.querySelector('button,a[href],input');(first||modal).focus();}
    else if(activeLegacy&&(!activeLegacy.isConnected||!visible(activeLegacy))){activeLegacy=null;if(returnFocus?.isConnected)returnFocus.focus();}
  }
  document.addEventListener('keydown',e=>{
    if(!activeLegacy)return;
    if(e.key==='Escape'){const close=activeLegacy.querySelector('[aria-label="Close document preview"]');if(close){e.preventDefault();close.click();}}
    if(e.key==='Tab'){
      const list=Array.from(activeLegacy.querySelectorAll('a[href],button,input,select,textarea,[tabindex="0"]')).filter(el=>visible(el)&&!el.disabled);
      if(!list.length){e.preventDefault();activeLegacy.focus();return;}
      if(e.shiftKey&&document.activeElement===list[0]){e.preventDefault();list.at(-1).focus();}
      else if(!e.shiftKey&&document.activeElement===list.at(-1)){e.preventDefault();list[0].focus();}
    }
  });
  function initialize(){
    if(!document.getElementById('ux-announcement')){const live=document.createElement('div');live.id='ux-announcement';live.className='ux-sr-only';live.setAttribute('role','status');document.body.append(live);}
    document.querySelectorAll('#app-content table').forEach(tableTools);profiles();forms();labels();legacyDialogs();
  }
  document.addEventListener('DOMContentLoaded',initialize);
  document.addEventListener('htmx:afterSettle',initialize);
  new MutationObserver(legacyDialogs).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class','hidden']});
})();
