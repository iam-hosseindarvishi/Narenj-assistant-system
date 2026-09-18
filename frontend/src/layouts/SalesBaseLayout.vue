<template>
  <div class="flex min-h-screen bg-slate-100 dark:bg-slate-900">
    <!-- Sidebar -->
    <aside
      class="w-64 bg-slate-900 text-slate-200 flex flex-col shrink-0"
      :class="{ hidden: !sidebarOpen }"
    >
      <div class="px-5 py-5 border-b border-slate-800">
        <div class="text-lg font-bold text-white">پنل اطلاعات پایه فروش</div>
        <div class="text-xs text-slate-400 mt-1">ویزیتور، مشتری، گروه کالا و قواعد</div>
      </div>

      <nav class="flex-1 overflow-y-auto py-3">
        <div v-for="section in sections" :key="section.title" class="mb-2">
          <div class="px-4 pb-1 pt-2 text-[11px] font-semibold text-slate-500 tracking-wide">
            {{ section.title }}
          </div>
          <router-link
            v-for="item in section.items"
            :key="item.to"
            :to="item.to"
            class="block px-4 py-2.5 text-sm hover:bg-slate-800 hover:text-white transition-colors"
            :class="$route.path === item.to ? 'bg-slate-800 text-white border-r-2 border-narenj-500' : ''"
          >
            <span class="ml-2">{{ item.icon }}</span>{{ item.label }}
          </router-link>
        </div>
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
      <header class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button class="md:hidden btn-secondary !px-2 !py-1" @click="sidebarOpen = !sidebarOpen">
            ☰
          </button>
          <button
            class="btn-secondary !py-1 text-xs"
            title="بازگشت به داشبورد اصلی"
            @click="$router.push('/')"
          >
            ← داشبورد اصلی
          </button>
        </div>
        <h1 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ pageTitle }}</h1>
        <div class="flex items-center gap-2">
          <div class="text-xs text-slate-500 dark:text-slate-400">{{ today }}</div>
          <ThemeToggle />
        </div>
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
import ThemeToggle from '../components/ThemeToggle.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const sidebarOpen = ref(true)

const sections = [
  {
    title: 'ویزیتور',
    items: [
      { to: '/sales-base/visitors', label: 'لیست ویزیتورها', icon: '🧑‍💼' },
      { to: '/sales-base/routes', label: 'مسیرهای فروش', icon: '🛣️' },
      { to: '/sales-base/weekly-plans', label: 'برنامه هفتگی', icon: '📅' },
      { to: '/sales-base/customer-visitors', label: 'ارتباط مشتری با ویزیتور', icon: '🔗' }
    ]
  },
  {
    title: 'مشتریان',
    items: [
      { to: '/sales-base/customers', label: 'لیست مشتریان', icon: '🏪' },
      { to: '/sales-base/customer-routes', label: 'مسیرهای مشتریان', icon: '📍' }
    ]
  },
  {
    title: 'گروه کالا',
    items: [
      { to: '/sales-base/groups', label: 'لیست گروه کالا', icon: '📦' },
      { to: '/sales-base/group-rules', label: 'ارتباط گروه با ویزیتور', icon: '⚖️' }
    ]
  },
  {
    title: 'گزارش‌ها',
    items: [
      { to: '/sales-base/violations', label: 'گزارش تخلفات', icon: '🚨' }
    ]
  }
]

const allItems = sections.flatMap((s) => s.items)

const pageTitle = computed(() => {
  const item = allItems.find((i) => i.to === route.path)
  return item ? item.label : 'پنل اطلاعات پایه فروش'
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
