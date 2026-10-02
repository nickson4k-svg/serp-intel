/**
 * VibeRadar — Shared UI Helpers & Navigation
 */

// 1. Theme Management
export function initTheme() {
  const savedTheme = localStorage.getItem('viberadar_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }

  // Listen to system changes if no manual preference
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('viberadar_theme')) {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      updateThemeButtonText();
    }
  });
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('viberadar_theme', next);
  updateThemeButtonText();
}

function getThemeToggleHtml(theme) {
  if (theme === 'dark') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg><span>Світла</span>`;
  }
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg><span>Темна</span>`;
}

function updateThemeButtonText() {
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    btn.innerHTML = getThemeToggleHtml(current);
  }
}

// 2. Navigation bar renderer
export function renderHeader(activePage = 'pulse') {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const links = [
    { id: 'pulse', label: 'Pulse', href: 'index.html' },
    { id: 'builders', label: 'Builders', href: 'builders.html' },
    { id: 'niche-map', label: 'Niche Map', href: 'niche-map.html' },
    { id: 'gap-finder', label: 'Gap Finder', href: 'gap-finder.html' },
    { id: 'teardown', label: 'Teardown', href: 'teardown.html' },
    { id: 'method', label: 'Methodology', href: 'method.html' },
  ];

  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

  header.innerHTML = `
    <div class="container header-inner">
      <div style="display: flex; align-items: center; gap: 8px;">
        <a href="index.html" class="brand">
          <div class="brand-radar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
              <path d="M8.5 8.5a5 5 0 0 0 7 7"></path>
              <circle cx="12" cy="12" r="1.5" fill="currentColor"></circle>
            </svg>
          </div>
          <span>VibeRadar</span>
        </a>
        <span class="header-status-indicator" id="headerApiStatus" title="Підключено до живого FreeSerp API">
          <span class="status-dot dot-live" id="headerApiDot"></span>
          <span id="headerApiText">Live</span>
        </span>
      </div>

      <nav aria-label="Головна навігація">
        <ul class="nav-links">
          ${links.map(l => `
            <li class="nav-item ${activePage === l.id ? 'active' : ''}">
              <a href="${l.href}">${l.label}</a>
            </li>
          `).join('')}
        </ul>
      </nav>

      <div class="header-actions">
        <button id="themeToggleBtn" class="theme-toggle-btn" aria-label="Перемкнути тему">
          ${getThemeToggleHtml(currentTheme)}
        </button>
      </div>
    </div>
  `;

  document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
}

// 2.1 Live / Cached Status Updater
export function updateApiStatus(isLive, label) {
  const dot = document.getElementById('headerApiDot');
  const text = document.getElementById('headerApiText');
  const container = document.getElementById('headerApiStatus');
  if (!dot || !text) return;
  if (isLive) {
    dot.className = 'status-dot dot-live';
    text.textContent = label || 'Live';
    if (container) container.title = 'Підключено до живого FreeSerp API';
  } else {
    dot.className = 'status-dot dot-cached';
    text.textContent = label || 'Cached';
    if (container) container.title = 'Офлайн / Резервний знімок даних';
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('viberadar:api-status', (e) => {
    if (e.detail) {
      updateApiStatus(e.detail.isLive, e.detail.label);
    }
  });
}

// 3. Footer renderer
export function renderFooter() {
  const footer = document.querySelector('.site-footer');
  if (!footer) return;

  footer.innerHTML = `
    <div class="container footer-inner">
      <div>
        <strong>VibeRadar</strong> — Аналітична платформа екосистеми вебсайтів та AI-білдерів на базі індексу <a href="https://freeserp.ai" target="_blank" rel="noopener">FreeSerp.ai</a>.
      </div>
      <div>
        Дані глобального індексу (20M+ сайтів). Дата live відповідає моменту першої фіксації домену живим у веб-просторі.
      </div>
    </div>
  `;
}

// 4. Formatting Utilities
export function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '—';
  return new Intl.NumberFormat('uk-UA').format(num);
}

export function formatPercent(num, digits = 1) {
  if (num === null || num === undefined || isNaN(num)) return '—';
  return `${Number(num).toFixed(digits)}%`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('uk-UA', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (_) {
    return String(dateStr);
  }
}

export function formatShortDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr).slice(5, 10);
    return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch (_) {
    return String(dateStr).slice(5, 10);
  }
}

// Auto-run theme on import
initTheme();
