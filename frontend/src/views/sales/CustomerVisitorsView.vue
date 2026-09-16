<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">ارتباط مشتری با ویزیتور</h2>
      <button v-if="auth.canEdit" class="btn-primary" @click="modalOpen = true">+ ارتباط جدید</button>
    </div>

    <p class="text-xs text-slate-500 dark:text-slate-400">
      هر ویزیتور می‌تواند با چند مشتری و هر مشتری با چند ویزیتور در ارتباط باشد.
    </p>

    <div class="card overflow-x-auto !p-0">
      <table class="table-base">
        <thead>
          <tr>
            <th>مشتری</th>
            <th>ویزیتور</th>
            <th v-if="auth.canEdit" class="w-20">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in links" :key="row.id">
            <td>{{ row.customer_name }}</td>
            <td>{{ row.visitor_name }}</td>
            <td v-if="auth.canEdit">
              <button class="btn-secondary !px-2 !py-1 text-xs text-red-600 dark:text-red-400" @click="remove(row)">حذف</button>
            </td>
          </tr>
          <tr v-if="!links.length">
            <td :colspan="auth.canEdit ? 3 : 2" class="text-center text-slate-400 py-6">ارتباطی ثبت نشده است</td>
          </tr>
        </tbody>
      </table>
    </div>

    <CrudModal v-if="modalOpen" title="ارتباط جدید" :saving="saving" @close="modalOpen = false" @save="save">
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">مشتری</label>
        <select v-model="form.customer_id" class="input" required>
          <option value="" disabled>انتخاب مشتری...</option>
          <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }} ({{ c.code }})</option>
        </select>
      </div>
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">ویزیتور</label>
        <select v-model="form.visitor_id" class="input" required>
          <option value="" disabled>انتخاب ویزیتور...</option>
          <option v-for="v in visitors" :key="v.id" :value="v.id">{{ v.full_name }} ({{ v.code }})</option>
        </select>
      </div>
    </CrudModal>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../../api/client'
import { useAuthStore } from '../../stores/auth'
import CrudModal from '../../components/CrudModal.vue'

const auth = useAuthStore()
const links = ref<any[]>([])
const customers = ref<any[]>([])
const visitors = ref<any[]>([])
const modalOpen = ref(false)
const saving = ref(false)
const form = ref({ customer_id: '' as number | '', visitor_id: '' as number | '' })

async function load() {
  const [ls, cs, vs] = await Promise.all([
    api.get('/sales/customer-visitors'),
    api.get('/sales/customers'),
    api.get('/sales/visitors')
  ])
  links.value = ls.data
  customers.value = cs.data
  visitors.value = vs.data
}

async function save() {
  saving.value = true
  try {
    await api.post('/sales/customer-visitors', form.value)
    modalOpen.value = false
    form.value = { customer_id: '', visitor_id: '' }
    await load()
  } catch (e: any) {
    alert(e.response?.data?.detail || 'خطا در ذخیره')
  } finally {
    saving.value = false
  }
}

async function remove(row: any) {
  if (!confirm(`حذف ارتباط «${row.customer_name}» و «${row.visitor_name}»؟`)) return
  try {
    await api.delete(`/sales/customer-visitors/${row.id}`)
    await load()
  } catch (e: any) {
    alert(e.response?.data?.detail || 'خطا در حذف')
  }
}

onMounted(load)
</script>
