<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <div>
        <label class="block text-xs text-slate-500 mb-1">از تاریخ</label>
        <input v-model="dateFrom" class="input font-mono" dir="ltr" placeholder="1405-01-01" />
      </div>
      <div>
        <label class="block text-xs text-slate-500 mb-1">تا تاریخ</label>
        <input v-model="dateTo" class="input font-mono" dir="ltr" placeholder="1405-12-29" />
      </div>
      <button class="btn-primary mt-5" :disabled="loading" @click="load">
        {{ loading ? '...' : 'نمایش گزارش' }}
      </button>
      <a class="btn-secondary mt-5" href="/api/reports/export" download>دانلود اکسل</a>
    </div>

    <div v-for="sec in sections" :key="sec.title" class="card">
      <h2 class="font-semibold text-slate-800 mb-3">{{ sec.title }}</h2>
      <div class="overflow-x-auto">
        <table class="table-base">
          <thead>
            <tr>
              <th v-for="h in sec.headers" :key="h">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in sec.rows" :key="i">
              <td v-for="h in sec.headers" :key="h">{{ row[h] ?? '—' }}</td>
            </tr>
            <tr v-if="!sec.rows.length">
              <td :colspan="sec.headers.length" class="text-center text-slate-400 py-4">موردی یافت نشد</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../../api/client'

const dateFrom = ref('')
const dateTo = ref('')
const loading = ref(false)
const report = ref<any>({})

const sections = ref<{ title: string; headers: string[]; rows: any[] }[]>([])

async function load() {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (dateFrom.value) params.date_from = dateFrom.value
    if (dateTo.value) params.date_to = dateTo.value
    report.value = (await api.get('/reports', { params })).data
    sections.value = buildSections(report.value)
  } finally {
    loading.value = false
  }
}

function buildSections(r: any) {
  const out: { title: string; headers: string[]; rows: any[] }[] = []
  if (r.summary) {
    out.push({ title: 'خلاصه', headers: Object.keys(r.summary), rows: [r.summary] })
  }
  for (const key of ['layer1', 'layer2', 'layer3', 'layer4']) {
    const data = r[key]
    if (!data) continue
    if (Array.isArray(data) && data.length) {
      out.push({ title: titleFor(key), headers: Object.keys(data[0]), rows: data })
    } else if (data && typeof data === 'object' && !Array.isArray(data)) {
      out.push({ title: titleFor(key), headers: Object.keys(data), rows: [data] })
    }
  }
  for (const key of ['unmatchedBank', 'unmatchedAccounting', 'unmatchedPos']) {
    const data = r[key]
    if (Array.isArray(data) && data.length) {
      out.push({ title: titleFor(key), headers: Object.keys(data[0]), rows: data })
    }
  }
  return out
}

function titleFor(key: string) {
  return ({
    layer1: 'لایه ۱: POS ↔ بانک',
    layer2: 'لایه ۲: کارمزدها',
    layer3: 'لایه ۳: بانک ↔ حسابداری',
    layer4: 'لایه ۴: ریز تراکنش POS',
    unmatchedBank: 'تراکنش‌های بانکی تطبیق‌نشده',
    unmatchedAccounting: 'آرتیکل‌های حسابداری تطبیق‌نشده',
    unmatchedPos: 'تراکنش‌های POS تطبیق‌نشده'
  } as any)[key] || key
}

onMounted(load)
</script>
