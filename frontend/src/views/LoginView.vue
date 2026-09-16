<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-bl from-slate-900 to-slate-700 p-4">
    <div class="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
      <div class="text-center mb-8">
        <div class="text-2xl font-bold text-slate-800 dark:text-slate-100">پنل مدیریت نارنج</div>
        <div class="text-sm text-slate-500 dark:text-slate-400 mt-1">ورود به سامانه</div>
      </div>
      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">نام کاربری</label>
          <input v-model="username" class="input" autocomplete="username" required />
        </div>
        <div>
          <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">گذرواژه</label>
          <input v-model="password" type="password" class="input" autocomplete="current-password" required />
        </div>
        <div v-if="error" class="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">{{ error }}</div>
        <button class="btn-primary w-full" :disabled="auth.loading" type="submit">
          {{ auth.loading ? 'در حال ورود...' : 'ورود' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const username = ref('')
const password = ref('')
const error = ref('')

async function submit() {
  error.value = ''
  try {
    const ok = await auth.login(username.value, password.value)
    if (ok) router.push('/')
  } catch (e: any) {
    error.value = e.response?.data?.detail === 'Invalid credentials'
      ? 'نام کاربری یا گذرواژه اشتباه است'
      : 'خطا در ورود؛ دوباره تلاش کنید'
  }
}
</script>
