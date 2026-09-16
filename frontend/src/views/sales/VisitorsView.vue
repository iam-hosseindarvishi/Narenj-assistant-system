<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">لیست ویزیتورها</h2>
      <button v-if="auth.canEdit" class="btn-primary" @click="openCreate">+ ویزیتور جدید</button>
    </div>

    <div class="card overflow-x-auto !p-0">
      <table class="table-base">
        <thead>
          <tr>
            <th>کد</th>
            <th>نام و نام خانوادگی</th>
            <th>تلفن</th>
            <th>وضعیت</th>
            <th v-if="auth.canEdit" class="w-32">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in visitors" :key="v.id">
            <td class="font-mono">{{ v.code }}</td>
            <td>{{ v.full_name }}</td>
            <td dir="ltr" class="text-right">{{ v.phone || '—' }}</td>
            <td>
              <span class="badge" :class="v.active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'">
                {{ v.active ? 'فعال' : 'غیرفعال' }}
              </span>
            </td>
            <td v-if="auth.canEdit" class="space-x-1 space-x-reverse whitespace-nowrap">
              <button class="btn-secondary !px-2 !py-1 text-xs" @click="openEdit(v)">ویرایش</button>
              <button class="btn-secondary !px-2 !py-1 text-xs text-red-600 dark:text-red-400" @click="remove(v)">حذف</button>
            </td>
          </tr>
          <tr v-if="!visitors.length">
            <td colspan="5" class="text-center text-slate-400 py-6">هنوز ویزیتوری ثبت نشده است</td>
          </tr>
        </tbody>
      </table>
    </div>

    <CrudModal
      v-if="modalOpen"
      :title="editing ? 'ویرایش ویزیتور' : 'ویزیتور جدید'"
      :saving="saving"
      @close="modalOpen = false"
      @save="save"
    >
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">کد</label>
        <input v-model="form.code" class="input" required />
      </div>
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">نام و نام خانوادگی</label>
        <input v-model="form.full_name" class="input" required />
      </div>
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">تلفن</label>
        <input v-model="form.phone" class="input" dir="ltr" />
      </div>
      <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input v-model="form.active" type="checkbox" class="accent-narenj-500" />
        فعال
      </label>
    </CrudModal>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../../api/client'
import { useAuthStore } from '../../stores/auth'
import CrudModal from '../../components/CrudModal.vue'

const auth = useAuthStore()
const visitors = ref<any[]>([])
const modalOpen = ref(false)
const saving = ref(false)
const editing = ref<any | null>(null)
const form = ref({ code: '', full_name: '', phone: '', active: true })

async function load() {
  visitors.value = (await api.get('/sales/visitors')).data
}

function openCreate() {
  editing.value = null
  form.value = { code: '', full_name: '', phone: '', active: true }
  modalOpen.value = true
}

function openEdit(v: any) {
  editing.value = v
  form.value = { code: v.code, full_name: v.full_name, phone: v.phone || '', active: v.active }
  modalOpen.value = true
}

async function save() {
  saving.value = true
  try {
    if (editing.value) {
      await api.put(`/sales/visitors/${editing.value.id}`, form.value)
    } else {
      await api.post('/sales/visitors', form.value)
    }
    modalOpen.value = false
    await load()
  } catch (e: any) {
    alert(e.response?.data?.detail || 'خطا در ذخیره')
  } finally {
    saving.value = false
  }
}

async function remove(v: any) {
  if (!confirm(`حذف ویزیتور «${v.full_name}»؟ برنامه هفتگی و ارتباط‌های او هم حذف می‌شود.`)) return
  try {
    await api.delete(`/sales/visitors/${v.id}`)
    await load()
  } catch (e: any) {
    alert(e.response?.data?.detail || 'خطا در حذف')
  }
}

onMounted(load)
</script>
