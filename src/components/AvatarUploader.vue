<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  avatar: string | null
}>()

const emit = defineEmits<{
  'update:avatar': [value: string | null]
}>()

const channelUrl = ref('')
const error = ref('')
const isResolving = ref(false)

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Unable to read file'))
    reader.readAsDataURL(file)
  })
}

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  emit('update:avatar', await readFileAsDataUrl(file))
  input.value = ''
}

async function resolveAvatar() {
  const url = channelUrl.value.trim()
  if (!url || isResolving.value) return

  error.value = ''
  isResolving.value = true

  try {
    const response = await fetch(`/api/youtube-avatar?url=${encodeURIComponent(url)}`)
    const body = (await response.json()) as { avatarDataUrl?: string; error?: string }

    if (!response.ok || !body.avatarDataUrl) {
      throw new Error(body.error ?? 'Could not find an avatar for that channel.')
    }

    emit('update:avatar', body.avatarDataUrl)
  } catch (resolveError) {
    error.value =
      resolveError instanceof Error
        ? resolveError.message
        : 'Could not find an avatar for that channel.'
  } finally {
    isResolving.value = false
  }
}
</script>

<template>
  <section class="space-y-2 rounded-md border border-line bg-[#121212] p-3">
    <div class="flex items-center gap-3">
      <div class="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[#303030] text-sm font-bold text-ink">
        <img v-if="avatar" :src="avatar" alt="" class="h-full w-full object-cover" />
        <span v-else>CH</span>
      </div>
      <div class="min-w-0 flex-1">
        <p class="field-label">Channel avatar</p>
        <p class="truncate text-xs text-graphite">{{ avatar ? 'Avatar loaded.' : 'Upload or use a channel URL.' }}</p>
      </div>
      <div class="flex shrink-0 gap-1">
        <label class="tool-button min-h-8 cursor-pointer px-2 text-xs">
          Upload
          <input class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" @change="handleUpload" />
        </label>
        <button
          type="button"
          class="tool-button min-h-8 px-2 text-xs"
          :disabled="!avatar"
          @click="emit('update:avatar', null)"
        >
          Remove
        </button>
      </div>
    </div>

    <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
      <input
        v-model="channelUrl"
        class="field-input min-h-9 py-2 text-xs"
        type="url"
        placeholder="Paste YouTube channel URL"
        @keydown.enter.prevent="resolveAvatar"
      />
      <button
        type="button"
        class="tool-button min-h-9 px-3 text-xs"
        :disabled="!channelUrl.trim() || isResolving"
        @click="resolveAvatar"
      >
        {{ isResolving ? 'Finding' : 'Use' }}
      </button>
    </div>

    <p v-if="error" class="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
      {{ error }}
    </p>
  </section>
</template>
