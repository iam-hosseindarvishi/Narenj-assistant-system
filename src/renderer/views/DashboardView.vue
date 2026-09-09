<template>
  <v-container dir="rtl" fluid>
    <v-row align="center" class="mb-2">
      <v-col><h1 class="text-h5">وضعیت روزانه تطبیق</h1></v-col>
      <v-col cols="12" sm="3">
        <v-text-field v-model="date" label="تاریخ (YYYY/MM/DD)" density="compact" :loading="loading" @keyup.enter="load" @blur="load" />
      </v-col>
      <v-col cols="auto"><v-btn color="primary" variant="tonal" @click="load">نمایش</v-btn></v-col>
    </v-row>
    <v-alert v-if="error" type="error" class="mb-2">{{ error }}</v-alert>
    <v-row>
      <v-col v-for="card in cards" :key="card.title" cols="12" sm="6" md="3">
        <v-card>
          <v-card-title>{{ card.title }}</v-card-title>
          <v-card-text>
            <div class="text-h6">{{ card.matched.toLocaleString('fa-IR') }}</div>
            <div class="text-caption">تطبیق‌شده از {{ card.total.toLocaleString('fa-IR') }}</div>
            <v-progress-linear :model-value="progress(card)" color="primary" class="mt-2" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>کارمزد {{ date ? 'روز ' + date : 'ثبت‌نشده' }}</v-card-title>
          <v-card-text class="text-h5">{{ fee.toLocaleString('fa-IR') }} ریال</v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>پیشرفت کلی</v-card-title>
          <v-card-text>
            <v-progress-linear :model-value="overall" color="success" height="12" />
            <div class="mt-2">{{ overall.toLocaleString('fa-IR') }}٪</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { todayJalali } from '../../shared/utils/jalali-date'

interface StatusCard { title: string; matched: number; total: number }

const date = ref(todayJalali())
const stats = ref<DashboardStatsDto | null>(null)
const loading = ref(false)
const error = ref('')

const cards = computed<StatusCard[]>(() => {
  if (!stats.value) return []
  return [
    { title: 'لایه ۱: پوز-بانک', matched: stats.value.layer1.matched + stats.value.layer1.manual, total: stats.value.layer1.total },
    { title: 'لایه ۲: کارمزد', matched: stats.value.layer2.matched, total: stats.value.layer2.total },
    { title: 'لایه ۳: بانک-حسابداری', matched: stats.value.layer3.matched + stats.value.layer3.manual, total: stats.value.layer3.total },
    { title: 'لایه ۴: ریز پوز', matched: stats.value.layer4.matched + stats.value.layer4.manual, total: stats.value.layer4.total }
  ]
})

const fee = computed(() => stats.value?.dateFeeTotal ?? stats.value?.unregisteredFeeTotal ?? 0)

const overall = computed(() => {
  if (!stats.value) return 0
  const layers = [stats.value.layer1, stats.value.layer2, stats.value.layer3, stats.value.layer4]
  const total = layers.reduce((sum, l) => sum + l.total, 0)
  const matched = layers.reduce((sum, l) => sum + l.matched + l.manual, 0)
  return total === 0 ? 0 : Math.round((matched / total) * 100)
})

function progress(card: StatusCard): number {
  return card.total === 0 ? 0 : Math.round((card.matched / card.total) * 100)
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    stats.value = await window.api.dashboard.stats(date.value || undefined)
  } catch (err) { error.value = String(err) }
  loading.value = false
}

onMounted(load)
</script>
