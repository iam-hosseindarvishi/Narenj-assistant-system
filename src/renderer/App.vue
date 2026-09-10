<template>
  <v-app dir="rtl">
    <template v-if="auth.isLoggedIn">
      <v-navigation-drawer v-model="drawer" permanent>
        <v-list nav>
          <v-list-item title="سامانه تطبیق نارنج" subtitle="گزارش‌گیری مالی" />
          <v-divider class="my-2" />
          <v-list-item
            v-for="item in visibleNavigation"
            :key="item.key"
            :title="item.title"
            :active="activeView === item.key"
            @click="activeView = item.key"
          />
        </v-list>
      </v-navigation-drawer>
      <v-app-bar color="primary">
        <v-app-bar-nav-icon @click="drawer = !drawer" />
        <v-toolbar-title>{{ currentTitle }}</v-toolbar-title>
        <v-spacer />
        <span class="ml-2">{{ auth.user?.username }} ({{ roleLabel }})</span>
        <v-btn variant="text" prepend-icon="mdi-logout" @click="logout">خروج</v-btn>
      </v-app-bar>
      <v-main class="bg-grey-lighten-4">
        <DashboardView v-if="activeView === 'dashboard'" />
        <ImportView v-else-if="activeView === 'import'" />
        <ReconciliationWizardView v-else-if="activeView === 'wizard'" />
        <ManualView v-else-if="activeView === 'manual'" />
        <TemplatesView v-else-if="activeView === 'templates'" />
        <UsersView v-else-if="activeView === 'users'" />
        <AuditView v-else-if="activeView === 'audit'" />
        <ReportsView v-else-if="activeView === 'reports'" />
        <DashboardView v-else />
      </v-main>
    </template>
    <v-main v-else class="bg-grey-lighten-4">
      <LoginView @success="activeView = 'dashboard'" />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import DashboardView from './views/DashboardView.vue'
import ImportView from './views/ImportView.vue'
import ReconciliationWizardView from './views/ReconciliationWizardView.vue'
import ManualView from './views/ManualView.vue'
import TemplatesView from './views/TemplatesView.vue'
import UsersView from './views/UsersView.vue'
import AuditView from './views/AuditView.vue'
import ReportsView from './views/ReportsView.vue'
import LoginView from './views/LoginView.vue'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
const drawer = ref(true)
const activeView = ref('dashboard')
const navigation = [
  { key: 'dashboard', title: 'داشبورد' }, { key: 'import', title: 'ورود فایل' },
  { key: 'wizard', title: 'مغایرت‌یابی خودکار' },
  { key: 'manual', title: 'تطبیق دستی' }, { key: 'templates', title: 'قالب‌ها' },
  { key: 'users', title: 'کاربران', adminOnly: true }, { key: 'audit', title: 'حسابرسی' },
  { key: 'reports', title: 'گزارش‌ها' }
]

const visibleNavigation = computed(() => navigation.filter(item => !item.adminOnly || auth.isAdmin))
const currentTitle = computed(() => navigation.find((item) => item.key === activeView.value)?.title ?? 'داشبورد')
const roleLabel = computed(() => {
  if (auth.user?.role === 'admin') return 'مدیر'
  if (auth.user?.role === 'operator') return 'اپراتور'
  return 'مشاهده‌گر'
})

async function logout(): Promise<void> {
  await auth.logout()
  activeView.value = 'dashboard'
}

onMounted(() => {
  auth.checkSession()
})
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700&display=swap');
:root { font-family: Vazirmatn, sans-serif; }
</style>
