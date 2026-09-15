<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="text-sm text-slate-500">آمار کلی لایه‌های تطبیق</div>
      <button class="btn-primary" :disabled="running" @click="runAll">
        {{ running ? 'در حال اجرا...' : 'اجرای همه لایه‌ها' }}
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <div v-for="layer in layers" :key="layer.key" class="card">
        <div class="flex items-center justify-between mb-3">
          <div class="font-semibold text-slate-800">{{ layer.label }}</div>
          <router-link :to="layer.route" class="text-xs text-narenj-600 hover:underline">مشاهده</router-link>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center">
          <div>
            <div class="text-xl font-bold text-emerald-600">{{ stats[layer.key]?.matched ?? 0 }}</div>
            <div class="text-[11px] text-slate-500">تطبیق‌شده</div>
          </div>
          <div>
            <div class="text-xl font-bold text-amber-600">{{ stats[layer.key]?.unmatched ?? 0 }}</div>
            <div class="text-[11px] text-slate-500">باقی‌مانده</div>
          </div>
          <div>
            <div class="text-xl font-bold text-slate-700">{{ stats[layer.key]?.total ?? 0 }}</div>
            <div class="text-[11px] text-slate-500">کل</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center justify-between">
        <div>
          <div class="font-semibold text-slate-800">کارمزد ثبت‌نشده</div>
          <div class="text-xs text-slate-500">جمع کارمزدهای روزانه‌ای که هنوز ثبت دفتری نشده‌اند</div>
        </div>
        <div class="text-2xl font-bold text-narenj-600">{{ formatMoney(stats.unregisteredFeeTotal ?? 0) }}</div>
      </div>
    </div>

    <div v-if="runResult" class="card text-sm text-slate-700">
      <div class="font-semibold mb-2">نتیجه آخرین اجرا</div>
      <pre class="bg-slate-50 rounded-lg p-3 text-xs overflow-x-auto" dir="ltr">{{ JSON.stringify(runResult, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../../api/client'

const stats = ref<any>({})
const running = ref(false)
const runResult = ref<any>(null)

const layers = [
  { key: 'layer1', label: 'لایه ۱: POS ↔ بانک', route: '/reconciliation/layer1' },
  { key: 'layer2', label: 'لایه ۲: کارمزدها', route: '/reconciliation/layer2' },
  { key: 'layer3', label: 'لایه ۳: بانک ↔ حسابداری', route: '/reconciliation/layer3' },
  { key: 'layer4', label: 'لایه ۴: ریز تراکنش POS', route: '/reconciliation/layer4' }
]

async function load() {
  const resp = await api.get('/dashboard')
  stats.value = resp.data
}

async function runAll() {
  running.value = true
  try {
    runResult.value = (await api.post('/reconciliation/run/all')).data
    await load()
  } finally {
    running.value = false
  }
}

function formatMoney(v: number) {
  return new Intl.NumberFormat('fa-IR').format(v)
}

onMounted(load)
</script>
