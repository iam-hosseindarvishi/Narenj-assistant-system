<template>
  <v-container fluid dir="rtl">
    <v-card class="mb-4">
      <v-card-title>لایه ۴: تطبیق ریز تراکنش‌های پوز با اسناد حسابداری</v-card-title>
      <v-card-subtitle>تطبیق با ۶ رقم آخر پیگیری + ۴ رقم آخر کارت + نام شعبه؛ گروه‌های تجمیعی (سرجمع) جمع‌شونده هستند</v-card-subtitle>
      <v-card-text>
        <v-row>
          <v-col cols="12" sm="6" md="3"><v-card color="success" variant="tonal"><v-card-title>تطبیق‌شده</v-card-title><v-card-text class="text-h5">{{ counts.matched }}</v-card-text></v-card></v-col>
          <v-col cols="12" sm="6" md="3"><v-card color="error" variant="tonal"><v-card-title>تطبیق‌نیافته</v-card-title><v-card-text class="text-h5">{{ counts.unmatched }}</v-card-text></v-card></v-col>
          <v-col cols="12" sm="6" md="3"><v-card color="info" variant="tonal"><v-card-title>گروه تجمیعی</v-card-title><v-card-text class="text-h5">{{ aggregatedCount }}</v-card-text></v-card></v-col>
          <v-col cols="12" md="3" class="d-flex align-center"><v-btn color="primary" block :loading="running" @click="runReconcile">اجرای تطبیق ریز پوز با حسابداری</v-btn></v-col>
        </v-row>
        <v-alert v-if="error" class="mt-4" type="error">{{ error }}</v-alert>
        <v-alert v-if="success" class="mt-4" type="success">{{ success }}</v-alert>
      </v-card-text>
    </v-card>

    <v-expansion-panels v-if="groups.length > 0">
      <v-expansion-panel v-for="group in groups" :key="group.key">
        <v-expansion-panel-title>
          <span class="ml-2">{{ group.date }} — {{ group.branch }}</span>
          <v-chip size="small" class="ml-2" :color="groupColor(group)">{{ groupMatched(group) }}/{{ group.rows.length }}</v-chip>
          <v-chip v-if="group.rows.some(r => r.aggregated)" size="small" color="info" class="ml-2">سرجمع</v-chip>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-table density="compact">
            <thead>
              <tr>
                <th class="text-right">شماره پیگیری</th>
                <th class="text-right">کارت</th>
                <th class="text-right">مبلغ</th>
                <th class="text-right">سند حسابداری</th>
                <th class="text-right">شرح سند</th>
                <th class="text-right">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in group.rows" :key="row.posTxId">
                <td>{{ row.refNumber }}</td>
                <td>{{ row.cardNumberMasked }}</td>
                <td>{{ formatAmount(row.amount) }}</td>
                <td>{{ row.entryId ?? '—' }}</td>
                <td class="text-truncate" style="max-width: 320px">{{ row.accountingDescription ?? '—' }}</td>
                <td><v-chip :color="row.status === 'matched' || row.status === 'manual' ? 'success' : 'error'" size="small">{{ row.status === 'matched' ? 'تطبیق‌شده' : row.status === 'manual' ? 'دستی' : 'تطبیق‌نیافته' }}</v-chip></td>
              </tr>
            </tbody>
          </v-table>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
    <v-alert v-else type="info" variant="tonal">داده‌ای برای نمایش وجود ندارد. ابتدا فایل‌ها را در بخش «ورود فایل» بارگذاری کنید.</v-alert>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const rows = ref<Layer4RowDto[]>([])
const running = ref(false)
const error = ref('')
const success = ref('')

const groups = computed(() => {
  const map = new Map<string, Layer4RowDto[]>()
  for (const row of rows.value) {
    const key = `${row.dateJalali}__${row.branchName}`
    const list = map.get(key) ?? []
    list.push(row)
    map.set(key, list)
  }
  return [...map.entries()].map(([key, list]) => ({ key, date: list[0].dateJalali, branch: list[0].branchName, rows: list }))
})

const counts = computed(() => ({
  matched: rows.value.filter(r => r.status === 'matched' || r.status === 'manual').length,
  unmatched: rows.value.filter(r => r.status === 'unmatched').length
}))

const aggregatedCount = computed(() => new Set(rows.value.filter(r => r.aggregated).map(r => r.accountingId)).size)

function groupMatched(group: { rows: Layer4RowDto[] }): number {
  return group.rows.filter(r => r.status === 'matched' || r.status === 'manual').length
}

function groupColor(group: { rows: Layer4RowDto[] }): string {
  const matched = groupMatched(group)
  if (matched === group.rows.length) return 'success'
  if (matched > 0) return 'warning'
  return 'error'
}

function formatAmount(val: number): string {
  return (val || 0).toLocaleString('fa-IR')
}

async function load(): Promise<void> {
  error.value = ''
  try { rows.value = await window.api.layer4.list() } catch (err) { error.value = String(err) }
}

async function runReconcile(): Promise<void> {
  running.value = true
  error.value = ''
  success.value = ''
  try {
    const result = await window.api.layer4.reconcile()
    if (!result.ok && result.error) {
      error.value = result.error
      return
    }
    const data = result.data
    success.value = data
      ? `تطبیق لایه ۴ انجام شد: ${data.matched} تطبیق، ${data.unmatched} تطبیق‌نشده`
      : 'تطبیق لایه ۴ انجام شد'
    await load()
  } catch (err) { error.value = String(err) }
  running.value = false
}

onMounted(load)
</script>
