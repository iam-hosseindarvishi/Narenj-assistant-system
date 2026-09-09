<template>
  <v-container fluid>
    <v-card class="mb-4">
      <v-card-title>تطبیق لایه ۲: کارمزد‌های بانکی</v-card-title>
      <v-card-subtitle>تجمیع روزانه کارمزدها و تطبیق با اسناد حسابداری</v-card-subtitle>
      <v-card-text>
        <v-btn color="primary" class="mb-4" @click="runReconciliation">
          اجرای تطبیق کارمزد
        </v-btn>

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
              <td>
                <v-chip color="success" size="small">{{ item.linkedCount }}</v-chip>
              </td>
              <td>
                <v-chip color="warning" size="small">{{ item.unlinkedCount }}</v-chip>
              </td>
              <td>
                <v-checkbox-btn
                  :model-value="item.registered"
                  @update:model-value="(val) => toggleRegistered(item, Boolean(val))"
                />
              </td>
              <td>
                <v-btn size="small" variant="text" color="primary" @click="selectDate(item.dateJalali)">
                  جزئیات
                </v-btn>
              </td>
            </tr>
            <tr v-if="dailyFees.length === 0">
              <td colspan="6" class="text-center text-medium-emphasis py-4">
                هیچ داده‌ای برای نمایش وجود ندارد
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>

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
            </tbody>
          </v-table>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text="بستن" @click="detailsDialog = false" />
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface DailyFeeItem {
  dateJalali: string
  totalAmount: number
  linkedCount: number
  unlinkedCount: number
  registered: boolean
}

interface FeeDetailItem {
  id: number
  amount: number
  description: string
  status: string
}

const dailyFees = ref<DailyFeeItem[]>([])
const selectedDate = ref<string>('')
const selectedDateFees = ref<FeeDetailItem[]>([])
const detailsDialog = ref<boolean>(false)

function formatAmount(val: number): string {
  return (val || 0).toLocaleString('fa-IR')
}

function runReconciliation(): void {
  // IPC call placeholder when connected
}

function toggleRegistered(item: DailyFeeItem, registered: boolean): void {
  item.registered = registered
}

function selectDate(date: string): void {
  selectedDate.value = date
  detailsDialog.value = true
}
</script>
