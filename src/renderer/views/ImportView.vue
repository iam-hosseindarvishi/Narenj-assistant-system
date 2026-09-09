<template>
  <v-container fluid dir="rtl">
    <v-card class="mb-4">
      <v-card-title>ورود فایل اکسل</v-card-title>
      <v-card-subtitle>فایل بانک، خلاصه پوز، ریز پوز یا حسابداری را با قالب متناسب بارگذاری کنید</v-card-subtitle>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="6">
            <v-select v-model="selectedTemplateId" :items="templateItems" item-title="title" item-value="value" label="قالب فایل" />
          </v-col>
          <v-col cols="12" md="6" class="d-flex align-center">
            <v-btn color="primary" :loading="uploading" :disabled="selectedTemplateId === null" @click="upload">بارگذاری فایل</v-btn>
          </v-col>
        </v-row>
        <v-alert v-if="error" type="error">{{ error }}</v-alert>
        <v-alert v-if="lastResult" class="mt-4" type="success" variant="tonal">
          <div>کل ردیف‌ها: {{ lastResult.totalRows }}</div>
          <div>ردیف‌های تجزیه‌شده: {{ lastResult.parsedRows }}</div>
          <div>ردیف‌های نادیده‌گرفته‌شده: {{ lastResult.skippedRows }}</div>
          <div v-for="(err, index) in lastResult.errors" :key="index">خطا: {{ err }}</div>
        </v-alert>
      </v-card-text>
    </v-card>

    <v-card>
      <v-card-title class="text-subtitle-1">تاریخچه فایل‌های بارگذاری‌شده</v-card-title>
      <v-table density="compact">
        <thead>
          <tr>
            <th class="text-right">ردیف</th>
            <th class="text-right">نام فایل</th>
            <th class="text-right">تاریخ بارگذاری</th>
            <th class="text-right">تعداد ردیف</th>
            <th class="text-right">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(file, index) in files" :key="file.id">
            <td>{{ index + 1 }}</td>
            <td>{{ file.originalFilename }}</td>
            <td>{{ file.uploadDate }}</td>
            <td>{{ file.rowCount ?? '—' }}</td>
            <td><v-btn size="x-small" color="error" variant="tonal" @click="removeFile(file.id)">حذف</v-btn></td>
          </tr>
          <tr v-if="files.length === 0">
            <td colspan="5" class="text-center text-medium-emphasis py-4">فایلی بارگذاری نشده است</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const templates = ref<TemplateDto[]>([])
const selectedTemplateId = ref<number | null>(null)
const files = ref<UploadedFileDto[]>([])
const uploading = ref(false)
const error = ref('')
const lastResult = ref<ImportResultDto | null>(null)

const templateItems = computed(() => templates.value.map(t => ({ title: `${t.name} (${typeLabel(t.type)})`, value: t.id })))

function typeLabel(type: string): string {
  if (type === 'bank') return 'بانک'
  if (type === 'pos_summary') return 'خلاصه پوز'
  if (type === 'pos_detail') return 'ریز پوز'
  return 'حسابداری'
}

async function load(): Promise<void> {
  error.value = ''
  try {
    templates.value = await window.api.templates.list()
    if (selectedTemplateId.value === null && templates.value.length > 0) selectedTemplateId.value = templates.value[0].id
    files.value = await window.api.import.list()
  } catch (err) { error.value = String(err) }
}

async function upload(): Promise<void> {
  if (selectedTemplateId.value === null) return
  uploading.value = true
  error.value = ''
  try {
    const result = await window.api.import.upload(selectedTemplateId.value)
    if (result) lastResult.value = result
    files.value = await window.api.import.list()
  } catch (err) { error.value = String(err) }
  uploading.value = false
}

async function removeFile(fileId: number): Promise<void> {
  try {
    await window.api.import.remove(fileId)
    files.value = await window.api.import.list()
  } catch (err) { error.value = String(err) }
}

onMounted(load)
</script>
