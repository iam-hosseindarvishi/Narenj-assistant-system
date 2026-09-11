<template>
  <v-card flat>
    <v-card-title>لایه ۲: کارمزدهای بانکی</v-card-title>
    <v-card-subtitle>تجمیع روزانه کارمزدها و تطبیق با اسناد حسابداری</v-card-subtitle>
    <v-card-text>
      <div class="mb-4 d-flex flex-column align-start gap-3">
        <v-btn v-if="!reconciled" color="primary" :loading="running" @click="runReconciliation">اجرای تطبیق کارمزد</v-btn>
        <template v-else>
          <v-chip color="success" size="large" prepend-icon="mdi-check-circle">تکمیل شد</v-chip>
          <v-btn color="primary" variant="tonal" prepend-icon="mdi-arrow-right" @click="$emit('next')">مرحله بعد</v-btn>
        </template>
      </div>
      <v-alert v-if="alreadyDone" type="info" variant="tonal" class="mb-4" prepend-icon="mdi-information">
        داده جدیدی برای پردازش وجود ندارد. برای مشاهده نتایج از بخش <strong>گزارش‌ها</strong> اقدام فرمایید.
      </v-alert>
      <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
      <v-alert v-if="success" type="success" class="mb-4">{{ success }}</v-alert>

      <v-table>
        <thead>
          <tr>
            <th class="text-right">تاریخ</th>
            <th class="text-right">مبلغ کل (ریال)</th>
            <th class="text-right">تعداد متصل</th>
            <th class="text-right">تعداد متصل‌نشده</th>
            <th class="text-right">ثبت شده در حسابداری</th>
            <th class="text-right">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in dailyFees" :key="item.dateJalali">
            <td>{{ item.dateJalali }}</td>
            <td>{{ formatAmount(item.totalAmount) }}</td>
            <td><v-chip color="success" size="small">{{ item.linkedCount }}</v-chip></td>
            <td><v-chip color="warning" size="small">{{ item.unlinkedCount }}</v-chip></td>
            <td>
              <v-checkbox-btn
                :model-value="item.registered"
                :disabled="toggling === item.dateJalali"
                @update:model-value="(val) => toggleRegistered(item, Boolean(val))"
              />
            </td>
            <td>
              <v-btn size="small" variant="text" color="primary" @click="selectDate(item)">جزئیات</v-btn>
            </td>
          </tr>
          <tr v-if="dailyFees.length === 0">
            <td colspan="6" class="text-center text-medium-emphasis py-4">هیچ داده‌ای برای نمایش وجود ندارد</td>
          </tr>
        </tbody>
      </v-table>
    </v-card-text>

    <v-dialog v-model="detailsDialog" max-width="800">
      <v-card>
        <v-card-title>جزئیات کارمزدهای تاریخ {{ selectedDate }}</v-card-title>
        <v-card-text>
          <v-table>
            <thead>
              <tr>
                <th class="text-right">ردیف</th>
                <th class="text-right">مبلغ</th>
                <th class="text-right">شرح</th>
                <th class="text-right">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(fee, index) in selectedDateFees" :key="fee.id">
                <td>{{ index + 1 }}</td>
                <td>{{ formatAmount(fee.amount) }}</td>
                <td>{{ fee.description }}</td>
                <td>
                  <v-chip :color="fee.status === 'matched' ? 'success' : 'grey'" size="small">
                    {{ fee.status === 'matched' ? 'متصل' : 'تطبیق‌نشده' }}
                  </v-chip>
                </td>
              </tr>
              <tr v-if="selectedDateFees.length === 0">
                <td colspan="4" class="text-center text-medium-emphasis py-4">کارمزدی ثبت نشده است</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text="بستن" @click="detailsDialog = false" />
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

defineProps<{ active: boolean }>()
const emit = defineEmits<{ done: []; next: [] }>()

const dailyFees = ref<Layer2RowDto[]>([])
const selectedDate = ref('')
const selectedDateFees = ref<Array<{ id: number; amount: number; description: string; status: string }>>([])
const detailsDialog = ref(false)
const running = ref(false)
const toggling = ref('')
const error = ref('')
const success = ref('')
const reconciled = ref(false)
const alreadyDone = ref(false)

function formatAmount(val: number): string {
  return (val || 0).toLocaleString('fa-IR')
}

async function load(): Promise<void> {
  error.value = ''
  try {
    dailyFees.value = await window.api.layer2.list()
    const hasUnlinked = dailyFees.value.some(f => f.unlinkedCount > 0)
    if (dailyFees.value.length > 0 && !hasUnlinked) {
      reconciled.value = true
      alreadyDone.value = true
      emit('done')
    }
  } catch (err) { error.value = String(err) }
}

async function runReconciliation(): Promise<void> {
  running.value = true
  error.value = ''
  success.value = ''
  try {
    const result = await window.api.layer2.reconcile()
    success.value = `تطبیق کارمزد انجام شد: ${result.matched} مورد متصل و ${result.aggregated} تجمیع روزانه`
    reconciled.value = true
    await load()
    emit('done')
  } catch (err) { error.value = errorMessage(err) } finally { running.value = false }
}

async function toggleRegistered(item: Layer2RowDto, registered: boolean): Promise<void> {
  toggling.value = item.dateJalali
  try {
    await window.api.layer2.register(item.dateJalali, registered)
    await load()
  } catch (err) { error.value = errorMessage(err) } finally { toggling.value = '' }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function selectDate(item: Layer2RowDto): void {
  selectedDate.value = item.dateJalali
  selectedDateFees.value = item.fees
  detailsDialog.value = true
}

onMounted(load)
</script>
