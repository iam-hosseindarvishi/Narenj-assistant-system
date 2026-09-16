<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="$emit('close')"
  >
    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
      <div class="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <h3 class="font-bold text-slate-800 dark:text-slate-100">{{ title }}</h3>
        <button class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" @click="$emit('close')">✕</button>
      </div>
      <form class="p-5 space-y-4" @submit.prevent="$emit('save')">
        <slot />
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn-secondary" @click="$emit('close')">انصراف</button>
          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? 'در حال ذخیره...' : 'ذخیره' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; saving?: boolean }>()
defineEmits<{ (e: 'close'): void; (e: 'save'): void }>()
</script>
