<script setup lang="ts">
import { computed } from 'vue'
import SidebarIcon from './SidebarIcon.vue'
import YouTubeFeedCard from './YouTubeFeedCard.vue'
import YouTubeLogo from './YouTubeLogo.vue'
import type { FeedVideo, VideoPackage } from '../types'

type SidebarIconName =
  | 'home'
  | 'shorts'
  | 'channel'
  | 'history'
  | 'playlists'
  | 'clock'
  | 'like'
  | 'video'
  | 'download'

type SidebarItem = {
  label: string
  icon: SidebarIconName
  active?: boolean
}

const props = defineProps<{
  packageData: VideoPackage
  thumbnail: string | null
  feedVideos: FeedVideo[]
  feedStatus: 'fallback' | 'loading' | 'live' | 'error'
  placementStep: number
}>()

const userVideo = computed<FeedVideo>(() => ({
  id: 'youtube-packager-preview',
  title: props.packageData.title || 'Untitled video',
  channelName: props.packageData.channelName || 'Channel name',
  views: props.packageData.views || '0 views',
  publishTime: props.packageData.publishTime || 'Just now',
  duration: props.packageData.duration || '0:00',
  thumbnail: props.thumbnail,
  avatar: props.packageData.avatar,
  accent: '#e83f35',
}))

const primarySidebarItems: SidebarItem[] = [
  { label: 'Home', icon: 'home', active: true },
  { label: 'Shorts', icon: 'shorts', active: false },
]

const youSidebarItems: SidebarItem[] = [
  { label: 'Your channel', icon: 'channel' },
  { label: 'History', icon: 'history' },
  { label: 'Playlists', icon: 'playlists' },
  { label: 'Watch later', icon: 'clock' },
  { label: 'Liked videos', icon: 'like' },
  { label: 'Your videos', icon: 'video' },
  { label: 'Downloads', icon: 'download' },
]

const feed = computed(() => {
  const contextVideos = rotateVideos(props.feedVideos.slice(0, 8), props.placementStep)
  const insertAt = contextVideos.length ? props.placementStep % (contextVideos.length + 1) : 0
  const videos = [...contextVideos]
  videos.splice(insertAt, 0, userVideo.value)
  return videos
})

function rotateVideos(videos: FeedVideo[], step: number) {
  if (!videos.length) return videos

  const offset = step % videos.length
  return [...videos.slice(offset), ...videos.slice(0, offset)]
}
</script>

<template>
  <section class="w-full min-w-0 bg-[#0f0f0f] text-white">
    <div class="flex h-14 items-center gap-5 border-b border-[#202020] px-4">
      <div class="flex w-[170px] shrink-0 items-center gap-5">
        <div class="space-y-1.5">
          <span class="block h-0.5 w-5 rounded bg-[#f1f1f1]" />
          <span class="block h-0.5 w-5 rounded bg-[#f1f1f1]" />
          <span class="block h-0.5 w-5 rounded bg-[#f1f1f1]" />
        </div>
        <YouTubeLogo class="text-xl" />
      </div>
      <div class="mx-auto flex h-10 min-w-[220px] max-w-[430px] flex-1 overflow-hidden rounded-full border border-[#303030] bg-[#121212]">
        <div class="flex-1 px-5 py-2.5 text-sm text-[#777]">Search</div>
        <div class="grid w-16 place-items-center border-l border-[#303030] bg-[#222] text-xl">⌕</div>
      </div>
      <div class="grid size-10 place-items-center rounded-full bg-[#181818] text-xl">+</div>
      <div class="size-8 rounded-full bg-[#2764d9]" />
    </div>

    <div class="flex">
      <aside class="w-[188px] shrink-0 px-3 py-3">
        <div class="space-y-1">
          <div
            v-for="item in primarySidebarItems"
            :key="item.label"
            class="flex min-h-10 items-center gap-4 rounded-lg px-3 text-sm"
            :class="item.active ? 'bg-[#272727] font-semibold text-white' : 'text-[#f1f1f1]'"
          >
            <SidebarIcon :name="item.icon" />
            <span class="truncate">{{ item.label }}</span>
          </div>
        </div>

        <div class="my-3 border-t border-[#303030]" />

        <div class="mb-2 flex min-h-9 items-center gap-2 px-3 text-sm font-semibold text-[#f1f1f1]">
          <span>You</span>
          <SidebarIcon name="chevron" class="size-4" />
        </div>

        <div class="space-y-1">
          <div
            v-for="item in youSidebarItems"
            :key="item.label"
            class="flex min-h-10 items-center gap-4 rounded-lg px-3 text-sm text-[#f1f1f1]"
          >
            <SidebarIcon :name="item.icon" />
            <span class="truncate">{{ item.label }}</span>
          </div>
        </div>
      </aside>

      <div class="min-w-0 flex-1 px-4 py-3">
        <div class="mb-6 flex gap-2 overflow-hidden">
          <span class="shrink-0 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black">All</span>
          <span class="shrink-0 rounded-lg bg-[#272727] px-3 py-2 text-sm font-semibold text-white">Gaming</span>
          <span class="shrink-0 rounded-lg bg-[#272727] px-3 py-2 text-sm font-semibold text-white">Music</span>
          <span class="shrink-0 rounded-lg bg-[#272727] px-3 py-2 text-sm font-semibold text-white">News</span>
          <span class="shrink-0 rounded-lg bg-[#272727] px-3 py-2 text-sm font-semibold text-white">Sports</span>
          <span class="shrink-0 rounded-lg bg-[#272727] px-3 py-2 text-sm font-semibold text-white">Podcasts</span>
          <span class="shrink-0 rounded-lg bg-[#272727] px-3 py-2 text-sm font-semibold text-white">Live</span>
        </div>

        <div class="grid grid-cols-3 gap-x-4 gap-y-10">
          <YouTubeFeedCard
            v-for="video in feed"
            :key="video.id"
            :video="video"
            :highlighted="video.id === 'youtube-packager-preview'"
          />
        </div>
      </div>
    </div>
  </section>
</template>
