<template>
  <div class="space-y-6">
    <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">داشبورد اطلاعات پایه فروش</h2>

    <section>
      <h3 class="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">گزارش‌ها</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card">
          <div class="text-2xl font-bold text-narenj-600 dark:text-narenj-500">{{ visitors.length }}</div>
          <div class="text-sm text-slate-600 dark:text-slate-300">ویزیتور</div>
        </div>
        <div class="card">
          <div class="text-2xl font-bold text-narenj-600 dark:text-narenj-500">{{ routes.length }}</div>
          <div class="text-sm text-slate-600 dark:text-slate-300">مسیر فروش</div>
        </div>
        <div class="card">
          <div class="text-2xl font-bold text-narenj-600 dark:text-narenj-500">{{ customers.length }}</div>
          <div class="text-sm text-slate-600 dark:text-slate-300">مشتری</div>
        </div>
        <div class="card">
          <div class="text-2xl font-bold text-narenj-600 dark:text-narenj-500">{{ groups.length }}</div>
          <div class="text-sm text-slate-600 dark:text-slate-300">گروه کالا</div>
        </div>
      </div>
      <p class="text-xs text-slate-400 dark:text-slate-500 mt-4">
        کارت‌های گزارش عملیاتی بعداً به این صفحه اضافه می‌شوند.
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../../api/client'

const visitors = ref<any[]>([])
const routes = ref<any[]>([])
const customers = ref<any[]>([])
const groups = ref<any[]>([])

onMounted(async () => {
  const [v, r, c, g] = await Promise.all([
    api.get('/sales/visitors'),
    api.get('/sales/routes'),
    api.get('/sales/customers'),
    api.get('/sales/groups')
  ])
  visitors.value = v.data
  routes.value = r.data
  customers.value = c.data
  groups.value = g.data
})
</script>
