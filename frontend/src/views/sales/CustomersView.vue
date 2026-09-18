<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">لیست مشتریان</h2>
      <button v-if="auth.canEdit" class="btn-primary" @click="openCreate">+ مشتری جدید</button>
    </div>

    <div class="card overflow-x-auto !p-0">
      <table class="table-base">
        <thead>
          <tr>
            <th>کد</th>
            <th>نام</th>
            <th>تلفن</th>
            <th>مسیرهای ویزیت</th>
            <th>وضعیت</th>
            <th v-if="auth.canEdit" class="w-32">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in customers" :key="c.id">
            <td class="font-mono">{{ c.code }}</td>
            <td>{{ c.name }}</td>
            <td dir="ltr" class="text-right">{{ c.phone || '—' }}</td>
            <td>
              <span
                v-for="rid in c.route_ids"
                :key="rid"
                class="badge bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 mr-1"
              >{{ routeName(rid) }}</span>
              <span v-if="!c.route_ids.length" class="text-slate-400">—</span>
              <button
                v-if="auth.canEdit"
                class="text-xs text-narenj-600 dark:text-narenj-400 hover:underline mr-1"
                @click="openAssign(c)"
              >+ مسیر</button>
            </td>
            <td>
              <span class="badge" :class="c.active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'">
                {{ c.active ? 'فعال' : 'غیرفعال' }}
              </span>
            </td>
            <td v-if="auth.canEdit" class="space-x-1 space-x-reverse whitespace-nowrap">
              <button class="btn-secondary !px-2 !py-1 text-xs" @click="openEdit(c)">ویرایش</button>
              <button class="btn-secondary !px-2 !py-1 text-xs text-red-600 dark:text-red-400" @click="remove(c)">حذف</button>
            </td>
          </tr>
          <tr v-if="!customers.length">
            <td colspan="6" class="text-center text-slate-400 py-6">هنوز مشتری ثبت نشده است</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/edit customer modal -->
    <CrudModal
      v-if="modalOpen"
      :title="editing ? 'ویرایش مشتری' : 'مشتری جدید'"
      :saving="saving"
      @close="modalOpen = false"
      @save="save"
    >
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">کد</label>
        <input v-model="form.code" class="input" required />
      </div>
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">نام</label>
        <input v-model="form.name" class="input" required />
      </div>
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">تلفن</label>
        <input v-model="form.phone" class="input" dir="ltr" />
      </div>
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">آدرس</label>
        <textarea v-model="form.address" class="input" rows="2"></textarea>
      </div>
      <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input v-model="form.active" type="checkbox" class="accent-narenj-500" />
        فعال
      </label>
    </CrudModal>

    <!-- Assign-route modal -->
    <CrudModal
      v-if="assignOpen"
      title="نسبت دادن مسیر ویزیت"
      :saving="saving"
      @close="assignOpen = false"
      @save="assign"
    >
      <p class="text-sm text-slate-600 dark:text-slate-300">
        انتخاب مسیر برای مشتری «{{ assigning?.name }}»:
      </p>
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">مسیر</label>
        <select v-model="assignRouteId" class="input" required>
          <option value="" disabled>انتخاب مسیر...</option>
          <option v-for="r in assignableRoutes" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </div>
    </CrudModal>

    <ConfirmModal v-if="confirmOpen" :message="confirmMessage" :busy="confirmBusy" @confirm="doConfirm" @cancel="cancel" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '../../api/client'
import { useAuthStore } from '../../stores/auth'
import CrudModal from '../../components/CrudModal.vue'
import ConfirmModal from '../../components/ConfirmModal.vue'
import { useConfirm } from '../../composables/useConfirm'

const auth = useAuthStore()
const { confirmOpen, confirmMessage, confirmBusy, confirmAction, doConfirm, cancel } = useConfirm()
const customers = ref<any[]>([])
const routes = ref<any[]>([])
const modalOpen = ref(false)
const assignOpen = ref(false)
const saving = ref(false)
const editing = ref<any | null>(null)
const assigning = ref<any | null>(null)
const assignRouteId = ref<number | ''>('')
const form = ref({ code: '', name: '', phone: '', address: '', active: true })

const assignableRoutes = computed(() =>
  routes.value.filter((r) => !assigning.value?.route_ids.includes(r.id))
)

function routeName(id: number): string {
  return routes.value.find((r) => r.id === id)?.name || `#${id}`
}

async function load() {
  const [cs, rs] = await Promise.all([api.get('/sales/customers'), api.get('/sales/routes')])
  customers.value = cs.data
  routes.value = rs.data
}

function openCreate() {
  editing.value = null
  form.value = { code: '', name: '', phone: '', address: '', active: true }
  modalOpen.value = true
}

function openEdit(c: any) {
  editing.value = c
  form.value = { code: c.code, name: c.name, phone: c.phone || '', address: c.address || '', active: c.active }
  modalOpen.value = true
}

async function save() {
  saving.value = true
  try {
    if (editing.value) {
      await api.put(`/sales/customers/${editing.value.id}`, form.value)
    } else {
      await api.post('/sales/customers', form.value)
    }
    modalOpen.value = false
    await load()
  } catch (e: any) {
    alert(e.response?.data?.detail || 'خطا در ذخیره')
  } finally {
    saving.value = false
  }
}

function openAssign(c: any) {
  assigning.value = c
  assignRouteId.value = ''
  assignOpen.value = true
}

async function assign() {
  if (!assignRouteId.value) {
    alert('مسیر را انتخاب کنید')
    return
  }
  saving.value = true
  try {
    await api.post('/sales/customer-routes', {
      customer_id: assigning.value.id,
      route_id: assignRouteId.value
    })
    assignOpen.value = false
    await load()
  } catch (e: any) {
    alert(e.response?.data?.detail || 'خطا در نسبت دادن مسیر')
  } finally {
    saving.value = false
  }
}

function remove(c: any) {
  confirmAction(`حذف مشتری «${c.name}»؟ مسیرها و ارتباط‌های او هم حذف می‌شود.`, async () => {
    await api.delete(`/sales/customers/${c.id}`)
    await load()
  })
}

onMounted(load)
</script>
