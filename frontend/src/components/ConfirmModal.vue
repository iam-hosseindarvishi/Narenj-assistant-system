<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="$emit('cancel')"
  >
    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm">
      <div class="px-5 pt-5 pb-2 text-center">
        <div class="mx-auto mb-3 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-2xl">🗑️</div>
        <h3 class="font-bold text-slate-800 dark:text-slate-100 mb-1">{{ title || 'تأیید حذف' }}</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400 leading-6">{{ message }}</p>
      </div>
      <div class="flex justify-center gap-2 px-5 pb-5 pt-2">
        <button class="btn-secondary" @click="$emit('cancel')">انصراف</button>
        <button class="btn-primary !bg-red-600 hover:!bg-red-700" :disabled="busy" @click="$emit('confirm')">
          {{ busy ? 'در حال حذف...' : 'حذف' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title?: string; message: string; busy?: boolean }>()
defineEmits<{ (e: 'confirm'): void; (e: 'cancel'): void }>()
</script>
