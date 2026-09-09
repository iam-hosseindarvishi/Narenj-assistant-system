<template>
  <v-container dir="rtl">
    <v-row align="center"><v-col><h1 class="text-h5">وضعیت روزانه تطبیق</h1></v-col><v-col cols="12" sm="3"><v-text-field v-model="date" label="تاریخ" density="compact" /></v-col></v-row>
    <v-row>
      <v-col v-for="card in cards" :key="card.title" cols="12" sm="6" md="3"><v-card><v-card-title>{{ card.title }}</v-card-title><v-card-text><div class="text-h6">{{ card.matched.toLocaleString('fa-IR') }}</div><div class="text-caption">تطبیق‌شده از {{ card.total.toLocaleString('fa-IR') }}</div><v-progress-linear :model-value="progress(card)" color="primary" class="mt-2" /></v-card-text></v-card></v-col>
    </v-row>
    <v-row><v-col cols="12" md="6"><v-card><v-card-title>کارمزد روز</v-card-title><v-card-text class="text-h5">{{ fee.toLocaleString('fa-IR') }} تومان</v-card-text></v-card></v-col><v-col cols="12" md="6"><v-card><v-card-title>پیشرفت کلی</v-card-title><v-card-text><v-progress-linear :model-value="overall" color="success" height="12" /><div class="mt-2">{{ overall }}٪</div></v-card-text></v-card></v-col></v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
interface StatusCard { title: string; matched: number; total: number }
const date = ref('1403/01/01')
const cards = ref<StatusCard[]>([
  { title: 'لایه ۱: پوز-بانک', matched: 45, total: 45 }, { title: 'لایه ۲: کارمزد', matched: 38, total: 45 },
  { title: 'لایه ۳: بانک-حسابداری', matched: 29, total: 36 }, { title: 'لایه ۴: ریز پوز', matched: 1087, total: 1120 }
])
const fee = ref(1250000)
const progress = (card: StatusCard): number => card.total === 0 ? 0 : Math.round(card.matched / card.total * 100)
const overall = computed(() => Math.round(cards.value.reduce((sum, card) => sum + card.matched, 0) / cards.value.reduce((sum, card) => sum + card.total, 0) * 100))
</script>
