/**
 * StudioHR — Next-Gen Frontend JavaScript v2.0
 * Modern interactions, dark mode, animations, and micro-interactions
 */

// ═══════════════════════════════════════════════════════════════════════════
// Dark Mode Toggle
// ═══════════════════════════════════════════════════════════════════════════
(function() {
  const THEME_KEY = 'studiohrs_theme';
  const toggle = document.getElementById('themeToggle');
  const html = document.documentElement;

  function applyTheme(isDark) {
    html.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  }

  // Initialize from localStorage or system preference
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme:dark)').matches)) {
    applyTheme(true);
    if (toggle) toggle.checked = true;
  }

  // Toggle handler
  if (toggle) {
    toggle.addEventListener('change', () => {
      applyTheme(toggle.checked);
    });
  }

  // Listen for system preference changes
  window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(THEME_KEY)) {
      applyTheme(e.matches);
      if (toggle) toggle.checked = e.matches;
    }
  });
})();

// ═══════════════════════════════════════════════════════════════════════════
// Sidebar Toggle & Mobile Menu
// ═══════════════════════════════════════════════════════════════════════════
(function() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  const overlay = document.getElementById('sidebarOverlay');
  const mobileBtn = document.getElementById('mobileMenuBtn');

  if (!sidebar) return;

  const COLLAPSED_KEY = 'studiohrs_sidebar_collapsed';

  // Restore collapsed state
  if (localStorage.getItem(COLLAPSED_KEY) === '1' && window.innerWidth > 768) {
    sidebar.classList.add('collapsed');
  }

  // Desktop sidebar toggle
  if (toggle) {
    toggle.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        sidebar.classList.toggle('mobile-open');
        toggleOverlay();
        document.body.style.overflow = sidebar.classList.contains('mobile-open') ? 'hidden' : '';
      } else {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem(COLLAPSED_KEY, sidebar.classList.contains('collapsed') ? '1' : '0');
      }
    });
  }

  // Mobile menu button
  if (mobileBtn) {
    mobileBtn.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
      toggleOverlay();
      document.body.style.overflow = sidebar.classList.contains('mobile-open') ? 'hidden' : '';
    });
  }

  // Overlay click to close
  function toggleOverlay() {
    if (!overlay) return;
    if (sidebar.classList.contains('mobile-open')) {
      overlay.classList.add('visible');
    } else {
      overlay.classList.remove('visible');
    }
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      overlay.classList.remove('visible');
      document.body.style.overflow = '';
    });
  }

  // Handle resize
  window.addEventListener('resize', () => {
    if (mobileBtn) {
      mobileBtn.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
    }
    if (window.innerWidth > 768) {
      sidebar.classList.remove('mobile-open');
      if (overlay) overlay.classList.remove('visible');
      document.body.style.overflow = '';
    }
  });

  // Close sidebar on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
      sidebar.classList.remove('mobile-open');
      if (overlay) overlay.classList.remove('visible');
      document.body.style.overflow = '';
    }
  });
})();

// ═══════════════════════════════════════════════════════════════════════════
// Toast Notifications
// ═══════════════════════════════════════════════════════════════════════════
const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      this.container.style.cssText = `
        position: fixed;
        top: 80px;
        right: 24px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 9999;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = 5000) {
    this.init();

    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

    const toast = document.createElement('div');
    toast.className = `message message--${type}`;
    toast.innerHTML = `
      <span class="message-icon">${icons[type] || 'ℹ'}</span>
      <span class="message-content">${message}</span>
      <button class="message-close" onclick="this.parentElement.remove()">×</button>
    `;
    toast.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      border-radius: 10px;
      font-size: 13px;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
      pointer-events: auto;
      animation: slideInRight 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      min-width: 280px;
      max-width: 400px;
    `;

    this.container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
  },

  success(message, duration) { this.show(message, 'success', duration); },
  error(message, duration) { this.show(message, 'error', duration); },
  warning(message, duration) { this.show(message, 'warning', duration); },
  info(message, duration) { this.show(message, 'info', duration); }
};

// Auto-dismiss Django flash messages
document.querySelectorAll('.message').forEach(msg => {
  setTimeout(() => {
    msg.style.opacity = '0';
    msg.style.transform = 'translateX(100%)';
    msg.style.transition = 'all 0.3s ease';
    setTimeout(() => msg.remove(), 300);
  }, 5000);
});

// ═══════════════════════════════════════════════════════════════════════════
// Active Navigation Highlight
// ═══════════════════════════════════════════════════════════════════════════
(function() {
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(item => {
    const href = item.getAttribute('href');
    if (href && href !== '/' && currentPath.startsWith(href)) {
      item.classList.add('active');
    }
  });
})();

// ═══════════════════════════════════════════════════════════════════════════
// Confirmation Dialogs
// ═══════════════════════════════════════════════════════════════════════════
document.querySelectorAll('[data-confirm]').forEach(el => {
  el.addEventListener('click', (e) => {
    const msg = el.dataset.confirm || 'Are you sure?';
    if (!confirm(msg)) {
      e.preventDefault();
      return false;
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CSRF Helper
// ═══════════════════════════════════════════════════════════════════════════
function getCsrfToken() {
  const cookie = document.cookie.split(';').find(c => c.trim().startsWith('csrftoken='));
  return cookie ? cookie.split('=')[1] : '';
}

// ═══════════════════════════════════════════════════════════════════════════
// Table Utilities
// ═══════════════════════════════════════════════════════════════════════════
const TableUtils = {
  sort(tableId, columnIndex, direction = 'asc') {
    const table = document.getElementById(tableId) || document.querySelector(`#${tableId} table`);
    if (!table) return;

    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    rows.sort((a, b) => {
      const aVal = a.cells[columnIndex]?.textContent.trim() || '';
      const bVal = b.cells[columnIndex]?.textContent.trim() || '';

      const aNum = parseFloat(aVal.replace(/[^0-9.-]/g, ''));
      const bNum = parseFloat(bVal.replace(/[^0-9.-]/g, ''));

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return direction === 'asc' ? aNum - bNum : bNum - aNum;
      }

      return direction === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });

    rows.forEach(row => tbody.appendChild(row));
  },

  filter(tableId, searchTerm, columnIndex = 0) {
    const table = document.getElementById(tableId) || document.querySelector(`#${tableId} table`);
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const text = row.cells[columnIndex]?.textContent.trim().toLowerCase() || '';
      row.style.display = text.includes(searchTerm.toLowerCase()) ? '' : 'none';
    });
  },

  selectAll(source, tableId) {
    const table = document.getElementById(tableId) || document.querySelector(`#${tableId} table`);
    if (!table) return;

    const checkboxes = table.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = source.checked);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Department Filter for Employee List
// ═══════════════════════════════════════════════════════════════════════════
function filterDept(val) {
  document.querySelectorAll('tbody tr[data-dept]').forEach(row => {
    row.style.display = (!val || row.dataset.dept === val) ? '' : 'none';
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Modal System
// ═══════════════════════════════════════════════════════════════════════════
const Modal = {
  open(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  },

  close(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  },

  create(options) {
    const { title, content, actions, onClose } = options;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop open';
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="btn btn--ghost btn--icon" onclick="Modal.closeAll()">×</button>
        </div>
        <div class="modal-body">${content}</div>
        ${actions ? `<div class="modal-footer">${actions}</div>` : ''}
      </div>
    `;

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.closeAll();
        if (onClose) onClose();
      }
    });

    document.body.appendChild(backdrop);
    return backdrop;
  },

  closeAll() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.remove());
    document.body.style.overflow = '';
  }
};

// Close modal on escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    Modal.closeAll();
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Form Enhancements
// ═══════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Auto-submit forms with data-autosubmit attribute
  document.querySelectorAll('[data-autosubmit]').forEach(el => {
    el.addEventListener('change', () => {
      el.closest('form')?.submit();
    });
  });

  // Character counter for textareas
  document.querySelectorAll('[data-maxlength]').forEach(textarea => {
    const max = parseInt(textarea.dataset.maxlength);
    const counter = document.createElement('div');
    counter.className = 'text-muted text-sm';
    counter.style.cssText = 'text-align: right; margin-top: 4px;';
    textarea.parentElement.appendChild(counter);

    const updateCounter = () => {
      const remaining = max - textarea.value.length;
      counter.textContent = `${textarea.value.length}/${max}`;
      counter.style.color = remaining < 50 ? '#f59e0b' : remaining < 20 ? '#ef4444' : '';
    };

    textarea.addEventListener('input', updateCounter);
    updateCounter();
  });

  // Form validation styling + prevent double-submit
  document.querySelectorAll('form').forEach(form => {
    let submitted = false;
    let clickedBtn = null;

    // Track which submit button was clicked so its name/value is preserved
    // (disabled buttons don't include their name=value in POST data)
    form.querySelectorAll('button[type=submit], input[type=submit]').forEach(btn => {
      btn.addEventListener('click', () => {
        clickedBtn = btn;
      });
    });

    form.addEventListener('submit', (e) => {
      const invalid = form.querySelector(':invalid');
      if (invalid) {
        e.preventDefault();
        invalid.focus();
        invalid.style.borderColor = '#ef4444';
        invalid.style.boxShadow = '0 0 0 4px rgba(239,68,68,0.1)';
        Toast.error('Please fill in all required fields.');
        return;
      }
      // Prevent double-submit
      if (submitted) {
        e.preventDefault();
        return;
      }
      submitted = true;

      // Inject hidden input for the clicked button's name/value BEFORE disabling
      if (clickedBtn && clickedBtn.name) {
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = clickedBtn.name;
        hidden.value = clickedBtn.value;
        form.appendChild(hidden);
      }

      // Now safe to disable buttons (hidden input carries the value)
      form.querySelectorAll('button[type=submit], input[type=submit]').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.cursor = 'not-allowed';
      });
    });
  });

  // Stagger-animate cards and stat-cards on page load
  const animateEls = document.querySelectorAll('.stat-card, .card, .report-card, .project-card');
  animateEls.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    setTimeout(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 60 * i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Real-time Clock & Work Timer for Check-in Widget
// ═══════════════════════════════════════════════════════════════════════════
(function() {
  const timeEl = document.querySelector('.checkin-time');
  const dateEl = document.querySelector('.checkin-date');
  const timerEl = document.getElementById('workTimer');
  const timerStart = timerEl ? timerEl.dataset.start : null;

  function updateClock() {
    const now = new Date();
    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    }
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  }

  function updateWorkTimer() {
    if (!timerStart || !timerEl) return;
    const start = new Date(timerStart);
    const now = new Date();
    const diff = now - start;

    if (diff < 0) return;

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    timerEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  updateClock();
  setInterval(updateClock, 1000);

  if (timerStart) {
    updateWorkTimer();
    setInterval(updateWorkTimer, 1000);
  }
})();

// ═══════════════════════════════════════════════════════════════════════════
// Search Highlight
// ═══════════════════════════════════════════════════════════════════════════
function highlightSearch(term) {
  if (!term) return;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const nodesToReplace = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.tagName !== 'SCRIPT' &&
        node.parentElement.tagName !== 'STYLE' &&
        node.parentElement.className !== 'message-content') {
      if (node.textContent.toLowerCase().includes(term.toLowerCase())) {
        nodesToReplace.push(node);
      }
    }
  }

  nodesToReplace.forEach(node => {
    const regex = new RegExp(`(${term})`, 'gi');
    const parent = node.parentElement;
    const span = document.createElement('span');
    span.innerHTML = node.textContent.replace(regex, '<mark style="background:#fef08a;padding:0 2px;border-radius:2px;">$1</mark>');
    parent.replaceChild(span, node);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Lazy Loading Images
// ═══════════════════════════════════════════════════════════════════════════
if ('IntersectionObserver' in window) {
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
        observer.unobserve(img);
      }
    });
  });

  document.querySelectorAll('img[data-src]').forEach(img => {
    imageObserver.observe(img);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Drag & Drop File Upload Enhancement
// ═══════════════════════════════════════════════════════════════════════════
document.querySelectorAll('.drop-zone').forEach(zone => {
  const input = zone.querySelector('input[type="file"]') || zone.previousElementSibling?.querySelector('input[type="file"]');
  // Find the dedicated file name display element (e.g. #fileName)
  const fileNameEl = zone.parentElement?.querySelector('#fileName') || zone.closest('.card')?.querySelector('#fileName');

  function showFileName(name) {
    // Update the drop zone subtitle text
    const nameEl = zone.querySelector('.drop-zone-text');
    if (nameEl) nameEl.textContent = name;
    // Also update dedicated #fileName display if present
    if (fileNameEl) {
      fileNameEl.textContent = '✓ ' + name;
      fileNameEl.classList.remove('hidden');
    }
  }

  zone.addEventListener('click', () => {
    if (input) input.click();
  });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (input && e.dataTransfer.files.length) {
      input.files = e.dataTransfer.files;
      showFileName(e.dataTransfer.files[0].name);
    }
  });

  // Handle file input change
  if (input) {
    input.addEventListener('change', () => {
      if (input.files.length) {
        showFileName(input.files[0].name);
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Task Card Expand/Collapse (Projects)
// ═══════════════════════════════════════════════════════════════════════════
document.querySelectorAll('.task-card-header').forEach(h => {
  h.addEventListener('click', () => {
    const body = h.nextElementSibling;
    const icon = h.querySelector('.task-expand');
    if (body && body.classList.contains('task-card-body')) {
      body.classList.toggle('open');
      if (icon) icon.textContent = body.classList.contains('open') ? '▲' : '▼';
    }
  });
});

// Subtask status auto-submit
document.querySelectorAll('.subtask-status-select').forEach(s => {
  s.addEventListener('change', () => s.closest('form').submit());
});

// ═══════════════════════════════════════════════════════════════════════════
// Navigation Sub-Group Toggle (Attendance expanded menu)
// ═══════════════════════════════════════════════════════════════════════════
function toggleNavGroup(triggerEl) {
  // Sub-group is always the immediate next sibling in the DOM
  const subGroup = triggerEl.nextElementSibling;
  if (!subGroup || !subGroup.classList.contains('nav-sub-group')) return;

  const isOpen = subGroup.classList.contains('open');
  subGroup.classList.toggle('open');
  triggerEl.classList.toggle('open');
  // Chevron rotation is handled by .nav-item.open .nav-chevron svg in CSS.

  // Persist state in localStorage
  try {
    localStorage.setItem('nav_' + subGroup.id, isOpen ? '0' : '1');
  } catch(e) {}
}

// Restore sub-group states from localStorage on load
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-sub-group').forEach(group => {
    const stored = localStorage.getItem('nav_' + group.id);
    if (stored === '1') {
      group.classList.add('open');
      const trigger = group.previousElementSibling;
      if (trigger && trigger.classList.contains('nav-item')) {
        trigger.classList.add('open');
      }
    }
  });
});

// Toggle subtask form
function toggleSubtaskForm(id) {
  const f = document.getElementById('subtask-form-' + id);
  if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

// Toggle comment form
function toggleComment(id) {
  const el = document.getElementById('comment-' + id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ═══════════════════════════════════════════════════════════════════════════
// Print Function
// ═══════════════════════════════════════════════════════════════════════════
function printPage() {
  window.print();
}

// ═══════════════════════════════════════════════════════════════════════════
// Copy to Clipboard
// ═══════════════════════════════════════════════════════════════════════════
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    Toast.success('Copied to clipboard!');
  }).catch(() => {
    Toast.error('Failed to copy');
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Keyboard Shortcuts
// ═══════════════════════════════════════════════════════════════════════════
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + K: Focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const searchInput = document.querySelector('.filter-bar .form-input, [data-search]');
    if (searchInput) searchInput.focus();
  }

  // Ctrl/Cmd + Shift + D: Toggle dark mode
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
    e.preventDefault();
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
      toggle.checked = !toggle.checked;
      toggle.dispatchEvent(new Event('change'));
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Export functions for global use
// ═══════════════════════════════════════════════════════════════════════════
window.Toast = Toast;
window.Modal = Modal;
window.TableUtils = TableUtils;
window.filterDept = filterDept;
window.highlightSearch = highlightSearch;
window.getCsrfToken = getCsrfToken;
window.toggleSubtaskForm = toggleSubtaskForm;
window.toggleComment = toggleComment;
window.printPage = printPage;
window.copyToClipboard = copyToClipboard;

// ═══════════════════════════════════════════════════════════════════════════
// Page Load Animation
// ═══════════════════════════════════════════════════════════════════════════
document.body.classList.add('loading');
window.addEventListener('load', () => {
  document.body.classList.remove('loading');
  document.body.classList.add('loaded');
});
