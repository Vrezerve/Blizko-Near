// Shared cache for /api/settings/public — dedupes concurrent requests and
// keeps a short-lived cache so multiple components don't re-fetch on mount.
import axios from 'axios';

const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const API = process.env.REACT_APP_BACKEND_URL + '/api';

let cached = null;      // last resolved data
let cachedAt = 0;       // timestamp
let inflight = null;    // shared pending promise

export const fetchPublicSettings = () => {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) {
    return Promise.resolve(cached);
  }
  if (inflight) return inflight;
  inflight = axios
    .get(`${API}/settings/public`)
    .then((res) => {
      cached = res.data;
      cachedAt = Date.now();
      inflight = null;
      return cached;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
};

export const invalidatePublicSettings = () => {
  cached = null;
  cachedAt = 0;
};
