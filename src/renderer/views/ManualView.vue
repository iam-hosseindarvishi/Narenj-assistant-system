<template>
  <v-container dir="rtl">
    <v-card>
      <v-card-title>تطبیق دستی</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="3"><v-text-field v-model="from" label="از تاریخ" /></v-col>
          <v-col cols="12" md="3"><v-text-field v-model="to" label="تا تاریخ" /></v-col>
          <v-col cols="12" md="3"><v-select v-model="system" :items="systems" label="سیستم" /></v-col>
          <v-col cols="12" md="3" class="d-flex align-center ga-2"><v-btn @click="load">نمایش</v-btn><v-btn color="primary" :disabled="selected.length < 2" @click="link">تطبیق</v-btn></v-col>
        </v-row>
        <v-alert v-if="error" type="error">{{ error }}</v-alert>
        <v-row>
          <v-col v-for="name in visibleSystems" :key="name" cols="12" :md="12 / visibleSystems.length">
            <v-data-table :headers="headers" :items="groups[name]" item-value="id" show-select v-model="selectedBySystem[name]" :title="titles[name]" @update:model-value="syncSelected(name, $event)">
              <template #item.amount="{ item }">{{ item.amount.toLocaleString() }}</template>
              <template #item.suggestion="{ item }"><v-chip v-if="item.suggestion" color="warning">پیشنهاد</v-chip></template>
            </v-data-table>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
interface RecordItem { id: number; system: string; dateJalali: string; amount: number; label: string; suggestion?: boolean }
const from = ref(''); const to = ref(''); const system = ref('all'); const error = ref(''); const records = ref<RecordItem[]>([])
const systems = ['all', 'bank', 'accounting', 'pos']; const titles: Record<string, string> = { bank: 'بانک', accounting: 'حسابداری', pos: 'پوز' }
const headers = [{ title: 'تاریخ', key: 'dateJalali' }, { title: 'مبلغ', key: 'amount' }, { title: 'شرح', key: 'label' }, { title: 'پیشنهاد', key: 'suggestion' }]
const selectedBySystem = reactive<Record<string, RecordItem[]>>({ bank: [], accounting: [], pos: [] })
const groups = computed(() => ({ bank: records.value.filter(r => r.system === 'bank'), accounting: records.value.filter(r => r.system === 'accounting'), pos: records.value.filter(r => r.system === 'pos') }))
const visibleSystems = computed(() => (['bank', 'accounting', 'pos'] as const).filter(name => groups.value[name].length > 0))
const selected = computed(() => Object.values(selectedBySystem).flat())
async function load(): Promise<void> { error.value = ''; try { records.value = await window.api.manual.list({ from: from.value || undefined, to: to.value || undefined, system: system.value }) } catch (err) { error.value = String(err) } }
function syncSelected(name: string, value: RecordItem[]): void { selectedBySystem[name] = value }
async function link(): Promise<void> { try { await window.api.manual.link(selected.value.map(item => ({ system: item.system, id: item.id }))); Object.keys(selectedBySystem).forEach(name => { selectedBySystem[name] = [] }); await load() } catch (err) { error.value = String(err) } }
onMounted(load)
</script>
