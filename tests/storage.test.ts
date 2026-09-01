import { describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS, migrateLegacyStorageKeys, readJson, writeJson } from '../config/storage';

const MIGRATION_FLAG = 'sebillink_storage_migration_v1';

describe('migrateLegacyStorageKeys', () => {
  it('copies legacy Sanctuary and Sabil keys onto the current names', () => {
    localStorage.setItem('sanctuary_user', '{"id":"u1"}');
    localStorage.setItem('sanctuary_sessions', '[{"id":"s1"}]');
    localStorage.setItem('sanctuary_progress', '{"xp":250}');
    localStorage.setItem('sabil_daily_legacy', '{"date":"today"}');

    migrateLegacyStorageKeys();

    expect(localStorage.getItem(STORAGE_KEYS.user)).toBe('{"id":"u1"}');
    expect(localStorage.getItem(STORAGE_KEYS.sessions)).toBe('[{"id":"s1"}]');
    expect(localStorage.getItem(STORAGE_KEYS.progress)).toBe('{"xp":250}');
    expect(localStorage.getItem(STORAGE_KEYS.dailyLegacy)).toBe('{"date":"today"}');
  });

  it('leaves the legacy keys in place so an older deploy still reads them', () => {
    localStorage.setItem('sanctuary_user', '{"id":"u1"}');

    migrateLegacyStorageKeys();

    expect(localStorage.getItem('sanctuary_user')).toBe('{"id":"u1"}');
  });

  it('never overwrites data already stored under a current key', () => {
    localStorage.setItem('sanctuary_user', '{"id":"stale"}');
    localStorage.setItem(STORAGE_KEYS.user, '{"id":"current"}');

    migrateLegacyStorageKeys();

    expect(localStorage.getItem(STORAGE_KEYS.user)).toBe('{"id":"current"}');
  });

  it('migrates runtime-suffixed briefing cache keys by prefix', () => {
    localStorage.setItem('sanctuary_briefing_cache_en_Accra_Ghana', '{"timestamp":1}');
    localStorage.setItem('sanctuary_briefing_cache_ar_Lagos_Nigeria', '{"timestamp":2}');

    migrateLegacyStorageKeys();

    expect(localStorage.getItem('sebillink_briefing_cache_en_Accra_Ghana')).toBe('{"timestamp":1}');
    expect(localStorage.getItem('sebillink_briefing_cache_ar_Lagos_Nigeria')).toBe('{"timestamp":2}');
  });

  it('runs at most once, so a later user edit is not reverted by a stale legacy value', () => {
    localStorage.setItem('sanctuary_lang', 'ar');
    migrateLegacyStorageKeys();
    expect(localStorage.getItem(STORAGE_KEYS.lang)).toBe('ar');

    // The user switches language, then reloads the app.
    localStorage.setItem(STORAGE_KEYS.lang, 'en');
    migrateLegacyStorageKeys();

    expect(localStorage.getItem(STORAGE_KEYS.lang)).toBe('en');
  });

  it('records the migration flag', () => {
    migrateLegacyStorageKeys();
    expect(localStorage.getItem(MIGRATION_FLAG)).toBe('1');
  });

  it('does nothing when there is no legacy data', () => {
    migrateLegacyStorageKeys();

    for (const key of Object.values(STORAGE_KEYS)) {
      expect(localStorage.getItem(key)).toBeNull();
    }
  });
});

describe('writeJson', () => {
  it('serialises the value under the given key', () => {
    writeJson(STORAGE_KEYS.sessions, [{ id: 's1', title: 'New Inquiry' }]);

    expect(localStorage.getItem(STORAGE_KEYS.sessions)).toBe('[{"id":"s1","title":"New Inquiry"}]');
  });

  it('warns instead of throwing when the quota is exceeded', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    expect(() => writeJson(STORAGE_KEYS.sessions, [{ id: 's1' }])).not.toThrow();
    expect(warn).toHaveBeenCalled();

    setItem.mockRestore();
    warn.mockRestore();
  });
});

describe('readJson', () => {
  it('round-trips a value written by writeJson', () => {
    writeJson(STORAGE_KEYS.progress, { xp: 400, level: 3 });
    expect(readJson(STORAGE_KEYS.progress, null)).toEqual({ xp: 400, level: 3 });
  });

  it('returns the fallback when the key is absent', () => {
    expect(readJson('sebillink_missing', { xp: 0 })).toEqual({ xp: 0 });
  });

  it('returns the fallback instead of throwing on malformed JSON', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(STORAGE_KEYS.sessions, '{"half-written":');

    expect(readJson(STORAGE_KEYS.sessions, [])).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('preserves a stored null rather than substituting the fallback', () => {
    // `user` is legitimately null when signed out; that must not be confused
    // with "unreadable, use the default".
    writeJson(STORAGE_KEYS.user, null);
    expect(readJson(STORAGE_KEYS.user, { id: 'fallback' })).toBeNull();
  });

  it('returns the fallback when storage itself throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage disabled');
    });

    expect(readJson(STORAGE_KEYS.arts, [])).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });
});
