<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">گزارش تخلفات فروش</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          فروش گروه کالایی که در این مسیر به ویزیتور دیگری اختصاص دارد، در بازه هفتگی (شنبه تا جمعه).
        </p>
      </div>
      <div class="flex items-center gap-2">
        <input v-model="weekStart" class="input !w-36 text-center" dir="ltr" placeholder="۱۴۰۵/۰۶/۲۱" />
        <button class="btn-secondary" :disabled="loading" @click="load">نمایش</button>
      </div>
    </div>

    <p v-if="weekLabel" class="text-xs text-slate-500 dark:text-slate-400">بازه: {{ weekLabel }}</p>

    <div class="card overflow-x-auto !p-0">
      <table class="table-base">
        <thead>
          <tr>
            <th>تاریخ (شمسی)</th>
            <th>ویزیتور متخلف</th>
            <th>مسیر</th>
            <th>گروه کالا</th>
            <th>ویزیتور دارای حق فروش</th>
            <th>مبلغ</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(v, i) in items" :key="i" class="bg-red-50/50 dark:bg-red-900/10">
            <td>{{ jalali(v.sale_date) }}</td>
            <td class="font-semibold">{{ v.visitor_name }}</td>
            <td>{{ v.route_name }}</td>
            <td>{{ v.group_name }}</td>
            <td>{{ v.owner_name }}</td>
            <td class="font-mono">{{ money(v.amount) }}</td>
          </tr>
          <tr v-if="!items.length && !loading">
            <td colspan="6" class="text-center text-slate-400 py-6">تخلفی در این بازه ثبت نشده است</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../../api/client'

const items = ref<any[]>([])
const loading = ref(false)
const weekStart = ref('')
const weekLabel = ref('')

function jalali(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR').format(new Date(iso))
  } catch {
    return iso
  }
}

function money(n: number): string {
  return new Intl.NumberFormat('fa-IR').format(n)
}

async function load() {
  loading.value = true
  try {
    const body: any = {}
    if (weekStart.value.trim()) body.week_start = weekStart.value.trim().replace(/-/g, '/')
    const resp = await api.post('/sales/violations', body)
    items.value = resp.data.items
    weekLabel.value = `${jalali(resp.data.week_start)} تا ${jalali(resp.data.week_end)}`
  } catch (e: any) {
    alert(e.response?.data?.detail || 'خطا در دریافت گزارش')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
