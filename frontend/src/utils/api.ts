export const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

// Re-export from auth so all files can import apiFetch from one place.
// The auth version handles Bearer token injection + automatic token refresh.
export { apiFetch } from "./auth";
