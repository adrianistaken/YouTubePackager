<script setup lang="ts">
import type { VariantKey, VideoPackage } from '../types'

const model = defineModel<VideoPackage>({ required: true })

function setVariant(variant: VariantKey) {
  model.value = { ...model.value, activeVariant: variant }
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3" v-bind="$attrs">
    <p class="text-sm font-medium text-graphite">Compare thumbnail variants with the same metadata.</p>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="variant in ['A', 'B', 'C'] as VariantKey[]"
        :key="variant"
        type="button"
        class="focus-ring inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm font-bold transition"
        :class="model.activeVariant === variant ? 'border-ink bg-ink text-paper' : 'border-line bg-[#0f0f0f] text-ink hover:bg-[#1f1f1f]'"
        @click="setVariant(variant)"
      >
        {{ variant }}
        <span
          class="size-2 rounded-full"
          :class="model.thumbnails[variant] ? 'bg-signal' : 'bg-[#4a4a50]'"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>
