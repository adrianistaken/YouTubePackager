<script setup lang="ts">
import type { LayoutMode } from '../types'

const model = defineModel<LayoutMode>({ required: true })
</script>

<template>
  <div class="inline-grid grid-cols-2 rounded-md border border-line bg-wash p-1">
    <button
      v-for="mode in ['desktop', 'mobile'] as LayoutMode[]"
      :key="mode"
      type="button"
      class="focus-ring min-h-9 rounded px-3 text-sm font-semibold capitalize transition"
      :class="model === mode ? 'bg-ink text-paper' : 'text-graphite hover:text-ink'"
      @click="model = mode"
    >
      {{ mode }}
    </button>
  </div>
</template>
