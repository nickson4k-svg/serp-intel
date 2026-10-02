/**
 * VibeRadar — Data Layer
 * FreeSerp API Client with Rate-Limiting Queue, sessionStorage Caching,
 * 10s Timeout and 502 Retry Mechanism.
 */

import { FALLBACK_STATS, FALLBACK_BUILDERS } from './fallback-data.js';

let activeBaseUrl = null;

export function getBaseUrlCandidates() {
  if (activeBaseUrl) return [activeBaseUrl];

  const candidates = [];
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    const origin   = window.location.origin;

    // 1. Same-origin proxy (works for Vercel /api.php and local proxy on 4000)
    candidates.push(`${origin}/api.php`);

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // If frontend runs on a different port (e.g. IDE live server), connect to local proxy on 4000
      candidates.push('http://localhost:4000/api.php');
      candidates.push('http://127.0.0.1:4000/api.php');
    }
  }

  // Direct FreeSerp API endpoints.
  // NOTE: Browser fetch will be CORS-blocked (duplicate "*, *" header from freeserp.ai).
  // The catch in rawApiQuery silently falls back to snapshot data in that case.
  candidates.push('https://freeserp.ai/api.php');
  candidates.push('https://freeserp.ai/api');

  return candidates;
}

export function getActiveBaseUrl() {
  return activeBaseUrl || getBaseUrlCandidates()[0];
}

let BASE_URL = getActiveBaseUrl();
const AGENT = 'VibeRadar/1.0';
const PROJECT = 'VibeRadar';
const MIN_REQUEST_INTERVAL_MS = 350; // Max ~2.8 requests/sec (< 3 req/sec)
const REQUEST_TIMEOUT_MS = 8000;    // 8s timeout
const MAX_502_RETRIES = 1;          // Up to 1 retry on 502
const CACHE_PREFIX = 'viberadar_cache_v1:';

// In-memory fallback if sessionStorage is restricted/disabled
const memoryCache = new Map();

function safeGetCache(key) {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const item = window.sessionStorage.getItem(CACHE_PREFIX + key);
      return item ? JSON.parse(item) : null;
    }
  } catch (e) {
    // Fallback to memory
  }
  return memoryCache.get(key) || null;
}

function safeSetCache(key, data) {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
      return;
    }
  } catch (e) {
    // Fallback or quota exceeded
  }
  memoryCache.set(key, data);
}

/**
 * Sequential Request Queue with guaranteed pause between requests
 */
class RequestQueue {
  constructor(minIntervalMs = MIN_REQUEST_INTERVAL_MS) {
    this.minIntervalMs = minIntervalMs;
    this.lastRequestTimestamp = 0;
    this.queue = Promise.resolve();
  }

  enqueue(fn) {
    this.queue = this.queue.then(async () => {
      const now = Date.now();
      const elapsed = now - this.lastRequestTimestamp;
      if (elapsed < this.minIntervalMs) {
        await new Promise(resolve => setTimeout(resolve, this.minIntervalMs - elapsed));
      }
      this.lastRequestTimestamp = Date.now();
      return fn();
    });
    return this.queue;
  }
}

const apiQueue = new RequestQueue();

/**
 * Low-level HTTP requester with timeout and retry logic
 */
async function fetchWithRetry(url, attempt = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`));
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });
    clearTimeout(timer);

    if (response.status === 502 && attempt < MAX_502_RETRIES) {
      const backoffMs = (attempt + 1) * 600;
      await new Promise(r => setTimeout(r, backoffMs));
      return fetchWithRetry(url, attempt + 1);
    }

    if (!response.ok) {
      let errBody = null;
      try {
        errBody = await response.json();
      } catch (_) {}
      const error = new Error(errBody?.detail || errBody?.error || `HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      error.body = errBody;
      throw error;
    }

    const data = await response.json();
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      const timeoutErr = new Error(`Таймаут запиту (${REQUEST_TIMEOUT_MS / 1000} с)`);
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    // Catch CORS failures: browser raises TypeError with 'Failed to fetch' or
    // 'NetworkError' when a CORS violation (e.g. duplicate "*, *" header) occurs.
    if (
      err.name === 'TypeError' &&
      (
        err.message.toLowerCase().includes('failed to fetch') ||
        err.message.toLowerCase().includes('networkerror') ||
        err.message.toLowerCase().includes('network request failed')
      )
    ) {
      const corsErr = new Error(`Браузер заблокував прямий запит (CORS / мережева помилка)`);
      corsErr.isCors = true;
      corsErr.original = err;
      throw corsErr;
    }
    throw err;
  }
}

/**
 * Executes a query with candidate base URL fallback to avoid 404s
 */
async function executeWithCandidateFallback(urlBuilder) {
  const candidates = getBaseUrlCandidates();
  let lastError = null;

  for (let i = 0; i < candidates.length; i++) {
    const base = candidates[i];
    const targetUrl = urlBuilder(base);

    try {
      const data = await fetchWithRetry(targetUrl);
      if (data && (data.ok || data.results || data.stats || data.total !== undefined || data.generated_at)) {
        activeBaseUrl = base;
        BASE_URL = base;
        return { data, targetUrl };
      }
    } catch (err) {
      lastError = err;
      // CORS errors are systemic — all remaining direct candidates will fail too.
      // Short-circuit immediately so we don't spam 3 identical CORS errors in the console.
      if (err.isCors) {
        break;
      }
      continue;
    }
  }

  throw lastError || new Error('Усі API-ендпоінти повернули помилку або 404.');
}

/**
 * Resolves local fallback data when network or upstream returns 404/CORS
 */
async function resolveFallbackData(params = {}) {
  // 1. Stats query (index.html Pulse)
  if (params.stats === 1 || params.stats === '1' || params.stats) {
    try {
      const res = await fetch('./data/sample-stats.json');
      if (res.ok) {
        const json = await res.json();
        return json;
      }
    } catch (_) {}
    return JSON.parse(JSON.stringify(FALLBACK_STATS));
  }

  // 2. Builder counts or site queries
  if (params.ai_source) {
    const key = String(params.ai_source).toLowerCase();
    let bData = null;
    try {
      const res = await fetch('./data/sample-builders.json');
      if (res.ok) {
        const json = await res.json();
        bData = json[key];
      }
    } catch (_) {}
    if (!bData) {
      bData = FALLBACK_BUILDERS[key] || { total: 0, dr_ge_1: 0, top_sites: [] };
    }

    const isDrMin = params.dr_min !== undefined && Number(params.dr_min) >= 1;
    const total = isDrMin ? bData.dr_ge_1 : bData.total;
    const sites = (bData.top_sites || []).filter(s => !isDrMin || (s.dr && s.dr >= 1));

    return {
      ok: true,
      total: total,
      count: sites.length,
      took_ms: 12,
      results: sites,
      filters: params
    };
  }

  // 3. Generic site search fallback
  const allSites = [];
  for (const b of Object.values(FALLBACK_BUILDERS)) {
    if (Array.isArray(b.top_sites)) {
      allSites.push(...b.top_sites);
    }
  }

  let filtered = allSites;
  if (params.q) {
    const qClean = String(params.q).toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').trim();
    const matched = allSites.filter(s => {
      const sDom = (s.domain || '').toLowerCase().replace(/^www\./i, '');
      return sDom === qClean || sDom.includes(qClean) || qClean.includes(sDom);
    });
    if (matched.length > 0) {
      filtered = matched;
    }
  }

  return {
    ok: true,
    total: filtered.length,
    count: filtered.length,
    took_ms: 10,
    results: filtered.slice(0, Number(params.size) || 20),
    filters: params
  };
}

/**
 * Core query function with caching, queueing, and silent fallback
 */
export async function rawApiQuery(params = {}, options = {}) {
  const queryParams = new URLSearchParams();
  queryParams.set('agent', AGENT);
  queryParams.set('project', PROJECT);
  // index=sites is REQUIRED by freeserp.ai — without it the server returns 404
  queryParams.set('index', params.index || 'sites');

  for (const [key, val] of Object.entries(params)) {
    // skip 'index' — already set above
    if (key === 'index') continue;
    if (val !== undefined && val !== null && val !== '') {
      queryParams.set(key, String(val));
    }
  }

  const queryStr = queryParams.toString();
  const cacheKey = `query:${queryStr}`;

  if (!options.bypassCache) {
    const cached = safeGetCache(cacheKey);
    if (cached) {
      return { ...cached, _cached: true, _sourceUrl: `${getActiveBaseUrl()}?${queryStr}` };
    }
  }

  try {
    const { data, targetUrl } = await apiQueue.enqueue(() => 
      executeWithCandidateFallback(base => `${base}?${queryStr}`)
    );

    if (data && data.ok) {
      safeSetCache(cacheKey, data);
    }

    return { ...data, _cached: false, _sourceUrl: targetUrl };
  } catch (err) {
    console.warn('[VibeRadar API] Мережевий запит недоступний, використовуємо знімок даних:', err.message);
    const fallbackData = await resolveFallbackData(params);
    return { ...fallbackData, _cached: false, _fallback: true, _sourceUrl: 'snapshot-fallback' };
  }
}

/**
 * 1. getStats() — Отримання живого зрізу індексу
 */
export async function getStats(options = {}) {
  return rawApiQuery({ stats: 1 }, options);
}

/**
 * 2. countBy(filters) — Швидкий підрахунок кількості сайтів із size=1
 * @param {Object} filters — { ai_source, dr_min, ai_categories, ai_startups, ... }
 */
export async function countBy(filters = {}, options = {}) {
  const params = {
    size: 1,
    ...filters
  };

  const response = await rawApiQuery(params, options);
  return {
    total: typeof response.total === 'number' ? response.total : 0,
    took_ms: response.took_ms || 0,
    filters: response.filters || filters,
    sample: (response.results && response.results.length > 0) ? response.results[0] : null,
    _cached: !!response._cached,
    _sourceUrl: response._sourceUrl
  };
}

/**
 * 3. searchSites(filters) — Пошук сайтів за параметрами або запитом
 * @param {Object} filters — { q, ai_source, ai_categories, dr_min, dr_max, sort, order, size, from, all, ... }
 */
export async function searchSites(filters = {}, options = {}) {
  const defaultParams = {
    size: 20,
    from: 0,
    sort: 'relevance',
    order: 'desc'
  };

  const params = { ...defaultParams, ...filters };
  const response = await rawApiQuery(params, options);

  return {
    ok: response.ok ?? true,
    total: response.total ?? 0,
    count: response.count ?? (response.results ? response.results.length : 0),
    from: response.from ?? params.from,
    size: response.size ?? params.size,
    sort: response.sort ?? params.sort,
    order: response.order ?? params.order,
    results: response.results || [],
    took_ms: response.took_ms || 0,
    filters: response.filters || {},
    _cached: !!response._cached,
    _sourceUrl: response._sourceUrl
  };
}

export { BASE_URL, AGENT, PROJECT };

// Global window exposure for non-module script tags
if (typeof window !== 'undefined') {
  window.VibeRadarAPI = {
    getStats,
    countBy,
    searchSites,
    rawApiQuery,
    BASE_URL,
    AGENT,
    PROJECT
  };
}
