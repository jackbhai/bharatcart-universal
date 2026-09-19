/**
 * Versioned state migrations. Bump SCHEMA_VERSION and add an entry whenever
 * the persisted shape changes, so returning users don't get a broken store.
 */
export const SCHEMA_VERSION = 1

/** version N -> N+1 */
export const migrations = {
  // 0: pre-versioned / unknown blobs -> v1 baseline
  0: (state) => ({
    ...state,
    _migratedFrom: 0,
  }),
}

export function migrate(persisted, targetVersion = SCHEMA_VERSION) {
  if (!persisted || typeof persisted !== 'object') return null
  let version = typeof persisted.__v === 'number' ? persisted.__v : 0
  let data = persisted.data ?? persisted

  if (version > targetVersion) {
    console.warn(`[migrate] persisted v${version} is newer than app v${targetVersion}; discarding`)
    return null
  }

  while (version < targetVersion) {
    const step = migrations[version]
    if (!step) { version = targetVersion; break }
    try {
      data = step(data)
      version += 1
    } catch (err) {
      console.error(`[migrate] step ${version} failed; discarding persisted state`, err)
      return null
    }
  }

  return data
}

export function envelope(data, version = SCHEMA_VERSION) {
  return { __v: version, at: Date.now(), data }
}

export default migrate
