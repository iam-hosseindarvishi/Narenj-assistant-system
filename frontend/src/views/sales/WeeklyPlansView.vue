<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">برنامه هفتگی ویزیت</h2>
      <button v-if="auth.canEdit" class="btn-primary" @click="openPlan(null)">+ برنامه‌ریزی ویزیتور</button>
    </div>

    <div class="card overflow-x-auto !p-0">
      <table class="table-base">
        <thead>
          <tr>
            <th>ویزیتور</th>
            <th v-for="(d, i) in WEEKDAYS" :key="i">{{ d }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableRows" :key="row.visitor_id">
            <td class="font-semibold whitespace-nowrap">
              {{ row.visitor_name }}
              <button
                v-if="auth.canEdit"
                class="text-xs text-narenj-600 dark:text-narenj-400 hover:underline mr-1"
                @click="openPlan(plans.find((p) => p.visitor_id === row.visitor_id))"
              >ویرایش</button>
            </td>
            <td v-for="(d, i) in WEEKDAYS" :key="i" class="align-top">
              <span
                v-for="cell in row.cells[i]"
                :key="cell.route_id"
                class="badge bg-narenj-100 text-narenj-700 dark:bg-narenj-900/40 dark:text-narenj-300 mr-1 mb-1 inline-block"
              >{{ cell.route_name }}</span>
            </td>
          </tr>
          <tr v-if="!tableRows.length">
            <td :colspan="8" class="text-center text-slate-400 py-6">برنامه‌ای ثبت نشده است</td>
          </tr>
        </tbody>
      </table>
    </div>

    <CrudModal
      v-if="modalOpen"
      :title="editingVisitor ? `ویرایش برنامه ${editingVisitor.visitor_name}` : 'برنامه‌ریزی هفتگی ویزیتور'"
      :saving="saving"
      @close="modalOpen = false"
      @save="save"
    >
      <div>
        <label class="block text-sm text-slate-600 dark:text-slate-300 mb-1">ویزیتور</label>
        <select v-model="selectedVisitor" class="input" :disabled="!!editingVisitor" required>
          <option value="" disabled>انتخاب ویزیتور...</option>
          <option v-for="v in visitors" :key="v.id" :value="v.id">{{ v.full_name }} ({{ v.code }})</option>
        </select>
      </div>
      <div class="space-y-2">
        <div class="text-sm text-slate-600 dark:text-slate-300">مسیر هر روز (می‌توانید هر روز چند مسیر انتخاب کنید):</div>
        <div v-for="(d, i) in WEEKDAYS" :key="i" class="flex items-center gap-2">
          <span class="w-20 text-sm text-slate-600 dark:text-slate-300">{{ d }}:</span>
          <div class="flex flex-wrap gap-1.5 flex-1">
            <button
              v-for="r in routes"
              :key="r.id"
              type="button"
              class="badge border transition-colors"
              :class="daySelection[i].includes(r.id)
                ? 'bg-narenj-500 text-white border-narenj-500'
                : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-600'"
              @click="toggleRoute(i, r.id)"
            >{{ r.name }}</button>
          </div>
        </div>
      </div>
    </CrudModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '../../api/client'
import { useAuthStore } from '../../stores/auth'
import CrudModal from '../../components/CrudModal.vue'

const auth = useAuthStore()
const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']

const visitors = ref<any[]>([])
const routes = ref<any[]>([])
const plans = ref<any[]>([])
const modalOpen = ref(false)
const saving = ref(false)
const editingVisitor = ref<any | null>(null)
const selectedVisitor = ref<number | ''>('')
const daySelection = ref<number[][]>(WEEKDAYS.map(() => []))

const tableRows = computed(() =>
  plans.value.map((p) => {
    const cells: { route_id: number; route_name: string }[][] = WEEKDAYS.map(() => [])
    for (const day of p.days) cells[day.weekday].push({ route_id: day.route_id, route_name: day.route_name })
    return { visitor_id: p.visitor_id, visitor_name: `${p.visitor_name} (${p.visitor_code})`, cells }
  })
)

async function load() {
  const [vs, rs, ps] = await Promise.all([
    api.get('/sales/visitors'),
    api.get('/sales/routes'),
    api.get('/sales/weekly-plans')
  ])
  visitors.value = vs.data
  routes.value = rs.data
  plans.value = ps.data
}

function openPlan(plan: any | null) {
  editingVisitor.value = plan
  selectedVisitor.value = plan ? plan.visitor_id : ''
  daySelection.value = WEEKDAYS.map((_, i) =>
    plan ? plan.days.filter((d: any) => d.weekday === i).map((d: any) => d.route_id) : []
  )
  modalOpen.value = true
}

function toggleRoute(weekday: number, routeId: number) {
  const list = daySelection.value[weekday]
  const idx = list.indexOf(routeId)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(routeId)
}

async function save() {
  if (!selectedVisitor.value) {
    alert('ویزیتور را انتخاب کنید')
    return
  }
  const items = daySelection.value.flatMap((routeIds, weekday) =>
    routeIds.map((route_id) => ({ weekday, route_id }))
  )
  if (!items.length) {
    alert('حداقل یک روز/مسیر انتخاب کنید')
    return
  }
  saving.value = true
  try {
    await api.post('/sales/weekly-plans', { visitor_id: selectedVisitor.value, items })
    modalOpen.value = false
    await load()
  } catch (e: any) {
    alert(e.response?.data?.detail || 'خطا در ذخیره')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
