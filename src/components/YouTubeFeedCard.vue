<script setup lang="ts">
import type { FeedVideo } from '../types'

defineProps<{
  video: FeedVideo
  compact?: boolean
  highlighted?: boolean
}>()

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'CH'
  )
}
</script>

<template>
  <article class="group min-w-0">
    <div
      class="relative aspect-video w-full overflow-hidden bg-[#202020]"
      :class="compact ? 'rounded-none' : 'rounded-xl'"
    >
      <img v-if="video.thumbnail" :src="video.thumbnail" alt="" class="h-full w-full object-cover" />
      <div
        v-else
        class="h-full w-full"
      >
        <div class="h-full w-full bg-[radial-gradient(circle_at_24%_18%,rgba(255,255,255,0.14),transparent_18%),linear-gradient(135deg,#2a2a2a_0%,#171717_46%,#0b0b0b_100%)]" />
      </div>
      <div class="absolute bottom-1.5 right-1.5 rounded bg-black/90 px-1 py-0.5 text-xs font-semibold text-white">
        {{ video.duration || '0:00' }}
      </div>
    </div>

    <div class="flex gap-3" :class="compact ? 'px-3 py-3' : 'mt-3'">
      <div
        class="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-bold text-white"
        :style="{ backgroundColor: video.accent }"
      >
        <img v-if="video.avatar" :src="video.avatar" alt="" class="h-full w-full object-cover" />
        <span v-else>{{ initials(video.channelName) }}</span>
      </div>
      <div class="min-w-0 flex-1">
        <h2 class="line-clamp-2 text-[15px] font-semibold leading-5 text-[#f1f1f1]">
          {{ video.title || 'Untitled video' }}
        </h2>
        <p class="mt-1 truncate text-sm text-[#aaa]">{{ video.channelName || 'Channel name' }}</p>
        <p class="truncate text-sm text-[#aaa]">
          {{ video.views || '0 views' }} · {{ video.publishTime || 'Just now' }}
        </p>
      </div>
      <button class="grid size-8 shrink-0 place-items-center rounded-full text-lg leading-none text-[#aaa]" aria-label="More options">
        ⋮
      </button>
    </div>
  </article>
</template>
