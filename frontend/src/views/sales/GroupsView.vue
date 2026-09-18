<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">لیست گروه کالا</h2>
      <div v-if="auth.canEdit" class="flex gap-2">
        <button class="btn-secondary" @click="bulkOpen = true">ورود از اکسل/متن</button>
        <button class="btn-primary" @click="openCreate">+ گروه جدید</button>
      </div>
    </div>

    <div class="card overflow-x-auto !p-0">
      <table class="table-base">
        <thead>
          <tr>
            <th>کد</th>
            <th>نام گروه</th>
            <th v-if="auth.canEdit" class="w-32">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="g in groups" :key="g.id">
            <td class="font-mono">{{ g.code }}</td>
            <td>{{ g.name }}</td>
            <td v-if="auth.canEdit" class="space-x-1 space-x-reverse whitespace-nowrap">
              <button class="btn-secondary !px-2 !py-1 text-xs" @click="openEdit(g)">ویرایش</button>
              <button class="btn-secondary !px-2 !py-1 text-xs text-red-600 dark:text-red-400" @click="remove(g)">حذف</button>
            </td>
          </tr>
          <tr v-if="!groups.length">
            <td :colspan="auth.canEdit ? 3 : 2" class="text-center text-slate-400 py-6">هنوز گروهی ثبت نشده است</td>
          </tr>
        </tbody>
      </table>
    </div>

    <CrudModal
      v-if="modalOpen"
      :title="editing ? 'ویرایش گروه کالا' : 'گروه کالای جدید'"
      :saving="saving"
      @close="modalOpen = false"
      @save="save"
    >
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">کد</label>
        <input v-model="form.code" class="input" required />
      </div>
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">نام گروه</label>
        <input v-model="form.name" class="input" required />
      </div>
    </CrudModal>

    <!-- Bulk paste import: Excel rows copied to clipboard (TSV) or CSV text -->
    <CrudModal v-if="bulkOpen" title="ورود گروهی از متن" :saving="saving" @close="bulkOpen = false" @save="bulkSave">
      <p class="text-xs text-slate-500 dark:text-slate-400">
        دو ستون: کد و نام گروه. ردیف‌ها را از اکسل کپی و اینجا Paste کنید (تب یا کاما جدا می‌شوند).
      </p>
      <textarea v-model="bulkText" class="input font-mono" rows="8" dir="ltr"></textarea>
    </CrudModal>

    <ConfirmModal v-if="confirmOpen" :message="confirmMessage" :busy="confirmBusy" @confirm="doConfirm" @cancel="cancel" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../../api/client'
import { useAuthStore } from '../../stores/auth'
import CrudModal from '../../components/CrudModal.vue'
import ConfirmModal from '../../components/ConfirmModal.vue'
import { useConfirm } from '../../composables/useConfirm'

const auth = useAuthStore()
const { confirmOpen, confirmMessage, confirmBusy, confirmAction, doConfirm, cancel } = useConfirm()
const groups = ref<any[]>([])
const modalOpen = ref(false)
const bulkOpen = ref(false)
const saving = ref(false)
const editing = ref<any | null>(null)
const form = ref({ code: '', name: '' })
const bulkText = ref('')

async function load() {
  groups.value = (await api.get('/sales/groups')).data
}

function openCreate() {
  editing.value = null
  form.value = { code: '', name: '' }
  modalOpen.value = true
}

function openEdit(g: any) {
  editing.value = g
  form.value = { code: g.code, name: g.name }
  modalOpen.value = true
}

async function save() {
  saving.value = true
  try {
    if (editing.value) {
      await api.put(`/sales/groups/${editing.value.id}`, form.value)
    } else {
      await api.post('/sales/groups', form.value)
    }
    modalOpen.value = false
    await load()
  } catch (e: any) {
    alert(e.response?.data?.detail || 'خطا در ذخیره')
  } finally {
    saving.value = false
  }
}

function parseBulk(): { code: string; name: string }[] {
  return bulkText.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [code, name] = line.split(/\t|,|;/).map((p) => p.trim())
      return { code: code || '', name: name || code || '' }
    })
    .filter((r) => r.code)
}

async function bulkSave() {
  const rows = parseBulk()
  if (!rows.length) {
    alert('متن معتبری یافت نشد')
    return
  }
  saving.value = true
  try {
    const resp = await api.post('/sales/bulk/groups', { rows })
    alert(`${resp.data.created} گروه اضافه شد، ${resp.data.skipped} ردیف رد شد`)
    bulkOpen.value = false
    bulkText.value = ''
    await load()
  } catch (e: any) {
    alert(e.response?.data?.detail || 'خطا در ورود گروهی')
  } finally {
    saving.value = false
  }
}

function remove(g: any) {
  confirmAction(`حذف گروه «${g.name}»؟ قواعد مرتبط هم حذف می‌شود.`, async () => {
    await api.delete(`/sales/groups/${g.id}`)
    await load()
  })
}

onMounted(load)
</script>
