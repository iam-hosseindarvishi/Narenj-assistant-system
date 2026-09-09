<template>
  <v-container dir="rtl" class="report-page">
    <v-card><v-card-title>گزارش تطبیق مالی</v-card-title><v-card-text>
      <v-row><v-col><v-text-field v-model="from" label="از تاریخ" /></v-col><v-col><v-text-field v-model="to" label="تا تاریخ" /></v-col></v-row>
      <div class="report-header mb-4"><strong>شرکت نارنج</strong><span>بازه: {{ from }} تا {{ to }}</span><span>ایجادکننده: کاربر جاری | {{ generatedAt }}</span></div>
      <v-table><thead><tr><th>بخش</th><th>کل</th><th>تطبیق‌شده</th><th>باقی‌مانده</th></tr></thead><tbody><tr v-for="row in rows" :key="row.section"><td>{{ row.section }}</td><td>{{ row.total }}</td><td>{{ row.matched }}</td><td>{{ row.total - row.matched }}</td></tr></tbody></v-table>
      <v-alert class="mt-4" type="info" variant="tonal">کارمزد ثبت‌نشده: {{ fee.toLocaleString('fa-IR') }} تومان</v-alert>
      <div class="d-flex ga-2 mt-4"><v-btn color="primary" @click="print">چاپ / PDF</v-btn><v-btn variant="tonal" @click="exportExcel">خروجی Excel</v-btn></div>
    </v-card-text></v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import * as XLSX from 'xlsx'
interface ReportRow { section: string; total: number; matched: number }
const from = ref('1403/01/01'); const to = ref('1403/01/01'); const fee = ref(1250000)
const generatedAt = new Date().toLocaleString('fa-IR')
const rows = ref<ReportRow[]>([
  { section: 'لایه ۱: پوز-بانک', total: 45, matched: 45 }, { section: 'لایه ۲: کارمزد', total: 45, matched: 38 },
  { section: 'لایه ۳: بانک-حسابداری', total: 36, matched: 29 }, { section: 'لایه ۴: ریز پوز', total: 1120, matched: 1087 }
])
function print(): void { window.print() }
function exportExcel(): void {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.value), 'خلاصه')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ از: from.value, تا: to.value, کارمزد: fee.value, ایجادشده: generatedAt }]), 'اطلاعات گزارش')
  XLSX.writeFile(workbook, `narenj-report-${from.value}-${to.value}.xlsx`)
}
</script>

<style scoped>
.report-header { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
@media print { :deep(.v-navigation-drawer), :deep(.v-app-bar), .d-flex { display: none !important; } .report-page { max-width: none; } }
</style>
