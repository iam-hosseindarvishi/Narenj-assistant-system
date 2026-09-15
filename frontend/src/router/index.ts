import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { getAccessTokenSafe } from '../api/client'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
    {
      path: '/',
      name: 'main-dashboard',
      component: () => import('../views/MainDashboardView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/reconciliation',
      component: () => import('../layouts/AdminLayout.vue'),
      meta: { module: 'reconciliation' },
      children: [
        { path: '', redirect: '/reconciliation/dashboard' },
        { path: 'dashboard', name: 'dashboard', component: () => import('../views/recon/DashboardView.vue') },
        { path: 'import', name: 'import', component: () => import('../views/recon/ImportView.vue') },
        { path: 'layer1', name: 'layer1', component: () => import('../views/recon/Layer1View.vue') },
        { path: 'layer2', name: 'layer2', component: () => import('../views/recon/Layer2View.vue') },
        { path: 'layer3', name: 'layer3', component: () => import('../views/recon/Layer3View.vue') },
        { path: 'layer4', name: 'layer4', component: () => import('../views/recon/Layer4View.vue') },
        { path: 'manual', name: 'manual', component: () => import('../views/recon/ManualMatchingView.vue') },
        { path: 'reports', name: 'reports', component: () => import('../views/recon/ReportsView.vue') },
        { path: 'audit', name: 'audit', component: () => import('../views/recon/AuditView.vue') }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (to.name === 'login') return true
  if (!getAccessTokenSafe()) return { name: 'login' }
  if (!auth.user) await auth.fetchMe()
  if (!auth.user) return { name: 'login' }
  // Module-level permission guard (e.g. only admin/recon-privileged users
  // may enter the reconciliation system — more modules will follow).
  const mod = to.matched.find((r) => r.meta.module)?.meta.module
  if (mod && !auth.hasModule(mod as string)) return { name: 'main-dashboard' }
  return true
})

export default router
