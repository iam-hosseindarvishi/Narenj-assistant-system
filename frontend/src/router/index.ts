import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
    {
      path: '/',
      component: () => import('../layouts/AdminLayout.vue'),
      children: [
        { path: '', redirect: '/reconciliation/dashboard' },
        { path: 'reconciliation/dashboard', name: 'dashboard', component: () => import('../views/recon/DashboardView.vue') },
        { path: 'reconciliation/import', name: 'import', component: () => import('../views/recon/ImportView.vue') },
        { path: 'reconciliation/layer1', name: 'layer1', component: () => import('../views/recon/Layer1View.vue') },
        { path: 'reconciliation/layer2', name: 'layer2', component: () => import('../views/recon/Layer2View.vue') },
        { path: 'reconciliation/layer3', name: 'layer3', component: () => import('../views/recon/Layer3View.vue') },
        { path: 'reconciliation/layer4', name: 'layer4', component: () => import('../views/recon/Layer4View.vue') },
        { path: 'reconciliation/manual', name: 'manual', component: () => import('../views/recon/ManualMatchingView.vue') },
        { path: 'reconciliation/reports', name: 'reports', component: () => import('../views/recon/ReportsView.vue') },
        { path: 'reconciliation/audit', name: 'audit', component: () => import('../views/recon/AuditView.vue') }
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
  return true
})

function getAccessTokenSafe(): string | null {
  try {
    return localStorage.getItem('narenj_access')
  } catch {
    return null
  }
}

export default router
