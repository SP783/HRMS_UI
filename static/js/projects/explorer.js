(() => {
  'use strict';
  const root = document.querySelector('.px-workspace');
  if (!root) return;
  const dialog = document.querySelector('#px-dialog'), content = document.querySelector('#px-content');
  const feedback = document.querySelector('#px-feedback'), org = root.dataset.organization;
  const csrf = document.querySelector('#px-csrf input').value;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let current = null, projectId = null, generation = 0, activeTab = 'tasks', filter = 'all', busy = false, opener = null, draft = '';
  const url = id => `${root.dataset.base}${id}/panel/?organization=${org}`;
  const message = text => { feedback.textContent = text; };
  async function request(target, options = {}) {
    const response = await fetch(target, {credentials:'same-origin', headers:{'X-Requested-With':'XMLHttpRequest'}, ...options});
    const type = response.headers.get('content-type') || '';
    if (response.redirected || !type.includes('application/json')) throw new Error('Your session or permissions changed. Reload Projects to continue.');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not complete the request. Please try again.');
    return data;
  }
  function pendingDraft() { return draft.trim() || busy; }
  function canLeave() { return !pendingDraft() || (!busy && confirm('Discard your unsent comment?')); }
  async function open(id, trigger, preserveURL = false) {
    if (dialog.open && !canLeave()) return;
    const ticket = ++generation;
    projectId = String(id); opener = trigger || document.activeElement; current = null; draft = ''; activeTab = 'tasks'; filter = 'all';
    document.querySelector('#px-title').textContent = 'Loading project…';
    document.querySelector('#px-project-meta').textContent = '';
    content.innerHTML = '<div class="px-loading"></div><div class="px-loading"></div><div class="px-loading"></div>';
    document.querySelector('#px-org').textContent = 'Project';
    document.querySelector('#px-full').href = root.dataset.base + id + '/';
    message('Loading tasks and subtasks…');
    if (!dialog.open) dialog.showModal();
    if (!preserveURL) { const next = new URL(location.href); next.searchParams.set('project', id); history.replaceState(null, '', next); }
    try { const data = await request(url(id)); if (ticket !== generation || !dialog.open) return; current = data; render(); message(''); }
    catch (error) { if (ticket !== generation) return; document.querySelector('#px-title').textContent = 'Project unavailable'; content.innerHTML = '<p class="px-muted">Your list and filters are still here. You can close this window or retry.</p><button class="px-button" data-retry>Retry</button>'; message(error.message); }
  }
  function close() {
    if (!canLeave()) return;
    ++generation; dialog.close(); draft = ''; current = null;
    const next = new URL(location.href); next.searchParams.delete('project'); history.replaceState(null, '', next);
    if (opener?.isConnected) opener.focus();
  }
  const matches = item => filter === 'all' || (filter === 'open' ? item.status !== 'done' : filter === 'mine' ? item.mine : filter === 'overdue' ? item.overdue : item.status === filter);
  function assigneeInitials(names) {
    return names.length ? names.slice(0, 3).map(name => `<span class="px-assignee-avatar">${escape(name.split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase())}</span>`).join(' ') + (names.length > 3 ? '<span class="px-assignee-avatar" aria-hidden="true">+</span>' : '') : '+';
  }
  function row(item) {
    const label = current.statuses.find(([value]) => value === item.status)?.[1] || item.status;
    const status = item.can_update ? `<select aria-label="Status for ${escape(item.title)}" data-status-id="${item.id}" data-kind="${item.kind}">${current.statuses.map(([code, name]) => `<option value="${code}" ${code === item.status ? 'selected' : ''}>${escape(name)}</option>`).join('')}</select>` : `<span class="px-status" data-status="${escape(item.status)}">${escape(label)}</span>`;
    const assigneeNames = item.assignees.join(', ') || 'Unassigned';
    const assignee = item.can_assign ? `<details class="px-assignee-picker"><summary title="${escape(assigneeNames)}" aria-label="Assignees: ${escape(assigneeNames)}"><span class="px-assignee-trigger" style="display:flex;flex-wrap:wrap;gap:3px;max-width:none;justify-content:center">${assigneeInitials(item.assignees)}</span></summary><div class="px-assignee-options"><input type="search" placeholder="Search team members…" aria-label="Search team members" data-assignee-search><div class="px-assignee-list">${current.assignee_options.map(u => { const initials = u.name.split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase(); return `<label data-assignee-option><input type="checkbox" data-assignee-id="${item.id}" data-kind="${item.kind}" data-profile-id="${u.id}" ${item.assignee_ids.includes(u.id) ? 'checked' : ''}><span class="px-assignee-avatar">${escape(initials)}</span><span>${escape(u.name)}</span></label>`; }).join('')}</div><footer><span data-assignee-count>${item.assignee_ids.length} selected</span></footer></div></details>` : `<span title="${escape(assigneeNames)}" aria-label="Assignees: ${escape(assigneeNames)}">${assigneeInitials(item.assignees)}</span>`;
    const due = item.can_update ? `<input type="date" aria-label="Due date for ${escape(item.title)}" value="${escape(item.due)}" data-due-id="${item.id}" data-kind="${item.kind}">` : escape(item.due || 'Not set');
    return `<div class="px-task-main"><div><div class="px-task-title">${escape(item.title)} ${item.can_update ? `<button class="px-button px-pencil" style="padding:2px 5px" data-px-action="edit" data-item="${item.id}" data-kind="${item.kind}" aria-label="Edit ${escape(item.title)}" title="Edit">✎</button>` : ''} ${item.priority ? `<span class="px-status" data-priority="${escape(item.priority)}">${escape(item.priority)}</span>` : ''}</div><div class="px-item-tools">${item.can_add_subtasks ? `<button class="px-button" data-px-action="subtasks" data-item="${item.id}">+ Subtasks</button>` : ''}${item.can_delete ? `<button class="px-button" data-px-action="delete" data-item="${item.id}" data-kind="${item.kind}">Delete</button>` : ''}${item.kind === 'task' ? `<span class="px-muted">Completed: ${escape(item.completed_at || '—')}</span>` : ''}</div>${item.blocked_note ? `<p class="px-task-note">Blocked: ${escape(item.blocked_note)}</p>` : ''}${item.description ? `<p class="px-task-note">${escape(item.description)}</p>` : ''}</div><div>${status}</div><div class="px-muted"><span class="px-label">Assignee</span>${assignee}</div><div class="${item.overdue ? 'px-overdue' : 'px-muted'}"><span class="px-label">${item.overdue ? 'Overdue' : 'Due'}</span>${due}</div></div>`;
  }
  function taskView() {
    const options = [['open','Open'],['all','All'],['mine','Assigned to me'],['overdue','Overdue'],['blocked','Blocked'],['review','In review'],['done','Completed']];
    let html = '';
    const tasks = current.tasks.filter(t => matches(t) || t.subtasks.some(matches));
    if (!tasks.length) return html + '<div class="px-empty"><h2>No tasks match this view</h2><p>Choose another filter, or add work using “Add task”.</p></div>';
    return html + tasks.map(task => {
      const subs = task.subtasks.filter(matches);
      return `<article class="px-task">${row(task)}${task.subtasks.length ? `<details data-task-id="${task.id}" ${filter !== 'open' && filter !== 'all' ? 'open' : ''}><summary>${task.subtasks.filter(s => s.status === 'done').length}/${task.subtasks.length} subtasks complete · ${subs.length} shown</summary><div class="px-subtasks">${subs.map(s => `<div class="px-subtask">${row(s)}</div>`).join('') || '<p class="px-muted">No subtasks match this filter.</p>'}</div></details>` : ''}</article>`;
    }).join('');
  }
  function render() {
    if (!current) return;
    document.querySelector('#px-org').textContent = current.organization + ' / ' + current.workspace;
    document.querySelector('#px-full').href = current.detail_url;
    const expanded = [...content.querySelectorAll('details[open][data-task-id]')].map(el => el.dataset.taskId);
    document.querySelector('#px-title').textContent = current.name;
    const dateField = (name, label) => current.edit_url ? `<label>${label} <input type="date" data-project-date="${name}" aria-label="Project ${label.toLowerCase()}" value="${escape(current[name] || '')}"></label>` : `<span>${label}: ${escape(current[name] || 'Not set')}</span>`;
    document.querySelector('#px-project-meta').innerHTML = `<span>${escape(current.status)}</span><span>Handler: ${escape(current.owner)}</span>${dateField('start_date','Start date')}${dateField('end_date','End date')}<span>Workspace: ${escape(current.workspace)}</span><span>Department: ${escape(current.department || 'Not set')}</span>`;
    content.innerHTML = `${current.description ? `<p class="px-task-note">${escape(current.description)}</p>` : ''}<div class="px-metrics"><div class="px-metric"><strong>${current.task_done}/${current.tasks.length}</strong><span class="px-muted">Tasks complete</span></div><div class="px-metric"><strong>${current.subtask_done}/${current.subtask_total}</strong><span class="px-muted">Subtasks complete</span></div><div class="px-metric"><strong>${current.blocked}</strong><span class="px-muted">Blocked items</span></div></div><div class="px-nav-actions"><div class="px-tabs" aria-label="Project sections">${[['tasks','Tasks'],['discussion','Discussion'],['activity','Recent activity'],['directory','Directory']].map(([code,label]) => `<button class="px-button" data-tab="${code}" aria-pressed="${activeTab === code}">${label}</button>`).join('')}</div><div class="px-actions">${current.add_task_url ? `<button class="px-button px-primary" data-px-action="tasks">+ Add tasks</button>` : ''}<label class="px-filter-select">Filter<select data-filter-select aria-label="Task filter"><option value="all" ${filter === 'all' ? 'selected' : ''}>All</option><option value="todo" ${filter === 'todo' ? 'selected' : ''}>To Do</option><option value="in_progress" ${filter === 'in_progress' ? 'selected' : ''}>In Progress</option><option value="open" ${filter === 'open' ? 'selected' : ''}>Open</option><option value="mine" ${filter === 'mine' ? 'selected' : ''}>Assigned to me</option><option value="overdue" ${filter === 'overdue' ? 'selected' : ''}>Overdue</option><option value="blocked" ${filter === 'blocked' ? 'selected' : ''}>Blocked</option><option value="review" ${filter === 'review' ? 'selected' : ''}>In review</option><option value="done" ${filter === 'done' ? 'selected' : ''}>Completed</option></select></label></div></div><section id="px-tab-content"></section>`;
    const hoursBlock = document.createElement('details');
    hoursBlock.className = 'px-hours-breakdown';
    hoursBlock.innerHTML = `<summary>Logged hours: ${escape(Number(current.logged_hours || 0).toFixed(1))}h · View by employee</summary><div>${current.hours_by_employee.length ? current.hours_by_employee.map(item => `<div class="px-hours-person"><span>${escape(item.name)}</span><strong>${escape(Number(item.hours).toFixed(1))}h</strong></div>`).join('') : '<p class="px-muted">No hours logged for this project yet.</p>'}</div>`;
    content.querySelector('.px-metrics').after(hoursBlock);
    const body = content.querySelector('#px-tab-content');
    if (activeTab === 'tasks') body.innerHTML = taskView();
    else if (activeTab === 'directory') drawDirectory(body);
    else if (activeTab === 'activity') {
      const items = current.tasks.flatMap(t => [t, ...t.subtasks]).sort((a,b) => b.version.localeCompare(a.version)).slice(0,20);
      body.innerHTML = '<p class="px-muted">Latest task and subtask updates. This shows current state, not a complete change history.</p>' + (items.map(i => `<div class="px-activity"><strong>${escape(i.title)}</strong><div class="px-muted">${escape(i.status.replaceAll('_',' '))} · Updated ${escape(new Date(i.version).toLocaleString())}</div></div>`).join('') || '<p class="px-empty">No task activity yet.</p>');
    } else loadComments();
    expanded.forEach(id => { const el = content.querySelector(`details[data-task-id="${id}"]`); if (el) el.open = true; });
  }
  async function loadComments() {
    const id = projectId, ticket = generation;
    const body = content.querySelector('#px-tab-content'); body.innerHTML = '<p class="px-muted">Loading discussion…</p>';
    try { const data = await request(current.comments_url + '?organization=' + org); if (ticket !== generation || id !== projectId || activeTab !== 'discussion') return; drawComments(data); }
    catch(error) { if (ticket === generation) { body.textContent = error.message; } }
  }
  function drawComments(data) {
    const body = content.querySelector('#px-tab-content');
    body.innerHTML = `<div class="px-discussion"><p class="px-muted">${data.total} comments · Showing the latest 10</p>${data.comments.map(c => `<article><strong>${escape(c.author_name)}</strong><span class="px-muted"> · ${escape(c.created_at_human)}</span><p>${escape(c.body)}</p></article>`).join('') || '<p class="px-empty">Start a conversation about this project.</p>'}${data.can_post ? `<form id="px-comment-form"><label for="px-comment">Add a comment</label><textarea id="px-comment" maxlength="5000" required placeholder="Share an update or ask a question…">${escape(draft)}</textarea><button class="px-button px-primary" type="submit">Post comment</button></form>` : '<p class="px-muted">You have read-only access to this discussion.</p>'}</div>`;
  }
  root.addEventListener('click', async event => {
    const link = event.target.closest('[data-open-project]');
    if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); open(link.dataset.openProject, link); return; }

  });
  content.addEventListener('click', async event => {
    const retry = event.target.closest('[data-retry]'); if (retry) { open(projectId, opener, true); return; }
    const tab = event.target.closest('[data-tab]');
    if (tab && !busy) { activeTab = tab.dataset.tab; render(); content.querySelector(`[data-tab="${activeTab}"]`)?.focus(); return; }
    const f = event.target.closest('[data-filter]'); if (f && !busy) { filter = f.dataset.filter; render(); content.querySelector(`[data-filter="${filter}"]`)?.focus(); return; }
    if (event.target.closest('[data-refresh]') && !busy) { const ticket = generation; message('Refreshing…'); try { const data = await request(url(projectId)); if (ticket !== generation || !dialog.open) return; current = data; render(); message('Up to date.'); updateSummary(); } catch(error) { if (ticket === generation) message(error.message); } }
  });
  content.addEventListener('input', event => {
    if (event.target.id === 'px-comment') draft = event.target.value;
    const search = event.target.closest('[data-assignee-search]');
    if (search) {
      const query = search.value.trim().toLowerCase();
      search.closest('.px-assignee-options').querySelectorAll('[data-assignee-option]').forEach(row => { row.hidden = query && !row.textContent.toLowerCase().includes(query); });
    }
  });
  content.addEventListener('change', async event => {
    const filterSelect = event.target.closest('[data-filter-select]');
    if (filterSelect && !busy) { filter = filterSelect.value; render(); return; }
    const assigneeCheck = event.target.closest('input[data-assignee-id]');
    if (assigneeCheck && !busy) {
      const item = current.tasks.flatMap(t => [t, ...t.subtasks]).find(i => i.id === Number(assigneeCheck.dataset.assigneeId) && i.kind === assigneeCheck.dataset.kind);
      if (!item) return;
      const picker = assigneeCheck.closest('.px-assignee-picker');
      const selected = [...picker.querySelectorAll('input[data-profile-id]:checked')].map(input => Number(input.dataset.profileId));
      const count = picker.querySelector('[data-assignee-count]'); if (count) count.textContent = `${selected.length} selected`;
      const form = new FormData(); form.append('csrfmiddlewaretoken', csrf); selected.forEach(id => form.append('profile_ids', id));
      busy = true; assigneeCheck.closest('.px-assignee-picker').querySelectorAll('input').forEach(input => input.disabled = true); message('Saving assignees…');
      try { await request(item.assignment_url, {method:'POST', body:form}); item.assignee_ids = selected; item.assignees = selected.map(id => current.assignee_options.find(u => u.id === id)?.name).filter(Boolean); const summary = picker.querySelector('summary'); summary.title = item.assignees.join(', ') || 'Unassigned'; summary.setAttribute('aria-label', 'Assignees: ' + summary.title); picker.querySelector('.px-assignee-trigger').innerHTML = assigneeInitials(item.assignees); message('Assignees updated.'); }
      catch(error) { picker.querySelectorAll('input[data-profile-id]').forEach(input => { input.checked = item.assignee_ids.includes(Number(input.dataset.profileId)); }); if (count) count.textContent = `${item.assignee_ids.length} selected`; message(error.message); }
      finally { busy = false; picker.querySelectorAll('input').forEach(input => input.disabled = false); }
      return;
    }
    const dueInput = event.target.closest('[data-due-id]');
    if (dueInput && !busy) {
      const item = current.tasks.flatMap(t => [t, ...t.subtasks]).find(i => i.id === Number(dueInput.dataset.dueId) && i.kind === dueInput.dataset.kind);
      if (!item) return;
      const form = new FormData(); Object.entries({csrfmiddlewaretoken:csrf, kind:item.kind, id:item.id, status:item.status, version:item.version, due_date:dueInput.value, blocked_note:item.blocked_note || ''}).forEach(([k,v]) => form.append(k,v));
      busy = true; dueInput.disabled = true; message('Saving due date…');
      try { current = await request(url(projectId), {method:'POST', body:form}); render(); message('Due date updated.'); updateSummary(); }
      catch(error) { message(error.message); }
      finally { busy = false; }
      return;
    }
    const select = event.target.closest('[data-status-id]'); if (!select || busy) return;
    const items = current.tasks.flatMap(t => [t,...t.subtasks]);
    const item = items.find(i => i.id === Number(select.dataset.statusId) && i.kind === select.dataset.kind);
    let note = item.blocked_note;
    if (select.value === 'blocked') { note = prompt('What is blocking this work?', note || ''); if (note === null) { select.value = item.status; return; } }
    const form = new FormData(); Object.entries({csrfmiddlewaretoken:csrf, kind:item.kind, id:item.id, status:select.value, version:item.version, blocked_note:note || ''}).forEach(([k,v]) => form.append(k,v));
    busy = true; content.querySelectorAll('select').forEach(el => { el.disabled = true; }); message('Saving…');
    try { current = await request(url(projectId), {method:'POST', body:form}); render(); message('Saved. Project totals updated.'); updateSummary(); }
    catch(error) { select.value = item.status; message(error.message); }
    finally { busy = false; content.querySelectorAll('select').forEach(el => { el.disabled = false; }); }
  });
  function updateSummary() {
    const row = root.querySelector(`[data-project="${projectId}"]`); if (!row) { htmx.ajax('GET', location.pathname + location.search, {target:'#px-list-region', select:'#px-list-region', swap:'outerHTML'}); return; }
    const progress = row.querySelector('progress'); progress.value = current.task_done; progress.max = current.tasks.length || 1;
    row.querySelector('.px-progress .px-label').textContent = `${current.task_done}/${current.tasks.length} tasks`;
  }
  content.addEventListener('submit', async event => {
    if (event.target.id !== 'px-comment-form') return;
    event.preventDefault(); if (busy) return; busy = true; const button = event.target.querySelector('button'); button.disabled = true; message('Posting…');
    const form = new FormData(); form.append('csrfmiddlewaretoken',csrf); form.append('body',draft);
    try { const data = await request(current.comments_url + '?organization=' + org, {method:'POST', body:form}); draft = ''; drawComments(data); message('Comment posted.'); }
    catch(error) { message(error.message); button.disabled = false; }
    finally { busy = false; }
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  document.querySelector('#px-close').addEventListener('click',close);
  window.addEventListener('beforeunload', event => { if (pendingDraft()) { event.preventDefault(); event.returnValue = ''; } });
  const initial = new URL(location.href).searchParams.get('project'); if (/^\d+$/.test(initial || '')) open(initial, null, true);
  document.querySelector('#px-project-meta').addEventListener('change', async event => {
    if (!event.target.matches('[data-project-date]') || busy || !current) return;
    const inputs = [...document.querySelectorAll('[data-project-date]')];
    const form = new FormData(); form.append('csrfmiddlewaretoken',csrf); form.append('kind','project_dates'); form.append('version',current.project_version);
    inputs.forEach(input => { form.append(input.dataset.projectDate,input.value); input.disabled = true; });
    busy = true; message('Saving project dates…');
    try { current = await request(url(projectId),{method:'POST',body:form}); render(); message('Project dates saved.'); htmx.ajax('GET',location.pathname + location.search,{target:'#px-list-region',select:'#px-list-region',swap:'outerHTML'}); }
    catch(error) { inputs.forEach(input => input.value = current[input.dataset.projectDate] || ''); message(error.message); }
    finally { busy = false; inputs.forEach(input => input.disabled = false); }
  });
  const editor = document.querySelector('#px-editor');
  let editorBusy = false, editorDirty = false;
  const closeEditor = () => { if (!editorBusy && (!editorDirty || confirm('Discard unsaved changes?'))) { editor.close(); editorDirty = false; } };
  document.querySelector('#px-editor-close').addEventListener('click', closeEditor);
  editor.addEventListener('cancel', event => { event.preventDefault(); closeEditor(); });
  editor.addEventListener('input', () => { editorDirty = true; });
  editor.addEventListener('htmx:beforeRequest', () => { editorBusy = true; });
  editor.addEventListener('htmx:afterRequest', event => { editorBusy = false; if (!event.detail.successful) document.querySelector('#px-editor-body').insertAdjacentHTML('beforeend', '<p role="alert">Unable to complete the request. Your session, permissions or organization may have changed. Close and try again.</p>'); });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-px-action]'); if (!button || busy) return;
    event.preventDefault();
    const target = new URL(root.dataset.actionUrl, location.origin);
    Object.entries({organization:org, operation:button.dataset.pxAction, project:button.dataset.projectId || projectId || '', item:button.dataset.item || '', kind:button.dataset.kind || ''}).forEach(([key,value]) => target.searchParams.set(key,value));
    editorDirty = false; document.querySelector('#px-editor-body').textContent = 'Loading…'; editor.showModal();
    htmx.ajax('GET', target.toString(), {target:'#px-editor-body', swap:'innerHTML'});
  });
  document.addEventListener('px-saved', async event => {
    editorDirty = false; editor.close();
    if (event.detail.workspace_created) { location.reload(); return; }
    if (event.detail.removed && String(event.detail.project) === projectId) { ++generation; dialog.close(); current = null; }
    else if (dialog.open && event.detail.project && String(event.detail.project) === projectId) {
      const ticket = generation;
      try { const updated = await request(url(projectId)); if (ticket === generation && dialog.open) { current = updated; render(); message('Saved.'); } } catch(error) { message(error.message); }
    }
    htmx.ajax('GET', location.pathname + location.search, {target:'#px-list-region', select:'#px-list-region', swap:'outerHTML'});
  });
  const directoryKey = () => `hrms-directory-${root.dataset.actor}-${org}-${projectId}`;
  function readDirectory() { try { const data = JSON.parse(localStorage.getItem(directoryKey())); if (data && typeof data.root === 'string' && Array.isArray(data.entries)) return data; } catch (_) {} return {root:'', entries:[]}; }
  function drawDirectory(body) {
    const data = readDirectory();
    body.innerHTML = `<p class="px-muted">Directory notes saved in this browser. These entries do not create or browse files on the server.</p><form id="px-directory-form"><label>Root path<input name="root" value="${escape(data.root)}" maxlength="1000"></label><label>Add file or folder (end folders with /)<input name="entry" maxlength="500"></label><button class="px-button">Save</button></form><ul>${data.entries.map((name,index) => `<li>${escape(name.endsWith('/') ? '📁 ' + name : '📄 ' + name)} <button class="px-button" data-directory-remove="${index}" aria-label="Remove ${escape(name)}">×</button></li>`).join('')}</ul>`;
  }
  content.addEventListener('submit', event => {
    if (event.target.id !== 'px-directory-form') return; event.preventDefault(); const data = readDirectory(); const values = new FormData(event.target); data.root = values.get('root').trim(); const entry = values.get('entry').trim(); if (entry && !data.entries.includes(entry)) data.entries.push(entry);
    try { localStorage.setItem(directoryKey(), JSON.stringify(data)); drawDirectory(document.querySelector('#px-tab-content')); } catch (_) { message('Browser storage is unavailable. Directory notes were not saved.'); }
  });
  content.addEventListener('click', event => { const button = event.target.closest('[data-directory-remove]'); if (!button) return; const data = readDirectory(); data.entries.splice(Number(button.dataset.directoryRemove),1); try { localStorage.setItem(directoryKey(),JSON.stringify(data)); drawDirectory(document.querySelector('#px-tab-content')); } catch (_) { message('Could not save directory notes.'); } });
  function initializeColumns() {
  const columnPicker = document.querySelector('.px-column-picker');
  if (columnPicker) {
    if (!columnPicker.querySelector('[data-column-item="hours"]')) {
      const item = document.createElement('label');
      item.draggable = true;
      item.dataset.columnItem = 'hours';
      item.innerHTML = '<input type="checkbox" data-column="hours" checked> Logged hours <button type="button" data-move-column="hours" data-direction="up" aria-label="Move Logged hours left">←</button><button type="button" data-move-column="hours" data-direction="down" aria-label="Move Logged hours right">→</button>';
      columnPicker.querySelector('.px-column-options').appendChild(item);
    }
    const key = 'hrms-project-columns';
    const orderKey = 'hrms-project-column-order';
    const columns = ['workspace', 'client', 'owner', 'progress', 'hours', 'start', 'deadline', 'status', 'actions'];
    const readPreference = (name, fallback) => { try { const value = JSON.parse(localStorage.getItem(name)); return Array.isArray(value) ? value : fallback; } catch (_) { return fallback; } };
    const hidden = readPreference(key, []).filter(value => columns.includes(value));
    let order = [...new Set(readPreference(orderKey, columns).filter(value => columns.includes(value)))];
    order.push(...columns.filter(value => !order.includes(value)));
    const applyLayout = () => {
      root.dataset.hiddenColumns = hidden.join(' ');
      root.querySelectorAll('.px-project-row,.px-project-header').forEach(row => {
        order.forEach(name => { const cell = row.querySelector('.px-col-' + name); if (cell) { cell.hidden = hidden.includes(name); row.appendChild(cell); } });
      });
      root.querySelectorAll('.px-preview-row-container td').forEach(cell => cell.colSpan = 1 + columns.length - hidden.length);
      order.forEach((name, index) => {
        const item = columnPicker.querySelector('[data-column-item="' + name + '"]');
        columnPicker.querySelector('.px-column-options').appendChild(item);
        item.querySelector('input').checked = !hidden.includes(name);
        item.querySelector('[data-direction="up"]').disabled = index === 0;
        item.querySelector('[data-direction="down"]').disabled = index === order.length - 1;
      });
      try { localStorage.setItem(key, JSON.stringify(hidden)); localStorage.setItem(orderKey, JSON.stringify(order)); } catch (_) {}
    };
    applyLayout();
    columnPicker.addEventListener('change', event => { const input = event.target.closest('[data-column]'); if (!input) return; hidden.splice(0, hidden.length, ...[...columnPicker.querySelectorAll('[data-column]:not(:checked)')].map(item => item.dataset.column)); applyLayout(); });
    columnPicker.addEventListener('click', event => { const button = event.target.closest('[data-move-column]'); if (!button) return; event.preventDefault(); const index = order.indexOf(button.dataset.moveColumn); const next = index + (button.dataset.direction === 'down' ? 1 : -1); if (index < 0 || next < 0 || next >= order.length) return; [order[index], order[next]] = [order[next], order[index]]; applyLayout(); });
    let dragged = null;
    columnPicker.addEventListener('dragstart', event => { const item = event.target.closest('[data-column-item]'); if (!item) return; dragged = item.dataset.columnItem; item.classList.add('is-dragging'); });
    columnPicker.addEventListener('dragend', event => { const item = event.target.closest('[data-column-item]'); if (item) item.classList.remove('is-dragging'); dragged = null; });
    columnPicker.addEventListener('dragover', event => { if (event.target.closest('[data-column-item]')) event.preventDefault(); });
    columnPicker.addEventListener('drop', event => { const target = event.target.closest('[data-column-item]'); if (!target || !dragged || dragged === target.dataset.columnItem) return; event.preventDefault(); const from = order.indexOf(dragged); const to = order.indexOf(target.dataset.columnItem); order.splice(from, 1); order.splice(to, 0, dragged); applyLayout(); });
  }
  }
  initializeColumns();
  document.addEventListener('htmx:afterSwap', event => { if (event.target.id === 'px-list-region') initializeColumns(); });
})();
