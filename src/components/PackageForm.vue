<script setup lang="ts">
import AvatarUploader from './AvatarUploader.vue'
import ThumbnailUploader from './ThumbnailUploader.vue'
import type { VideoPackage } from '../types'

const model = defineModel<VideoPackage>({ required: true })

function updateField<K extends keyof VideoPackage>(field: K, value: VideoPackage[K]) {
  model.value = { ...model.value, [field]: value }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent>
    <ThumbnailUploader v-model="model" />
    <AvatarUploader
      :avatar="model.avatar"
      @update:avatar="updateField('avatar', $event)"
    />

    <label class="block space-y-2">
      <span class="field-label">Title</span>
      <input
        class="field-input"
        :value="model.title"
        maxlength="120"
        placeholder="Your video title"
        @input="updateField('title', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <label class="block space-y-2">
      <span class="field-label">Channel name</span>
      <input
        class="field-input"
        :value="model.channelName"
        placeholder="Channel name"
        @input="updateField('channelName', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      <label class="block space-y-2">
        <span class="field-label">Views</span>
        <input
          class="field-input"
          :value="model.views"
          placeholder="18K views"
          @input="updateField('views', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="block space-y-2">
        <span class="field-label">Publish time</span>
        <input
          class="field-input"
          :value="model.publishTime"
          placeholder="3 days ago"
          @input="updateField('publishTime', ($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>

    <label class="block space-y-2">
      <span class="field-label">Duration</span>
      <input
        class="field-input"
        :value="model.duration"
        placeholder="12:18"
        @input="updateField('duration', ($event.target as HTMLInputElement).value)"
      />
    </label>
  </form>
</template>
