<template>
  <div ref="root" class="relative flex-1">
    <button
      type="button"
      class="input w-full text-right flex items-center justify-between"
      :class="{ 'opacity-60': disabled }"
      :disabled="disabled"
      @click="toggle"
    >
      <span :class="selected ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'">
        {{ selected ? selected.name : 'انتخاب مسیر...' }}
      </span>
      <span class="text-slate-400 text-xs">▼</span>
    </button>

    <div
      v-if="open"
      class="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden"
    >
      <div class="p-2 border-b border-slate-200 dark:border-slate-700">
        <input
          ref="searchInput"
          v-model="query"
          class="input !py-1.5 text-sm"
          placeholder="جستجوی مسیر..."
          @click.stop
        />
      </div>
      <div class="max-h-56 overflow-y-auto">
        <button
          v-for="r in filtered"
          :key="r.id"
          type="button"
          class="w-full text-right px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          :class="r.id === modelValue ? 'text-narenj-600 dark:text-narenj-400 font-semibold' : 'text-slate-700 dark:text-slate-200'"
          @click="pick(r.id)"
        >
          {{ r.name }} <span class="text-xs text-slate-400 font-mono">({{ r.code }})</span>
          <span v-if="r.id === modelValue" class="float-left">✓</span>
          <span
            v-if="r.active === false"
            class="text-xs text-slate-400 mr-1"
          >(غیرفعال)</span>
        </button>
        <div v-if="!filtered.length" class="px-3 py-4 text-center text-sm text-slate-400">مسیری یافت نشد</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  routes: { id: number; name: string; code: string; active?: boolean }[]
  modelValue: number | null
  disabled?: boolean
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: number | null): void }>()

const open = ref(false)
const query = ref('')
const root = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

const selected = computed(() => props.routes.find((r) => r.id === props.modelValue) || null)
const filtered = computed(() => {
  const q = query.value.trim()
  if (!q) return props.routes
  return props.routes.filter(
    (r) => r.name.includes(q) || r.code.includes(q) || String(r.id).includes(q)
  )
})

function toggle() {
  open.value = !open.value
  if (open.value) {
    query.value = ''
    nextTick(() => searchInput.value?.focus())
  }
}

function pick(id: number) {
  emit('update:modelValue', id)
  open.value = false
}

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}

function onKey(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === 'Escape') open.value = false
  if (e.key === 'Tab') open.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>
