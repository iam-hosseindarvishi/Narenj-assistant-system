<template>
  <v-container dir="rtl" class="d-flex align-center justify-center" style="min-height: 60vh">
    <v-card width="420">
      <v-card-title>ورود به سامانه تطبیق نارنج</v-card-title>
      <v-card-text>
        <v-text-field v-model="username" label="نام کاربری" :disabled="loading" @keyup.enter="login" />
        <v-text-field v-model="password" label="رمز عبور" type="password" :disabled="loading" @keyup.enter="login" />
        <v-alert v-if="error" type="error">{{ error }}</v-alert>
        <v-btn color="primary" block class="mt-4" :loading="loading" @click="login">ورود</v-btn>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const emit = defineEmits<{ success: [] }>()
const auth = useAuthStore()
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function login(): Promise<void> {
  if (username.value.length === 0 || password.value.length === 0) {
    error.value = 'نام کاربری و رمز عبور را وارد کنید'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await auth.login(username.value, password.value)
    username.value = ''
    password.value = ''
    emit('success')
  } catch (err) {
    error.value = 'نام کاربری یا رمز عبور نادرست است'
    void err
  }
  loading.value = false
}
</script>
