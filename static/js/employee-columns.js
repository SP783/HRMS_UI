(() => {
  'use strict';
  function initialize() {
    const table = document.getElementById('employee-directory-table');
    const data = document.getElementById('employee-column-data');
    const menu = document.getElementById('employee-column-popover');
    if (!table || !data || !menu || table.dataset.columnsReady) return;
    table.dataset.columnsReady = 'true';
    const settings = JSON.parse(data.textContent);
    const defaults = settings.columns.map(column => column.key);
    const labels = new Map(settings.columns.map(column => [column.key, column.label]));
    let layout = structuredClone(settings.layout);
    let dragged = null;
    let timer = null;
    let pending = Promise.resolve();
    const options = menu.querySelector('[data-employee-column-options]');
    const status = menu.querySelector('[data-employee-column-status]');
    const rows = [...table.rows];
    rows.forEach(row => {
      if (row.cells.length === defaults.length) {
        [...row.cells].forEach((cell, index) => { cell.dataset.employeeColumn = defaults[index]; });
      }
    });
    const filterData = document.getElementById('employee-filter-data');
    const filterMenu = document.getElementById('employee-filter-popover');
    const filterForm = document.getElementById('employee-directory-filter');
    if (filterData && filterMenu && filterForm) {
      const filters = JSON.parse(filterData.textContent);
      function openFilter(definition, trigger) {
        filterMenu.replaceChildren();
        const heading = document.createElement('strong');
        heading.textContent = 'Filter ' + definition.label;
        filterMenu.appendChild(heading);
        const controls = [];
        definition.params.forEach(parameter => {
          const label = document.createElement('label');
          label.textContent = definition.type === 'date' ? (parameter.endsWith('from') ? 'From' : 'To') : definition.label;
          let input;
          if (definition.type === 'select') {
            input = document.createElement('select');
            input.add(new Option('All', ''));
            definition.options.forEach(([value, text]) => input.add(new Option(text, value)));
          } else {
            input = document.createElement('input');
            input.type = definition.type;
            input.maxLength = 200;
            if (definition.type === 'text') input.placeholder = 'Contains…';
          }
          input.value = filters.values[parameter] || '';
          input.dataset.filterParameter = parameter;
          label.appendChild(input);
          controls.push(input);
          filterMenu.appendChild(label);
          input.addEventListener('keydown', event => {
            if (event.key === 'Enter') { event.preventDefault(); submit(false); }
          });
        });
        function submit(clear) {
          controls.forEach(input => { filterForm.elements.namedItem(input.dataset.filterParameter).value = clear ? '' : input.value; });
          filterMenu.hidePopover();
          trigger.focus();
          filterForm.requestSubmit();
        }
        const actions = document.createElement('div');
        actions.className = 'employee-filter-actions';
        [['Apply filter', false], ['Clear column filter', true]].forEach(([text, clear]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = text;
          button.addEventListener('click', () => submit(clear));
          actions.appendChild(button);
        });
        filterMenu.appendChild(actions);
        const rectangle = trigger.getBoundingClientRect();
        filterMenu.style.left = Math.max(12, Math.min(rectangle.left, innerWidth - Math.min(280, innerWidth - 24) - 12)) + 'px';
        filterMenu.style.top = Math.max(12, Math.min(rectangle.bottom + 8, innerHeight - 260)) + 'px';
        filterMenu.showPopover();
        controls[0]?.focus();
      }
      filters.definitions.forEach(definition => {
        const header = [...table.tHead.rows[0].cells].find(cell => cell.dataset.employeeColumn === definition.column);
        if (!header) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'employee-column-filter';
        button.id = 'employee-filter-' + definition.column;
        button.dataset.employeeFilter = definition.column;
        button.setAttribute('aria-label', 'Filter ' + definition.label);
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-controls', 'employee-filter-popover');
        button.title = 'Filter ' + definition.label;
        if (definition.params.some(parameter => filters.values[parameter])) button.classList.add('is-active');
        button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 4h18l-7 8v7l-4 2v-9z"/></svg>';
        button.addEventListener('click', () => openFilter(definition, button));
        header.appendChild(button);
      });
    }
    function apply() {
      rows.forEach(row => {
        const cells = new Map([...row.cells].map(cell => [cell.dataset.employeeColumn, cell]));
        if (cells.has('name')) {
          layout.order.forEach(key => {
            const cell = cells.get(key);
            cell.style.display = layout.hidden.includes(key) ? 'none' : '';
            row.appendChild(cell);
          });
        } else if (row.cells.length === 1) {
          row.cells[0].colSpan = defaults.length - layout.hidden.length;
        }
      });
    }
    function save() {
      clearTimeout(timer);
      status.textContent = 'Saving…';
      timer = setTimeout(() => {
        const payload = JSON.stringify({layout: structuredClone(layout)});
        pending = pending.catch(() => {}).then(async () => {
          const response = await fetch(menu.dataset.saveUrl, {
            method: 'POST', credentials: 'same-origin', keepalive: true,
            headers: {'Content-Type': 'application/json', 'X-CSRFToken': menu.querySelector('[name=csrfmiddlewaretoken]').value},
            body: payload
          });
          if (!response.ok) throw new Error('Save failed');
          const result = await response.json();
          if (!result.ok) throw new Error('Save failed');
          status.textContent = 'Saved';
        }).catch(() => { status.textContent = 'Could not save. Change a column to retry.'; });
      }, 180);
    }
    function move(key, destination) {
      const previous = layout.order.indexOf(key);
      if (destination < 0 || destination >= layout.order.length || destination === previous) return;
      layout.order.splice(previous, 1);
      layout.order.splice(destination, 0, key);
      apply();
      render();
      save();
    }
    function render() {
      options.replaceChildren();
      layout.order.forEach((key, index) => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2 py-1';
        row.draggable = true;
        row.addEventListener('dragstart', event => {
          dragged = key;
          event.dataTransfer.setData('text/plain', key);
        });
        row.addEventListener('dragover', event => { event.preventDefault(); });
        row.addEventListener('drop', event => {
          event.preventDefault();
          if (dragged) move(dragged, layout.order.indexOf(key));
          dragged = null;
        });
        row.addEventListener('dragend', () => { dragged = null; });
        const label = document.createElement('label');
        label.className = 'flex items-center gap-2 flex-1 text-sm';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !layout.hidden.includes(key);
        checkbox.disabled = key === 'name';
        checkbox.addEventListener('change', () => {
          layout.hidden = layout.hidden.filter(hidden => hidden !== key);
          if (!checkbox.checked) layout.hidden.push(key);
          apply();
          save();
        });
        label.append(checkbox, document.createTextNode(labels.get(key)));
        row.appendChild(label);
        [-1, 1].forEach(direction => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = direction < 0 ? '↑' : '↓';
          button.className = 'px-2 py-1 text-sm border rounded';
          button.setAttribute('aria-label', 'Move ' + labels.get(key) + (direction < 0 ? ' left' : ' right'));
          button.disabled = index + direction < 0 || index + direction >= layout.order.length;
          button.addEventListener('click', () => { move(key, index + direction); });
          row.appendChild(button);
        });
        options.appendChild(row);
      });
    }
    menu.querySelector('[data-employee-column-reset]').addEventListener('click', () => {
      layout = {order: [...defaults], hidden: []};
      apply();
      render();
      save();
    });
    apply();
    render();
  }
  document.addEventListener('DOMContentLoaded', initialize);
  document.addEventListener('htmx:afterSwap', initialize);
})();
