/* ════════════════════════════════════════════════════════════════════════
   Assignee picker — multi-select popover for assigning HRMS users to
   tasks and subtasks.

   Extracted from templates/projects/index.html (May 2026) as part of
   the project-frontend cleanup. Behavior is unchanged from the
   in-template version.

   Reads from the global TEAM_MEMBERS array (defined in index.js, which
   in turn reads it from window.PROJECTS_DATA). Writes via
       /projects/tasks/<pk>/assignees/    (kind='task')
       /projects/subtasks/<pk>/assignees/ (kind='subtask')
   depending on the data-kind on the clicked stack.

   The window.openAssigneePicker function is the public entry point —
   invoked from {% assignee_stack %} inclusion-tag's onclick attribute
   for users with TL+ role. The template tag renders the button as
   `disabled` for users below TL+, so the picker can't be opened
   without permission — and the backend enforces the same check.

   FIXES (May 2026):
   ─────────────────
   1. Positioning completely rewritten.
      • #assignee-picker must be `position: fixed` in CSS.  The old code
        used `position: absolute` + window.pageXOffset/pageYOffset, which
        broke whenever the popover's offsetParent was a scrolled inner
        container rather than <body> — causing the popover to fly off to
        the wrong corner of the screen.
      • Dimensions (offsetWidth/Height) are now read inside a
        requestAnimationFrame, AFTER the browser has rendered the newly-
        visible popover, so we always get real values instead of the 0/0
        fallback that made overflow-clamping useless.

   2. Corrected open sequence: hidden=false → position() → focus(), so
      the element is in the DOM and measurable before we try to place it.

   3. Minor: search input oninput handler re-assigned on every open so
      stale closures from a previous open can't fire.
   ════════════════════════════════════════════════════════════════════════ */

(function () {
  // Active state — null when popover is closed.
  var _picker = null;
  // Timer for the debounced save.
  var _saveTimer = null;
  // Whether a save is in flight (so close-and-flush can wait).
  var _saveInFlight = false;

  // CSRF token — pulled from the existing csrftoken cookie used elsewhere
  // in this page. Falls back to the {% csrf_token %} input from the page
  // header if cookie unavailable.
  function getCsrf() {
    var m = document.cookie.match(/(?:^| )csrftoken=([^;]+)/);
    if (m) return m[1];
    var inp = document.querySelector('input[name="csrfmiddlewaretoken"]');
    return inp ? inp.value : '';
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Color class derivation matches the assignee_stack template tag's
     `pk|mod5plus1` filter so avatars in the row and in the popover are
     consistently coloured for the same person. */
  function colorClass(pk) {
    return 'c' + ((parseInt(pk, 10) || 0) % 5 + 1);
  }

  function initialsOf(name) {
    return String(name || '')
      .trim()
      .split(/\s+/)
      .map(function (p) { return p[0] || ''; })
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  /* Find the row's existing avatar-stack and replace its inner markup
     to reflect the new assignee set. Avoids a full page reload. */
  function rerenderStack(stackBtn, assignees) {
    var visible  = assignees.slice(0, 3);
    var overflow = Math.max(0, assignees.length - 3);
    var html = '';

    if (assignees.length === 0) {
      html = '<span class="av-mini av-empty" title="Click to assign">+</span>';
    } else {
      visible.forEach(function (a) {
        var ini = a.initials || initialsOf(a.name);
        html +=
          '<span class="av-mini ' + colorClass(a.pk) +
          '" title="' + escHtml(a.name) + '">' + escHtml(ini) + '</span>';
      });
      if (overflow > 0) {
        html +=
          '<span class="av-mini av-overflow" title="' +
          overflow + ' more">+' + overflow + '</span>';
      }
    }

    stackBtn.innerHTML = html;
    stackBtn.dataset.assignees = assignees
      .map(function (a) { return a.pk; })
      .join(',');
  }

  /* Build / re-build the checkbox list, filtered by the search query. */
  function renderList(searchTerm) {
    if (!_picker) return;
    var listEl  = document.getElementById('assignee-picker-list');
    var term    = (searchTerm || '').toLowerCase();
    var members = typeof TEAM_MEMBERS !== 'undefined' ? TEAM_MEMBERS : [];
    var filtered = members.filter(function (m) {
      return !term || (m.name || '').toLowerCase().indexOf(term) !== -1;
    });

    if (filtered.length === 0) {
      listEl.innerHTML =
        '<div class="assignee-picker-empty">No matches</div>';
      return;
    }

    listEl.innerHTML = filtered.map(function (m) {
      var checked = _picker.selected.has(m.pk) ? 'checked' : '';
      var ini     = initialsOf(m.name);
      return (
        '<label class="assignee-picker-row">' +
          '<input type="checkbox" value="' + m.pk + '" ' + checked + '>' +
          '<span class="av-mini ' + colorClass(m.pk) + '">' + escHtml(ini) + '</span>' +
          '<span class="assignee-picker-row-name">' + escHtml(m.name) + '</span>' +
        '</label>'
      );
    }).join('');

    /* Re-bind change handlers — innerHTML wipes them. */
    listEl.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      cb.addEventListener('change', onToggle);
    });

    updateCount();
  }

  function updateCount() {
    var el = document.getElementById('assignee-picker-count');
    if (el && _picker) {
      el.textContent = _picker.selected.size + ' selected';
    }
  }

  /* Checkbox toggle → update _picker.selected → debounced save. */
  function onToggle(e) {
    if (!_picker) return;
    var pk = parseInt(e.target.value, 10);
    if (e.target.checked) _picker.selected.add(pk);
    else                  _picker.selected.delete(pk);
    _picker.dirty = true;
    updateCount();
    queueSave();
  }

  function queueSave() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(flushSave, 300);
    setStatus('Saving…');
  }

  function setStatus(msg) {
    var el = document.getElementById('assignee-picker-status');
    if (el) {
      el.textContent = msg || '';
      el.classList.toggle('assignee-picker-saving', !!msg);
    }
  }

  /* Send the current selection to the backend. Returns a promise that
     resolves when the request finishes. */
  function flushSave() {
    if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
    if (!_picker)        return Promise.resolve();
    if (!_picker.dirty)  return Promise.resolve();
    if (_saveInFlight)   return Promise.resolve();
    _saveInFlight = true;

    var snapshot = _picker;   /* capture in case popover closes mid-flight */
    var ids      = Array.from(snapshot.selected);
    var url      = snapshot.kind === 'subtask'
      ? '/projects/subtasks/' + snapshot.targetPk + '/assignees/'
      : '/projects/tasks/'    + snapshot.targetPk + '/assignees/';

    var data = new FormData();
    ids.forEach(function (id) { data.append('profile_ids', id); });
    data.append('csrfmiddlewaretoken', getCsrf());

    /* Snapshot the assignee state BEFORE the request goes out — used to
       restore the visual if the save fails. Without this, an attempted
       unassign would visually succeed even when the backend rejected it. */
    var preSaveAssignees = snapshot.stackBtn.dataset.assignees || '';

    return fetch(url, {
      method: 'POST',
      body: data,
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
      .then(function (r) {
        /* Read the body even on non-2xx — backend sends a JSON
           {ok:false, error:'...'} for 403/400. */
        return r.json()
          .then(function (body) { return { status: r.status, ok: r.ok, body: body }; })
          .catch(function ()    { return { status: r.status, ok: r.ok, body: null }; });
      })
      .then(function (resp) {
        _saveInFlight = false;

        if (!resp.ok || !resp.body || !resp.body.ok) {
          var msg;
          if (resp.status === 403) {
            msg = (resp.body && resp.body.error) ||
                  'You do not have permission to change assignees.';
          } else if (resp.status === 400) {
            msg = (resp.body && resp.body.error) || 'Bad request.';
          } else {
            msg = (resp.body && resp.body.error) ||
                  ('Save failed (HTTP ' + resp.status + ').');
          }
          setStatus('Failed');
          if (typeof showToast === 'function') showToast(msg);

          /* Restore the pre-save selection so the picker reflects what
             is actually stored on the server. */
          snapshot.stackBtn.dataset.assignees = preSaveAssignees;
          var restored = preSaveAssignees
            .split(',')
            .map(function (s) { return parseInt(s, 10); })
            .filter(function (n) { return !isNaN(n); });

          if (snapshot === _picker) {
            snapshot.selected = new Set(restored);
            snapshot.dirty    = false;
            var searchEl = document.getElementById('assignee-picker-search-input');
            renderList(searchEl ? searchEl.value : '');
          }
          return;
        }

        setStatus('Saved');
        if (snapshot === _picker) snapshot.dirty = false;
        rerenderStack(snapshot.stackBtn, resp.body.assignees || []);
        setTimeout(function () { setStatus(''); }, 800);
      })
      .catch(function () {
        _saveInFlight = false;
        setStatus('Network error');
        if (typeof showToast === 'function') {
          showToast('Network error — could not save. Refresh to see current assignees.');
        }
      });
  }

  /* ── FIX 1: Positioning ───────────────────────────────────────────────
     The old code used `window.pageXOffset/pageYOffset` on top of
     getBoundingClientRect() coords. That's only correct when the
     popover's offsetParent is <body> with no scroll. In a scrollable
     inner container (the task table) the numbers compound and the
     popover flies to the wrong corner.

     Solution: use `position: fixed` on #assignee-picker (add this to
     your CSS if not already there):

         #assignee-picker { position: fixed; z-index: 9999; }

     With `fixed`, placement is always relative to the viewport, so
     getBoundingClientRect() values map 1-to-1 — no scroll offsets
     needed at all.

     FIX 2: Read dimensions inside a requestAnimationFrame so the
     browser has actually rendered the now-visible element before we
     measure it. Without rAF, offsetWidth/Height are 0 (hidden→shown
     in the same JS tick) and fallback constants are used forever.
     ──────────────────────────────────────────────────────────────────── */
  function position(popover, anchor) {
    var GAP = 6;

    /* Make it invisible-but-present so the browser can measure it,
       then do the real placement one frame later. */
    popover.style.visibility = 'hidden';
    popover.style.left = '0px';
    popover.style.top  = '0px';

    requestAnimationFrame(function () {
      var rect      = anchor.getBoundingClientRect();
      var vw        = window.innerWidth;
      var vh        = window.innerHeight;
      var popWidth  = popover.offsetWidth  || 280;
      var popHeight = popover.offsetHeight || 320;

      /* Default: open below anchor, left-aligned with it. */
      var left = rect.left;
      var top  = rect.bottom + GAP;

      /* Clamp right edge inside viewport. */
      if (left + popWidth > vw - 8) {
        left = rect.right - popWidth;
      }
      /* Clamp left edge. */
      if (left < 8) left = 8;

      /* If no room below, flip above the anchor. */
      if (top + popHeight > vh - 8) {
        top = rect.top - popHeight - GAP;
      }
      /* Last-resort: clamp top so it never goes off-screen upward. */
      if (top < 8) top = 8;

      popover.style.left       = left + 'px';
      popover.style.top        = top  + 'px';
      popover.style.visibility = '';   /* restore visibility */
    });
  }

  /* Outside-click → close. Escape → close. */
  function onDocClick(e) {
    if (!_picker) return;
    var pop = document.getElementById('assignee-picker');
    if (
      e.target === _picker.stackBtn ||
      _picker.stackBtn.contains(e.target) ||
      pop.contains(e.target)
    ) {
      return;
    }
    closePicker();
  }

  function onKey(e) {
    if (e.key === 'Escape') closePicker();
  }

  /* Public API: opened from the avatar-stack button onclick. */
  window.openAssigneePicker = function (stackBtn) {
    /* Toggle off if clicked the same stack again. */
    if (_picker && _picker.stackBtn === stackBtn) {
      closePicker();
      return;
    }
    closePicker(false);   /* close any other open picker without flushing */

    var targetPk = parseInt(stackBtn.dataset.targetPk, 10);
    var kind     = stackBtn.dataset.kind || 'task';
    var rawIds   = (stackBtn.dataset.assignees || '')
      .split(',')
      .map(function (s) { return parseInt(s, 10); })
      .filter(function (n) { return !isNaN(n); });

    _picker = {
      stackBtn: stackBtn,
      targetPk: targetPk,
      kind:     kind,
      selected: new Set(rawIds),
      dirty:    false,
    };

    var pop = document.getElementById('assignee-picker');

    /* FIX: unhide BEFORE calling position() so the element is in the
       render tree and can be measured inside the rAF callback. */
    pop.hidden = false;
    position(pop, stackBtn);
    renderList('');

    var searchInp = document.getElementById('assignee-picker-search-input');
    searchInp.value   = '';
    /* Re-assign oninput each open so no stale closure from a prior open
       can still fire after this picker has been replaced. */
    searchInp.oninput = function () { renderList(this.value); };

    /* Bind global handlers AFTER this click event finishes, so the
       opening click doesn't immediately close the popover. */
    setTimeout(function () {
      document.addEventListener('click',   onDocClick);
      document.addEventListener('keydown', onKey);
    }, 0);

    /* Auto-focus the search input. */
    searchInp.focus();
  };

  function closePicker(flush) {
    if (!_picker) return;
    document.removeEventListener('click',   onDocClick);
    document.removeEventListener('keydown', onKey);
    document.getElementById('assignee-picker').hidden = true;
    if (flush !== false) flushSave();
    _picker = null;
  }
})();