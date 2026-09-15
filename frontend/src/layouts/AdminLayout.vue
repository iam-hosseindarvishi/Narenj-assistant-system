<template>
  <div class="flex min-h-screen">
    <!-- Sidebar -->
    <aside
      class="w-64 bg-slate-900 text-slate-200 flex flex-col shrink-0"
      :class="{ hidden: !sidebarOpen }"
    >
      <div class="px-5 py-5 border-b border-slate-800">
        <div class="text-lg font-bold text-white">پنل مدیریت نارنج</div>
        <div class="text-xs text-slate-400 mt-1">سامانه یکپارچه مدیریتی</div>
      </div>

      <nav class="flex-1 overflow-y-auto py-3">
        <div class="px-4 pb-1 text-[11px] font-semibold text-slate-500 tracking-wide">
          مغایرت یابی بانکی
        </div>
        <router-link
          v-for="item in reconItems"
          :key="item.to"
          :to="item.to"
          class="block px-4 py-2.5 text-sm hover:bg-slate-800 hover:text-white transition-colors"
          :class="$route.path === item.to ? 'bg-slate-800 text-white border-r-2 border-narenj-500' : ''"
        >
          <span class="ml-2">{{ item.icon }}</span>{{ item.label }}
        </router-link>
      </nav>

      <div class="px-4 py-4 border-t border-slate-800 text-xs text-slate-400">
        <div v-if="auth.user" class="flex items-center justify-between">
          <span>{{ auth.user.username }} ({{ roleLabel }})</span>
          <button class="text-slate-400 hover:text-white" @click="doLogout">خروج</button>
        </div>
      </div>
    </aside>

    <!-- Main -->
    <div class="flex-1 flex flex-col min-w-0">
      <header class="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <button class="md:hidden btn-secondary !px-2 !py-1" @click="sidebarOpen = !sidebarOpen">
          ☰
        </button>
        <h1 class="text-base font-semibold text-slate-800">{{ pageTitle }}</h1>
        <div class="text-xs text-slate-500">{{ today }}</div>
      </header>
      <main class="flex-1 p-6 overflow-x-hidden">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const sidebarOpen = ref(true)

const reconItems = [
  { to: '/reconciliation/dashboard', label: 'داشبورد', icon: '📊' },
  { to: '/reconciliation/import', label: 'ورود اطلاعات', icon: '📥' },
  { to: '/reconciliation/layer1', label: 'لایه ۱: POS ↔ بانک', icon: '🔄' },
  { to: '/reconciliation/layer2', label: 'لایه ۲: کارمزدها', icon: '💰' },
  { to: '/reconciliation/layer3', label: 'لایه ۳: بانک ↔ حسابداری', icon: '🏦' },
  { to: '/reconciliation/layer4', label: 'لایه ۴: ریز تراکنش POS', icon: '🧾' },
  { to: '/reconciliation/manual', label: 'تطبیق دستی', icon: '✋' },
  { to: '/reconciliation/reports', label: 'گزارش‌ها', icon: '📄' },
  { to: '/reconciliation/audit', label: 'حسابرسی', icon: '🔍' }
]

const pageTitle = computed(() => {
  const item = reconItems.find((i) => i.to === route.path)
  return item ? item.label : 'پنل مدیریت'
})

const roleLabel = computed(
  () => ({ admin: 'مدیر', operator: 'اپراتور', viewer: 'بیننده' })[auth.user?.role || ''] || ''
)

const today = new Intl.DateTimeFormat('fa-IR').format(new Date())

async function doLogout() {
  await auth.logout()
  router.push('/login')
}
</script>
