/**
 * Canonical `localStorage` keys, plus a one-time migration from the keys used by
 * earlier builds of this app.
 *
 * Branding history: the app shipped as "Sanctuary" (`sanctuary_*`) and briefly as
 * "Sabil" (`sabil_*`) before settling on SebilLink (`sebillink_*`). Users who
 * loaded those builds still have data under the old names.
 *
 * The migration copies forward and deliberately does NOT delete the originals, so
 * rolling back to an older deploy does not lose anyone's chats or progress.
 * Destructive cleanup is deferred until old clients are retired.
 */

export const STORAGE_KEYS = {
  user: 'sebillink_user',
  sessions: 'sebillink_sessions',
  activeSessionId: 'sebillink_active_session_id',
  arts: 'sebillink_arts',
  artsModality: 'sebillink_arts_modality',
  artsPrompt: 'sebillink_arts_prompt',
  liveRecords: 'sebillink_live_records',
  progress: 'sebillink_progress',
  lang: 'sebillink_lang',
  theme: 'sebillink_theme',
  dailyLegacy: 'sebillink_daily_legacy',
  /** Suffixed at runtime with language and location. */
  briefingCachePrefix: 'sebillink_briefing_cache',
} as const;

/** Bumping the suffix re-runs the migration for everyone. */
const MIGRATION_FLAG = 'sebillink_storage_migration_v1';

/**
 * Best-effort JSON write.
 *
 * Persisting must never take the app down: chat sessions can carry base64 image
 * attachments and will hit the ~5 MB quota, and storage throws outright in some
 * private-browsing modes.
 */
export const writeJson = (key: string, value: unknown): void => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`SebilLink: could not persist "${key}".`, error);
  }
};

/**
 * Best-effort JSON read.
 *
 * Returns `fallback` when the key is absent, when the stored value is not valid
 * JSON (a half-written value, or one left by an incompatible older build), or
 * when storage is unavailable. Callers get a usable value in every case, so a
 * single corrupt entry cannot stop the app from booting.
 */
export const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`SebilLink: could not read "${key}"; using the default.`, error);
    return fallback;
  }
};

const LEGACY_EXACT_KEYS: Readonly<Record<string, string>> = {
  sanctuary_user: STORAGE_KEYS.user,
  sanctuary_sessions: STORAGE_KEYS.sessions,
  sanctuary_active_session_id: STORAGE_KEYS.activeSessionId,
  sanctuary_arts: STORAGE_KEYS.arts,
  sanctuary_arts_modality: STORAGE_KEYS.artsModality,
  sanctuary_arts_prompt: STORAGE_KEYS.artsPrompt,
  sanctuary_live_records: STORAGE_KEYS.liveRecords,
  sanctuary_progress: STORAGE_KEYS.progress,
  sanctuary_lang: STORAGE_KEYS.lang,
  sanctuary_theme: STORAGE_KEYS.theme,
  sabil_daily_legacy: STORAGE_KEYS.dailyLegacy,
};

/** Keys built at runtime, so they can only be matched by prefix. */
const LEGACY_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ['sanctuary_briefing_cache', STORAGE_KEYS.briefingCachePrefix],
];

/**
 * Copies legacy values to their current keys. Idempotent, and never overwrites a
 * value that already exists under the new key.
 *
 * Call once before the app mounts. Safe to call when `localStorage` is
 * unavailable (private mode, disabled storage) — it simply does nothing.
 */
export const migrateLegacyStorageKeys = (): void => {
  let store: Storage;
  try {
    store = window.localStorage;
    if (store.getItem(MIGRATION_FLAG) === '1') return;
  } catch {
    return;
  }

  const copy = (from: string, to: string): void => {
    if (from === to) return;
    const value = store.getItem(from);
    if (value === null) return;
    if (store.getItem(to) !== null) return;
    store.setItem(to, value);
  };

  try {
    for (const [legacy, current] of Object.entries(LEGACY_EXACT_KEYS)) {
      copy(legacy, current);
    }

    // Snapshot the key list first: writing during iteration shifts indices.
    const existingKeys: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key !== null) existingKeys.push(key);
    }

    for (const key of existingKeys) {
      for (const [legacyPrefix, currentPrefix] of LEGACY_PREFIXES) {
        if (key.startsWith(legacyPrefix)) {
          copy(key, currentPrefix + key.slice(legacyPrefix.length));
        }
      }
    }

    store.setItem(MIGRATION_FLAG, '1');
  } catch (error) {
    // A full quota or a hostile storage shim must not prevent the app booting.
    console.warn('SebilLink: legacy storage migration incomplete.', error);
  }
};
