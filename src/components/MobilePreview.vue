<script setup lang="ts">
import { computed } from 'vue'
import YouTubeFeedCard from './YouTubeFeedCard.vue'
import YouTubeLogo from './YouTubeLogo.vue'
import type { FeedVideo, VideoPackage } from '../types'

const props = defineProps<{
  packageData: VideoPackage
  thumbnail: string | null
  feedVideos: FeedVideo[]
  feedStatus: 'fallback' | 'loading' | 'live' | 'error'
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

const feed = computed(() => [
  userVideo.value,
  ...props.feedVideos.slice(0, 5),
].filter(Boolean))
</script>

<template>
  <section class="w-[390px] max-w-[calc(100vw-56px)] bg-[#0f0f0f] text-white">
    <div class="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-[#202020] bg-[#0f0f0f] px-3">
      <YouTubeLogo class="text-lg" />
      <div class="flex items-center gap-3">
        <span class="size-5 rounded-full bg-[#272727]" />
        <span class="size-7 rounded-full bg-[#272727]" />
      </div>
    </div>

    <div class="flex gap-2 overflow-hidden border-b border-[#202020] px-3 py-2">
      <span class="rounded-lg bg-white px-3 py-1 text-sm font-medium text-black">All</span>
      <span class="rounded-lg bg-[#272727] px-3 py-1 text-sm font-medium text-white">Today</span>
      <span class="rounded-lg bg-[#272727] px-3 py-1 text-sm font-medium text-white">Editing</span>
      <span class="rounded-lg bg-[#272727] px-3 py-1 text-sm font-medium text-white">Gaming</span>
    </div>

    <div class="space-y-3 pb-4">
      <YouTubeFeedCard
        v-for="video in feed"
        :key="video.id"
        :video="video"
        compact
        :highlighted="video.id === 'youtube-packager-preview'"
      />
    </div>
  </section>
</template>
