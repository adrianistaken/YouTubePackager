import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { isCloudConfigured, supabase } from '../lib/supabase'
import { VARIANT_KEYS, type LayoutMode, type VariantKey, type VideoPackage } from '../types'

type SyncStatus = 'local' | 'loading' | 'saving' | 'saved' | 'error'

type PreviewSessionRow = {
  id: string
  user_id: string
  package_data: unknown
  preview_mode: string
  placement_step: number
  avatar_path: string | null
  thumbnail_paths: unknown
  created_at: string
  updated_at: string
}

type SyncMetadata = {
  userId: string | null
  localChangedAt: number
}

type UseCloudWorkspaceOptions = {
  packageData: Ref<VideoPackage>
  previewMode: Ref<LayoutMode>
  placementStep: Ref<number>
  normalizePackage: (value: unknown) => VideoPackage
}

const ASSET_BUCKET = 'preview-assets'
const SYNC_METADATA_KEY = 'youtube-packager:cloud-sync'

export function useCloudWorkspace(options: UseCloudWorkspaceOptions) {
  const user = ref<User | null>(null)
  const authReady = ref(!isCloudConfigured)
  const syncStatus = ref<SyncStatus>(isCloudConfigured ? 'loading' : 'local')
  const notice = ref('')
  const error = ref('')

  let sessionId: string | null = null
  let avatarPath: string | null = null
  let thumbnailPaths: Partial<Record<VariantKey, string>> = {}
  let lastAvatarSource: string | null = null
  let lastThumbnailSources: Partial<Record<VariantKey, string>> = {}
  let suppressCloudSave = false
  let saveQueued = false
  let saving = false
  let workspaceLoaded = false
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let authSubscription: { unsubscribe: () => void } | null = null
  let activationVersion = 0
  let localRevision = 0

  watch(
    [options.packageData, options.previewMode, options.placementStep],
    () => {
      if (suppressCloudSave) return

      localRevision += 1
      markLocalChange()
      if (user.value && sessionId && workspaceLoaded) scheduleSave()
    },
    { deep: true },
  )

  onMounted(async () => {
    if (!supabase) return

    const { data, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) {
      error.value = sessionError.message
      syncStatus.value = 'error'
    }

    await activateUser(data.session?.user ?? null)

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => void activateUser(nextSession?.user ?? null), 0)
    })
    authSubscription = listener.subscription
    authReady.value = true
  })

  onBeforeUnmount(() => {
    if (saveTimer) window.clearTimeout(saveTimer)
    authSubscription?.unsubscribe()
  })

  async function requestMagicLink(email: string) {
    if (!supabase) {
      error.value = 'Cloud login has not been configured yet.'
      return false
    }

    error.value = ''
    notice.value = ''
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })

    if (signInError) {
      error.value = signInError.message
      return false
    }

    notice.value = 'Check your email for the sign-in link.'
    return true
  }

  async function signOut() {
    if (!supabase) return

    if (saveTimer) {
      window.clearTimeout(saveTimer)
      saveTimer = null
    }
    await flushSaveQueue()

    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) error.value = signOutError.message
  }

  function retrySync() {
    if (!user.value) return
    error.value = ''
    if (!workspaceLoaded) {
      void activateUser(user.value, true)
      return
    }
    scheduleSave(0)
  }

  async function activateUser(nextUser: User | null, force = false) {
    const version = ++activationVersion

    if (!nextUser) {
      user.value = null
      sessionId = null
      avatarPath = null
      thumbnailPaths = {}
      lastAvatarSource = null
      lastThumbnailSources = {}
      workspaceLoaded = false
      syncStatus.value = 'local'
      notice.value = ''
      return
    }

    if (!force && user.value?.id === nextUser.id && sessionId && workspaceLoaded) return

    user.value = nextUser
    syncStatus.value = 'loading'
    notice.value = ''
    error.value = ''
    workspaceLoaded = false

    try {
      await loadOrCreateWorkspace(nextUser)
      if (version !== activationVersion) return
      syncStatus.value = 'saved'
    } catch (loadError) {
      if (version !== activationVersion) return
      error.value = messageFromError(loadError, 'Could not load your saved workspace.')
      syncStatus.value = 'error'
    }
  }

  async function loadOrCreateWorkspace(activeUser: User) {
    if (!supabase) return
    const revisionAtStart = localRevision

    const { data, error: selectError } = await supabase
      .from('preview_sessions')
      .select('*')
      .eq('user_id', activeUser.id)
      .maybeSingle()

    if (selectError) throw selectError
    if (user.value?.id !== activeUser.id) return

    if (!data) {
      const { data: created, error: insertError } = await supabase
        .from('preview_sessions')
        .insert({
          user_id: activeUser.id,
          package_data: packageWithoutAssets(options.packageData.value),
          preview_mode: options.previewMode.value,
          placement_step: options.placementStep.value,
        })
        .select('*')
        .single()

      if (insertError) throw insertError
      if (user.value?.id !== activeUser.id) return
      sessionId = (created as PreviewSessionRow).id
      avatarPath = null
      thumbnailPaths = {}
      lastAvatarSource = null
      lastThumbnailSources = {}
      workspaceLoaded = true
      saveQueued = true
      await flushSaveQueue()
      return
    }

    const row = data as PreviewSessionRow
    sessionId = row.id
    avatarPath = typeof row.avatar_path === 'string' ? row.avatar_path : null
    thumbnailPaths = parseThumbnailPaths(row.thumbnail_paths)

    const metadata = readSyncMetadata()
    const remoteCreatedAt = Date.parse(row.created_at)
    const remoteUpdatedAt = Date.parse(row.updated_at)
    const localIsNewer =
      metadata.userId === activeUser.id &&
      Number.isFinite(remoteUpdatedAt) &&
      metadata.localChangedAt > remoteUpdatedAt
    const remoteHasAssets = Boolean(avatarPath || Object.keys(thumbnailPaths).length)
    const localHasAssets = Boolean(
      options.packageData.value.avatar || Object.keys(options.packageData.value.thumbnails).length,
    )
    const remoteIsPristine =
      Number.isFinite(remoteCreatedAt) &&
      Number.isFinite(remoteUpdatedAt) &&
      Math.abs(remoteUpdatedAt - remoteCreatedAt) < 1000

    if (localIsNewer || (!remoteHasAssets && localHasAssets && remoteIsPristine)) {
      lastAvatarSource = null
      lastThumbnailSources = {}
      workspaceLoaded = true
      saveQueued = true
      await flushSaveQueue()
      return
    }

    const [remoteAvatar, remoteThumbnails] = await Promise.all([
      downloadAsset(avatarPath),
      downloadThumbnails(thumbnailPaths),
    ])
    if (user.value?.id !== activeUser.id) return

    if (localRevision !== revisionAtStart) {
      lastAvatarSource = null
      lastThumbnailSources = {}
      workspaceLoaded = true
      saveQueued = true
      await flushSaveQueue()
      return
    }

    const remotePackage = options.normalizePackage({
      ...(isRecord(row.package_data) ? row.package_data : {}),
      avatar: remoteAvatar,
      thumbnails: remoteThumbnails,
    })

    suppressCloudSave = true
    options.packageData.value = remotePackage
    options.previewMode.value = row.preview_mode === 'mobile' ? 'mobile' : 'desktop'
    options.placementStep.value = Number.isInteger(row.placement_step) ? row.placement_step : 0
    lastAvatarSource = remoteAvatar
    lastThumbnailSources = { ...remoteThumbnails }
    writeSyncMetadata({ userId: activeUser.id, localChangedAt: remoteUpdatedAt || Date.now() })
    await nextTick()
    suppressCloudSave = false
    workspaceLoaded = true
  }

  function scheduleSave(delay = 800) {
    saveQueued = true
    if (saveTimer) window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      saveTimer = null
      void flushSaveQueue()
    }, delay)
  }

  async function flushSaveQueue() {
    if (!supabase || !user.value || !sessionId || !workspaceLoaded || saving) return

    saving = true
    try {
      while (saveQueued && user.value && sessionId) {
        saveQueued = false
        syncStatus.value = 'saving'
        await saveWorkspace(user.value.id, sessionId)
        syncStatus.value = 'saved'
        error.value = ''
      }
    } catch (saveError) {
      saveQueued = true
      error.value = messageFromError(saveError, 'Could not save changes. Your local copy is still available.')
      syncStatus.value = 'error'
    } finally {
      saving = false
      if (saveQueued && syncStatus.value !== 'error') void flushSaveQueue()
    }
  }

  async function saveWorkspace(userId: string, activeSessionId: string) {
    if (!supabase) return

    const snapshot = createPackageSnapshot(options.packageData.value)
    const assetPrefix = `${userId}/${activeSessionId}`

    if (snapshot.avatar !== lastAvatarSource) {
      avatarPath = await syncAsset(snapshot.avatar, avatarPath, `${assetPrefix}/avatar`)
    }

    const nextThumbnailPaths: Partial<Record<VariantKey, string>> = { ...thumbnailPaths }
    for (const variant of VARIANT_KEYS) {
      const source = snapshot.thumbnails[variant] ?? null
      const previousSource = lastThumbnailSources[variant] ?? null
      if (source === previousSource) continue

      const nextPath = await syncAsset(
        source,
        thumbnailPaths[variant] ?? null,
        `${assetPrefix}/thumbnail-${variant.toLowerCase()}`,
      )
      if (nextPath) nextThumbnailPaths[variant] = nextPath
      else delete nextThumbnailPaths[variant]
    }

    const { data, error: updateError } = await supabase
      .from('preview_sessions')
      .update({
        package_data: packageWithoutAssets(snapshot),
        preview_mode: options.previewMode.value,
        placement_step: options.placementStep.value,
        avatar_path: avatarPath,
        thumbnail_paths: nextThumbnailPaths,
      })
      .eq('id', activeSessionId)
      .eq('user_id', userId)
      .select('updated_at')
      .single()

    if (updateError) throw updateError

    thumbnailPaths = nextThumbnailPaths
    lastAvatarSource = snapshot.avatar
    lastThumbnailSources = { ...snapshot.thumbnails }
    writeSyncMetadata({
      userId,
      localChangedAt: Date.parse(data.updated_at) || Date.now(),
    })
  }

  async function syncAsset(source: string | null, currentPath: string | null, targetPath: string) {
    if (!supabase) return currentPath

    if (!source) {
      if (currentPath) {
        const { error: removeError } = await supabase.storage.from(ASSET_BUCKET).remove([currentPath])
        if (removeError) throw removeError
      }
      return null
    }

    const blob = await sourceToBlob(source)
    const { error: uploadError } = await supabase.storage.from(ASSET_BUCKET).upload(targetPath, blob, {
      upsert: true,
      contentType: blob.type || 'image/jpeg',
      cacheControl: '3600',
    })
    if (uploadError) throw uploadError

    if (currentPath && currentPath !== targetPath) {
      const { error: removeError } = await supabase.storage.from(ASSET_BUCKET).remove([currentPath])
      if (removeError) throw removeError
    }
    return targetPath
  }

  async function downloadAsset(path: string | null) {
    if (!supabase || !path) return null

    const { data, error: downloadError } = await supabase.storage.from(ASSET_BUCKET).download(path)
    if (downloadError) throw downloadError
    return blobToDataUrl(data)
  }

  async function downloadThumbnails(paths: Partial<Record<VariantKey, string>>) {
    const entries = await Promise.all(
      VARIANT_KEYS.map(async (variant) => {
        const path = paths[variant]
        return [variant, path ? await downloadAsset(path) : null] as const
      }),
    )

    return Object.fromEntries(entries.filter((entry): entry is [VariantKey, string] => Boolean(entry[1])))
  }

  function markLocalChange() {
    const metadata = readSyncMetadata()
    writeSyncMetadata({
      userId: user.value?.id ?? metadata.userId,
      localChangedAt: Date.now(),
    })
  }

  return {
    configured: isCloudConfigured,
    user,
    authReady,
    syncStatus,
    notice,
    error,
    requestMagicLink,
    signOut,
    retrySync,
  }
}

function packageWithoutAssets(packageData: VideoPackage) {
  const { avatar: _avatar, thumbnails: _thumbnails, ...metadata } = packageData
  return metadata
}

function createPackageSnapshot(packageData: VideoPackage): VideoPackage {
  return {
    ...packageData,
    thumbnails: { ...packageData.thumbnails },
  }
}

function parseThumbnailPaths(value: unknown): Partial<Record<VariantKey, string>> {
  if (!isRecord(value)) return {}

  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, path]) => VARIANT_KEYS.some((variant) => variant === key) && typeof path === 'string',
    ),
  ) as Partial<Record<VariantKey, string>>
}

function readSyncMetadata(): SyncMetadata {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SYNC_METADATA_KEY) ?? '') as Partial<SyncMetadata>
    return {
      userId: typeof parsed.userId === 'string' ? parsed.userId : null,
      localChangedAt: typeof parsed.localChangedAt === 'number' ? parsed.localChangedAt : 0,
    }
  } catch {
    return { userId: null, localChangedAt: 0 }
  }
}

function writeSyncMetadata(metadata: SyncMetadata) {
  try {
    window.localStorage.setItem(SYNC_METADATA_KEY, JSON.stringify(metadata))
  } catch {
    // Cloud sync can continue without conflict metadata.
  }
}

function sourceToBlob(source: string) {
  if (!source.startsWith('data:')) return fetch(source).then((response) => response.blob())

  const [header, encoded] = source.split(',', 2)
  const mimeType = header.match(/^data:([^;]+)/)?.[1] ?? 'application/octet-stream'
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
  return Promise.resolve(new Blob([bytes], { type: mimeType }))
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read a saved image.'))
    reader.readAsDataURL(blob)
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function messageFromError(value: unknown, fallback: string) {
  if (value instanceof Error && value.message) return value.message
  if (isRecord(value) && typeof value.message === 'string' && value.message) return value.message
  return fallback
}
