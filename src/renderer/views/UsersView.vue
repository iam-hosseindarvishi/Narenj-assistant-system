<template>
  <v-container fluid dir="rtl">
    <v-alert v-if="!auth.isAdmin" type="warning" variant="tonal">این بخش فقط برای کاربر با نقش «مدیر» قابل مشاهده است.</v-alert>
    <template v-else>
      <v-card>
        <v-card-title class="d-flex align-center">
          مدیریت کاربران
          <v-spacer />
          <v-btn color="primary" @click="openCreate">کاربر جدید</v-btn>
        </v-card-title>
        <v-card-text>
          <v-table density="compact">
            <thead>
              <tr>
                <th class="text-right">نام کاربری</th>
                <th class="text-right">نقش</th>
                <th class="text-right">تاریخ ایجاد</th>
                <th class="text-right">عملیات</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id">
                <td>{{ user.username }}</td>
                <td><v-chip size="small" :color="roleColor(user.role)">{{ roleLabel(user.role) }}</v-chip></td>
                <td>{{ user.createdAt }}</td>
                <td>
                  <v-btn size="x-small" color="primary" variant="tonal" class="ml-1" @click="openEditRole(user)">تغییر نقش</v-btn>
                  <v-btn size="x-small" color="warning" variant="tonal" class="ml-1" @click="openResetPassword(user)">تغییر رمز</v-btn>
                  <v-btn size="x-small" color="error" variant="tonal" :disabled="user.id === auth.user?.id" @click="askRemove(user)">حذف</v-btn>
                </td>
              </tr>
              <tr v-if="users.length === 0">
                <td colspan="4" class="text-center text-medium-emphasis py-4">کاربری وجود ندارد</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>

      <v-dialog v-model="createDialog" max-width="480">
        <v-card>
          <v-card-title>ایجاد کاربر</v-card-title>
          <v-card-text>
            <v-text-field v-model="createForm.username" label="نام کاربری" />
            <v-text-field v-model="createForm.password" label="رمز عبور" type="password" />
            <v-select v-model="createForm.role" :items="roleItems" item-title="title" item-value="value" label="نقش" />
            <v-alert v-if="dialogError" type="error">{{ dialogError }}</v-alert>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn text="انصراف" @click="createDialog = false" />
            <v-btn color="primary" :loading="saving" @click="create">ذخیره</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="roleDialog" max-width="420">
        <v-card>
          <v-card-title>تغییر نقش {{ roleForm.username }}</v-card-title>
          <v-card-text>
            <v-select v-model="roleForm.role" :items="roleItems" item-title="title" item-value="value" label="نقش" />
            <v-alert v-if="dialogError" type="error">{{ dialogError }}</v-alert>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn text="انصراف" @click="roleDialog = false" />
            <v-btn color="primary" :loading="saving" @click="updateRole">ذخیره</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="passwordDialog" max-width="420">
        <v-card>
          <v-card-title>تغییر رمز عبور {{ passwordForm.username }}</v-card-title>
          <v-card-text>
            <v-text-field v-model="passwordForm.password" label="رمز عبور جدید" type="password" />
            <v-alert v-if="dialogError" type="error">{{ dialogError }}</v-alert>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn text="انصراف" @click="passwordDialog = false" />
            <v-btn color="primary" :loading="saving" @click="resetPassword">ذخیره</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="removeDialog" max-width="420">
        <v-card>
          <v-card-title>حذف کاربر</v-card-title>
          <v-card-text>آیا از حذف کاربر «{{ removeTarget?.username }}» مطمئن هستید؟</v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn text="انصراف" @click="removeDialog = false" />
            <v-btn color="error" :loading="saving" @click="remove">حذف</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">{{ snackbar.text }}</v-snackbar>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '../stores/auth'

interface UserRow { id: number; username: string; role: string; createdAt: string }

const auth = useAuthStore()
const users = ref<UserRow[]>([])
const saving = ref(false)
const dialogError = ref('')
const createDialog = ref(false)
const roleDialog = ref(false)
const passwordDialog = ref(false)
const removeDialog = ref(false)
const removeTarget = ref<UserRow | null>(null)
const roleItems = [
  { title: 'مدیر', value: 'admin' },
  { title: 'اپراتور', value: 'operator' },
  { title: 'مشاهده‌گر', value: 'viewer' }
]

const createForm = reactive({ username: '', password: '', role: 'operator' })
const roleForm = reactive({ id: 0, username: '', role: 'operator' })
const passwordForm = reactive({ id: 0, username: '', password: '' })
const snackbar = reactive({ show: false, text: '', color: 'success' })

function roleLabel(role: string): string {
  const item = roleItems.find(r => r.value === role)
  return item ? item.title : role
}

function roleColor(role: string): string {
  if (role === 'admin') return 'error'
  if (role === 'operator') return 'primary'
  return 'grey'
}

function notify(text: string, color = 'success'): void {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

async function load(): Promise<void> {
  try { users.value = await window.api.users.list() } catch (err) { notify(String(err), 'error') }
}

function openCreate(): void {
  createForm.username = ''
  createForm.password = ''
  createForm.role = 'operator'
  dialogError.value = ''
  createDialog.value = true
}

function openEditRole(user: UserRow): void {
  roleForm.id = user.id
  roleForm.username = user.username
  roleForm.role = user.role
  dialogError.value = ''
  roleDialog.value = true
}

function openResetPassword(user: UserRow): void {
  passwordForm.id = user.id
  passwordForm.username = user.username
  passwordForm.password = ''
  dialogError.value = ''
  passwordDialog.value = true
}

function askRemove(user: UserRow): void {
  removeTarget.value = user
  removeDialog.value = true
}

async function create(): Promise<void> {
  if (createForm.username.length === 0 || createForm.password.length === 0) {
    dialogError.value = 'نام کاربری و رمز عبور الزامی است'
    return
  }
  saving.value = true
  dialogError.value = ''
  try {
    await window.api.users.create(createForm.username, createForm.password, createForm.role)
    createDialog.value = false
    notify('کاربر ایجاد شد')
    await load()
  } catch (err) { dialogError.value = String(err) }
  saving.value = false
}

async function updateRole(): Promise<void> {
  saving.value = true
  dialogError.value = ''
  try {
    await window.api.users.update(roleForm.id, roleForm.role)
    roleDialog.value = false
    notify('نقش کاربر تغییر یافت')
    await load()
  } catch (err) { dialogError.value = String(err) }
  saving.value = false
}

async function resetPassword(): Promise<void> {
  if (passwordForm.password.length === 0) {
    dialogError.value = 'رمز عبور جدید را وارد کنید'
    return
  }
  saving.value = true
  dialogError.value = ''
  try {
    await window.api.users.resetPassword(passwordForm.id, passwordForm.password)
    passwordDialog.value = false
    notify('رمز عبور تغییر یافت')
  } catch (err) { dialogError.value = String(err) }
  saving.value = false
}

async function remove(): Promise<void> {
  if (!removeTarget.value) return
  saving.value = true
  try {
    await window.api.users.remove(removeTarget.value.id)
    removeDialog.value = false
    notify('کاربر حذف شد')
    await load()
  } catch (err) { notify(String(err), 'error') }
  saving.value = false
}

onMounted(() => { if (auth.isAdmin) void load() })
</script>
