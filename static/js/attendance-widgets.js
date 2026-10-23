(() => {
  'use strict';
  const root = () => document.getElementById('attendance-widgets');
  let countdown = null;
  function cancelConfirmation() {
    clearInterval(countdown);
    countdown = null;
    document.getElementById('checkoutConfirm')?.classList.add('hidden');
  }
  function tick() {
    for (const id of ['workTimer', 'breakTimer', 'otTimer']) {
      const node = document.getElementById(id);
      if (!node?.dataset.start) continue;
      const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(node.dataset.start)) / 1000));
      if (!Number.isFinite(seconds)) continue;
      const s = String(seconds % 60).padStart(2, '0');
      node.textContent = id === 'breakTimer' ? `(${Math.floor(seconds / 60)}m ${s}s)` :
        `${Math.floor(seconds / 3600)}h ${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}m ${s}s`;
    }
    const alert = document.getElementById('otAlert');
    if (alert && (Date.now() - Date.parse(alert.dataset.checkin)) / 60000 >= (Number(alert.dataset.threshold) || 540)) alert.style.display = 'flex';
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !root()?.contains(button)) return;
    if (button.id === 'initCheckoutBtn') {
      cancelConfirmation();
      let remaining = 10;
      const confirm = document.getElementById('confirmBtn');
      confirm.textContent = 'Confirm (10s)';
      document.getElementById('checkoutConfirm').classList.remove('hidden');
      countdown = setInterval(() => {
        confirm.textContent = `Confirm (${--remaining}s)`;
        if (remaining <= 0) cancelConfirmation();
      }, 1000);
    } else if (button.id === 'cancelBtn') cancelConfirmation();
    else if (button.id === 'confirmBtn') {
      cancelConfirmation();
      document.getElementById('checkoutForm').requestSubmit();
    }
  });
  document.addEventListener('htmx:beforeRequest', event => {
    if (!root()?.contains(event.detail.elt)) return;
    const dialog = document.getElementById('checkoutConfirm');
    if (event.detail.requestConfig.verb === 'get' && dialog && !dialog.classList.contains('hidden')) event.preventDefault();
  });
  document.addEventListener('htmx:beforeSwap', event => {
    if (event.detail.target?.id !== 'attendance-widgets') return;
    if (event.detail.xhr.status !== 200) return;
    const html = new DOMParser().parseFromString(event.detail.xhr.responseText, 'text/html');
    if (!html.getElementById('attendance-widgets')) {
      event.detail.shouldSwap = false;
      const url = new URL(event.detail.xhr.responseURL);
      if (url.origin === location.origin) location.assign(url.href);
    }
  });
  document.addEventListener('htmx:afterSwap', event => {
    if (event.detail.target?.id === 'attendance-widgets') { cancelConfirmation(); tick(); }
  });
  function failure(event) {
    if (!root()?.contains(event.detail.elt)) return;
    const node = document.getElementById('attendance-request-error');
    node.hidden = false;
    node.textContent = 'Unable to confirm the attendance update. Refresh the widget before trying again.';
  }
  ['htmx:responseError', 'htmx:sendError', 'htmx:timeout'].forEach(name => document.addEventListener(name, failure));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && root() && window.htmx) htmx.trigger(root(), 'attendanceRefresh');
  });
  tick();
  setInterval(tick, 1000);
})();
