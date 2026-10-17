import { STORAGE_KEY, freshState, validateProgress } from './core.mjs';

const SESSION_KEY = 'cysa-mastery.session.v1';
const CORRUPT_KEY = `${STORAGE_KEY}.unreadable`;
export const storage = { ok: true, recovered: false };

function guard(fn, fallback = null) {
  try { return fn(); } catch { storage.ok = false; return fallback; }
}

export function loadState() {
  const raw = guard(() => localStorage.getItem(STORAGE_KEY));
  if (!raw) return freshState();
  try {
    return validateProgress(JSON.parse(raw));
  } catch {
    // Keep the unreadable payload instead of silently overwriting it.
    guard(() => localStorage.setItem(CORRUPT_KEY, raw));
    storage.recovered = true;
    return freshState();
  }
}

export function saveState(state) {
  return guard(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }, false);
}

export function loadSession() {
  const raw = guard(() => localStorage.getItem(SESSION_KEY));
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    return s && Array.isArray(s.ids) && s.ids.every((id) => typeof id === 'string') && s.answers && typeof s.answers === 'object' ? s : null;
  } catch { return null; }
}
export const saveSession = (session) => guard(() => { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); return true; }, false);
export const clearSession = () => guard(() => { localStorage.removeItem(SESSION_KEY); return true; }, false);
export const clearAll = () => guard(() => { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(SESSION_KEY); return true; }, false);
