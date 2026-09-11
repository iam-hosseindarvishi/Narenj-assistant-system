<template>
  <v-container dir="rtl">
    <v-card>
      <v-card-title>تطبیق دستی</v-card-title>
      <v-card-text>
        <v-row class="mb-4">
          <v-col cols="12" md="3"><v-text-field v-model="from" label="از تاریخ" density="compact" variant="outlined" /></v-col>
          <v-col cols="12" md="3"><v-text-field v-model="to" label="تا تاریخ" density="compact" variant="outlined" /></v-col>
          <v-col cols="12" md="3">
            <v-select v-model="system" :items="sourceSystems" item-title="title" item-value="value" label="سیستم" density="compact" variant="outlined" />
          </v-col>
          <v-col cols="12" md="3" class="d-flex align-center ga-2">
            <v-btn variant="outlined" @click="load">نمایش</v-btn>
            <v-btn color="primary" :disabled="selectedAccounting.length === 0 || selectedSource.length === 0" @click="link">تطبیق</v-btn>
          </v-col>
        </v-row>

        <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
        <v-alert v-if="success" type="success" class="mb-4">{{ success }}</v-alert>

        <v-alert v-if="filterAmount !== null" type="info" variant="tonal" class="mb-4" closable @click:close="clearFilter">
          فیلتر خودکار فعال است: مبلغ <strong>{{ filterAmount.toLocaleString() }}</strong> ریال
          <span class="text-caption mr-2">(فقط رکوردهای حسابداری با این مبلغ نمایش داده می‌شوند)</span>
        </v-alert>

        <v-row v-if="allAccountingRecords.length > 0 || sourceRecords.length > 0">
          <!-- Source side (bank or pos) -->
          <v-col cols="12" md="6">
            <v-card variant="outlined">
              <v-card-title class="text-subtitle-1 pb-0">{{ sourceLabel }} <v-chip size="small" color="grey" class="mr-1">{{ sourceRecords.length }}</v-chip></v-card-title>
              <v-card-text class="pt-2">
                <v-data-table
                  :headers="sourceHeaders"
                  :items="sourceRecords"
                  item-value="id"
                  show-select
                  v-model="selectedSource"
                  density="compact"
                  :items-per-page="15"
                  class="text-body-2"
                  @click:row="onSourceRowClick"
                >
                  <template #item.amount="{ item }">{{ item.amount.toLocaleString() }}</template>
                  <template #item.label="{ item }">
                    <v-tooltip location="bottom" :disabled="!item.label || item.label.length <= 50">
                      <template #activator="{ props: tipProps }">
                        <span v-bind="tipProps" class="text-truncate d-inline-block" style="max-width: 280px">{{ item.label || '—' }}</span>
                      </template>
                      <span style="white-space: pre-wrap; max-width: 500px; display: block;">{{ item.label }}</span>
                    </v-tooltip>
                  </template>
                  <template #item.suggestion="{ item }">
                    <v-chip v-if="item.suggestion" color="warning" size="x-small">پیشنهاد</v-chip>
                    <span v-else>—</span>
                  </template>
                </v-data-table>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Accounting side -->
          <v-col cols="12" md="6">
            <v-card variant="outlined">
              <v-card-title class="text-subtitle-1 pb-0">
                حسابداری
                <v-chip size="small" color="grey" class="mr-1">{{ filteredAccountingRecords.length }}</v-chip>
                <v-chip v-if="filterAmount !== null" size="small" color="info" class="mr-1">فیلتر شده</v-chip>
              </v-card-title>
              <v-card-text class="pt-2">
                <v-data-table
                  :headers="accountingHeaders"
                  :items="filteredAccountingRecords"
                  item-value="id"
                  show-select
                  v-model="selectedAccounting"
                  density="compact"
                  :items-per-page="15"
                  class="text-body-2"
                >
                  <template #item.amount="{ item }">{{ item.amount.toLocaleString() }}</template>
                  <template #item.label="{ item }">
                    <v-tooltip location="bottom" :disabled="!item.label || item.label.length <= 50">
                      <template #activator="{ props: tipProps }">
                        <span v-bind="tipProps" class="text-truncate d-inline-block" style="max-width: 280px">{{ item.label || '—' }}</span>
                      </template>
                      <span style="white-space: pre-wrap; max-width: 500px; display: block;">{{ item.label }}</span>
                    </v-tooltip>
                  </template>
                  <template #item.suggestion="{ item }">
                    <v-chip v-if="item.suggestion" color="warning" size="x-small">پیشنهاد</v-chip>
                    <span v-else>—</span>
                  </template>
                </v-data-table>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-alert v-else-if="loaded" type="info" variant="tonal" class="mt-4">داده‌ای یافت نشد.</v-alert>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

interface RecordItem { id: number; system: string; dateJalali: string; amount: number; label: string; suggestion?: boolean }

const from = ref('')
const to = ref('')
const system = ref('bank')
const error = ref('')
const success = ref('')
const records = ref<RecordItem[]>([])
const loaded = ref(false)
const filterAmount = ref<number | null>(null)

const selectedSource = ref<number[]>([])
const selectedAccounting = ref<number[]>([])

const sourceSystems = [
  { title: 'بانک', value: 'bank' },
  { title: 'پوز', value: 'pos' }
]

const sourceLabel = computed(() => system.value === 'pos' ? 'پوز' : 'بانک')

const sourceHeaders = [
  { title: 'تاریخ', key: 'dateJalali', width: '100px' },
  { title: 'مبلغ', key: 'amount', width: '120px' },
  { title: 'شرح', key: 'label' },
  { title: 'پیشنهاد', key: 'suggestion', width: '80px' }
]

const accountingHeaders = [
  { title: 'تاریخ', key: 'dateJalali', width: '100px' },
  { title: 'مبلغ', key: 'amount', width: '120px' },
  { title: 'شرح', key: 'label' },
  { title: 'پیشنهاد', key: 'suggestion', width: '80px' }
]

const sourceRecords = computed(() => records.value.filter(r => r.system === system.value))
const allAccountingRecords = computed(() => records.value.filter(r => r.system === 'accounting'))

const filteredAccountingRecords = computed(() => {
  if (filterAmount.value === null) return allAccountingRecords.value
  return allAccountingRecords.value.filter(r => Math.abs(r.amount - filterAmount.value!) < 0.01)
})

function onSourceRowClick(_event: Event, { item }: { item: RecordItem }): void {
  if (filterAmount.value === item.amount) {
    clearFilter()
  } else {
    filterAmount.value = item.amount
    selectedAccounting.value = []
  }
}

function clearFilter(): void {
  filterAmount.value = null
  selectedAccounting.value = []
}

async function load(clearMessages = true): Promise<void> {
  if (clearMessages) {
    error.value = ''
    success.value = ''
  }
  selectedSource.value = []
  selectedAccounting.value = []
  filterAmount.value = null
  try {
    records.value = await window.api.manual.list({
      from: from.value || undefined,
      to: to.value || undefined,
      system: system.value as 'bank' | 'pos'
    })
    loaded.value = true
  } catch (err) { error.value = String(err) }
}

async function link(): Promise<void> {
  error.value = ''
  success.value = ''
  try {
    const selection = [
      ...selectedAccounting.value.map(id => ({ system: 'accounting' as const, id })),
      ...selectedSource.value.map(id => ({ system: system.value as 'bank' | 'pos', id }))
    ]
    await window.api.manual.link(selection)
    await load(false)
    success.value = `تطبیق ${selection.length} رکورد با موفقیت انجام شد`
  } catch (err) { error.value = String(err) }
}

onMounted(load)
</script>
