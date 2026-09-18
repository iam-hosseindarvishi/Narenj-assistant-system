<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">ارتباط گروه کالا با ویزیتور</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          به‌صورت پیش‌فرض همه ویزیتورها همه گروه‌ها را می‌فروشند؛ با ثبت قاعده، فقط ویزیتور تعیین‌شده حق فروش آن گروه در آن مسیر را دارد.
        </p>
      </div>
      <button v-if="auth.canEdit" class="btn-primary" @click="modalOpen = true">+ قاعده جدید</button>
    </div>

    <div class="card overflow-x-auto !p-0">
      <table class="table-base">
        <thead>
          <tr>
            <th>مسیر</th>
            <th>گروه کالا</th>
            <th>ویزیتور دارای حق فروش</th>
            <th v-if="auth.canEdit" class="w-20">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rules" :key="row.id">
            <td>{{ row.route_name }}</td>
            <td>{{ row.group_name }}</td>
            <td>{{ row.visitor_name }}</td>
            <td v-if="auth.canEdit">
              <button class="btn-secondary !px-2 !py-1 text-xs text-red-600 dark:text-red-400" @click="remove(row)">حذف</button>
            </td>
          </tr>
          <tr v-if="!rules.length">
            <td :colspan="auth.canEdit ? 4 : 3" class="text-center text-slate-400 py-6">
              قاعده‌ای ثبت نشده — همه ویزیتورها آزادند
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <CrudModal v-if="modalOpen" title="قاعده جدید" :saving="saving" @close="modalOpen = false" @save="save">
      <p class="text-xs text-slate-500 dark:text-slate-400">
        «در مسیر انتخابی، فقط این ویزیتور حق فروش این گروه کالا را دارد.»
      </p>
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">مسیر</label>
        <select v-model="form.route_id" class="input" required>
          <option value="" disabled>انتخاب مسیر...</option>
          <option v-for="r in routes" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </div>
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">گروه کالا</label>
        <select v-model="form.group_id" class="input" required>
          <option value="" disabled>انتخاب گروه...</option>
          <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
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
const rules = ref<any[]>([])
const routes = ref<any[]>([])
const groups = ref<any[]>([])
const visitors = ref<any[]>([])
const modalOpen = ref(false)
const saving = ref(false)
const form = ref({ route_id: '' as number | '', group_id: '' as number | '', visitor_id: '' as number | '' })

async function load() {
  const [rs, rts, gs, vs] = await Promise.all([
    api.get('/sales/group-rules'),
    api.get('/sales/routes'),
    api.get('/sales/groups'),
    api.get('/sales/visitors')
  ])
  rules.value = rs.data
  routes.value = rts.data
  groups.value = gs.data
  visitors.value = vs.data
}

async function save() {
  saving.value = true
  try {
    await api.post('/sales/group-rules', form.value)
    modalOpen.value = false
    form.value = { route_id: '', group_id: '', visitor_id: '' }
    await load()
  } catch (e: any) {
    alert(e.response?.data?.detail || 'خطا در ذخیره')
  } finally {
    saving.value = false
  }
}

function remove(row: any) {
  confirmAction(`حذف قاعده «${row.group_name}» در «${row.route_name}» برای «${row.visitor_name}»؟`, async () => {
    await api.delete(`/sales/group-rules/${row.id}`)
    await load()
  })
}

onMounted(load)
</script>
