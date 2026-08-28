import { Capacitor } from '@capacitor/core'
import { apiFetch } from './api'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export async function requestPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const result = await PushNotifications.requestPermissions()
      return result.receive === 'granted'
    } catch {
      return false
    }
  }
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export async function registerPushNotifications(): Promise<void> {
  const granted = await requestPermission()
  if (!granted) return

  if (Capacitor.isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      await PushNotifications.register()
      PushNotifications.addListener('registration', async ({ value: token }) => {
        try {
          await apiFetch('/api/push/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, platform: 'fcm' }),
          })
        } catch { /* ignore */ }
      })
    } catch { /* @capacitor/push-notifications not installed */ }
    return
  }

  // Web push via VAPID
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  try {
    const keyRes = await apiFetch('/api/push/vapid-public-key')
    if (!keyRes.ok) return
    const { publicKey } = await keyRes.json()
    if (!publicKey) return

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    }
    await apiFetch('/api/push/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: sub.endpoint,
        platform: 'webpush',
        subscription: JSON.stringify(sub.toJSON()),
      }),
    })
  } catch { /* push not supported or denied */ }
}
