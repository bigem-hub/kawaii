const API_URL = import.meta.env.VITE_API_URL || "/api";

export interface ApiError extends Error {
  status?: number;
}

export async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    // Network-level failure (offline, DNS, CORS, serverless cold boot timeout)
    const error = new Error("Network error — check your connection and try again.") as ApiError;
    error.status = 0;
    throw error;
  }

  if (res.status === 401) {
    // Clear invalid session
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("auth:logout"));
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data?.error || "Something went wrong") as ApiError;
    error.status = res.status;
    throw error;
  }

  return data as T;
}

/**
 * Best-effort human-readable message from a thrown error, for toast() calls.
 */
export function errMessage(e: unknown): string {
  if (e instanceof Error && e.message && e.message !== "Failed to fetch") {
    return e.message;
  }
  if (e && typeof e === "object" && "message" in e && (e as any).message) {
    return String((e as any).message);
  }
  return "Something went wrong. Please try again.";
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: any) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: any) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: any) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
