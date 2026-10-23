(() => {
  const trigger = document.querySelector('[data-create-project]');
  if (!trigger) return;
  const dialog = document.getElementById('px-create-dialog');
  const content = document.getElementById('px-create-content');
  const feedback = document.getElementById('px-create-feedback');
  let busy = false, dirty = false, generation = 0;
  const close = () => {
    if (busy || (dirty && !confirm('Discard this unsaved project?'))) return;
    generation++; dialog.close(); trigger.focus(); dirty = false;
  };
  document.getElementById('px-create-close').addEventListener('click', close);
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
  content.addEventListener('input', () => { dirty = true; });
  content.addEventListener('change', () => { dirty = true; });
  trigger.addEventListener('click', async e => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); const ticket = ++generation;
    content.textContent = 'Loading form…'; feedback.textContent = ''; dirty = false;
    dialog.showModal();
    try {
      const response = await fetch(trigger.dataset.popupUrl);
      if (response.redirected) throw new Error('Your session changed. Reload this page.');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load the form.');
      if (ticket !== generation) return;
      content.innerHTML = data.html; content.querySelector('input[name=name]')?.focus();
    } catch (error) { if (ticket === generation) { content.textContent = ''; feedback.textContent = error.message + ' Close and try again.'; } }
  });
  content.addEventListener('submit', async e => {
    e.preventDefault(); if (busy) return;
    busy = true; feedback.textContent = 'Creating project…';
    const form = e.target, body = new FormData(form);
    form.querySelectorAll('button').forEach(b => b.disabled = true);
    try {
      const response = await fetch(trigger.dataset.popupUrl, {method: 'POST', body});
      if (response.redirected) throw new Error('Your session changed. Reload this page.');
      const data = await response.json();
      if (response.status === 201) { dirty = false; busy = false; window.location.assign(data.url); return; }
      if (data.html) { content.innerHTML = data.html; content.querySelector('[aria-invalid=true]')?.focus(); throw new Error('Please correct the highlighted fields.'); }
      throw new Error(data.error || 'Unable to create the project.');
    } catch (error) { feedback.textContent = error.message; }
    finally { busy = false; content.querySelectorAll('button').forEach(b => b.disabled = false); }
  });
  window.addEventListener('beforeunload', e => { if (dialog.open && (dirty || busy)) { e.preventDefault(); e.returnValue = ''; } });
})();
