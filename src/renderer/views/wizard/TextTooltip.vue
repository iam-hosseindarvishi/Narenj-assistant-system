<template>
  <v-tooltip location="bottom" :disabled="!text || text.length <= (maxLen ?? 40)">
    <template #activator="{ props: tipProps }">
      <span v-bind="tipProps" class="text-truncate d-inline-block" :style="{ maxWidth: (maxWidth ?? 200) + 'px' }">{{ text || '—' }}</span>
    </template>
    <span style="white-space: pre-wrap; max-width: 500px; display: block;">{{ text }}</span>
  </v-tooltip>
</template>

<script setup lang="ts">
defineProps<{
  text: string | null | undefined
  maxLen?: number
  maxWidth?: number
}>()
</script>
