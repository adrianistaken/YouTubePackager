<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { toJpeg, toPng } from 'html-to-image'
import type { LayoutMode } from '../types'

type ExportQuality = 'high' | 'small'

const props = defineProps<{
  target: HTMLElement | null
  mode: LayoutMode
  compact?: boolean
}>()

const exporting = ref(false)
const menuOpen = ref(false)
const container = ref<HTMLElement | null>(null)

async function exportPreview(quality: ExportQuality) {
  if (!props.target || exporting.value) return

  menuOpen.value = false
  exporting.value = true
  try {
    const sharedOptions = {
      cacheBust: true,
      backgroundColor: '#ffffff',
    }
    const dataUrl = quality === 'high'
      ? await toPng(props.target, { ...sharedOptions, pixelRatio: 2 })
      : await toJpeg(props.target, { ...sharedOptions, pixelRatio: 1, quality: 0.82 })
    const link = document.createElement('a')
    link.download = quality === 'high'
      ? `youtube-packager-${props.mode}-preview.png`
      : `youtube-packager-${props.mode}-preview-smaller.jpg`
    link.href = dataUrl
    link.click()
  } finally {
    exporting.value = false
  }
}

function closeOnOutsideClick(event: MouseEvent) {
  if (!container.value?.contains(event.target as Node)) menuOpen.value = false
}

function closeOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') menuOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', closeOnOutsideClick)
  document.addEventListener('keydown', closeOnEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeOnOutsideClick)
  document.removeEventListener('keydown', closeOnEscape)
})
</script>

<template>
  <div ref="container" class="relative">
    <button
      type="button"
      class="primary-button"
      :class="compact ? 'min-h-9 px-3 text-xs' : ''"
      :disabled="!target || exporting"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      @click.stop="menuOpen = !menuOpen"
    >
      <span aria-hidden="true">↓</span>
      {{ exporting ? 'Exporting' : 'Export' }}
      <span class="text-[10px]" aria-hidden="true">▾</span>
    </button>

    <div
      v-if="menuOpen"
      class="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-md border border-line bg-[#1f1f1f] p-1 shadow-2xl"
      role="menu"
    >
      <button
        type="button"
        class="focus-ring block w-full rounded px-3 py-2 text-left transition hover:bg-[#303030]"
        role="menuitem"
        @click="exportPreview('high')"
      >
        <span class="block text-sm font-semibold text-ink">High quality</span>
        <span class="block text-xs text-graphite">2× resolution · PNG</span>
      </button>
      <button
        type="button"
        class="focus-ring block w-full rounded px-3 py-2 text-left transition hover:bg-[#303030]"
        role="menuitem"
        @click="exportPreview('small')"
      >
        <span class="block text-sm font-semibold text-ink">Smaller / Notion-friendly</span>
        <span class="block text-xs text-graphite">1× resolution · compressed JPG</span>
      </button>
    </div>
  </div>
</template>
