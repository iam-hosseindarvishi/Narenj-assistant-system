<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="text-sm text-slate-500">آخرین رویدادهای ثبت‌شده در سامانه</div>
      <button class="btn-secondary" :disabled="loading" @click="load">
        {{ loading ? '...' : 'بازخوانی' }}
      </button>
    </div>

    <div class="card overflow-x-auto">
      <table class="table-base">
        <thead>
          <tr>
            <th>زمان</th>
            <th>کاربر</th>
            <th>عملیات</th>
            <th>موجودیت</th>
            <th>شناسه</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(a, i) in rows" :key="i">
            <td class="text-xs text-slate-500" dir="ltr">{{ a.timestamp }}</td>
            <td>{{ a.username ?? '—' }}</td>
            <td class="font-mono text-xs" dir="ltr">{{ a.action }}</td>
            <td class="font-mono text-xs" dir="ltr">{{ a.entityType }}</td>
            <td>{{ a.entityId ?? '—' }}</td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="5" class="text-center text-slate-400 py-6">رویدادی ثبت نشده است</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../../api/client'

const rows = ref<any[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    rows.value = (await api.get('/audit?limit=200')).data
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
