import type {
  ApiError,
  AppState,
  CreateAlertRequest,
  CreateAlertResponse,
} from "@ishaara/server/types";

export const SERVER_UNREACHABLE = "Cannot reach the Ishaara server. Check that it is running.";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new Error(SERVER_UNREACHABLE);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(body?.error ?? SERVER_UNREACHABLE);
  }
  return (await response.json()) as T;
}

export function getState(): Promise<AppState> {
  return request<AppState>("/api/state");
}

export function createAlert(body: CreateAlertRequest): Promise<CreateAlertResponse> {
  return request<CreateAlertResponse>("/api/alerts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
