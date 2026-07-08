<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DesktopPreview from './components/DesktopPreview.vue'
import ExportButton from './components/ExportButton.vue'
import MobilePreview from './components/MobilePreview.vue'
import PackageForm from './components/PackageForm.vue'
import PreviewToggle from './components/PreviewToggle.vue'
import VariantSwitcher from './components/VariantSwitcher.vue'
import { useFeedVideos } from './composables/useFeedVideos'
import type { LayoutMode, VideoPackage } from './types'
import logoUrl from '../youtubepackager-logo.png'

const PACKAGE_STORAGE_KEY = 'youtube-packager:package'

const previewMode = ref<LayoutMode>('desktop')
const previewRef = ref<HTMLElement | null>(null)
const placementStep = ref(0)
const { videos: feedVideos, status: feedStatus } = useFeedVideos()

const defaultPackage: VideoPackage = {
  title: 'I rebuilt my entire editing workflow in one weekend',
  channelName: 'Channel Name',
  views: '18K views',
  publishTime: '3 days ago',
  duration: '12:18',
  avatar: null,
  activeVariant: 'A',
  thumbnails: {},
}

const videoPackage = ref<VideoPackage>(readStoredPackage())

const activeThumbnail = computed(
  () => videoPackage.value.thumbnails[videoPackage.value.activeVariant] ?? null,
)

const previewLabel = computed(() =>
  previewMode.value === 'desktop' ? 'Desktop feed' : 'Mobile feed',
)

function swapPreviewSpots() {
  placementStep.value += 1
}

watch(
  videoPackage,
  (value) => {
    persistPackage(value)
  },
  { deep: true },
)

function readStoredPackage(): VideoPackage {
  try {
    const stored = window.localStorage.getItem(PACKAGE_STORAGE_KEY)
    if (!stored) return { ...defaultPackage }

    const parsed = JSON.parse(stored) as Partial<VideoPackage>
    return {
      ...defaultPackage,
      ...parsed,
      activeVariant: isVariantKey(parsed.activeVariant) ? parsed.activeVariant : defaultPackage.activeVariant,
      avatar: typeof parsed.avatar === 'string' ? parsed.avatar : null,
      thumbnails: isThumbnailRecord(parsed.thumbnails) ? parsed.thumbnails : {},
    }
  } catch {
    return { ...defaultPackage }
  }
}

function persistPackage(value: VideoPackage) {
  try {
    window.localStorage.setItem(PACKAGE_STORAGE_KEY, JSON.stringify(value))
  } catch {
    const lightweightPackage: VideoPackage = {
      ...value,
      avatar: null,
      thumbnails: {},
    }

    try {
      window.localStorage.setItem(PACKAGE_STORAGE_KEY, JSON.stringify(lightweightPackage))
    } catch {
      // Ignore storage failures so the editor remains usable.
    }
  }
}

function isVariantKey(value: unknown): value is VideoPackage['activeVariant'] {
  return value === 'A' || value === 'B' || value === 'C'
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
        <div class="border-b border-line px-4 py-3">
          <div class="flex items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-3">
              <img :src="logoUrl" alt="" class="size-8 shrink-0 rounded-md object-cover" />
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold">YouTube Packager</p>
              </div>
            </div>
          </div>
        </div>
        <div class="p-4">
          <PackageForm v-model="videoPackage" />
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
              <button type="button" class="tool-button min-h-9 px-3 text-xs sm:text-sm" @click="swapPreviewSpots">
                Swap spots
              </button>
              <ExportButton :target="previewRef" :mode="previewMode" />
            </div>
          </div>

          <div class="border-b border-line bg-panel px-4 py-3">
            <VariantSwitcher v-model="videoPackage" />
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
