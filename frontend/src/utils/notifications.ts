export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function showBrowserNotification(
  title: string,
  body: string,
  tag?: string,
  onClick?: () => void,
) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const n = new Notification(title, {
    body,
    tag,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
  });
  if (onClick) n.onclick = () => { onClick(); n.close(); };
  setTimeout(() => n.close(), 10_000);
}
