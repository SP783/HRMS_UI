/* ════════════════════════════════════════════════════════════════════════
   Projects — utilities.

   Shared helpers used across every other projects/ module:
     * escHtml(s)        — safe HTML escaping for client-side templates
     * showToast(msg)    — bottom-of-screen transient notification
     * openModal(id)     — show an overlay element (adds .visible)
     * closeModal(id)    — hide an overlay element
     * showModal/hideModal — aliases kept for backward compatibility
     * getCsrfToken()    — read the csrftoken cookie (used by fetch POSTs)

   Also hosts the page-wide TEAM_MEMBERS and PIPELINE_DATA arrays that
   other modules and assignee_picker.js read from. Sourced from
   window.PROJECTS_DATA which is set by partials/_data_script.html.

   Loaded first — before tree.js, projects.js, tasks.js, and
   assignee_picker.js.
   ════════════════════════════════════════════════════════════════════════ */


var TEAM_MEMBERS = window.PROJECTS_DATA.team_members || [];

/* Pipeline data for the New Project modal preview. The full pipelines
   page lives at /projects/pipelines/, but this lightweight blob lets the
   create-project modal show "tasks that will auto-create" inline. */

var PIPELINE_DATA = {};
Object.assign(PIPELINE_DATA, window.PROJECTS_DATA.pipelines || {});

/* ── STATS ── */
/* Stats moved to server-side rendering. */

/* ── UTILITIES ── */

function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function showToast(msg){ var t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(function(){ t.classList.remove('show'); },2800); }

function openModal(id){ var el = document.getElementById(id); if (el) el.classList.add('visible'); }

function closeModal(id){ var el = document.getElementById(id); if (el) el.classList.remove('visible'); }

function showModal(id){ openModal(id); }

function hideModal(id){ closeModal(id); }

/* ── CLIENT FILTER ── */

function getCsrfToken() {
  var m = document.cookie.match(/(?:^| )csrftoken=([^;]+)/);
  if (m) return m[1];
  var inp = document.querySelector('input[name="csrfmiddlewaretoken"]');
  return inp ? inp.value : '';
}

/* ── INLINE TASK ADD ── */

/* ── View toggle (Tree / Board) — May 2026 ──────────────────────────────
   Toggles between the existing tree layout and the read-only board.
   Choice persists per-browser via localStorage. The board is purely
   visual — clicks on cards open the existing edit picker; status
   changes still go through the per-row dropdowns in tree view. */

function setProjectsView(mode) {
  if (mode !== 'tree' && mode !== 'board') mode = 'tree';
  try { localStorage.setItem('projects_view', mode); } catch (e) {}

  var tree  = document.getElementById('projects-tree-view');
  var board = document.getElementById('projects-board-view');
  var btnTree  = document.getElementById('view-toggle-tree');
  var btnBoard = document.getElementById('view-toggle-board');
  if (!tree || !board) return;

  if (mode === 'board') {
    tree.style.display  = 'none';
    board.style.display = '';
    if (btnTree)  btnTree.classList.remove('active');
    if (btnBoard) btnBoard.classList.add('active');
  } else {
    tree.style.display  = '';
    board.style.display = 'none';
    if (btnTree)  btnTree.classList.add('active');
    if (btnBoard) btnBoard.classList.remove('active');
  }
}

/* Restore last view on page load. */
(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProjectsView);
  } else {
    initProjectsView();
  }
  function initProjectsView() {
    var saved = 'tree';
    try { saved = localStorage.getItem('projects_view') || 'tree'; } catch (e) {}
    if (saved === 'board') setProjectsView('board');
  }
})();
