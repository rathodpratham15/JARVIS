/**
 * Handles images shared to JARVIS from smart glasses (e.g. Meta Ray-Ban).
 *
 * On Android, the system delivers a share intent as an appUrlOpen event via
 * the Capacitor bridge. We listen for it and forward the image to
 * /api/glasses/photo for vision analysis.
 *
 * Usage: call initGlassesShareHandler() once after the app mounts.
 */

import { Capacitor } from "@capacitor/core";
import { apiFetch } from "./api";

export function initGlassesShareHandler(
  onResult?: (result: { description: string; imageUrl: string }) => void
): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};

  // The Capacitor bridge fires 'appUrlOpen' for custom URL schemes and share intents.
  // We hook into the window-level message that Capacitor uses internally.
  const handler = async (event: Event) => {
    const detail = (event as CustomEvent).detail as { url?: string; path?: string } | undefined;
    const rawUrl = detail?.url ?? detail?.path ?? "";

    // Only handle file:// or content:// URIs that look like images
    if (!rawUrl.match(/\.(jpg|jpeg|png|webp|heic|gif)$/i) && !rawUrl.startsWith("content://")) {
      return;
    }

    try {
      const fetchResp = await fetch(rawUrl);
      const blob = await fetchResp.blob();
      const ext = rawUrl.split(".").pop()?.split("?")[0] ?? "jpg";
      const file = new File([blob], `glasses_share.${ext}`, { type: blob.type || "image/jpeg" });

      const form = new FormData();
      form.append("image", file);

      const resp = await apiFetch("/api/glasses/photo", { method: "POST", body: form });
      if (resp.ok) {
        const data = await resp.json();
        onResult?.({
          description: data.results?.description ?? "",
          imageUrl: data.image_url ?? "",
        });
      }
    } catch {
      // Share handling is best-effort; silently ignore errors
    }
  };

  window.addEventListener("capacitorAppUrlOpen", handler);
  return () => window.removeEventListener("capacitorAppUrlOpen", handler);
}
