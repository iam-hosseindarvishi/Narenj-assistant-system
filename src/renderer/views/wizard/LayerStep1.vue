<template>
  <v-card flat>
    <v-card-title>لایه ۱: تطبیق خلاصه پوز با واریزهای شاپرک</v-card-title>
    <v-card-subtitle>واریز پوز با یک روز تأخیر (D+1) تسویه می‌شود</v-card-subtitle>
    <v-card-text>
      <v-row class="mb-4">
        <v-col cols="12" sm="6" md="3"><v-card color="success" variant="tonal"><v-card-title>تطبیق‌شده</v-card-title><v-card-text class="text-h5">{{ counts.matched }}</v-card-text></v-card></v-col>
        <v-col cols="12" sm="6" md="3"><v-card color="warning" variant="tonal"><v-card-title>در انتظار</v-card-title><v-card-text class="text-h5">{{ counts.pending }}</v-card-text></v-card></v-col>
        <v-col cols="12" sm="6" md="3"><v-card color="error" variant="tonal"><v-card-title>تطبیق‌نیافته</v-card-title><v-card-text class="text-h5">{{ counts.unmatched }}</v-card-text></v-card></v-col>
        <v-col cols="12" md="3" class="d-flex flex-column align-start gap-1">
          <v-btn v-if="!reconciled" color="primary" :loading="running" @click="runReconcile">اجرای تطبیق پوز و بانک</v-btn>
          <template v-else>
            <v-chip color="success" size="large" prepend-icon="mdi-check-circle">تکمیل شد</v-chip>
            <v-btn color="primary" variant="tonal" prepend-icon="mdi-arrow-right" class="mt-2" @click="$emit('next')">مرحله بعد</v-btn>
          </template>
        </v-col>
      </v-row>
      <v-alert v-if="alreadyDone" type="info" variant="tonal" class="mb-4" prepend-icon="mdi-information">
        داده جدیدی برای پردازش وجود ندارد. برای مشاهده نتایج از بخش <strong>گزارش‌ها</strong> اقدام فرمایید.
      </v-alert>
      <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
      <v-alert v-if="success" type="success" class="mb-4">{{ success }}</v-alert>

      <v-card v-for="group in groups" :key="group.date" class="mb-4" variant="outlined">
        <v-card-title class="text-subtitle-1">تاریخ {{ group.date }}</v-card-title>
        <v-table density="compact">
          <thead>
            <tr>
              <th class="text-right">شناسه شعبه</th>
              <th class="text-right">نام شعبه</th>
              <th class="text-right">تعداد</th>
              <th class="text-right">مبلغ پوز</th>
              <th class="text-right">مبلغ بانک</th>
              <th class="text-right">اختلاف</th>
              <th class="text-right">روزهای انتظار</th>
              <th class="text-right">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in group.rows" :key="row.id">
              <td>{{ row.branchId }}</td>
              <td>{{ row.branchName }}</td>
              <td>{{ row.txCount }}</td>
              <td>{{ formatAmount(row.posAmount) }}</td>
              <td>{{ row.bankAmount === null ? '—' : formatAmount(row.bankAmount) }}</td>
              <td :class="diffColor(row.diff)">{{ row.diff === null ? '—' : formatAmount(row.diff) }}</td>
              <td>{{ row.daysWaiting === null ? '—' : row.daysWaiting }}</td>
              <td><v-chip :color="statusColor(row.status)" size="small">{{ statusLabel(row.status) }}</v-chip></td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
      <v-alert v-if="!loading && groups.length === 0" type="info" variant="tonal">داده‌ای برای نمایش وجود ندارد. ابتدا فایل‌ها را در بخش «ورود فایل» بارگذاری کنید.</v-alert>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

defineProps<{ active: boolean }>()
const emit = defineEmits<{ done: []; next: [] }>()

const rows = ref<Layer1RowDto[]>([])
const loading = ref(false)
const running = ref(false)
const error = ref('')
const success = ref('')
const reconciled = ref(false)
const alreadyDone = ref(false)

const groups = computed(() => {
  const map = new Map<string, Layer1RowDto[]>()
  for (const row of rows.value) {
    const list = map.get(row.dateJalali) ?? []
    list.push(row)
    map.set(row.dateJalali, list)
  }
  return [...map.entries()].map(([date, list]) => ({ date, rows: list }))
})

const counts = computed(() => ({
  matched: rows.value.filter(r => r.status === 'matched' || r.status === 'manual').length,
  pending: rows.value.filter(r => r.status === 'pending').length,
  unmatched: rows.value.filter(r => r.status === 'unmatched').length
}))

function formatAmount(val: number): string {
  return Math.abs(val || 0).toLocaleString('fa-IR')
}

function statusColor(status: string): string {
  if (status === 'matched' || status === 'manual') return 'success'
  if (status === 'pending') return 'warning'
  return 'error'
}

function statusLabel(status: string): string {
  if (status === 'matched') return 'تطبیق‌شده'
  if (status === 'manual') return 'دستی'
  if (status === 'pending') return 'در انتظار'
  return 'تطبیق‌نیافته'
}

function diffColor(diff: number | null): string {
  if (diff === null) return ''
  if (Math.abs(diff) < 0.01) return 'text-success'
  return 'text-error font-weight-bold'
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    rows.value = await window.api.layer1.list()
    if (rows.value.length > 0 && counts.value.unmatched === 0 && counts.value.pending === 0) {
      reconciled.value = true
      alreadyDone.value = true
      emit('done')
    }
  } catch (err) { error.value = String(err) }
  loading.value = false
}

async function runReconcile(): Promise<void> {
  running.value = true
  error.value = ''
  success.value = ''
  try {
    await window.api.layer1.reconcile()
    success.value = 'تطبیق لایه ۱ انجام شد'
    reconciled.value = true
    await load()
    emit('done')
  } catch (err) { error.value = String(err) }
  running.value = false
}

onMounted(load)
</script>
