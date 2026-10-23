const CLIENT_ID_KEY = "ibm.clientId";

const envClientId = (
  import.meta.env.VITE_IBROADCAST_CLIENT_ID as string | undefined
)?.trim();

export function getStoredClientId(): string {
  try {
    return localStorage.getItem(CLIENT_ID_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function saveClientId(clientId: string): void {
  const trimmed = clientId.trim();
  if (!trimmed) {
    localStorage.removeItem(CLIENT_ID_KEY);
    return;
  }
  localStorage.setItem(CLIENT_ID_KEY, trimmed);
}

export function resolveClientId(): string {
  return envClientId || getStoredClientId();
}

export function hasEnvClientId(): boolean {
  return Boolean(envClientId);
}

export function getRedirectUri(): string {
  const url = new URL("/callback", window.location.origin);
  return url.toString().replace(/\/$/, "");
}

export function isCallbackRoute(): boolean {
  return window.location.pathname.replace(/\/+$/, "") === "/callback";
}
