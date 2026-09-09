<template>
  <v-container fluid dir="rtl">
    <v-card class="mb-4">
      <v-card-title>گزارش حسابرسی</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="3">
            <v-select v-model="userId" :items="userItems" item-title="title" item-value="value" label="کاربر" clearable />
          </v-col>
          <v-col cols="12" md="3">
            <v-select v-model="action" :items="actionItems" label="عملیات" clearable />
          </v-col>
          <v-col cols="12" md="2"><v-text-field v-model="from" label="از تاریخ" /></v-col>
          <v-col cols="12" md="2"><v-text-field v-model="to" label="تا تاریخ" /></v-col>
          <v-col cols="12" md="2" class="d-flex align-center"><v-btn color="primary" block @click="load">جستجو</v-btn></v-col>
        </v-row>
        <v-alert v-if="error" type="error">{{ error }}</v-alert>
      </v-card-text>
    </v-card>

    <v-card>
      <v-table density="compact">
        <thead>
          <tr>
            <th class="text-right">کاربر</th>
            <th class="text-right">عملیات</th>
            <th class="text-right">موجودیت</th>
            <th class="text-right">شناسه</th>
            <th class="text-right">زمان</th>
            <th class="text-right">جزئیات</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="entry in pageEntries" :key="entry.id">
            <tr @click="toggle(entry.id)">
              <td>{{ userLabel(entry.userId) }}</td>
              <td>{{ entry.action }}</td>
              <td>{{ entry.entityType }}</td>
              <td>{{ entry.entityId ?? '—' }}</td>
              <td>{{ entry.timestamp }}</td>
              <td>
                <v-btn size="x-small" variant="text" :append-icon="expandedId === entry.id ? 'mdi-chevron-up' : 'mdi-chevron-down'">
                  {{ expandedId === entry.id ? 'بستن' : 'نمایش' }}
                </v-btn>
              </td>
            </tr>
            <tr v-if="expandedId === entry.id">
              <td colspan="6">
                <v-row>
                  <v-col cols="12" md="6">
                    <div class="text-subtitle-2 mb-1">مقدار قبلی</div>
                    <pre class="json-box">{{ pretty(entry.oldValue) }}</pre>
                  </v-col>
                  <v-col cols="12" md="6">
                    <div class="text-subtitle-2 mb-1">مقدار جدید</div>
                    <pre class="json-box">{{ pretty(entry.newValue) }}</pre>
                  </v-col>
                </v-row>
              </td>
            </tr>
          </template>
          <tr v-if="entries.length === 0">
            <td colspan="6" class="text-center text-medium-emphasis py-4">رکوردی برای نمایش وجود ندارد</td>
          </tr>
        </tbody>
      </v-table>
      <v-card-actions v-if="pageCount > 1">
        <v-spacer />
        <v-pagination v-model="page" :length="pageCount" total-visible="7" />
        <v-spacer />
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

interface AuditRow {
  id: number
  userId: number | null
  action: string
  entityType: string
  entityId: number | null
  oldValue: string | null
  newValue: string | null
  timestamp: string
}

const PAGE_SIZE = 10
const entries = ref<AuditRow[]>([])
const users = ref<Array<{ id: number; username: string }>>([])
const userId = ref<number | null>(null)
const action = ref('')
const from = ref('')
const to = ref('')
const page = ref(1)
const expandedId = ref<number | null>(null)
const error = ref('')

const actionItems = ['match', 'manual-link', 'manual-unlink', 'import', 'import-remove', 'fee-register', 'fee-unregister', 'accept-suggestion', 'reject-suggestion', 'user-create', 'user-update', 'user-remove', 'user-reset-password', 'template-remove']

const userItems = computed(() => users.value.map(u => ({ title: u.username, value: u.id })))
const pageCount = computed(() => Math.max(1, Math.ceil(entries.value.length / PAGE_SIZE)))
const pageEntries = computed(() => entries.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

function userLabel(id: number | null): string {
  if (id === null) return 'سیستم'
  const user = users.value.find(u => u.id === id)
  return user ? user.username : String(id)
}

function pretty(value: string | null): string {
  if (value === null || value.length === 0) return '—'
  try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value }
}

function toggle(id: number): void {
  expandedId.value = expandedId.value === id ? null : id
}

async function load(): Promise<void> {
  error.value = ''
  try {
    entries.value = await window.api.audit.list({
      userId: userId.value ?? undefined,
      action: action.value || undefined,
      from: from.value || undefined,
      to: to.value || undefined
    })
    page.value = 1
    expandedId.value = null
  } catch (err) { error.value = String(err) }
}

onMounted(async () => {
  try { users.value = await window.api.users.list() } catch { /* users list unavailable for viewers */ }
  await load()
})
</script>

<style scoped>
.json-box { background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 8px; max-height: 220px; overflow: auto; text-align: left; direction: ltr; font-size: 12px; }
</style>
