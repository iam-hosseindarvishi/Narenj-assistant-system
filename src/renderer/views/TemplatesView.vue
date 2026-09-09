<template>
  <v-container fluid dir="rtl">
    <v-card class="mb-4">
      <v-card-title class="d-flex align-center">
        قالب‌های فایل
        <v-spacer />
        <v-btn color="primary" @click="openCreate">قالب جدید</v-btn>
      </v-card-title>
      <v-table density="compact">
        <thead>
          <tr>
            <th class="text-right">نام</th>
            <th class="text-right">نوع</th>
            <th class="text-right">تاریخ ایجاد</th>
            <th class="text-right">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tpl in templates" :key="tpl.id">
            <td>{{ tpl.name }}</td>
            <td>{{ typeLabel(tpl.type) }}</td>
            <td>{{ tpl.createdAt }}</td>
            <td>
              <v-btn size="x-small" color="primary" variant="tonal" class="ml-1" @click="openEdit(tpl)">ویرایش</v-btn>
              <v-btn size="x-small" color="error" variant="tonal" @click="remove(tpl.id)">حذف</v-btn>
            </td>
          </tr>
          <tr v-if="templates.length === 0">
            <td colspan="4" class="text-center text-medium-emphasis py-4">قالبی وجود ندارد</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <v-dialog v-model="dialog" max-width="720">
      <v-card>
        <v-card-title>{{ editingId === null ? 'ایجاد قالب' : 'ویرایش قالب' }}</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6"><v-text-field v-model="form.name" label="نام قالب" /></v-col>
            <v-col cols="12" md="6">
              <v-select v-model="form.type" :items="typeItems" item-title="title" item-value="value" label="نوع" />
            </v-col>
            <v-col cols="12" md="4"><v-text-field v-model="form.skipTopRows" label="ردیف‌های ابتدایی حذف‌شده (با کاما)" /></v-col>
            <v-col cols="12" md="4"><v-text-field v-model.number="form.headerRow" type="number" label="ردیف سرستون" /></v-col>
            <v-col cols="12" md="4"><v-text-field v-model.number="form.skipBottomRows" type="number" label="ردیف‌های انتهایی حذف‌شده" /></v-col>
            <v-col cols="12"><v-textarea v-model="form.columnMapping" label="نگاشت ستون‌ها (JSON)" rows="4" /></v-col>
            <v-col cols="12"><v-textarea v-model="form.extractionRules" label="قواعد استخراج (JSON)" rows="4" /></v-col>
          </v-row>
          <v-alert v-if="dialogError" type="error">{{ dialogError }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text="انصراف" @click="dialog = false" />
          <v-btn color="primary" :loading="saving" @click="save">ذخیره</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

const templates = ref<TemplateDto[]>([])
const dialog = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const dialogError = ref('')
const typeItems = [
  { title: 'بانک', value: 'bank' },
  { title: 'خلاصه پوز', value: 'pos_summary' },
  { title: 'ریز پوز', value: 'pos_detail' },
  { title: 'حسابداری', value: 'accounting' }
]

const form = reactive({
  name: '',
  type: 'bank',
  skipTopRows: '',
  headerRow: 1,
  skipBottomRows: 0,
  columnMapping: '{}',
  extractionRules: '[]'
})

function typeLabel(type: string): string {
  const item = typeItems.find(t => t.value === type)
  return item ? item.title : type
}

function openCreate(): void {
  editingId.value = null
  form.name = ''
  form.type = 'bank'
  form.skipTopRows = ''
  form.headerRow = 1
  form.skipBottomRows = 0
  form.columnMapping = '{}'
  form.extractionRules = '[]'
  dialogError.value = ''
  dialog.value = true
}

function openEdit(tpl: TemplateDto): void {
  editingId.value = tpl.id
  form.name = tpl.name
  form.type = tpl.type
  form.skipTopRows = tpl.cleanupRules.skipTopRows.join(',')
  form.headerRow = tpl.cleanupRules.headerRow
  form.skipBottomRows = tpl.cleanupRules.skipBottomRows
  form.columnMapping = JSON.stringify(tpl.columnMapping, null, 2)
  form.extractionRules = JSON.stringify(tpl.extractionRules, null, 2)
  dialogError.value = ''
  dialog.value = true
}

async function save(): Promise<void> {
  saving.value = true
  dialogError.value = ''
  try {
    const columnMapping = JSON.parse(form.columnMapping || '{}') as Record<string, string>
    const extractionRules = JSON.parse(form.extractionRules || '[]') as Array<{ field: string; pattern: string; mode: string }>
    const skipTopRows = form.skipTopRows.split(',').map(s => s.trim()).filter(s => s.length > 0).map(Number).filter(n => !Number.isNaN(n))
    const payload = {
      id: editingId.value ?? undefined,
      name: form.name,
      type: form.type,
      bankId: null,
      columnMapping,
      cleanupRules: { skipTopRows, skipBottomRows: form.skipBottomRows, headerRow: form.headerRow },
      extractionRules
    }
    await window.api.templates.save(payload)
    dialog.value = false
    templates.value = await window.api.templates.list()
  } catch (err) { dialogError.value = String(err) }
  saving.value = false
}

async function remove(id: number): Promise<void> {
  try {
    await window.api.templates.remove(id)
    templates.value = await window.api.templates.list()
  } catch (err) { dialogError.value = String(err) }
}

onMounted(async () => { templates.value = await window.api.templates.list() })
</script>
