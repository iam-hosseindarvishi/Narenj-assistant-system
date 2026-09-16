<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">مسیرهای فروش</h2>
      <button v-if="auth.canEdit" class="btn-primary" @click="openCreate">+ مسیر جدید</button>
    </div>

    <div class="card overflow-x-auto !p-0">
      <table class="table-base">
        <thead>
          <tr>
            <th>کد</th>
            <th>نام مسیر</th>
            <th>توضیحات</th>
            <th>وضعیت</th>
            <th v-if="auth.canEdit" class="w-32">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in routes" :key="r.id">
            <td class="font-mono">{{ r.code }}</td>
            <td>{{ r.name }}</td>
            <td class="text-slate-500 dark:text-slate-400">{{ r.description || '—' }}</td>
            <td>
              <span class="badge" :class="r.active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'">
                {{ r.active ? 'فعال' : 'غیرفعال' }}
              </span>
            </td>
            <td v-if="auth.canEdit" class="space-x-1 space-x-reverse whitespace-nowrap">
              <button class="btn-secondary !px-2 !py-1 text-xs" @click="openEdit(r)">ویرایش</button>
              <button class="btn-secondary !px-2 !py-1 text-xs text-red-600 dark:text-red-400" @click="remove(r)">حذف</button>
            </td>
          </tr>
          <tr v-if="!routes.length">
            <td colspan="5" class="text-center text-slate-400 py-6">هنوز مسیری ثبت نشده است</td>
          </tr>
        </tbody>
      </table>
    </div>

    <CrudModal
      v-if="modalOpen"
      :title="editing ? 'ویرایش مسیر' : 'مسیر جدید'"
      :saving="saving"
      @close="modalOpen = false"
      @save="save"
    >
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">کد</label>
        <input v-model="form.code" class="input" required />
      </div>
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">نام مسیر</label>
        <input v-model="form.name" class="input" required />
      </div>
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">توضیحات</label>
        <textarea v-model="form.description" class="input" rows="2"></textarea>
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
const routes = ref<any[]>([])
const modalOpen = ref(false)
const saving = ref(false)
const editing = ref<any | null>(null)
const form = ref({ code: '', name: '', description: '', active: true })

async function load() {
  routes.value = (await api.get('/sales/routes')).data
}

function openCreate() {
  editing.value = null
  form.value = { code: '', name: '', description: '', active: true }
  modalOpen.value = true
}

function openEdit(r: any) {
  editing.value = r
  form.value = { code: r.code, name: r.name, description: r.description || '', active: r.active }
  modalOpen.value = true
}

async function save() {
  saving.value = true
  try {
    if (editing.value) {
      await api.put(`/sales/routes/${editing.value.id}`, form.value)
    } else {
      await api.post('/sales/routes', form.value)
    }
    modalOpen.value = false
    await load()
  } catch (e: any) {
    alert(e.response?.data?.detail || 'خطا در ذخیره')
  } finally {
    saving.value = false
  }
}

async function remove(r: any) {
  if (!confirm(`حذف مسیر «${r.name}»؟ برنامه‌ها و ارتباط‌های این مسیر هم حذف می‌شود.`)) return
  try {
    await api.delete(`/sales/routes/${r.id}`)
    await load()
  } catch (e: any) {
    alert(e.response?.data?.detail || 'خطا در حذف')
  }
}

onMounted(load)
</script>
