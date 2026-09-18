import { ref } from 'vue'

/** Shared state for the delete-confirmation dialog (one at a time). */
const confirmOpen = ref(false)
const confirmMessage = ref('')
const confirmBusy = ref(false)
let action: (() => Promise<void>) | null = null

export function useConfirm() {
  function confirmAction(message: string, run: () => Promise<void>) {
    confirmMessage.value = message
    action = run
    confirmOpen.value = true
  }

  async function doConfirm() {
    if (!action) return
    confirmBusy.value = true
    try {
      await action()
      confirmOpen.value = false
      action = null
    } catch (e: any) {
      alert(e.response?.data?.detail || 'خطا در حذف')
    } finally {
      confirmBusy.value = false
    }
  }

  function cancel() {
    confirmOpen.value = false
    action = null
  }

  return { confirmOpen, confirmMessage, confirmBusy, confirmAction, doConfirm, cancel }
}
