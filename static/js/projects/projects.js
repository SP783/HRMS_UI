/* ════════════════════════════════════════════════════════════════════════
   Projects — project-level interactions.

   Handles everything related to a project as a whole (as opposed to
   the tasks inside it):
     * updateDate / showProjectDates  — inline date editing
     * createProject + setProjTab     — New Project modal
     * onProjDeptChange / onProjClientChange — modal cascading dropdowns
     * addCompany / addDepartment     — inline create-client / dept dialogs
     * switchProjTab                  — within-project tab switching
     * dirSetRoot / dirAdd / dirToggle / renderDir — project directory editor
     * tsToggle / renderTS / tsUpdateEntry — timesheet panel

   Depends on:
     utils.js  — escHtml, showToast, openModal, closeModal
     tree.js   — filterClient (called by addCompany after a new client
                 is created, to re-apply the filter)
   ════════════════════════════════════════════════════════════════════════ */


function updateDate(pk, field, value) {
  var url = '/projects/' + pk + '/update-date/';
  var data = new FormData();
  data.append('field', field);
  data.append('value', value);
  data.append('csrfmiddlewaretoken', window.PROJECTS_DATA.csrf);
  fetch(url, { method:'POST', body:data })
    .then(function(r){ return r.json(); })
    .then(function(res){ showToast(res.ok ? 'Date updated' : (res.error||'Update failed')); })
    .catch(function(){ showToast('Network error'); });
}

// Replace the "📅 Set dates" button with two empty date inputs so the
// user can pick start/end dates inline. Triggered from the per-project
// header when no dates are set yet.

function showProjectDates(pk) {
  var holder = document.getElementById('dates-' + pk);
  if (!holder) return;
  holder.innerHTML =
    '<input type="date" class="proj-date-inline" title="Start date" onchange="updateDate(' + pk + ',\'start_date\',this.value)">' +
    '<span style="color:var(--ink3);">→</span>' +
    '<input type="date" class="proj-date-inline" title="End date" onchange="updateDate(' + pk + ',\'end_date\',this.value)">';
  // Auto-focus the first input so the date picker opens
  var first = holder.querySelector('input');
  if (first) first.focus();
}

/* ── TIMESHEET TOGGLE ── */

function tsToggle(id) {
  var body = document.getElementById(id);
  var arr = document.getElementById('ts-arrow-' + id.replace('ts-',''));
  if (!body) return;
  var open = body.classList.toggle('open');
  if (arr) arr.textContent = open ? '▼' : '▶';
}

function renderTS() {
  var empF = document.getElementById('ts-emp') ? document.getElementById('ts-emp').value : '';
  var staF = document.getElementById('ts-status') ? document.getElementById('ts-status').value : '';
  var wkF  = document.getElementById('ts-week')   ? document.getElementById('ts-week').value  : '';
  document.querySelectorAll('#ts-body .ts-card').forEach(function(card){
    var emp  = card.dataset.tsEmp  || '';
    var sta  = card.dataset.tsStatus || '';
    var week = card.dataset.tsWeek || '';
    var show = (!empF || emp===empF) && (!staF || sta===staF) && (!wkF || week===wkF);
    card.style.display = show ? '' : 'none';
  });
}

function tsUpdateEntry(input) {
  var url = input.dataset.url; if (!url) return;
  var data = new FormData();
  data.append('hours', input.value);
  data.append('csrfmiddlewaretoken', window.PROJECTS_DATA.csrf);
  fetch(url, { method:'POST', body:data })
    .then(function(){ showToast('Hours updated'); })
    .catch(function(){ showToast('Update failed'); });
}

/* ── PROJECT MODAL ── */

function setProjTab(tab) {
  document.getElementById('ptab-single').classList.toggle('active', tab==='single');
  document.getElementById('ptab-bulk').classList.toggle('active', tab==='bulk');
  // Toggle the Tailwind `hidden` class directly. (Setting inline
  // style.display='' can't reveal an element that still carries `hidden`.)
  document.getElementById('proj-single').classList.toggle('hidden', tab!=='single');
  document.getElementById('proj-bulk').classList.toggle('hidden', tab!=='bulk');
}

function onProjDeptChange(sel) {
  if (sel.value === 'new') {
    sel.value = '';
    closeModal('modal-new-proj');
    openModal('modal-add-dept');
    return;
  }
  var deptName = sel.options[sel.selectedIndex].text;
  var pl = PIPELINE_DATA[deptName];
  var prev = document.getElementById('pl-preview');
  var prevList = document.getElementById('pl-preview-list');
  if (pl && pl.tasks.length) {
    prevList.innerHTML = pl.tasks.map(function(t){ return '<div style="margin-bottom:3px;">▸ ' + escHtml(t.name) + (t.subtasks.length ? ' <span style="opacity:.6;">(' + t.subtasks.length + ' subtasks)</span>' : '') + '</div>'; }).join('');
    if (prev) prev.classList.add('visible');
  } else {
    if (prev) prev.classList.remove('visible');
  }
}

function onProjClientChange(sel) {
  // If user picked the "+ Add new client..." sentinel, swap modals so they
  // can create a client without losing their place. The Add Client modal's
  // success handler already appends the new client to this dropdown, so
  // when the user comes back the new option is selectable immediately.
  if (sel.value === 'new') {
    sel.value = '';
    closeModal('modal-new-proj');
    openModal('modal-add-co');
  }
}

function createProject() {
  var singleForm = document.getElementById('proj-single');
  var bulkForm   = document.getElementById('proj-bulk');

  // BUG FIX: this used to check `form.style.display !== 'none'` to detect
  // which tab is active, but setProjTab() switches tabs by toggling the
  // Tailwind `hidden` CLASS, never touching inline style.display — so that
  // check was always true and this always submitted the (usually empty)
  // Single form, even while the user was on the Bulk tab. Symptoms: "Workspace
  // required" errors despite selecting one (the Single tab's own workspace
  // select was untouched), and blank-name projects (Single tab's Name field
  // was empty, and form.submit() bypasses required-field validation).
  //
  // Fix: check the actual visibility (the `hidden` class), and submit each
  // form to its OWN dedicated server endpoint natively via requestSubmit()
  // (falls back to submit() on older browsers) so HTML5 required-field
  // validation runs before anything hits the server. This also drops the
  // fetch()/Promise.all reimplementation below in favor of the real
  // project_bulk_create view, which already handles per-line dedupe and
  // department pipeline-task loading server-side.
  var bulkActive = bulkForm && !bulkForm.classList.contains('hidden');

  if (bulkActive) {
    var clientSel = document.getElementById('proj-bulk-client');
    var ta        = document.getElementById('proj-bulk-ta');
    if (!clientSel || !clientSel.value) { showToast('Please select a workspace'); return; }
    if (!ta || !ta.value.trim()) { showToast('Enter at least one project name'); return; }
    if (bulkForm.requestSubmit) { bulkForm.requestSubmit(); } else { bulkForm.submit(); }
    return;
  }

  if (singleForm) {
    if (singleForm.requestSubmit) { singleForm.requestSubmit(); } else { singleForm.submit(); }
  }
}

/* ── PROJECT SUB-TABS ── */

function switchProjTab(projId, tab, btn) {
  var c = document.getElementById(projId); if (!c) return;
  c.querySelectorAll('.proj-view').forEach(function(p) { p.classList.remove('active'); });
  c.querySelectorAll('.proj-tab').forEach(function(t) { t.classList.remove('active'); });
  var pane = document.getElementById(projId + '-' + tab); if (pane) pane.classList.add('active');
  btn.classList.add('active');
}

/* ── PER-PROJECT TASK FILTER ── */

function addCompany() {
  var name = document.getElementById('new-co-name').value.trim();
  var err = document.getElementById('co-modal-error');
  err.style.display = 'none';
  if (!name) { err.textContent = 'Workspace name is required.'; err.style.display = ''; return; }
  var data = new FormData();
  data.append('name', name);
  data.append('contact_person', document.getElementById('new-co-contact').value.trim());
  data.append('email', document.getElementById('new-co-email').value.trim());
  data.append('phone', document.getElementById('new-co-phone').value.trim());
  data.append('color', document.getElementById('new-co-color').value);
  data.append('csrfmiddlewaretoken', window.PROJECTS_DATA.csrf);
  fetch(window.PROJECTS_DATA.urls.client_create, { method:'POST', body:data })
    .then(function(r){ return r.json(); })
    .then(function(res) {
      if (!res.ok) { err.textContent = res.error || 'Error'; err.style.display = ''; return; }
      // Add button to co-bar
      var bar = document.getElementById('co-bar');
      var addBtn = bar.querySelector('.btn--ghost');
      var btn = document.createElement('button');
      btn.className = 'co-btn'; btn.dataset.client = res.pk;
      btn.onclick = function() { filterClient(btn, String(res.pk)); };
      btn.innerHTML = '<span class="co-dot" style="background:'+escHtml(res.color)+';"></span>'+escHtml(res.name)+'<span class="co-badge">0</span>';
      bar.insertBefore(btn, addBtn);
      // Add to New Project dropdown — insert BEFORE the "+ Add new client…"
      // sentinel so it stays at the bottom. Auto-select the new client.
      var sel = document.getElementById('proj-client');
      if (sel) {
        var opt = new Option(res.name, res.pk, false, true);
        var sentinel = sel.querySelector('option[value="new"]');
        if (sentinel) sel.insertBefore(opt, sentinel); else sel.add(opt);
        // Trigger change so any pipeline preview etc. updates
        sel.dispatchEvent(new Event('change'));
      }
      // Add to Bulk Create dropdown too
      var bsel = document.getElementById('proj-bulk-client');
      if (bsel) {
        var bopt = new Option(res.name, res.pk, false, false);
        var bsentinel = bsel.querySelector('option[value="new"]');
        if (bsentinel) bsel.insertBefore(bopt, bsentinel); else bsel.add(bopt);
      }
      // Clear
      ['new-co-name','new-co-contact','new-co-email','new-co-phone'].forEach(function(id){ document.getElementById(id).value=''; });
      closeModal('modal-add-co');
      // Reopen the New Project modal so the user can continue where they
      // left off. The newly-added workspace is already auto-selected above.
      openModal('modal-new-proj');
      showToast('Workspace "' + res.name + '" added');
    })
    .catch(function(){ err.textContent = 'Network error'; err.style.display = ''; });
}

/* ── DIRECTORY (client-side only) ── */

var dirState = {};

function dirSetRoot(pid, val) {
  if (!dirState[pid]) dirState[pid] = { root:'', entries:[] };
  dirState[pid].root = val;
  renderDir(pid);
}

function dirAdd(pid, input) {
  var v = input.value.trim(); if (!v) return;
  if (!dirState[pid]) dirState[pid] = { root:'', entries:[] };
  dirState[pid].entries.push({ name:v, isFolder:v.endsWith('/'), open:false, children:[] });
  input.value = '';
  renderDir(pid);
}

function dirToggle(pid, idx) {
  if (!dirState[pid]) return;
  var e = dirState[pid].entries[idx]; if (!e) return;
  e.open = !e.open; renderDir(pid);
}

function renderDir(pid) {
  var tree = document.getElementById('dir-tree-' + pid); if (!tree) return;
  var state = dirState[pid];
  if (!state || !state.entries.length) { tree.innerHTML = '<div class="dir-empty">No files yet — set a root path or add entries below.</div>'; return; }
  tree.innerHTML = state.entries.map(function(e, i) {
    var icon = e.isFolder ? (e.open ? '📂' : '📁') : '📄';
    return '<div class="dir-row '+(e.isFolder?'folder':'file')+'" onclick="dirToggle(\''+pid+'\','+i+')">'
      +'<span>'+icon+'</span><span class="dir-name">'+escHtml(e.name.replace(/\/$/,''))+'</span></div>';
  }).join('');
}

/* ── ADD DEPARTMENT ── */

function addDepartment() {
  var name = document.getElementById('new-dept-name').value.trim();
  if (!name) { showToast('Enter a department name'); return; }
  var data = new FormData();
  data.append('name', name);
  data.append('csrfmiddlewaretoken', window.PROJECTS_DATA.csrf);
  fetch(window.PROJECTS_DATA.urls.department_create, { method:'POST', body:data })
    .then(function(r){ return r.json(); })
    .then(function(res){
      if (!res.ok) { showToast(res.error || 'Error'); return; }
      var sel = document.getElementById('proj-dept');
      if (sel) { var opt=new Option(res.name, res.pk, true, true); var newOpt=sel.querySelector('option[value="new"]'); sel.insertBefore(opt, newOpt); sel.value=res.pk; }
      document.getElementById('new-dept-name').value='';
      closeModal('modal-add-dept');
      openModal('modal-new-proj');
      showToast('Department "' + res.name + '" added');
    })
    .catch(function(){ showToast('Network error'); });
}

/* ── CONFIRM FORMS ── */
document.querySelectorAll('[data-confirm]').forEach(function(btn){
  btn.addEventListener('click', function(e){
    if (!confirm(btn.dataset.confirm)) e.preventDefault();
  });
});

/* ── BLOCKER MODAL ── */
