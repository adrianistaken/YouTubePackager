<script setup lang="ts">
defineProps<{
  name:
    | 'home'
    | 'shorts'
    | 'channel'
    | 'history'
    | 'playlists'
    | 'clock'
    | 'like'
    | 'video'
    | 'download'
    | 'chevron'
}>()
</script>

<template>
  <svg
    class="size-6 shrink-0"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.9"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-if="name === 'home'" d="M3 10.8 12 3l9 7.8" />
    <path v-if="name === 'home'" d="M5.5 9.5V21h5v-6h3v6h5V9.5" />

    <path v-if="name === 'shorts'" d="M10.5 3.8 17 7.4a2.3 2.3 0 0 1 0 4l-6.6 3.8a2.3 2.3 0 0 1-3.4-2v-.5" />
    <path v-if="name === 'shorts'" d="m13.5 20.2-6.5-3.6a2.3 2.3 0 0 1 0-4l6.6-3.8a2.3 2.3 0 0 1 3.4 2v.5" />
    <path v-if="name === 'shorts'" d="m10.5 9.5 4 2.5-4 2.5z" />

    <rect v-if="name === 'channel'" x="4" y="3.5" width="16" height="17" rx="2" />
    <circle v-if="name === 'channel'" cx="12" cy="10" r="2.6" />
    <path v-if="name === 'channel'" d="M7.7 17c.8-2 2.2-3 4.3-3s3.5 1 4.3 3" />

    <path v-if="name === 'history'" d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path v-if="name === 'history'" d="M4 4.5v4h4" />
    <path v-if="name === 'history'" d="M12 8v4.4l3 1.8" />

    <path v-if="name === 'playlists'" d="M4 7h11" />
    <path v-if="name === 'playlists'" d="M4 12h11" />
    <path v-if="name === 'playlists'" d="M4 17h8" />
    <path v-if="name === 'playlists'" d="m17 14 4 3-4 3z" />

    <circle v-if="name === 'clock'" cx="12" cy="12" r="8.5" />
    <path v-if="name === 'clock'" d="M12 7.5V12l3.2 2" />

    <path v-if="name === 'like'" d="M7.5 21H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h2.5" />
    <path v-if="name === 'like'" d="M7.5 10 11 3.8a2 2 0 0 1 3.7 1.3L14 9h4.5a2.4 2.4 0 0 1 2.3 3l-1.7 6.4A3.5 3.5 0 0 1 15.7 21H7.5z" />

    <rect v-if="name === 'video'" x="3.5" y="6" width="17" height="12" rx="1.8" />
    <path v-if="name === 'video'" d="m10 9.5 5 2.5-5 2.5z" />

    <path v-if="name === 'download'" d="M12 4v10" />
    <path v-if="name === 'download'" d="m7.5 10 4.5 4.5L16.5 10" />
    <path v-if="name === 'download'" d="M5 20h14" />

    <path v-if="name === 'chevron'" d="m9 6 6 6-6 6" />
  </svg>
</template>
