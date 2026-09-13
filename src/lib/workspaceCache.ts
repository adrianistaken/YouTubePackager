import type { WorkspaceState } from '../types'

const PREFIX = 'youtube-packager:v2:'
const LEGACY_KEYS = ['youtube-packager:workspace', 'youtube-packager:package', 'youtube-packager:channel-url', 'youtube-packager:cloud-sync', 'youtube-packager:legacy-assets-recovered']
const key = (owner: string | null) => `${PREFIX}${owner ?? 'guest'}`

export function readWorkspaceCache(owner: string | null): Partial<WorkspaceState> | null {
  try {
    const value = window.localStorage.getItem(key(owner))
    return value ? JSON.parse(value) : null
  } catch { return null }
}

export function writeWorkspaceCache(owner: string | null, workspace: WorkspaceState) {
  try {
    window.localStorage.setItem(key(owner), JSON.stringify(workspace))
  } catch {
    // Do not overwrite a complete cached workspace with a copy missing its images.
  }
}

export function clearWorkspaceCache(owner: string | null) {
  try {
    window.localStorage.removeItem(key(owner))
    window.localStorage.removeItem(`${key(owner)}:sync`)
    for (const legacy of LEGACY_KEYS) window.localStorage.removeItem(legacy)
  } catch { /* The in-memory workspace is still cleared when storage is unavailable. */ }
}

export function readSyncMetadata(owner: string | null): { userId: string | null; localChangedAt: number } {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`${key(owner)}:sync`) ?? '')
    return { userId: owner, localChangedAt: typeof parsed.localChangedAt === 'number' ? parsed.localChangedAt : 0 }
  } catch { return { userId: owner, localChangedAt: 0 } }
}

export function writeSyncMetadata(metadata: { userId: string | null; localChangedAt: number }) {
  try { window.localStorage.setItem(`${key(metadata.userId)}:sync`, JSON.stringify(metadata)) } catch { /* Optional cache. */ }
}

// Move the old shared cache behind its recorded owner's boundary before showing any UI.
export function migrateWorkspaceCache() {
  try {
    const raw = window.localStorage.getItem('youtube-packager:workspace')
    const legacyPackage = window.localStorage.getItem('youtube-packager:package')
    if (!raw && !legacyPackage) return
    let metadata: { userId?: string; localChangedAt?: number } = {}
    try { metadata = JSON.parse(window.localStorage.getItem('youtube-packager:cloud-sync') ?? '{}') } catch { /* Guest cache. */ }
    const owner = typeof metadata.userId === 'string' ? metadata.userId : null
    const state = raw ? JSON.parse(raw) : { packageData: JSON.parse(legacyPackage!), previewMode: 'desktop', placementStep: 0 }
    if (state.packageData && !state.packageData.channelUrl) state.packageData.channelUrl = window.localStorage.getItem('youtube-packager:channel-url') ?? ''
    if (!window.localStorage.getItem(key(owner))) {
      window.localStorage.setItem(key(owner), JSON.stringify(state))
      writeSyncMetadata({ userId: owner, localChangedAt: metadata.localChangedAt ?? 0 })
    }
    for (const legacy of LEGACY_KEYS) window.localStorage.removeItem(legacy)
  } catch { /* Never display an unreadable legacy cache. */ }
}
