<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="text-sm text-slate-500 dark:text-slate-400">تطبیق دستی رکوردهای باقی‌مانده و بررسی پیشنهادها</div>
      <button class="btn-secondary" :disabled="loading" @click="load">
        {{ loading ? '...' : 'بازخوانی' }}
      </button>
    </div>

    <!-- Suggestions -->
    <div v-if="suggestions.length" class="card border border-amber-300 dark:border-amber-500/50">
      <h2 class="font-semibold text-slate-800 dark:text-slate-100 mb-3">پیشنهادهای در انتظار تأیید</h2>
      <div class="overflow-x-auto">
        <table class="table-base">
          <thead>
            <tr>
              <th>شناسه لینک</th>
              <th>سیستم</th>
              <th>تاریخ</th>
              <th>مبلغ</th>
              <th>شرح</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in suggestions" :key="s.suggestionLinkId">
              <td>{{ s.suggestionLinkId }}</td>
              <td>{{ systemLabel(s.system) }}</td>
              <td class="font-mono">{{ s.dateJalali }}</td>
              <td>{{ money(s.amount) }}</td>
              <td class="max-w-[300px] truncate">{{ s.label }}</td>
              <td v-if="auth.canEdit" class="whitespace-nowrap">
                <button class="text-emerald-600 hover:text-emerald-800 text-xs ml-2" @click="accept(s.suggestionLinkId)">تأیید</button>
                <button class="text-red-600 hover:text-red-800 text-xs" @click="reject(s.suggestionLinkId)">رد</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Selection lists -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card">
        <h2 class="font-semibold text-slate-800 dark:text-slate-100 mb-3">تراکنش‌های بانک (تطبیق‌نشده)</h2>
        <div class="overflow-x-auto max-h-80">
          <table class="table-base">
            <thead>
              <tr><th></th><th>تاریخ</th><th>مبلغ</th><th>شرح</th></tr>
            </thead>
            <tbody>
              <tr v-for="r in bankRows" :key="r.id">
                <td>
                  <input v-model.number="selection.bank" type="radio" :value="r.id" :disabled="!auth.canEdit" />
                </td>
                <td class="font-mono">{{ r.dateJalali }}</td>
                <td>{{ money(r.amount) }}</td>
                <td class="max-w-[200px] truncate">{{ r.label }}</td>
              </tr>
              <tr v-if="!bankRows.length">
                <td colspan="4" class="text-center text-slate-400 dark:text-slate-500 py-3">موردی نیست</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h2 class="font-semibold text-slate-800 dark:text-slate-100 mb-3">آرتیکل‌های حسابداری (تطبیق‌نشده)</h2>
        <div class="overflow-x-auto max-h-80">
          <table class="table-base">
            <thead>
              <tr><th></th><th>تاریخ</th><th>مبلغ</th><th>شرح</th></tr>
            </thead>
            <tbody>
              <tr v-for="r in accRows" :key="r.id">
                <td>
                  <input v-model.number="selection.accounting" type="radio" :value="r.id" :disabled="!auth.canEdit" />
                </td>
                <td class="font-mono">{{ r.dateJalali }}</td>
                <td>{{ money(r.amount) }}</td>
                <td class="max-w-[200px] truncate">{{ r.label }}</td>
              </tr>
              <tr v-if="!accRows.length">
                <td colspan="4" class="text-center text-slate-400 dark:text-slate-500 py-3">موردی نیست</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="flex gap-2">
      <button class="btn-primary" :disabled="!canLink || linking" @click="link">
        {{ linking ? 'در حال اتصال...' : 'اتصال انتخاب‌شده‌ها' }}
      </button>
    </div>
    <div v-if="message" class="text-sm" :class="ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'">{{ message }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '../../api/client'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const rows = ref<any[]>([])
const loading = ref(false)
const linking = ref(false)
const message = ref('')
const ok = ref(false)
const selection = ref({ bank: null as number | null, accounting: null as number | null })

const bankRows = computed(() => rows.value.filter((r) => r.system === 'bank' && r.suggestionLinkId == null))
const accRows = computed(() => rows.value.filter((r) => r.system === 'accounting' && r.suggestionLinkId == null))
const suggestions = computed(() => rows.value.filter((r) => r.suggestionLinkId != null))
const canLink = computed(() => auth.canEdit && selection.value.bank != null && selection.value.accounting != null)

async function load() {
  loading.value = true
  try {
    rows.value = (await api.get('/reconciliation/manual')).data
  } finally {
    loading.value = false
  }
}

function show(msg: string, success: boolean) {
  message.value = msg
  ok.value = success
}

async function link() {
  if (!canLink.value) return
  linking.value = true
  try {
    await api.post('/reconciliation/manual/link', {
      selection: [
        { system: 'bank', id: selection.value.bank },
        { system: 'accounting', id: selection.value.accounting }
      ]
    })
    show('✅ اتصال انجام شد', true)
    selection.value = { bank: null, accounting: null }
    await load()
  } catch (e: any) {
    show('❌ ' + (e.response?.data?.detail || 'خطا در اتصال'), false)
  } finally {
    linking.value = false
  }
}

async function accept(linkId: number) {
  await api.post('/reconciliation/manual/suggestions/accept', { link_id: linkId })
  await load()
}

async function reject(linkId: number) {
  await api.post('/reconciliation/manual/suggestions/reject', { link_id: linkId })
  await load()
}

function systemLabel(s: string) {
  return ({ bank: 'بانک', accounting: 'حسابداری', pos: 'پوز' } as any)[s] || s
}

function money(v: number) {
  return new Intl.NumberFormat('fa-IR').format(v)
}

onMounted(load)
</script>
