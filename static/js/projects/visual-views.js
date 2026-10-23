(() => {
  'use strict';
  const root = document.querySelector('.px-workspace');
  if (!root) return;
  let dragged = null, pending = false;
  const feedback = text => { const node = document.querySelector('#pv-feedback'); if (node) node.textContent = text; };
  async function move(card, status) {
    if (pending || !card || card.dataset.currentStatus === status) return;
    pending = true; card.classList.add('is-moving');
    const select = card.querySelector('[data-pv-status]');
    if (select) select.disabled = true;
    feedback('Saving project status…');
    try {
      const response = await fetch(card.dataset.moveUrl, {method:'POST', credentials:'same-origin', headers:{'X-CSRFToken':document.querySelector('#px-csrf input').value}, body:new URLSearchParams({status, organization:root.dataset.organization, version:card.dataset.version})});
      if (response.redirected || !(response.headers.get('content-type') || '').includes('application/json')) throw new Error('Session changed. Reload Projects.');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save status.');
      await htmx.ajax('GET',location.pathname + location.search,{target:'#px-list-region',select:'#px-list-region',swap:'outerHTML'});
      feedback('Project status updated.');
    } catch (error) { feedback(error.message); if (select) select.value = card.dataset.currentStatus; }
    finally { pending = false; card.classList.remove('is-moving'); if (select) select.disabled = false; }
  }
  document.addEventListener('change', event => { const select = event.target.closest('[data-pv-status]'); if (select) { if (pending) {select.value=select.closest('[data-pv-project]').dataset.currentStatus;return;} move(select.closest('[data-pv-project]'),select.value); } });
  document.addEventListener('dragstart', event => {
    const card = event.target.closest('[data-pv-project][draggable=true]');
    if (!card) return;
    if (pending || event.target.closest('select')) {event.preventDefault();return;}
    dragged = card; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain',card.dataset.pvProject);
  });
  document.addEventListener('dragover', event => { const column=event.target.closest('[data-drop-status]'); if(column && dragged && !pending) {event.preventDefault();event.dataTransfer.dropEffect='move';column.classList.add('is-drop-target');} });
  document.addEventListener('dragleave', event => {const column=event.target.closest('[data-drop-status]');if(column && !column.contains(event.relatedTarget)) column.classList.remove('is-drop-target');});
  function clear() {document.querySelectorAll('.is-drop-target').forEach(node=>node.classList.remove('is-drop-target'));dragged=null;}
  document.addEventListener('dragend', clear);
  document.addEventListener('drop', event => {const column=event.target.closest('[data-drop-status]');if(column && dragged) {event.preventDefault();move(dragged,column.dataset.dropStatus);}clear();});
})();
