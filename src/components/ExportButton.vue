<script setup lang="ts">
import { ref } from 'vue'
import { toPng } from 'html-to-image'
import type { LayoutMode } from '../types'

const props = defineProps<{
  target: HTMLElement | null
  mode: LayoutMode
  compact?: boolean
}>()

const exporting = ref(false)

async function exportPreview() {
  if (!props.target || exporting.value) return

  exporting.value = true
  try {
    const dataUrl = await toPng(props.target, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#ffffff',
    })
    const link = document.createElement('a')
    link.download = `youtube-packager-${props.mode}-preview.png`
    link.href = dataUrl
    link.click()
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <button
    type="button"
    class="primary-button"
    :class="compact ? 'min-h-9 px-3 text-xs' : ''"
    :disabled="!target || exporting"
    @click="exportPreview"
  >
    <span aria-hidden="true">↓</span>
    {{ exporting ? 'Exporting' : 'Export PNG' }}
  </button>
</template>
