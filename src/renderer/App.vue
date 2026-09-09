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
    </v-app-bar>
    <v-main class="bg-grey-lighten-4">
      <DashboardView v-if="activeView === 'dashboard'" />
      <ReportsView v-else-if="activeView === 'reports'" />
      <v-container v-else><v-alert type="info" variant="tonal">این بخش در حال آماده‌سازی است.</v-alert></v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import DashboardView from './views/DashboardView.vue'
import ReportsView from './views/ReportsView.vue'

const drawer = ref(true)
const activeView = ref('dashboard')
const navigation = [
  { key: 'dashboard', title: 'داشبورد' }, { key: 'import', title: 'ورود فایل' },
  { key: 'layer1', title: 'مغایرت پوز-بانک' }, { key: 'layer2', title: 'کارمزدها' },
  { key: 'layer3', title: 'مغایرت بانک-حسابداری' }, { key: 'layer4', title: 'مغایرت ریز پوز' },
  { key: 'manual', title: 'تطبیق دستی' }, { key: 'templates', title: 'قالب‌ها' },
  { key: 'users', title: 'کاربران' }, { key: 'reports', title: 'گزارش‌ها' }
]
const currentTitle = computed(() => navigation.find((item) => item.key === activeView.value)?.title ?? 'داشبورد')
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700&display=swap');
:root { font-family: Vazirmatn, sans-serif; }
</style>
