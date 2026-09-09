<template>
  <v-container dir="rtl"><v-card><v-card-title>ورود</v-card-title><v-card-text><v-text-field v-model="username" label="نام کاربری" /><v-text-field v-model="password" label="رمز عبور" type="password" /><v-alert v-if="error" type="error">{{ error }}</v-alert><v-btn color="primary" @click="login">ورود</v-btn></v-card-text></v-card></v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const username = ref('')
const password = ref('')
const error = ref('')
async function login(): Promise<void> {
  try { await window.api.auth.login(username.value, password.value); error.value = '' } catch (err) { error.value = String(err) }
}
</script>
