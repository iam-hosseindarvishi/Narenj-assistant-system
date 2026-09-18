<template>
  <button
    class="btn-secondary !py-1 text-xs"
    :title="theme.isDark ? 'حالت روشن' : 'حالت تیره'"
    aria-label="تغییر تم"
    @click="theme.toggle()"
  >
    {{ theme.isDark ? '☀️' : '🌙' }}
  </button>
</template>

<script setup lang="ts">
import { useThemeStore } from '../stores/theme'

const theme = useThemeStore()
</script>
