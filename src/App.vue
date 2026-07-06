<script setup lang="ts">
import { computed, ref } from 'vue'
import DesktopPreview from './components/DesktopPreview.vue'
import ExportButton from './components/ExportButton.vue'
import MobilePreview from './components/MobilePreview.vue'
import PackageForm from './components/PackageForm.vue'
import PreviewToggle from './components/PreviewToggle.vue'
import VariantSwitcher from './components/VariantSwitcher.vue'
import { useFeedVideos } from './composables/useFeedVideos'
import type { LayoutMode, VideoPackage } from './types'
import logoUrl from '../youtubepackager-logo.png'

const previewMode = ref<LayoutMode>('desktop')
const previewRef = ref<HTMLElement | null>(null)
const { videos: feedVideos, status: feedStatus } = useFeedVideos()

const videoPackage = ref<VideoPackage>({
  title: 'I rebuilt my entire editing workflow in one weekend',
  channelName: 'Adrian Makes',
  views: '18K views',
  publishTime: '3 days ago',
  duration: '12:18',
  avatar: null,
  activeVariant: 'A',
  thumbnails: {},
})

const activeThumbnail = computed(
  () => videoPackage.value.thumbnails[videoPackage.value.activeVariant] ?? null,
)

const previewLabel = computed(() =>
  previewMode.value === 'desktop' ? 'Desktop feed' : 'Mobile feed',
)
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
                <p class="text-xs text-graphite">Edit the test package.</p>
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
              <p class="text-xs text-graphite">
                {{ feedStatus === 'live' ? 'Using popular YouTube videos.' : 'Using local context placeholders.' }}
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <PreviewToggle v-model="previewMode" />
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
              />
              <MobilePreview
                v-else
                :package-data="videoPackage"
                :thumbnail="activeThumbnail"
                :feed-videos="feedVideos"
                :feed-status="feedStatus"
              />
            </div>
          </div>
        </div>
      </section>
    </section>
  </main>
</template>
