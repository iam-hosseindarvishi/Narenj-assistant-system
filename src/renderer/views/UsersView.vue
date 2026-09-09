<template>
  <v-container dir="rtl"><v-card><v-card-title>مدیریت کاربران</v-card-title><v-data-table :headers="headers" :items="users" /></v-card></v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
interface User { id: number; username: string; role: string; createdAt: string }
const users = ref<User[]>([])
const headers = [{ title: 'نام کاربری', key: 'username' }, { title: 'نقش', key: 'role' }, { title: 'تاریخ ایجاد', key: 'createdAt' }]
onMounted(async () => { users.value = await window.api.users.list() })
</script>
