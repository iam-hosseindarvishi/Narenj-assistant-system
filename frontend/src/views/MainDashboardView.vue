<template>
  <div class="min-h-screen flex flex-col bg-slate-100">
    <!-- Appbar -->
    <header class="bg-white border-b border-slate-200 shadow-sm">
      <div class="px-5 py-3 flex items-center justify-between">
        <h1 class="text-lg font-bold text-slate-800">پنل مدیریت نارنج</h1>
        <div class="text-sm text-slate-500 font-mono" dir="ltr">{{ nowText }}</div>
      </div>
    </header>

    <!-- Content -->
    <main class="flex-1 p-6 space-y-6">
      <!-- Operations row -->
      <section>
        <h2 class="text-sm font-semibold text-slate-500 mb-3">عملیات</h2>
        <div class="flex flex-wrap gap-4">
          <button
            v-if="auth.hasModule('reconciliation')"
            class="group w-56 text-right bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:border-narenj-500 hover:shadow-md transition-all"
            @click="$router.push('/reconciliation/dashboard')"
          >
            <div class="text-3xl mb-2">🧮</div>
            <div class="font-bold text-slate-800 group-hover:text-narenj-600">
              سیستم مغایرت‌گیری
            </div>
            <div class="text-xs text-slate-500 mt-1">مغایرت‌یابی حساب‌های بانکی و POS</div>
          </button>
          <!-- More operation modules will be added here -->
        </div>
      </section>

      <hr class="border-slate-200" />

      <!-- Reports row (placeholder for future reports) -->
      <section>
        <h2 class="text-sm font-semibold text-slate-500 mb-3">گزارش‌ها</h2>
        <div class="text-sm text-slate-400 bg-white rounded-xl border border-dashed border-slate-300 p-6 text-center">
          گزارش‌های سامانه به‌زودی به این بخش اضافه می‌شوند
        </div>
      </section>
    </main>

    <!-- Bottom nav bar -->
    <nav class="bg-slate-900 text-slate-200 px-5 py-3 flex items-center justify-between">
      <div class="text-sm">
        <span class="text-slate-400">کاربر:</span>
        <span class="font-semibold text-white ml-1">{{ auth.user?.username }}</span>
        <span class="badge bg-slate-700 text-slate-200 mr-2">{{ roleLabel }}</span>
      </div>
      <div class="text-sm text-slate-400 font-mono" dir="ltr">{{ nowText }}</div>
      <button class="text-sm text-red-300 hover:text-red-200" @click="doLogout">خروج</button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const now = ref(new Date())
let timer: number | undefined

onMounted(() => {
  timer = window.setInterval(() => (now.value = new Date()), 30_000)
})
onUnmounted(() => window.clearInterval(timer))

const nowText = computed(() =>
  new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full', timeStyle: 'short' }).format(now.value)
)

const roleLabel = computed(
  () => ({ admin: 'مدیر', operator: 'اپراتور', viewer: 'بیننده' })[auth.user?.role || ''] || ''
)

async function doLogout() {
  await auth.logout()
  router.push('/login')
}
</script>
