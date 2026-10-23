/* ════════════════════════════════════════════════════════════════════════
   Projects — task & subtask interactions.

   Inline editing, status changes, and add-inline behaviour for the
   leaves of the tree:
     * filterTasks / toggleAllTasks   — per-project task filtering
     * updateTaskStatus               — status select change
     * openTaskEdit / cancelTaskEdit / saveTaskEdit / closeTaskEdit
     * addTaskInline                  — quick-create task from the row
     * updateSubStatus + openSubEdit / cancelSubEdit / saveSubEdit / closeSubEdit
     * addSubtaskInline               — quick-create subtask
     * cancelBlocker / confirmBlocker — blocker modal handlers

   Depends on:
     utils.js — escHtml, showToast, openModal, closeModal, getCsrfToken
     tree.js  — toggleSubs (used after add/save to expand subtask list)
   ════════════════════════════════════════════════════════════════════════ */


function filterTasks(projId, status, btn) {
  var tbody = document.getElementById(projId + '-tbody'); if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(function(tr) {
    tr.style.display = (status === 'all' || tr.dataset.status === status) ? '' : 'none';
  });
  if (btn) {
    btn.closest('div').querySelectorAll('.fbtn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
  }
}

/* ── CHECKBOX SELECT ALL ── */

function toggleAllTasks(tbodyId, masterCb) {
  var tbody = document.getElementById(tbodyId); if (!tbody) return;
  tbody.querySelectorAll('input[type="checkbox"]').forEach(function(cb) { cb.checked = masterCb.checked; });
}

/* ── ADD COMPANY / CLIENT ── */

var _bSel = null, _bTaskPk = null;

function cancelBlocker() {
  if (_bSel) {
    var existing = _bSel.parentElement ? _bSel.parentElement.querySelector('.blocker-note') : null;
    if (!existing) { _bSel.value = 'todo'; _bSel.className = 'ssel todo'; }
  }
  _bSel = null; _bTaskPk = null;
  closeModal('modal-blocker');
}

function confirmBlocker() {
  var task  = document.getElementById('blocker-sel').value;
  var notes = document.getElementById('blocker-notes').value.trim();
  if (!task && !notes) { document.getElementById('blocker-sel').style.borderColor='var(--red)'; return; }
  document.getElementById('blocker-sel').style.borderColor = '';
  var label = (task && task !== 'other' && task !== 'external')
    ? task + (notes ? ' — ' + notes : '')
    : (notes || task || 'Unknown');
  if (_bSel) {
    var parent = _bSel.parentElement;
    var old = parent ? parent.querySelector('.blocker-note') : null;
    if (old) old.remove();
    var note = document.createElement('span');
    note.className = 'blocker-note';
    note.dataset.b = label;
    note.title = 'Click to edit blocker';
    note.textContent = '🚫 ' + (label.length > 30 ? label.slice(0,30) + '…' : label);
    note.onclick = function(e) {
      e.stopPropagation();
      _bSel = note.previousElementSibling;
      document.getElementById('blocker-notes').value = note.dataset.b || '';
      openModal('modal-blocker');
    };
    _bSel.insertAdjacentElement('afterend', note);
  }
  if (_bTaskPk) {
    var pk = _bTaskPk;
    var data = new FormData();
    data.append('status', 'blocked');
    data.append('csrfmiddlewaretoken', window.PROJECTS_DATA.csrf);
    fetch('/projects/tasks/' + pk + '/status/', {
      method: 'POST', body: data,
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(function(r) { return r.json(); })
    .then(function(res) {
      var tr = document.getElementById('tr-' + pk);
      if (tr) { tr.dataset.status = 'blocked'; }
      if (res.ok) showToast('Task blocked');
    });
  }
  _bSel = null; _bTaskPk = null;
  closeModal('modal-blocker');
}

/* ── TASK STATUS (AJAX, no page reload) ── */

function updateTaskStatus(taskPk, sel) {
  var newStatus = sel.value;
  if (newStatus === 'blocked') {
    _bSel = sel;
    _bTaskPk = taskPk;
    document.getElementById('blocker-sel').value = '';
    document.getElementById('blocker-notes').value = '';
    var existing = sel.parentElement ? sel.parentElement.querySelector('.blocker-note') : null;
    if (existing) document.getElementById('blocker-notes').value = existing.dataset.b || '';
    openModal('modal-blocker');
    return;
  }
  var old = sel.parentElement ? sel.parentElement.querySelector('.blocker-note') : null;
  if (old) old.remove();
  var data = new FormData();
  data.append('status', newStatus);
  data.append('csrfmiddlewaretoken', window.PROJECTS_DATA.csrf);
  fetch('/projects/tasks/' + taskPk + '/status/', {
    method: 'POST', body: data,
    headers: { 'X-Requested-With': 'XMLHttpRequest' }
  })
  .then(function(r) { return r.json(); })
  .then(function(res) {
    if (!res.ok) { showToast('Status update failed'); return; }
    sel.className = 'ssel ' + res.status;
    var tr = document.getElementById('tr-' + taskPk);
    if (tr) {
      tr.dataset.status = res.status;
      var tds = tr.querySelectorAll('td');
      if (tds[5]) {
        tds[5].style.color = res.completed_at ? 'var(--green)' : 'var(--ink3)';
        tds[5].textContent = res.completed_at ? '✓ ' + res.completed_at : '—';
      }
    }
    showToast('Status → ' + res.status_display);
  })
  .catch(function() { showToast('Network error'); });
}

/* ── INLINE TASK EDIT PANEL ── */
/* In-place task editor.
   Click ✏️ → swap each editable cell's content with form controls.
   Click Save  → POST to task_edit (AJAX), reapply rendered values.
   Click Cancel → restore the original cell HTML.

   Why in-place rather than a row-below form? The row-below form
   shoved the task contents below a horizontal labeled-form which
   made the row layout look broken. Cell-level swaps preserve the
   table layout while making each value editable.

   We snapshot each cell's innerHTML before swapping so Cancel can
   restore the exact original DOM (including the .task-subtasks
   block, status pill, assignee stack, etc.). */

function openTaskEdit(taskPk) {
  /* Bail out of any existing edit on a different row first */
  document.querySelectorAll('tr[data-editing="1"]').forEach(function (tr) {
    if (tr.id !== 'tr-' + taskPk) cancelTaskEdit(parseInt(tr.dataset.editing_pk, 10));
  });

  var tr = document.getElementById('tr-' + taskPk);
  if (!tr) return;
  if (tr.dataset.editing === '1') return;  /* already editing */

  var title    = tr.dataset.title    || '';
  var priority = tr.dataset.priority || 'medium';
  var due      = tr.dataset.due      || '';
  var status   = tr.dataset.status   || 'todo';

  /* Snapshot the original cells so Cancel can restore them.
     We use indices that match the cell order:
       0=checkbox, 1=name, 2=status, 3=assignees, 4=deadline, 5=completed, 6=actions */
  var cells = tr.querySelectorAll('td');
  if (cells.length < 7) return;
  tr._origHtml = {
    name:     cells[1].innerHTML,
    deadline: cells[4].innerHTML,
    actions:  cells[6].innerHTML,
  };
  tr.dataset.editing = '1';
  tr.dataset.editing_pk = String(taskPk);
  tr.classList.add('row-editing');

  var priorityOpts = [['low','Low'],['medium','Medium'],['high','High'],['urgent','Urgent']]
    .map(function (p) {
      return '<option value="' + p[0] + '"' +
             (priority === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
    }).join('');

  /* Cell 1: title input + small inline priority picker. We keep the
     existing .task-subtasks block (subtasks list) intact below — only
     swap out the .task-name div. The whole subtasks UI stays usable. */
  var subtasksBlock = cells[1].querySelector('.task-subtasks');
  var subToggle     = cells[1].querySelector('.task-sub-toggle');
  cells[1].innerHTML =
    '<input class="finput row-edit-input" id="et-title-' + taskPk + '" ' +
      'value="' + escHtml(title) + '" style="width:calc(100% - 110px);font-size:13px;font-weight:600;padding:4px 8px;">' +
    '<select class="finput row-edit-priority" id="et-priority-' + taskPk + '" ' +
      'style="width:96px;margin-left:6px;font-size:11px;padding:3px 6px;" ' +
      'title="Priority">' + priorityOpts + '</select>';
  /* Re-attach the subtasks block that was sitting below the .task-name */
  if (subToggle)     cells[1].appendChild(subToggle);
  if (subtasksBlock) cells[1].appendChild(subtasksBlock);

  /* Cell 4: deadline as date input */
  cells[4].innerHTML =
    '<input type="date" class="finput row-edit-due" id="et-due-' + taskPk + '" ' +
      'value="' + escHtml(due) + '" style="font-size:11px;padding:3px 6px;width:100%;">';

  /* Cell 6 (actions): replace pencil + delete with Save / Cancel */
  cells[6].innerHTML =
    '<div style="display:flex;gap:4px;">' +
      '<button type="button" class="btn btn--primary btn--sm" ' +
        'style="font-size:11px;padding:3px 8px;" ' +
        'onclick="saveTaskEdit(' + taskPk + ')" title="Save (Enter)">✓</button>' +
      '<button type="button" class="btn btn--ghost btn--sm" ' +
        'style="font-size:11px;padding:3px 8px;" ' +
        'onclick="cancelTaskEdit(' + taskPk + ')" title="Cancel (Esc)">✕</button>' +
    '</div>';

  /* Status select (cell 2) and assignee stack (cell 3) are already
     editable in the row — leave them alone. */

  /* Wire keyboard shortcuts on the title input */
  var titleInput = document.getElementById('et-title-' + taskPk);
  if (titleInput) {
    titleInput.focus();
    titleInput.select();
    titleInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); saveTaskEdit(taskPk); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelTaskEdit(taskPk); }
    });
  }
}

function cancelTaskEdit(taskPk) {
  var tr = document.getElementById('tr-' + taskPk);
  if (!tr || tr.dataset.editing !== '1') return;
  var cells = tr.querySelectorAll('td');
  if (tr._origHtml) {
    cells[1].innerHTML = tr._origHtml.name;
    cells[4].innerHTML = tr._origHtml.deadline;
    cells[6].innerHTML = tr._origHtml.actions;
  }
  delete tr._origHtml;
  delete tr.dataset.editing;
  delete tr.dataset.editing_pk;
  tr.classList.remove('row-editing');
}

/* Backward-compat shim — older code paths may still call closeTaskEdit. */

function closeTaskEdit(taskPk) { cancelTaskEdit(taskPk); }

function saveTaskEdit(taskPk) {
  var tr = document.getElementById('tr-' + taskPk);
  if (!tr) return;
  var t = document.getElementById('et-title-' + taskPk);
  var p = document.getElementById('et-priority-' + taskPk);
  var d = document.getElementById('et-due-' + taskPk);
  /* Status sits in the regular status select (cell 2), not the editor */
  var s = tr.querySelector('td:nth-child(3) select');

  if (!t || !t.value.trim()) { showToast('Title is required'); return; }
  var data = new FormData();
  data.append('title',       t.value.trim());
  data.append('status',      s ? s.value : 'todo');
  data.append('priority',    p ? p.value : 'medium');
  data.append('due_date',    d ? d.value : '');
  /* Don't touch assignees on save — assignees are managed via the
     dedicated avatar-stack picker. We deliberately leave them alone
     here so a Save while the picker is mid-edit doesn't blow away
     the user's selection. */
  data.append('csrfmiddlewaretoken', getCsrfToken());

  fetch('/projects/tasks/' + taskPk + '/edit/', {
    method: 'POST', body: data,
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    credentials: 'same-origin',
  })
    .then(function (r) {
      /* Try to parse JSON regardless of status code — the backend
         returns {ok: false, error: ...} for permission denials too.
         If body isn't JSON (e.g. an HTML error page from a 500),
         synthesise a generic error so the user sees something
         actionable instead of "Network error". */
      return r.text().then(function (body) {
        try {
          return { status: r.status, parsed: JSON.parse(body) };
        } catch (e) {
          return {
            status: r.status,
            parsed: {
              ok: false,
              error: r.status === 403
                ? 'You do not have permission to do this.'
                : 'Server error (status ' + r.status + ')',
            },
          };
        }
      });
    })
    .then(function (envelope) {
      var res = envelope.parsed;
      if (!res || !res.ok) {
        showToast((res && res.error) || 'Save failed');
        return;
      }
      /* Update data-* attrs so the next edit pass starts from current state */
      tr.dataset.title    = res.title || '';
      tr.dataset.status   = res.status || '';
      tr.dataset.priority = (p ? p.value : tr.dataset.priority);
      tr.dataset.due      = res.due_date || '';

      /* Restore cells from the original snapshot, then patch new
         values into the right places. This is simpler than building
         new HTML from scratch and matches what the page would render
         on a full reload. */
      cancelTaskEdit(taskPk);

      /* Re-find cells after restore */
      var cells = tr.querySelectorAll('td');
      var nameDiv = cells[1].querySelector('[data-task-title]') || cells[1].querySelector('.task-name');
      if (nameDiv) {
        /* Set only the leading text node to the new title; keep the
           priority chip span intact. textContent= would replace
           the chip child element. We rebuild manually:
             - new text node with the title
             - keep / re-style the existing prio-chip <span>
           This is what was previously broken — the chip vanished
           after every save (May 2026 fix). */
        var newPrio = (p ? p.value : tr.dataset.priority) || 'medium';
        var prioLabel = ({low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent'})[newPrio] || newPrio;
        var chip = nameDiv.querySelector('[id^="prio-chip-"]') || nameDiv.querySelector('.prio-chip');
        if (chip) {
          chip.className = 'prio-chip prio-' + newPrio;
          chip.textContent = prioLabel;
          chip.setAttribute('title', 'Priority: ' + prioLabel);
        }
        /* Replace just the leading text node, leaving the chip in place. */
        var first = nameDiv.firstChild;
        if (first && first.nodeType === 3 /* TEXT_NODE */) {
          first.nodeValue = (res.title || '') + ' ';
        } else {
          /* Edge case: no leading text node — prepend one. */
          nameDiv.insertBefore(
            document.createTextNode((res.title || '') + ' '),
            nameDiv.firstChild
          );
        }
      }
      cells[4].innerHTML = res.due_date
        ? '<span style="font-size:11.5px;color:var(--ink2);">' + escHtml(res.due_date) + '</span>'
        : '<span style="font-size:11.5px;color:var(--ink2);">—</span>';
      var statusSel = cells[2].querySelector('select');
      if (statusSel) {
        statusSel.value = res.status || 'todo';
        /* Update the status pill colour class */
        if (statusSel.classList.contains('ssel')) statusSel.className = 'ssel ' + (res.status || 'todo');
      }
      showToast('Task updated');
    })
    .catch(function () { showToast('Network error'); });
}

/* Helper: read CSRF from the cookie (matches assignee picker pattern). */

function addTaskInline(projectPk, input) {
  var title = input.value.trim();
  if (!title) return;
  var data = new FormData();
  data.append('title', title);
  data.append('csrfmiddlewaretoken', window.PROJECTS_DATA.csrf);
  fetch('/projects/' + projectPk + '/tasks/inline/', { method: 'POST', body: data })
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (!res.ok) { showToast(res.error || 'Failed to add task'); return; }
      var tbody = document.getElementById('pt-' + projectPk + '-tbody');
      var addRow = document.getElementById('add-task-row-' + projectPk);
      if (!tbody) { showToast('Task added! Reload to see.'); input.value = ''; return; }
      var emptyRow = tbody.querySelector('td[colspan="7"]');
      if (emptyRow) emptyRow.closest('tr').remove();
      var tr = document.createElement('tr');
      tr.id = 'tr-' + res.pk;
      tr.dataset.status = res.status;
      tr.innerHTML = '<td><input type="checkbox"></td>'
        + '<td><div class="task-name">' + escHtml(res.title) + '</div>'
        + '<span class="task-sub-toggle" onclick="toggleSubs(\'subs-' + res.pk + '\',this)">▶ Add subtasks</span>'
        + '<div class="task-subtasks" id="subs-' + res.pk + '" style="display:none;">'
        + '<div class="sub-row" style="border-top:1px solid var(--border2);padding-top:5px;margin-top:3px;">'
        + '<input class="finput" id="newsub-' + res.pk + '" placeholder="Add subtask…" style="font-size:11px;padding:3px 7px;flex:1;min-width:0;" onkeydown="if(event.key===\'Enter\'){addSubtaskInline(' + res.pk + ',this);event.preventDefault();}">'
        + '<button class="btn btn--ghost btn--sm" style="font-size:10px;padding:2px 6px;flex-shrink:0;" onclick="addSubtaskInline(' + res.pk + ',document.getElementById(\'newsub-' + res.pk + '\'))">+</button>'
        + '</div></div></td>'
        + '<td><select class="ssel ' + escHtml(res.status) + '" onchange="updateTaskStatus(' + res.pk + ',this)"><option value="todo" selected>To Do</option><option value="in_progress">In Progress</option><option value="review">In Review</option><option value="done">Done</option><option value="blocked">Blocked</option></select></td>'
        + '<td><span style="color:var(--ink3);">—</span></td>'
        + '<td style="font-size:11.5px;color:var(--ink2);">—</td>'
        + '<td style="font-size:11.5px;color:var(--ink3);">—</td>'
        + '<td><div style="display:flex;gap:4px;"><button class="act" title="Edit" onclick="openTaskEdit(' + res.pk + ')">✏️</button></div></td>';
      if (addRow) tbody.insertBefore(tr, addRow);
      else tbody.appendChild(tr);
      input.value = '';
      showToast('Task "' + escHtml(res.title) + '" added');
    })
    .catch(function() { showToast('Network error'); });
}

/* ── SUBTASK STATUS (AJAX) ── */

function updateSubStatus(subPk, sel) {
  var data = new FormData();
  data.append('status', sel.value);
  data.append('csrfmiddlewaretoken', window.PROJECTS_DATA.csrf);
  fetch('/projects/subtasks/' + subPk + '/status/', {
    method: 'POST', body: data,
    headers: { 'X-Requested-With': 'XMLHttpRequest' }
  })
  .then(function(r) { return r.json(); })
  .then(function(res) {
    if (!res.ok) { showToast('Update failed'); return; }
    sel.className = 'ssel ' + res.status + ' ' + sel.className.split(' ').slice(2).join(' ');
    sel.className = ('ssel ' + res.status).trim();
    sel.className += ' ';  /* force refresh */
    sel.className = 'ssel ' + res.status;
    var row = document.getElementById('sub-row-' + subPk);
    if (row) row.dataset.status = res.status;
    showToast('Subtask → ' + res.status_display);
  })
  .catch(function() { showToast('Network error'); });
}

/* ── SUBTASK INLINE EDIT ── (in-place version)
   Same pattern as openTaskEdit: snapshot the row's innerHTML, replace
   the title cell with an <input>, swap the edit pencil for Save/Cancel
   buttons. The status select and assignee picker are already editable
   in the row, so we leave them alone. */

function openSubEdit(subPk) {
  /* Cancel any other open sub-edit */
  document.querySelectorAll('.sub-row[data-editing="1"]').forEach(function (r) {
    if (r.id !== 'sub-row-' + subPk) cancelSubEdit(parseInt(r.dataset.editing_pk, 10));
  });

  var row = document.getElementById('sub-row-' + subPk);
  if (!row) return;
  if (row.dataset.editing === '1') return;

  var title = row.dataset.title || (row.querySelector('.sub-name') ? row.querySelector('.sub-name').textContent.trim() : '');

  /* Snapshot the inner HTML so Cancel can restore exactly */
  row._origHtml = row.innerHTML;
  row.dataset.editing = '1';
  row.dataset.editing_pk = String(subPk);
  row.classList.add('row-editing');

  /* Find existing pieces we want to keep */
  var statusSel    = row.querySelector('select.ssel');
  var assigneeStack = row.querySelector('.assignee-stack');

  /* Build new content: [status dot] [title input] [assignee stack] [Save] [Cancel] [status pill] */
  var statusHtml   = statusSel ? statusSel.outerHTML : '';
  var assigneeHtml = assigneeStack ? assigneeStack.outerHTML : '';
  var statusDot    = row.querySelector('.sub-status-dot');
  var dotHtml      = statusDot ? statusDot.outerHTML : '';

  row.innerHTML =
    dotHtml +
    '<input class="finput row-edit-input" id="se-title-' + subPk + '" ' +
      'value="' + escHtml(title) + '" ' +
      'style="flex:1;font-size:11.5px;padding:3px 7px;min-width:80px;">' +
    assigneeHtml +
    '<button type="button" class="btn btn--primary btn--sm" ' +
      'style="font-size:10px;padding:2px 7px;flex-shrink:0;" ' +
      'onclick="saveSubEdit(' + subPk + ')" title="Save">✓</button>' +
    '<button type="button" class="btn btn--ghost btn--sm" ' +
      'style="font-size:10px;padding:2px 7px;flex-shrink:0;" ' +
      'onclick="cancelSubEdit(' + subPk + ')" title="Cancel">✕</button>' +
    statusHtml;

  var ti = document.getElementById('se-title-' + subPk);
  if (ti) {
    ti.focus();
    ti.select();
    ti.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); saveSubEdit(subPk); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelSubEdit(subPk); }
    });
  }
}

function cancelSubEdit(subPk) {
  var row = document.getElementById('sub-row-' + subPk);
  if (!row || row.dataset.editing !== '1') return;
  if (row._origHtml != null) row.innerHTML = row._origHtml;
  delete row._origHtml;
  delete row.dataset.editing;
  delete row.dataset.editing_pk;
  row.classList.remove('row-editing');
}

/* Backward-compat shim — older callers may still invoke closeSubEdit. */

function closeSubEdit(subPk) { cancelSubEdit(subPk); }

function saveSubEdit(subPk) {
  var row = document.getElementById('sub-row-' + subPk);
  if (!row) return;
  var t = document.getElementById('se-title-' + subPk);
  var s = row.querySelector('select.ssel');  /* the in-row status pill */

  if (!t || !t.value.trim()) { showToast('Title required'); return; }
  var data = new FormData();
  data.append('title',  t.value.trim());
  data.append('status', s ? s.value : 'todo');
  /* Don't touch assignees on save — they're managed via the avatar
     stack picker, like with tasks. */
  data.append('csrfmiddlewaretoken', getCsrfToken());

  fetch('/projects/subtasks/' + subPk + '/edit/', {
    method: 'POST', body: data,
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    credentials: 'same-origin',
  })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (!res || !res.ok) {
        showToast((res && res.error) || 'Save failed');
        return;
      }
      row.dataset.title  = res.title || '';
      row.dataset.status = res.status || '';
      cancelSubEdit(subPk);
      /* Patch the restored row with the new title + status */
      var nameEl = row.querySelector('.sub-name');
      if (nameEl) nameEl.textContent = res.title || '';
      var statusSel = row.querySelector('select.ssel');
      if (statusSel) {
        statusSel.value = res.status || 'todo';
        statusSel.className = 'ssel sub-status-pill ' + (res.status || 'todo');
      }
      var dot = row.querySelector('.sub-status-dot');
      if (dot) {
        /* Reset the dot's status class without touching other classes */
        dot.className = 'sub-status-dot sub-status-dot--' + (res.status || 'todo');
      }
      showToast('Subtask saved');
    })
    .catch(function () { showToast('Network error'); });
}

/* ── INLINE SUBTASK ADD ── */

function addSubtaskInline(taskPk, input, assignedSel) {
  var title = input.value.trim();
  if (!title) return;
  var assigned = assignedSel ? assignedSel.value : '';
  var data = new FormData();
  data.append('title', title);
  data.append('assigned_to', assigned);
  data.append('csrfmiddlewaretoken', window.PROJECTS_DATA.csrf);
  fetch('/projects/tasks/' + taskPk + '/subtasks/inline/', { method: 'POST', body: data })
    .then(function(r) {
      // Distinguish a clean JSON reply from an HTTP error (e.g. a 500 HTML
      // page from a transient DB lock). Parsing HTML as JSON would otherwise
      // throw and surface as a misleading "Network error" even though the
      // subtask may have been created.
      var ct = r.headers.get('content-type') || '';
      if (ct.indexOf('application/json') === -1) {
        return r.text().then(function(t) {
          var e = new Error('non-json'); e._status = r.status; e._body = t; throw e;
        });
      }
      return r.json();
    })
    .then(function(res) {
      if (!res.ok) { showToast(res.error || 'Failed'); return; }
      // The server confirmed the subtask was created. From here on, any
      // failure is a DOM/rendering glitch — NOT a network problem — so we
      // must never report it as one. Worst case: tell the user to refresh.
      try {
        var container = document.getElementById('subs-' + taskPk);
        if (!container) { showToast('Subtask added — refresh to see it.'); input.value = ''; return; }
        var addDiv = document.getElementById('sub-add-' + taskPk);
        var div = document.createElement('div');
        div.className = 'sub-row';
        div.id = 'sub-row-' + res.pk;
        div.dataset.sub      = res.pk;
        div.dataset.title    = res.title;
        div.dataset.status   = res.status;
        div.dataset.assigned = res.assigned_pk || '';
        // The avatar shown immediately after creation is a minimal
        // stub. The real interactive assignee picker chip renders on
        // page refresh via the template's {% assignee_stack %}; until
        // then, just show the legacy single-assignee circle if the
        // backend returned one.
        var avHtml = res.assigned_name
          ? '<div class="av-mini c1" style="width:18px;height:18px;font-size:8px;flex-shrink:0;" title="'+escHtml(res.assigned_name)+'">'+escHtml(res.assigned_initials)+'</div>'
          : '<span class="av-mini av-empty" style="width:18px;height:18px;font-size:10px;flex-shrink:0;" title="Refresh to assign">—</span>';
        div.innerHTML =
          '<span class="sub-status-dot sub-status-dot--'+escHtml(res.status)+'" title="'+escHtml(res.status)+'"></span>'
          +'<span class="sub-name">'+escHtml(res.title)+'</span>'
          + avHtml
          +'<button class="act" style="width:20px;height:20px;font-size:10px;flex-shrink:0;" title="Edit subtask" onclick="openSubEdit('+res.pk+')">✏️</button>'
          +'<select class="ssel sub-status-pill '+escHtml(res.status)+'" style="font-size:10px;padding:1px 6px;flex-shrink:0;margin-left:auto;" onchange="updateSubStatus('+res.pk+',this)">'
          +'<option value="todo" selected>To Do</option><option value="in_progress">In Progress</option>'
          +'<option value="review">In Review</option><option value="done">Done</option><option value="blocked">Blocked</option>'
          +'</select>';
        // insertBefore throws NotFoundError if addDiv isn't a direct child of
        // container (DOM structure can vary by view). Guard against it so the
        // row renders live instead of throwing.
        if (addDiv && addDiv.parentNode === container) container.insertBefore(div, addDiv);
        else container.appendChild(div);
        input.value = '';
        if (assignedSel) assignedSel.value = '';
        showToast('Subtask added');
      } catch (domErr) {
        console.error('Subtask create: created OK but DOM update failed', domErr);
        if (input) input.value = '';
        showToast('Subtask added — refresh to see it.');
      }
    })
    .catch(function(err) {
      // Reached only when the request itself failed (no usable response).
      // err._status set => server responded but not with JSON (e.g. a 500
      // HTML page); the row may still have been written.
      if (err && err._status) {
        console.error('Subtask create: HTTP ' + err._status, err._body);
        showToast('Server error (' + err._status + ') — reload to check if it saved.');
      } else {
        console.error('Subtask create: request failed (no response)', err);
        showToast('Network error — could not reach the server. Try again.');
      }
    });
}

/* ── TASK / SUBTASK DELETE (AJAX) ──
   Removes just the row instead of reloading the whole page. The delete views
   return JSON when called with X-Requested-With; the success path removes the
   DOM row, and (as with create) a confirmed server delete is never reported
   as a network error. */
function deleteSubtaskInline(subPk) {
  if (!confirm('Delete this subtask?')) return;
  var data = new FormData();
  data.append('csrfmiddlewaretoken', window.PROJECTS_DATA.csrf);
  fetch('/projects/subtasks/' + subPk + '/delete/', {
    method: 'POST', body: data, headers: { 'X-Requested-With': 'XMLHttpRequest' }
  })
    .then(function(r) {
      var ct = r.headers.get('content-type') || '';
      if (ct.indexOf('application/json') === -1) { var e = new Error('non-json'); e._status = r.status; throw e; }
      return r.json();
    })
    .then(function(res) {
      if (!res.ok) { showToast(res.error || 'Delete failed'); return; }
      try {
        var row = document.getElementById('sub-row-' + subPk);
        if (row) row.remove();
        showToast('Subtask deleted');
      } catch (domErr) {
        console.error('Subtask delete: removed on server but DOM update failed', domErr);
        showToast('Deleted — refresh to update.');
      }
    })
    .catch(function(err) {
      if (err && err._status) { console.error('Subtask delete: HTTP ' + err._status); showToast('Server error (' + err._status + ') — reload to check.'); }
      else { console.error('Subtask delete: request failed (no response)', err); showToast('Network error — could not reach the server. Try again.'); }
    });
}

function deleteTaskInline(taskPk) {
  if (!confirm('Delete this task?')) return;
  var data = new FormData();
  data.append('csrfmiddlewaretoken', window.PROJECTS_DATA.csrf);
  fetch('/projects/tasks/' + taskPk + '/delete/', {
    method: 'POST', body: data, headers: { 'X-Requested-With': 'XMLHttpRequest' }
  })
    .then(function(r) {
      var ct = r.headers.get('content-type') || '';
      if (ct.indexOf('application/json') === -1) { var e = new Error('non-json'); e._status = r.status; throw e; }
      return r.json();
    })
    .then(function(res) {
      if (!res.ok) { showToast(res.error || 'Delete failed'); return; }
      try {
        var row = document.getElementById('tr-' + taskPk);
        if (row) row.remove();
        showToast('Task deleted');
      } catch (domErr) {
        console.error('Task delete: removed on server but DOM update failed', domErr);
        showToast('Deleted — refresh to update.');
      }
    })
    .catch(function(err) {
      if (err && err._status) { console.error('Task delete: HTTP ' + err._status); showToast('Server error (' + err._status + ') — reload to check.'); }
      else { console.error('Task delete: request failed (no response)', err); showToast('Network error — could not reach the server. Try again.'); }
    });
}

/* ── BULK ADD SUBTASKS ──
   Toggle a textarea (one title per line) next to the inline "+" and create
   them all in one request, appending each returned row. */
function buildSubRow(taskPk, res) {
  // Shared with addSubtaskInline's row markup so single + bulk look identical.
  var div = document.createElement('div');
  div.className = 'flex items-center gap-2 text-xs';
  div.id = 'sub-row-' + res.pk;
  div.dataset.sub = res.pk;
  div.dataset.title = res.title;
  div.dataset.status = res.status;
  div.dataset.assigned = res.assigned_pk || '';
  var avHtml = res.assigned_name
    ? '<div class="av-mini c1" style="width:18px;height:18px;font-size:8px;flex-shrink:0;" title="'+escHtml(res.assigned_name)+'">'+escHtml(res.assigned_initials)+'</div>'
    : '<span class="av-mini av-empty" style="width:18px;height:18px;font-size:10px;flex-shrink:0;" title="Refresh to assign">—</span>';
  div.innerHTML =
    '<span class="sub-status-dot sub-status-dot--'+escHtml(res.status)+'" title="'+escHtml(res.status)+'"></span>'
    +'<span class="sub-name text-gray-700 dark:text-gray-300">'+escHtml(res.title)+'</span>'
    + avHtml
    +'<button class="act" style="width:20px;height:20px;font-size:10px;flex-shrink:0;" title="Edit subtask" onclick="openSubEdit('+res.pk+')">✏️</button>'
    +'<select class="ssel sub-status-pill '+escHtml(res.status)+'" style="font-size:10px;padding:1px 6px;flex-shrink:0;margin-left:auto;" onchange="updateSubStatus('+res.pk+',this)">'
    +'<option value="todo" selected>To Do</option><option value="in_progress">In Progress</option>'
    +'<option value="review">In Review</option><option value="done">Done</option><option value="blocked">Blocked</option>'
    +'</select>';
  return div;
}

function toggleBulkSubtasks(taskPk) {
  var panel = document.getElementById('bulksub-panel-' + taskPk);
  if (!panel) return;
  var hidden = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = hidden ? '' : 'none';
  if (hidden) {
    var ta = document.getElementById('bulksub-ta-' + taskPk);
    if (ta) ta.focus();
  }
}

function submitBulkSubtasks(taskPk) {
  var ta = document.getElementById('bulksub-ta-' + taskPk);
  if (!ta) return;
  var titles = ta.value.trim();
  if (!titles) { showToast('Enter at least one subtask (one per line).'); return; }
  var data = new FormData();
  data.append('titles', titles);
  data.append('csrfmiddlewaretoken', window.PROJECTS_DATA.csrf);
  fetch('/projects/tasks/' + taskPk + '/subtasks/inline/bulk/', {
    method: 'POST', body: data, headers: { 'X-Requested-With': 'XMLHttpRequest' }
  })
    .then(function(r) {
      var ct = r.headers.get('content-type') || '';
      if (ct.indexOf('application/json') === -1) { var e = new Error('non-json'); e._status = r.status; throw e; }
      return r.json();
    })
    .then(function(res) {
      if (!res.ok) { showToast(res.error || 'Bulk add failed'); return; }
      try {
        var container = document.getElementById('subs-' + taskPk);
        var addDiv = document.getElementById('sub-add-' + taskPk);
        if (container) {
          (res.created || []).forEach(function(s) {
            var row = buildSubRow(taskPk, s);
            if (addDiv && addDiv.parentNode === container) container.insertBefore(row, addDiv);
            else container.appendChild(row);
          });
        }
        ta.value = '';
        var panel = document.getElementById('bulksub-panel-' + taskPk);
        if (panel) panel.style.display = 'none';
        showToast(res.count + ' subtask' + (res.count === 1 ? '' : 's') + ' added'
                  + (res.count ? '' : ' (all were duplicates)'));
        if (!container && res.count) showToast(res.count + ' added — refresh to see them.');
      } catch (domErr) {
        console.error('Bulk subtask: created on server but DOM update failed', domErr);
        showToast('Added — refresh to see them.');
      }
    })
    .catch(function(err) {
      if (err && err._status) { console.error('Bulk subtask: HTTP ' + err._status); showToast('Server error (' + err._status + ') — reload to check.'); }
      else { console.error('Bulk subtask: request failed (no response)', err); showToast('Network error — could not reach the server. Try again.'); }
    });
}
