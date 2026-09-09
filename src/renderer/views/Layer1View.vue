<template>
  <v-container fluid dir="rtl">
    <v-card class="mb-4">
      <v-card-title>لایه ۱: تطبیق خلاصه پوز با واریزهای شاپرک</v-card-title>
      <v-card-subtitle>واریز پوز با یک روز تأخیر (D+1) تسویه می‌شود</v-card-subtitle>
      <v-card-text>
        <v-row>
          <v-col cols="12" sm="6" md="3"><v-card color="success" variant="tonal"><v-card-title>تطبیق‌شده</v-card-title><v-card-text class="text-h5">{{ counts.matched }}</v-card-text></v-card></v-col>
          <v-col cols="12" sm="6" md="3"><v-card color="warning" variant="tonal"><v-card-title>در انتظار</v-card-title><v-card-text class="text-h5">{{ counts.pending }}</v-card-text></v-card></v-col>
          <v-col cols="12" sm="6" md="3"><v-card color="error" variant="tonal"><v-card-title>تطبیق‌نیافته</v-card-title><v-card-text class="text-h5">{{ counts.unmatched }}</v-card-text></v-card></v-col>
          <v-col cols="12" md="3" class="d-flex align-center"><v-btn color="primary" block :loading="running" @click="runReconcile">اجرای تطبیق پوز و بانک، روز به روز</v-btn></v-col>
        </v-row>
        <v-alert v-if="error" class="mt-4" type="error">{{ error }}</v-alert>
      </v-card-text>
    </v-card>

    <v-card v-for="group in groups" :key="group.date" class="mb-4">
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
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const rows = ref<Layer1RowDto[]>([])
const loading = ref(false)
const running = ref(false)
const error = ref('')

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
  try { rows.value = await window.api.layer1.list() } catch (err) { error.value = String(err) }
  loading.value = false
}

async function runReconcile(): Promise<void> {
  running.value = true
  error.value = ''
  try {
    await window.api.layer1.reconcile()
    await load()
  } catch (err) { error.value = String(err) }
  running.value = false
}

onMounted(load)
</script>
