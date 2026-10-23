/* ════════════════════════════════════════════════════════════════════════
   Projects — tree-view UI (client filter, status filter, search,
   expand/collapse).
   ════════════════════════════════════════════════════════════════════════ */

var activeClient = 'all';

function filterClient(btn, clientId) {
  activeClient = clientId;
  document.querySelectorAll('.co-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  
  var archSec = document.getElementById('archived-section');
  if (clientId === 'archived') {
    document.querySelectorAll('.tree-co[data-client]').forEach(function(el){ el.style.display='none'; });
    if (archSec) {
        archSec.style.display='';
        archSec.classList.remove('hidden');
    }
  } else {
    if (archSec) {
        archSec.style.display='none';
    }
    document.querySelectorAll('.tree-co[data-client]').forEach(function(el){
      if (clientId === 'all' || el.dataset.client === String(clientId)) el.style.display='';
      else el.style.display='none';
    });
  }
}

/* ── CLIENT-NAME SEARCH (new May 2026) ──────────────────────────────────── */
function filterByClient(query) {
  var q = (query || '').toLowerCase().trim();
  document.querySelectorAll('.tree-proj').forEach(function(row) {
    if (!q) {
      row.style.display = '';
      return;
    }
    var name = (row.dataset.clientName || '').toLowerCase();
    row.style.display = name.indexOf(q) !== -1 ? '' : 'none';
  });
}

/* ── STATUS FILTER ── */
function filterStatus(btn, status) {
  btn.closest('div').querySelectorAll('.fbtn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  document.querySelectorAll('.tree-proj').forEach(function(p){
    if (status === 'all') { p.style.display=''; return; }
    p.style.display = (p.dataset.status === status) ? '' : 'none';
  });
}

/* ── TREE SEARCH ── */
function filterTree(q) {
  var lq = (q || '').toLowerCase();
  document.querySelectorAll('.tree-proj').forEach(function(proj){
    var name = (proj.querySelector('.tree-proj-name')||{}).textContent||'';
    var tasks = Array.from(proj.querySelectorAll('.task-name-cell')).map(function(t){ return t.textContent.toLowerCase(); });
    proj.style.display = (!lq || name.toLowerCase().includes(lq) || tasks.some(function(t){ return t.includes(lq); })) ? '' : 'none';
  });
}

/* ── TREE TOGGLE ── */
function toggleCo(id) {
  var w=document.getElementById(id), a=document.getElementById('arr-'+id);
  if (!w) return;
  var open = w.classList.toggle('open');
  if (a) a.classList.toggle('open', open);
}

function expandCo(id) {
  var w=document.getElementById(id), a=document.getElementById('arr-'+id);
  if (!w) return;
  w.classList.add('open'); if(a) a.classList.add('open');
  w.querySelectorAll('.tree-tasks,.tree-projs').forEach(function(el){ el.classList.add('open'); });
  w.querySelectorAll('.tree-proj-arrow').forEach(function(ar){ ar.classList.add('open'); });
}

function collapseCo(id) {
  var w=document.getElementById(id), a=document.getElementById('arr-'+id);
  if (!w) return;
  w.classList.remove('open'); if(a) a.classList.remove('open');
  w.querySelectorAll('.tree-tasks,.tree-projs').forEach(function(el){ el.classList.remove('open'); });
  w.querySelectorAll('.tree-proj-arrow').forEach(function(ar){ ar.classList.remove('open'); });
}

function toggleProj(id) {
  var t=document.getElementById(id), a=document.getElementById('arr-'+id);
  if (!t) return;
  var open = t.classList.toggle('open');
  if (a) a.classList.toggle('open', open);
}

/* ── SUBTASKS ── */
function toggleSubs(id, btn) {
  var el=document.getElementById(id); if (!el) return;
  var open = el.style.display !== 'none' && el.style.display !== '';
  el.style.display = open ? 'none' : 'block';
  if (btn) btn.textContent = (open ? '▶' : '▼') + btn.textContent.slice(1);
}

/* ── BULK ADD ── */
function showBulk(pk) { var el=document.getElementById('bulk-'+pk); if(el){ el.style.display='block'; } }
function hideBulk(pk) { var el=document.getElementById('bulk-'+pk); if(el){ el.style.display='none'; } }