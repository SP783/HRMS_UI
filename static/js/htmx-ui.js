/* Explicit list islands: navigation, uploads and mutations keep their own lifecycle. */
(() => {
  'use strict';
  if (!window.htmx) return;
  const regionId = 'ui-list-region';
  function status(message, error = false) {
    const node = document.getElementById('ui-request-status');
    if (!node) return;
    node.textContent = message;
    node.hidden = !message;
    node.dataset.error = String(error);
  }
  function attributes(node, url) {
    node.setAttribute('hx-get', url);
    node.setAttribute('hx-target', '#' + regionId);
    node.setAttribute('hx-select', '#' + regionId);
    node.setAttribute('hx-swap', 'outerHTML');
    node.setAttribute('hx-push-url', 'true');
    node.setAttribute('hx-sync', '#' + regionId + ':replace');
    node.setAttribute('hx-headers', '{"X-HRMS-List":"1"}');
    node.setAttribute('data-ui-request', '');
  }
  function initialize() {
    const region = document.getElementById(regionId);
    if (!region) return;
    region.querySelectorAll('form[data-ui-filter]').forEach((form, index) => {
      if (form.hasAttribute('hx-get')) return;
      const url = new URL(form.getAttribute('action') || location.pathname, location.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname) return;
      attributes(form, url.pathname);
      if (!form.id) form.id = 'ui-filter-' + index;
      // Stable ids retain focus/selection when a live search replaces its form.
      form.querySelectorAll('input[name="q"], input[name="search"]').forEach((input, i) => {
        if (!input.id) input.id = form.id + '-search-' + i;
      });
      form.setAttribute('hx-trigger', 'submit, input[event.target.matches("input[name=q], input[name=search]")] changed delay:500ms');
    });
    region.querySelectorAll('a[href]').forEach(link => {
      if (link.hasAttribute('hx-get') || link.hasAttribute('download') || link.target || link.getAttribute('onclick')) return;
      const url = new URL(link.href, location.href);
      // Only pagination/filter links; exports, other pages and modal actions stay native.
      if (url.origin !== location.origin || url.pathname !== location.pathname || url.hash) return;
      if (region.querySelector('form[hx-preserve]') && !url.searchParams.has('page')) return;
      if ([...url.searchParams.keys()].some(k => /export|download|format|action/i.test(k))) return;
      attributes(link, url.pathname + url.search);
    });
    htmx.process(region);
  }
  function ours(event) {
    return event.detail.elt?.closest?.('[data-ui-request]');
  }
  document.addEventListener('htmx:beforeRequest', event => {
    if (!ours(event)) return;
    status('Updating…');
    document.getElementById(regionId)?.setAttribute('aria-busy', 'true');
  });
  document.addEventListener('htmx:beforeSwap', event => {
    if (event.detail.target?.id !== regionId) return;
    const xhr = event.detail.xhr;
    if (xhr.status < 200 || xhr.status >= 300) return;
    const response = new DOMParser().parseFromString(xhr.responseText, 'text/html');
    if (!response.getElementById(regionId)) {
      event.detail.shouldSwap = false;
      // Expired login or permission redirects require a complete document.
      const url = new URL(xhr.responseURL || location.href);
      if (url.origin === location.origin && url.pathname !== location.pathname) location.assign(url.href);
      else status('Could not update this view. Reload the page and try again.', true);
    }
  });
  document.addEventListener('htmx:afterSwap', event => {
    if (event.detail.target?.id !== regionId) return;
    initialize();
    status('');
  });
  document.addEventListener('htmx:afterRequest', event => {
    if (!ours(event)) return;
    document.getElementById(regionId)?.removeAttribute('aria-busy');
    if (event.detail.failed) status('Update failed. Your current view is unchanged. Please try again.', true);
  });
  ['htmx:sendError', 'htmx:timeout'].forEach(name => document.addEventListener(name, event => {
    if (ours(event)) status('Connection failed. Please try again.', true);
  }));
  initialize();
})();
