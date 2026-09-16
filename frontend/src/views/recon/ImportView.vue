<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- File upload -->
      <div class="card">
        <h2 class="font-semibold text-slate-800 dark:text-slate-100 mb-1">ورود با فایل اکسل</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">فایل‌های xls / xlsx بانک، پوز و حسابداری</p>
        <div class="space-y-3">
          <select v-model.number="fileTemplateId" class="input">
            <option value="" disabled>قالب را انتخاب کنید</option>
            <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
          <input
            type="file"
            accept=".xls,.xlsx,.xlsm"
            class="input file:ml-3 file:btn-secondary file:border-0 file:text-xs"
            @change="onFileChange"
          />
          <button class="btn-primary w-full" :disabled="!file || !fileTemplateId || uploading" @click="upload">
            {{ uploading ? 'در حال بارگذاری...' : 'بارگذاری و ورود اطلاعات' }}
          </button>
        </div>
      </div>

      <!-- Clipboard paste -->
      <div class="card">
        <h2 class="font-semibold text-slate-800 dark:text-slate-100 mb-1">ورود با کپی از اکسل</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">
          محدوده دلخواه را در اکسل کپی و همین‌جا Paste کنید (ستون‌ها با Tab جدا می‌شوند)
        </p>
        <div class="space-y-3">
          <select v-model.number="pasteTemplateId" class="input">
            <option value="" disabled>قالب را انتخاب کنید</option>
            <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
          <textarea
            v-model="pasted"
            rows="8"
            class="input font-mono text-xs"
            dir="ltr"
            placeholder="Paste here... (Ctrl+V)"
          ></textarea>
          <button class="btn-primary w-full" :disabled="!pasted || !pasteTemplateId || pasting" @click="paste">
            {{ pasting ? 'در حال ورود...' : 'ثبت محتوای کپی‌شده' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="message" class="rounded-xl px-4 py-3 text-sm"
         :class="success ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'">
      {{ message }}
    </div>

    <!-- Import history -->
    <div class="card">
      <h2 class="font-semibold text-slate-800 dark:text-slate-100 mb-3">تاریخچه ورود اطلاعات</h2>
      <div class="overflow-x-auto">
        <table class="table-base">
          <thead>
            <tr>
              <th>#</th>
              <th>فایل</th>
              <th>منبع</th>
              <th>ردیف‌ها</th>
              <th>زمان</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in files" :key="f.id">
              <td>{{ f.id }}</td>
              <td class="max-w-[280px] truncate">{{ f.originalFilename }}</td>
              <td>
                <span class="badge" :class="f.source === 'clipboard' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'">
                  {{ f.source === 'clipboard' ? 'کلیپ‌بورد' : 'فایل' }}
                </span>
              </td>
              <td>{{ f.rowCount }}</td>
              <td class="text-xs text-slate-500">{{ f.uploadDate }}</td>
              <td>
                <button
                  v-if="auth.canEdit"
                  class="text-red-600 hover:text-red-800 text-xs"
                  @click="remove(f.id)"
                >حذف</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../../api/client'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const templates = ref<any[]>([])
const files = ref<any[]>([])

const fileTemplateId = ref<number | ''>('')
const pasteTemplateId = ref<number | ''>('')
const file = ref<File | null>(null)
const pasted = ref('')
const uploading = ref(false)
const pasting = ref(false)
const message = ref('')
const success = ref(false)

async function loadAll() {
  const [tpl, fl] = await Promise.all([api.get('/templates'), api.get('/files')])
  templates.value = tpl.data
  files.value = fl.data
}

function onFileChange(e: Event) {
  file.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

function show(msg: string, ok: boolean) {
  message.value = msg
  success.value = ok
}

async function upload() {
  if (!file.value || !fileTemplateId.value) return
  uploading.value = true
  try {
    const form = new FormData()
    form.append('file', file.value)
    const resp = await api.post(`/files/upload?template_id=${fileTemplateId.value}`, form)
    show(`✅ ${resp.data.parsed_rows} ردیف از ${resp.data.total_rows} ردیف وارد شد`, true)
    file.value = null
    await loadAll()
  } catch (e: any) {
    show('❌ ' + (e.response?.data?.detail || 'خطا در بارگذاری'), false)
  } finally {
    uploading.value = false
  }
}

async function paste() {
  if (!pasted.value || !pasteTemplateId.value) return
  pasting.value = true
  try {
    const resp = await api.post('/files/clipboard', {
      template_id: pasteTemplateId.value,
      text: pasted.value
    })
    show(`✅ ${resp.data.parsed_rows} ردیف از محتوای کپی‌شده وارد شد`, true)
    pasted.value = ''
    await loadAll()
  } catch (e: any) {
    show('❌ ' + (e.response?.data?.detail || 'خطا در ورود محتوا'), false)
  } finally {
    pasting.value = false
  }
}

async function remove(id: number) {
  if (!confirm('همه رکوردهای این فایل حذف شوند؟')) return
  await api.delete(`/files/${id}`)
  await loadAll()
}

onMounted(loadAll)
</script>
