<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="text-sm text-slate-500">
        خلاصه حساب‌های POS و واریزی شاپرک بانک (تسویه D+1)
      </div>
      <button class="btn-primary" :disabled="running" @click="run">
        {{ running ? 'در حال اجرا...' : 'اجرای لایه ۱' }}
      </button>
    </div>

    <div class="card overflow-x-auto">
      <table class="table-base">
        <thead>
          <tr>
            <th>شناسه</th>
            <th>تاریخ</th>
            <th>شعبه</th>
            <th>ترمینال</th>
            <th>تعداد تراکنش</th>
            <th>مبلغ POS</th>
            <th>واریز بانک</th>
            <th>اختلاف</th>
            <th>وضعیت</th>
            <th>روز انتظار</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.id }}</td>
            <td class="font-mono">{{ row.dateJalali }}</td>
            <td>{{ row.branchName || row.branchId }}</td>
            <td class="font-mono">{{ row.terminalId }}</td>
            <td>{{ row.txCount }}</td>
            <td>{{ money(row.posAmount) }}</td>
            <td>{{ row.bankAmount == null ? '—' : money(row.bankAmount) }}</td>
            <td :class="diffClass(row.diff)">{{ row.diff == null ? '—' : money(row.diff) }}</td>
            <td><span :class="badge(row.status)">{{ statusLabel(row.status) }}</span></td>
            <td>{{ row.daysWaiting ?? '—' }}</td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="10" class="text-center text-slate-400 py-6">داده‌ای وجود ندارد</td>
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
const running = ref(false)

async function load() {
  rows.value = (await api.get('/reconciliation/layer1')).data
}

async function run() {
  running.value = true
  try {
    await api.post('/reconciliation/run/layer1')
    await load()
  } finally {
    running.value = false
  }
}

function money(v: number) {
  return new Intl.NumberFormat('fa-IR').format(v)
}

function statusLabel(s: string) {
  return ({ unmatched: 'تطبیق‌نشده', pending: 'در انتظار', matched: 'تطبیق‌شده', manual: 'دستی' } as any)[s] || s
}

function badge(s: string) {
  return ({
    unmatched: 'badge bg-red-100 text-red-700',
    pending: 'badge bg-amber-100 text-amber-700',
    matched: 'badge bg-emerald-100 text-emerald-700',
    manual: 'badge bg-sky-100 text-sky-700'
  } as any)[s] || 'badge bg-slate-100 text-slate-700'
}

function diffClass(d: number | null) {
  if (d == null) return ''
  return d === 0 ? 'text-emerald-600' : 'text-red-600 font-semibold'
}

onMounted(load)
</script>
