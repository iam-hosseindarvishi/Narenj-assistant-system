<template>
  <v-card flat>
    <v-card-title>لایه ۳: تطبیق تراکنش‌های بانکی غیر POS با اسناد حسابداری</v-card-title>
    <v-card-text>
      <v-row class="mb-4">
        <v-col cols="12" md="3"><v-card color="success" variant="tonal"><v-card-title>تطبیق‌یافته</v-card-title><v-card-text class="text-h5 font-weight-bold">{{ stats.matched }}</v-card-text></v-card></v-col>
        <v-col cols="12" md="3"><v-card color="warning" variant="tonal"><v-card-title>پیشنهادها</v-card-title><v-card-text class="text-h5 font-weight-bold">{{ stats.pending }}</v-card-text></v-card></v-col>
        <v-col cols="12" md="3"><v-card color="error" variant="tonal"><v-card-title>تطبیق‌نیافته</v-card-title><v-card-text class="text-h5 font-weight-bold">{{ stats.unmatched }}</v-card-text></v-card></v-col>
        <v-col cols="12" md="3" class="d-flex align-center">
          <v-btn v-if="!reconciled" color="primary" block :loading="running" @click="runReconciliation">اجرای تطبیق لایه ۳</v-btn>
          <v-chip v-else color="success" size="large" prepend-icon="mdi-check-circle">تکمیل شد</v-chip>
        </v-col>
      </v-row>
      <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
      <v-alert v-if="success" type="success" class="mb-4">{{ success }}</v-alert>

      <v-table density="compact">
        <thead>
          <tr>
            <th class="text-right">تاریخ</th>
            <th class="text-right">مبلغ (ریال)</th>
            <th class="text-right">شرح بانک</th>
            <th class="text-right">سند حسابداری</th>
            <th class="text-right">شرح سند</th>
            <th class="text-right">وضعیت</th>
            <th class="text-right">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.bankTxId">
            <td>{{ row.dateJalali }}</td>
            <td>{{ formatAmount(row.amount) }}</td>
            <td class="text-truncate" style="max-width: 260px">{{ row.bankDescription }}</td>
            <td>{{ row.accountingEntryId ?? '—' }}</td>
            <td class="text-truncate" style="max-width: 300px">{{ row.accountingDescription ?? '—' }}</td>
            <td><v-chip :color="statusColor(row)" size="small">{{ statusLabel(row) }}</v-chip></td>
            <td>
              <template v-if="row.matchType === 'suggested' && row.linkId !== null">
                <v-btn size="x-small" color="success" variant="tonal" class="ml-1" @click="accept(row.linkId)">تأیید</v-btn>
                <v-btn size="x-small" color="error" variant="tonal" @click="reject(row.linkId)">رد</v-btn>
              </template>
              <span v-else>—</span>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td colspan="7" class="text-center text-medium-emphasis py-4">داده‌ای برای نمایش وجود ندارد</td>
          </tr>
        </tbody>
      </v-table>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

defineProps<{ active: boolean }>()
const emit = defineEmits<{ done: [] }>()

const rows = ref<Layer3RowDto[]>([])
const running = ref(false)
const error = ref('')
const success = ref('')
const reconciled = ref(false)

const stats = computed(() => ({
  matched: rows.value.filter(r => r.status === 'matched' || r.status === 'manual').length,
  pending: rows.value.filter(r => r.matchType === 'suggested').length,
  unmatched: rows.value.filter(r => r.status === 'unmatched' && r.matchType !== 'suggested').length
}))

function formatAmount(val: number): string {
  return (val || 0).toLocaleString('fa-IR')
}

function statusColor(row: Layer3RowDto): string {
  if (row.matchType === 'suggested') return 'warning'
  if (row.status === 'matched' || row.status === 'manual') return 'success'
  return 'error'
}

function statusLabel(row: Layer3RowDto): string {
  if (row.matchType === 'suggested') return 'پیشنهاد'
  if (row.status === 'matched') return 'تطبیق‌شده'
  if (row.status === 'manual') return 'دستی'
  return 'تطبیق‌نیافته'
}

async function load(): Promise<void> {
  error.value = ''
  try { rows.value = await window.api.layer3.list() } catch (err) { error.value = errorMessage(err) }
  if (reconciled.value) emit('done')
}

async function runReconciliation(): Promise<void> {
  running.value = true
  error.value = ''
  success.value = ''
  try {
    const result = await window.api.layer3.reconcile()
    if (!result.ok) {
      error.value = result.error ?? 'اجرای تطبیق لایه ۳ ناموفق بود'
      return
    }
    const data = result.data
    success.value = data
      ? `تطبیق لایه ۳ انجام شد: ${data.matched} تطبیق، ${data.pending} پیشنهاد، ${data.unmatched} تطبیق‌نشده`
      : 'تطبیق لایه ۳ انجام شد'
    reconciled.value = true
    await load()
  } catch (err) { error.value = errorMessage(err) } finally { running.value = false }
}

async function accept(linkId: number): Promise<void> {
  try { await window.api.layer3.accept(linkId); await load() } catch (err) { error.value = errorMessage(err) }
}

async function reject(linkId: number): Promise<void> {
  try { await window.api.layer3.reject(linkId); await load() } catch (err) { error.value = errorMessage(err) }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

onMounted(load)
</script>
