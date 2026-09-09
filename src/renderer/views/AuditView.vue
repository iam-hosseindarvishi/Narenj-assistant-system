<template>
  <v-container dir="rtl"><v-card><v-card-title>گزارش حسابرسی</v-card-title><v-card-text><v-row><v-col><v-text-field v-model="action" label="عملیات" /></v-col><v-col><v-text-field v-model="from" label="از تاریخ" /></v-col><v-col><v-text-field v-model="to" label="تا تاریخ" /></v-col><v-col><v-btn @click="load">فیلتر</v-btn></v-col></v-row><v-data-table :headers="headers" :items="entries" /></v-card-text></v-card></v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
interface AuditEntry { id: number; userId: number | null; action: string; entityType: string; entityId: number | null; timestamp: string }
const entries = ref<AuditEntry[]>([]); const action = ref(''); const from = ref(''); const to = ref('')
const headers = [{ title: 'کاربر', key: 'userId' }, { title: 'عملیات', key: 'action' }, { title: 'موجودیت', key: 'entityType' }, { title: 'شناسه', key: 'entityId' }, { title: 'زمان', key: 'timestamp' }]
async function load(): Promise<void> { entries.value = await window.api.audit.list({ action: action.value || undefined, from: from.value || undefined, to: to.value || undefined }) }
onMounted(load)
</script>
