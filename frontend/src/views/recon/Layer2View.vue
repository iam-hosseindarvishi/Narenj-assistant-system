<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="text-sm text-slate-500 dark:text-slate-400">تطبیق کارمزدهای بانک با حسابداری و تجمیع روزانه</div>
      <button class="btn-primary" :disabled="running" @click="run">
        {{ running ? 'در حال اجرا...' : 'اجرای لایه ۲' }}
      </button>
    </div>

    <div class="space-y-3">
      <div v-for="day in rows" :key="day.dateJalali" class="card">
        <div class="flex items-center justify-between mb-3">
          <div>
            <span class="font-mono font-semibold text-slate-800 dark:text-slate-100">{{ day.dateJalali }}</span>
            <span class="text-sm text-slate-500 dark:text-slate-400 mr-3">
              جمع روز: {{ money(day.totalAmount) }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="day.registered" class="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">ثبت‌شده</span>
            <button
              v-else-if="auth.canEdit"
              class="btn-secondary text-xs"
              :disabled="registering === day.dateJalali"
              @click="register(day.dateJalali)"
            >
              {{ registering === day.dateJalali ? '...' : 'ثبت در دفتر' }}
            </button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="table-base">
            <thead>
              <tr>
                <th>شناسه</th>
                <th>مبلغ</th>
                <th>شرح</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="fee in day.fees" :key="fee.id">
                <td>{{ fee.id }}</td>
                <td>{{ money(fee.amount) }}</td>
                <td class="max-w-[400px] truncate" :title="fee.description">{{ fee.description }}</td>
                <td><span :class="badge(fee.status)">{{ statusLabel(fee.status) }}</span></td>
              </tr>
              <tr v-if="!day.fees.length">
                <td colspan="4" class="text-center text-slate-400 py-3">کارمزدی برای این روز یافت نشد</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="!rows.length" class="card text-center text-slate-400 py-8">
        داده‌ای وجود ندارد
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../../api/client'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const rows = ref<any[]>([])
const running = ref(false)
const registering = ref<string | null>(null)

async function load() {
  rows.value = (await api.get('/reconciliation/layer2')).data
}

async function run() {
  running.value = true
  try {
    await api.post('/reconciliation/run/layer2')
    await load()
  } finally {
    running.value = false
  }
}

async function register(date: string) {
  registering.value = date
  try {
    await api.post(`/reconciliation/fees/${date}/register`)
    await load()
  } finally {
    registering.value = null
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
