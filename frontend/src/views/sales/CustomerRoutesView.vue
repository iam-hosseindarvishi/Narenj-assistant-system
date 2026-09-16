<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">مسیرهای مشتریان</h2>
      <button v-if="auth.canEdit" class="btn-primary" @click="modalOpen = true">+ نسبت دادن مسیر</button>
    </div>

    <p class="text-xs text-slate-500 dark:text-slate-400">
      فقط مسیر ویزیت به مشتری نسبت داده می‌شود؛ ارتباط مشتری با ویزیتور در بخش «ارتباط مشتری با ویزیتور» است.
    </p>

    <div class="card overflow-x-auto !p-0">
      <table class="table-base">
        <thead>
          <tr>
            <th>مشتری</th>
            <th>مسیر ویزیت</th>
            <th v-if="auth.canEdit" class="w-20">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in links" :key="row.id">
            <td>{{ row.customer_name }}</td>
            <td>{{ row.route_name }}</td>
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

    <CrudModal v-if="modalOpen" title="نسبت دادن مسیر به مشتری" :saving="saving" @close="modalOpen = false" @save="save">
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">مشتری</label>
        <select v-model="form.customer_id" class="input" required>
          <option value="" disabled>انتخاب مشتری...</option>
          <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }} ({{ c.code }})</option>
        </select>
      </div>
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">مسیر</label>
        <select v-model="form.route_id" class="input" required>
          <option value="" disabled>انتخاب مسیر...</option>
          <option v-for="r in routes" :key="r.id" :value="r.id">{{ r.name }}</option>
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
const routes = ref<any[]>([])
const modalOpen = ref(false)
const saving = ref(false)
const form = ref({ customer_id: '' as number | '', route_id: '' as number | '' })

async function load() {
  const [ls, cs, rs] = await Promise.all([
    api.get('/sales/customer-routes'),
    api.get('/sales/customers'),
    api.get('/sales/routes')
  ])
  links.value = ls.data
  customers.value = cs.data
  routes.value = rs.data
}

async function save() {
  saving.value = true
  try {
    await api.post('/sales/customer-routes', form.value)
    modalOpen.value = false
    form.value = { customer_id: '', route_id: '' }
    await load()
  } catch (e: any) {
    alert(e.response?.data?.detail || 'خطا در ذخیره')
  } finally {
    saving.value = false
  }
}

async function remove(row: any) {
  if (!confirm(`حذف مسیر «${row.route_name}» از مشتری «${row.customer_name}»؟`)) return
  try {
    await api.delete(`/sales/customer-routes/${row.id}`)
    await load()
  } catch (e: any) {
    alert(e.response?.data?.detail || 'خطا در حذف')
  }
}

onMounted(load)
</script>
