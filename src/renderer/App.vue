<template>
  <v-app dir="rtl">
    <v-navigation-drawer v-model="drawer" permanent>
      <v-list nav>
        <v-list-item title="سامانه تطبیق نارنج" subtitle="گزارش‌گیری مالی" />
        <v-divider class="my-2" />
        <v-list-item v-for="item in navigation" :key="item.key" :title="item.title" :active="activeView === item.key" @click="activeView = item.key" />
      </v-list>
    </v-navigation-drawer>
    <v-app-bar color="primary">
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-toolbar-title>{{ currentTitle }}</v-toolbar-title>
      <v-spacer />
      <v-btn v-if="activeView !== 'login'" variant="text" @click="activeView = 'login'">ورود کاربر</v-btn>
    </v-app-bar>
    <v-main class="bg-grey-lighten-4">
      <DashboardView v-if="activeView === 'dashboard'" />
      <ImportView v-else-if="activeView === 'import'" />
      <Layer1View v-else-if="activeView === 'layer1'" />
      <Layer2View v-else-if="activeView === 'layer2'" />
      <Layer3View v-else-if="activeView === 'layer3'" />
      <Layer4View v-else-if="activeView === 'layer4'" />
      <ManualView v-else-if="activeView === 'manual'" />
      <TemplatesView v-else-if="activeView === 'templates'" />
      <UsersView v-else-if="activeView === 'users'" />
      <AuditView v-else-if="activeView === 'audit'" />
      <ReportsView v-else-if="activeView === 'reports'" />
      <LoginView v-else-if="activeView === 'login'" @success="activeView = 'dashboard'" />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import DashboardView from './views/DashboardView.vue'
import ImportView from './views/ImportView.vue'
import Layer1View from './views/Layer1View.vue'
import Layer2View from './views/Layer2View.vue'
import Layer3View from './views/Layer3View.vue'
import Layer4View from './views/Layer4View.vue'
import ManualView from './views/ManualView.vue'
import TemplatesView from './views/TemplatesView.vue'
import UsersView from './views/UsersView.vue'
import AuditView from './views/AuditView.vue'
import ReportsView from './views/ReportsView.vue'
import LoginView from './views/LoginView.vue'

const drawer = ref(true)
const activeView = ref('dashboard')
const navigation = [
  { key: 'dashboard', title: 'داشبورد' }, { key: 'import', title: 'ورود فایل' },
  { key: 'layer1', title: 'مغایرت پوز-بانک' }, { key: 'layer2', title: 'کارمزدها' },
  { key: 'layer3', title: 'مغایرت بانک-حسابداری' }, { key: 'layer4', title: 'مغایرت ریز پوز' },
  { key: 'manual', title: 'تطبیق دستی' }, { key: 'templates', title: 'قالب‌ها' },
  { key: 'users', title: 'کاربران' }, { key: 'audit', title: 'حسابرسی' },
  { key: 'reports', title: 'گزارش‌ها' }
]
const currentTitle = computed(() => navigation.find((item) => item.key === activeView.value)?.title ?? 'داشبورد')
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700&display=swap');
:root { font-family: Vazirmatn, sans-serif; }
</style>
