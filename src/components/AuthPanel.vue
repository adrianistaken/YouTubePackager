<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  configured: boolean
  authReady: boolean
  userEmail: string | null
  syncStatus: 'local' | 'loading' | 'saving' | 'saved' | 'error'
  notice: string
  error: string
}>()

const emit = defineEmits<{
  login: [email: string]
  logout: []
  retry: []
}>()

const email = ref('')
const loginOpen = ref(false)
const submitting = ref(false)

async function submitLogin() {
  if (!email.value.trim() || submitting.value) return
  submitting.value = true
  emit('login', email.value.trim())
  window.setTimeout(() => {
    submitting.value = false
  }, 600)
}

function statusLabel() {
  if (props.syncStatus === 'loading') return 'Loading workspace…'
  if (props.syncStatus === 'saving') return 'Saving…'
  if (props.syncStatus === 'saved') return 'Saved to account'
  if (props.syncStatus === 'error') return 'Sync needs attention'
  return 'Saved on this device'
}
</script>

<template>
  <section class="border-t border-line px-4 py-3">
    <div v-if="userEmail" class="flex items-center gap-3">
      <div class="grid size-8 shrink-0 place-items-center rounded-full bg-[#303030] text-xs font-bold">
        {{ userEmail.slice(0, 1).toUpperCase() }}
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs font-semibold">{{ userEmail }}</p>
        <button
          v-if="syncStatus === 'error'"
          type="button"
          class="text-left text-[11px] text-amber-300 underline underline-offset-2"
          @click="emit('retry')"
        >
          Retry sync
        </button>
        <p v-else class="text-[11px] text-graphite">{{ statusLabel() }}</p>
      </div>
      <button type="button" class="tool-button min-h-8 px-2 text-xs" @click="emit('logout')">
        Log out
      </button>
    </div>

    <template v-else-if="configured">
      <button
        v-if="!loginOpen"
        type="button"
        class="tool-button min-h-8 w-full px-3 text-xs"
        :disabled="!authReady"
        @click="loginOpen = true"
      >
        {{ authReady ? 'Log in to sync' : 'Checking login…' }}
      </button>

      <form v-else class="space-y-2" @submit.prevent="submitLogin">
        <label class="block">
          <span class="sr-only">Email address</span>
          <input
            v-model="email"
            class="field-input min-h-9 py-2 text-xs"
            type="email"
            autocomplete="email"
            placeholder="Email address"
            required
          />
        </label>
        <div class="grid grid-cols-[1fr_auto] gap-2">
          <button type="submit" class="primary-button min-h-9 px-3 text-xs" :disabled="submitting">
            {{ submitting ? 'Sending…' : 'Email sign-in link' }}
          </button>
          <button type="button" class="tool-button min-h-9 px-3 text-xs" @click="loginOpen = false">
            Cancel
          </button>
        </div>
      </form>
    </template>

    <p v-else class="text-[11px] text-graphite">Cloud login is not configured.</p>
    <p v-if="notice && !userEmail" class="mt-2 text-xs text-emerald-300">{{ notice }}</p>
    <p v-if="error" class="mt-2 text-xs text-amber-300">{{ error }}</p>
  </section>
</template>
