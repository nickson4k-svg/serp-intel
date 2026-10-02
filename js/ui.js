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

function updateThemeButtonText() {
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    btn.innerHTML = current === 'dark' ? '☀️ Світла' : '🌙 Темна';
  }
}

// 2. Navigation bar renderer
export function renderHeader(activePage = 'pulse') {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const links = [
    { id: 'pulse', label: '⚡ Pulse', href: 'index.html' },
    { id: 'builders', label: '🛠 Builders', href: 'builders.html' },
    { id: 'niche-map', label: '🗺 Niche Map', href: 'niche-map.html' },
    { id: 'gap-finder', label: '🔍 Gap Finder', href: 'gap-finder.html' },
    { id: 'teardown', label: '🔬 Teardown', href: 'teardown.html' },
    { id: 'method', label: '📖 Method', href: 'method.html' },
  ];

  header.innerHTML = `
    <div class="container header-inner">
      <a href="index.html" class="brand">
        <div class="brand-radar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
            <path d="M8.5 8.5a5 5 0 0 0 7 7"></path>
            <circle cx="12" cy="12" r="1" fill="currentColor"></circle>
          </svg>
        </div>
        <span>VibeRadar</span>
      </a>

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
          ${(document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? '☀️ Світла' : '🌙 Темна'}
        </button>
      </div>
    </div>
  `;

  document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
}

// 3. Footer renderer
export function renderFooter() {
  const footer = document.querySelector('.site-footer');
  if (!footer) return;

  footer.innerHTML = `
    <div class="container footer-inner">
      <div>
        <strong>VibeRadar</strong> — Радар екосистеми AI-білдерів на базі публічного індексу <a href="https://freeserp.ai" target="_blank" rel="noopener">FreeSerp.ai</a>.
      </div>
      <div>
        Усі дані отримані напряму через FreeSerp API (index: <code>sites</code>). Дата live = «вперше зафіксовано живим».
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
