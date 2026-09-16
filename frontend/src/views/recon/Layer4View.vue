<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="text-sm text-slate-500 dark:text-slate-400">
        تطبیق ریز تراکنش‌های POS با حسابداری (سرجمع شعبه/روز و رکوردهای انفرادی)
      </div>
      <button class="btn-primary" :disabled="running" @click="run">
        {{ running ? 'در حال اجرا...' : 'اجرای لایه ۴' }}
      </button>
    </div>

    <div class="card overflow-x-auto">
      <table class="table-base">
        <thead>
          <tr>
            <th>شناسه</th>
            <th>شماره ارجاع</th>
            <th>کارت (ماسک‌شده)</th>
            <th>شعبه</th>
            <th>تاریخ</th>
            <th>مبلغ</th>
            <th>وضعیت</th>
            <th>شناسه حسابداری</th>
            <th>سرجمع</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.posTxId">
            <td>{{ row.posTxId }}</td>
            <td class="font-mono" dir="ltr">{{ row.refNumber }}</td>
            <td class="font-mono" dir="ltr">{{ row.cardNumberMasked }}</td>
            <td>{{ row.branchName }}</td>
            <td class="font-mono">{{ row.dateJalali }}</td>
            <td>{{ money(row.amount) }}</td>
            <td><span :class="badge(row.status)">{{ statusLabel(row.status) }}</span></td>
            <td>{{ row.entryId ?? '—' }}</td>
            <td>
              <span v-if="row.aggregated" class="badge bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">سرجمع</span>
              <span v-else class="text-slate-400">—</span>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="9" class="text-center text-slate-400 py-6">داده‌ای وجود ندارد</td>
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
  rows.value = (await api.get('/reconciliation/layer4')).data
}

async function run() {
  running.value = true
  try {
    await api.post('/reconciliation/run/layer4')
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
    unmatched: 'badge bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    pending: 'badge bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    matched: 'badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    manual: 'badge bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
  } as any)[s] || 'badge bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
}

onMounted(load)
</script>
