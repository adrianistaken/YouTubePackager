<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AuthPanel from './components/AuthPanel.vue'
import DesktopPreview from './components/DesktopPreview.vue'
import ExportButton from './components/ExportButton.vue'
import MobilePreview from './components/MobilePreview.vue'
import PackageForm from './components/PackageForm.vue'
import PreviewToggle from './components/PreviewToggle.vue'
import { useCloudWorkspace } from './composables/useCloudWorkspace'
import { useFeedVideos } from './composables/useFeedVideos'
import { VARIANT_KEYS, type LayoutMode, type VideoPackage, type WorkspaceState } from './types'
import { migrateWorkspaceCache, readWorkspaceCache, writeWorkspaceCache } from './lib/workspaceCache'
import logoUrl from '../youtubepackager-logo.png'

const defaultPackage: VideoPackage = {
  title: 'I rebuilt my entire editing workflow in one weekend',
  channelName: 'Channel Name',
  channelUrl: '',
  views: '18K views',
  publishTime: '3 days ago',
  duration: '12:18',
  avatar: null,
  activeVariant: 'A',
  thumbnails: {},
}

migrateWorkspaceCache()
const cachedGuest = readWorkspaceCache(null)
const storedWorkspace: WorkspaceState = {
  packageData: normalizePackage(cachedGuest?.packageData),
  previewMode: cachedGuest?.previewMode === 'mobile' ? 'mobile' : 'desktop',
  placementStep: Number.isInteger(cachedGuest?.placementStep) ? cachedGuest!.placementStep! : 0,
}
const previewMode = ref<LayoutMode>(storedWorkspace.previewMode)
const previewRef = ref<HTMLElement | null>(null)
const placementStep = ref(storedWorkspace.placementStep)
const videoPackage = ref<VideoPackage>(storedWorkspace.packageData)
const { videos: feedVideos, status: feedStatus } = useFeedVideos()
const cloud = useCloudWorkspace({
  packageData: videoPackage,
  previewMode,
  placementStep,
  normalizePackage,
})

const activeThumbnail = computed(
  () => videoPackage.value.thumbnails[videoPackage.value.activeVariant] ?? null,
)

const previewLabel = computed(() =>
  previewMode.value === 'desktop' ? 'Desktop feed' : 'Mobile feed',
)
const userEmail = computed(() => cloud.user.value?.email ?? null)

function movePreview(direction: -1 | 1) {
  placementStep.value += direction
}

watch(
  [videoPackage, previewMode, placementStep, cloud.cacheReady, cloud.cacheOwner],
  () => {
    if (!cloud.cacheReady.value) return
    writeWorkspaceCache(cloud.cacheOwner.value, {
      packageData: videoPackage.value,
      previewMode: previewMode.value,
      placementStep: placementStep.value,
    })
  },
  { deep: true },
)

function normalizePackage(value: unknown): VideoPackage {
  const parsed = value && typeof value === 'object' ? (value as Partial<VideoPackage>) : {}

  return {
    ...defaultPackage,
    ...parsed,
    activeVariant: isVariantKey(parsed.activeVariant) ? parsed.activeVariant : defaultPackage.activeVariant,
    avatar: typeof parsed.avatar === 'string' ? parsed.avatar : null,
    thumbnails: isThumbnailRecord(parsed.thumbnails) ? parsed.thumbnails : {},
  }
}

function isVariantKey(value: unknown): value is VideoPackage['activeVariant'] {
  return typeof value === 'string' && VARIANT_KEYS.some((variant) => variant === value)
}

function isThumbnailRecord(value: unknown): value is VideoPackage['thumbnails'] {
  if (!value || typeof value !== 'object') return false

  return Object.entries(value).every(
    ([key, thumbnail]) => isVariantKey(key) && typeof thumbnail === 'string',
  )
}
</script>

<template>
  <main class="min-h-screen bg-paper text-ink">
    <section class="grid min-h-screen lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside class="border-b border-line bg-panel lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div class="border-b border-line">
          <div class="px-4 py-3">
            <div class="flex items-center justify-between gap-3">
              <div class="flex min-w-0 items-center gap-3">
                <img :src="logoUrl" alt="" class="size-8 shrink-0 rounded-md object-cover" />
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold">YouTube Packager</p>
                </div>
              </div>
            </div>
          </div>
          <AuthPanel
            :configured="cloud.configured"
            :auth-ready="cloud.authReady.value"
            :user-email="userEmail"
            :sync-status="cloud.syncStatus.value"
            :notice="cloud.notice.value"
            :error="cloud.error.value"
            @login="cloud.requestMagicLink"
            @logout="cloud.signOut"
            @retry="cloud.retrySync"
          />
        </div>
        <div class="p-4">
          <PackageForm :key="cloud.cacheOwner.value ?? 'guest'" v-model="videoPackage" />
        </div>
      </aside>

      <section class="min-w-0 bg-paper">
        <div class="flex min-h-screen flex-col">
          <div class="flex flex-col gap-3 border-b border-line bg-panel px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="text-sm font-semibold">{{ previewLabel }}</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <PreviewToggle v-model="previewMode" />
              <div class="flex items-center gap-2" aria-label="Video position in feed">
                <span class="hidden text-xs font-medium text-graphite xl:inline">Video position</span>
                <div class="flex items-center">
                  <button
                    type="button"
                    class="tool-button min-h-9 rounded-r-none px-3 text-xs sm:text-sm"
                    aria-label="Move video earlier in the feed"
                    title="Move video earlier in the feed"
                    @click="movePreview(-1)"
                  >
                    <span aria-hidden="true">←</span>
                    Earlier
                  </button>
                  <button
                    type="button"
                    class="tool-button min-h-9 rounded-l-none border-l-0 px-3 text-xs sm:text-sm"
                    aria-label="Move video later in the feed"
                    title="Move video later in the feed"
                    @click="movePreview(1)"
                  >
                    Later
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
              <ExportButton :target="previewRef" :mode="previewMode" />
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-paper p-4">
            <div
              ref="previewRef"
              class="min-w-0 overflow-hidden bg-[#0f0f0f]"
              :class="previewMode === 'desktop' ? 'w-full' : 'mx-auto w-fit max-w-full'"
            >
              <DesktopPreview
                v-if="previewMode === 'desktop'"
                :package-data="videoPackage"
                :thumbnail="activeThumbnail"
                :feed-videos="feedVideos"
                :feed-status="feedStatus"
                :placement-step="placementStep"
              />
              <MobilePreview
                v-else
                :package-data="videoPackage"
                :thumbnail="activeThumbnail"
                :feed-videos="feedVideos"
                :feed-status="feedStatus"
                :placement-step="placementStep"
              />
            </div>
          </div>
        </div>
      </section>
    </section>
  </main>
</template>
