/**
 * VibeRadar — Data Layer
 * FreeSerp API Client with Rate-Limiting Queue, sessionStorage Caching,
 * 10s Timeout and 502 Retry Mechanism.
 */

const BASE_URL = 'https://freeserp.ai/api.php';
const AGENT = 'VibeRadar/1.0';
const PROJECT = 'VibeRadar';
const MIN_REQUEST_INTERVAL_MS = 350; // Max ~2.8 requests/sec (< 3 req/sec)
const REQUEST_TIMEOUT_MS = 10000;   // 10s timeout
const MAX_502_RETRIES = 2;          // Up to 2 retries on 502
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
    throw err;
  }
}

/**
 * Core query function with caching and queueing
 */
export async function rawApiQuery(params = {}, options = {}) {
  const urlObj = new URL(BASE_URL);
  
  // Enforce mandatory parameters
  urlObj.searchParams.set('agent', AGENT);
  urlObj.searchParams.set('project', PROJECT);

  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      urlObj.searchParams.set(key, String(val));
    }
  }

  const cacheKey = urlObj.toString();
  if (!options.bypassCache) {
    const cached = safeGetCache(cacheKey);
    if (cached) {
      return { ...cached, _cached: true, _sourceUrl: cacheKey };
    }
  }

  const result = await apiQueue.enqueue(() => fetchWithRetry(cacheKey));
  
  if (result && result.ok) {
    safeSetCache(cacheKey, result);
  }

  return { ...result, _cached: false, _sourceUrl: cacheKey };
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
