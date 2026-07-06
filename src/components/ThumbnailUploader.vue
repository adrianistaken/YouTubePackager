<script setup lang="ts">
import { ref } from 'vue'
import type { VariantKey, VideoPackage } from '../types'

const model = defineModel<VideoPackage>({ required: true })
const warning = ref('')

const acceptedTypes = ['image/png', 'image/jpeg', 'image/webp']

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Unable to read file'))
    reader.readAsDataURL(file)
  })
}

function getImageSize(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('Unable to inspect image'))
    image.src = src
  })
}

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!acceptedTypes.includes(file.type)) {
    warning.value = 'Use PNG, JPG, JPEG, or WEBP.'
    input.value = ''
    return
  }

  const src = await readFileAsDataUrl(file)
  const size = await getImageSize(src)
  const ratio = size.width / size.height

  warning.value =
    Math.abs(ratio - 16 / 9) > 0.04
      ? `Uploaded ${size.width}x${size.height}. 1280x720 or another 16:9 size will look closest to YouTube.`
      : ''

  model.value = {
    ...model.value,
    thumbnails: {
      ...model.value.thumbnails,
      [model.value.activeVariant]: src,
    },
  }
}

function setVariant(variant: VariantKey) {
  model.value = { ...model.value, activeVariant: variant }
}

function removeActiveThumbnail() {
  const thumbnails = { ...model.value.thumbnails }
  delete thumbnails[model.value.activeVariant]
  model.value = { ...model.value, thumbnails }
}
</script>

<template>
  <section class="space-y-3">
    <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <p class="field-label">Thumbnail</p>
        <p class="text-sm text-graphite">Recommended 1280x720.</p>
      </div>
      <div class="flex shrink-0 flex-wrap gap-1">
        <button
          v-for="variant in ['A', 'B', 'C'] as VariantKey[]"
          :key="variant"
          type="button"
          class="focus-ring grid size-9 place-items-center rounded-md border text-sm font-bold transition"
          :class="model.activeVariant === variant ? 'border-ink bg-ink text-paper' : 'border-line bg-[#0f0f0f] text-ink hover:bg-[#1f1f1f]'"
          :aria-label="`Use thumbnail variant ${variant}`"
          @click="setVariant(variant)"
        >
          {{ variant }}
        </button>
      </div>
    </div>

    <label class="focus-ring flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[#3a3a3a] bg-[#0f0f0f] px-4 py-5 text-center transition hover:border-[#5a5a5a]">
      <input class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" @change="handleUpload" />
      <span class="text-sm font-semibold">Upload variant {{ model.activeVariant }}</span>
      <span class="mt-1 text-xs text-graphite">PNG, JPG, JPEG, WEBP</span>
    </label>

    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-xs text-graphite">
        {{ model.thumbnails[model.activeVariant] ? 'Thumbnail loaded.' : 'No thumbnail for this variant yet.' }}
      </p>
      <button
        type="button"
        class="tool-button min-h-9 px-2 text-xs"
        :disabled="!model.thumbnails[model.activeVariant]"
        @click="removeActiveThumbnail"
      >
        Remove
      </button>
    </div>

    <p v-if="warning" class="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
      {{ warning }}
    </p>
  </section>
</template>
