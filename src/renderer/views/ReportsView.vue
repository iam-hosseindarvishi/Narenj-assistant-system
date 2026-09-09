<template>
  <v-container dir="rtl" fluid class="report-page">
    <v-card>
      <v-card-title class="d-flex align-center">
        گزارش تطبیق مالی
        <v-spacer />
        <v-btn color="primary" class="ml-2 no-print" :loading="loading" @click="load">به‌روزرسانی</v-btn>
        <v-btn color="primary" variant="tonal" class="ml-2 no-print" @click="print">چاپ / PDF</v-btn>
        <v-btn variant="tonal" class="no-print" :loading="exporting" @click="exportExcel">خروجی Excel</v-btn>
      </v-card-title>
      <v-card-text>
        <v-row class="no-print">
          <v-col cols="12" md="3"><v-text-field v-model="from" label="از تاریخ (YYYY/MM/DD)" density="compact" @keyup.enter="load" /></v-col>
          <v-col cols="12" md="3"><v-text-field v-model="to" label="تا تاریخ (YYYY/MM/DD)" density="compact" @keyup.enter="load" /></v-col>
        </v-row>
        <div class="report-header mb-4">
          <strong>شرکت نارنج</strong>
          <span>بازه: {{ from || 'ابتدا' }} تا {{ to || 'انتها' }}</span>
          <span>ایجادشده: {{ generatedAt }}</span>
        </div>
        <v-alert v-if="error" type="error">{{ error }}</v-alert>

        <h3 class="text-subtitle-1 mt-4">خلاصه لایه‌ها</h3>
        <v-table>
          <thead><tr><th>بخش</th><th>کل</th><th>تطبیق‌شده</th><th>باقی‌مانده</th></tr></thead>
          <tbody>
            <tr v-for="row in report?.sections ?? []" :key="row.section">
              <td>{{ row.section }}</td>
              <td>{{ row.total.toLocaleString('fa-IR') }}</td>
              <td>{{ row.matched.toLocaleString('fa-IR') }}</td>
              <td>{{ (row.total - row.matched).toLocaleString('fa-IR') }}</td>
            </tr>
          </tbody>
        </v-table>

        <h3 class="text-subtitle-1 mt-4">کارمزدهای روزانه</h3>
        <v-table>
          <thead><tr><th>تاریخ</th><th>مبلغ کل (ریال)</th><th>متصل</th><th>متصل‌نشده</th><th>ثبت‌شده</th></tr></thead>
          <tbody>
            <tr v-for="fee in report?.fees ?? []" :key="fee.dateJalali">
              <td>{{ fee.dateJalali }}</td>
              <td>{{ fee.totalAmount.toLocaleString('fa-IR') }}</td>
              <td>{{ fee.linkedCount }}</td>
              <td>{{ fee.unlinkedCount }}</td>
              <td>{{ fee.registered ? 'بله' : 'خیر' }}</td>
            </tr>
            <tr v-if="(report?.fees ?? []).length === 0"><td colspan="5" class="text-center text-medium-emphasis py-3">کارمزدی ثبت نشده است</td></tr>
          </tbody>
        </v-table>

        <h3 class="text-subtitle-1 mt-4">رکوردهای تطبیق‌نشده</h3>
        <v-row>
          <v-col v-for="(list, system) in unmatchedGroups" :key="system" cols="12" md="6">
            <v-card variant="tonal">
              <v-card-title class="text-subtitle-2">{{ system }} ({{ list.length.toLocaleString('fa-IR') }})</v-card-title>
              <v-card-text class="unmatched-list">
                <div v-for="(row, index) in list.slice(0, 50)" :key="index" class="unmatched-row">
                  {{ row.dateJalali }} — {{ row.amount.toLocaleString('fa-IR') }} — {{ row.label }}
                </div>
                <div v-if="list.length === 0" class="text-medium-emphasis">موردی وجود ندارد</div>
                <div v-if="list.length > 50" class="text-caption mt-1">و {{ (list.length - 50).toLocaleString('fa-IR') }} رکورد دیگر…</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-alert class="mt-4" type="info" variant="tonal">کارمزد ثبت‌نشده: {{ (report?.unregisteredFeeTotal ?? 0).toLocaleString('fa-IR') }} ریال</v-alert>

        <h3 class="text-subtitle-1 mt-4">گزارش حسابرسی (۲۰ رکورد آخر)</h3>
        <v-table>
          <thead><tr><th>زمان</th><th>کاربر</th><th>عملیات</th><th>موجودیت</th><th>شناسه</th></tr></thead>
          <tbody>
            <tr v-for="entry in report?.auditTrail ?? []" :key="entry.timestamp + entry.action">
              <td>{{ entry.timestamp }}</td>
              <td>{{ entry.username ?? 'سیستم' }}</td>
              <td>{{ entry.action }}</td>
              <td>{{ entry.entityType }}</td>
              <td>{{ entry.entityId ?? '—' }}</td>
            </tr>
            <tr v-if="(report?.auditTrail ?? []).length === 0"><td colspan="5" class="text-center text-medium-emphasis py-3">رکوردی وجود ندارد</td></tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import * as XLSX from 'xlsx'

const from = ref('')
const to = ref('')
const report = ref<ReportDataDto | null>(null)
const loading = ref(false)
const exporting = ref(false)
const error = ref('')

const generatedAt = computed(() => report.value ? new Date(report.value.generatedAt).toLocaleString('fa-IR') : new Date().toLocaleString('fa-IR'))

const unmatchedGroups = computed<Record<string, ReportDataDto['unmatched']['bank']>>(() => {
  const empty = { bank: [], accounting: [], pos: [], posSummary: [] } as ReportDataDto['unmatched']
  const data = report.value?.unmatched ?? empty
  return {
    بانک: data.bank,
    حسابداری: data.accounting,
    پوز: data.pos,
    'خلاصه پوز': data.posSummary
  }
})

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    report.value = await window.api.reports.generate(from.value || undefined, to.value || undefined)
  } catch (err) { error.value = String(err) }
  loading.value = false
}

function print(): void {
  window.print()
}

function exportExcel(): void {
  if (!report.value) return
  exporting.value = true
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.value.sections.map(s => ({ بخش: s.section, کل: s.total, 'تطبیق‌شده': s.matched, باقی‌مانده: s.total - s.matched }))), 'خلاصه')
  const unmatchedRows = [
    ...report.value.unmatched.bank.map(r => ({ سیستم: 'بانک', تاریخ: r.dateJalali, مبلغ: r.amount, شرح: r.label })),
    ...report.value.unmatched.accounting.map(r => ({ سیستم: 'حسابداری', تاریخ: r.dateJalali, مبلغ: r.amount, شرح: r.label })),
    ...report.value.unmatched.pos.map(r => ({ سیستم: 'پوز', تاریخ: r.dateJalali, مبلغ: r.amount, شرح: r.label })),
    ...report.value.unmatched.posSummary.map(r => ({ سیستم: 'خلاصه پوز', تاریخ: r.dateJalali, مبلغ: r.amount, شرح: r.label }))
  ]
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(unmatchedRows), 'رکوردهای تطبیق‌نشده')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.value.fees.map(f => ({ تاریخ: f.dateJalali, 'مبلغ کل': f.totalAmount, متصل: f.linkedCount, متصل‌نشده: f.unlinkedCount, 'ثبت‌شده': f.registered ? 'بله' : 'خیر' }))), 'کارمزدها')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.value.auditTrail.map(a => ({ زمان: a.timestamp, کاربر: a.username ?? '-', عملیات: a.action, موجودیت: a.entityType, شناسه: a.entityId ?? '-' }))), 'گزارش حسابرسی')
  XLSX.writeFile(workbook, `narenj-report-${from.value || 'all'}-${to.value || 'all'}.xlsx`)
  exporting.value = false
}

onMounted(load)
</script>

<style scoped>
.report-header { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.unmatched-list { max-height: 260px; overflow: auto; }
.unmatched-row { font-size: 13px; padding: 2px 0; border-bottom: 1px dashed #ddd; }
@media print {
  :deep(.v-navigation-drawer), :deep(.v-app-bar), .no-print { display: none !important; }
  .report-page { max-width: none; }
  .unmatched-list { max-height: none; overflow: visible; }
}
</style>
