import { ApiError } from "./api";
import { refreshAccessToken } from "./oauth";
import type { TokenSet } from "./types";

const TOKEN_KEY = "ibm.tokens";
const REFRESH_WINDOW_MS = 60_000;

export class SessionExpiredError extends Error {
  constructor(message = "Your iBroadcast session expired. Please connect again.") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

let memoryTokens: TokenSet | null = null;
let refreshInFlight: Promise<TokenSet> | null = null;

function isTokenSet(value: unknown): value is TokenSet {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.access_token === "string" &&
    typeof record.expires_at === "number"
  );
}

export function readTokens(): TokenSet | null {
  if (memoryTokens) {
    return memoryTokens;
  }
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!isTokenSet(parsed)) {
      clearTokens();
      return null;
    }
    memoryTokens = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function writeTokens(tokens: TokenSet): void {
  memoryTokens = tokens;
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  } catch {
    // Session storage can be unavailable in private modes; memory still works.
  }
}

export function clearTokens(): void {
  memoryTokens = null;
  refreshInFlight = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage failures.
  }
}

async function refreshSession(clientId: string): Promise<TokenSet> {
  if (refreshInFlight) {
    return refreshInFlight;
  }
  const current = readTokens();
  if (!current?.refresh_token) {
    clearTokens();
    throw new SessionExpiredError();
  }

  refreshInFlight = refreshAccessToken({
    clientId,
    refreshToken: current.refresh_token,
  })
    .then((refreshed) => {
      const merged: TokenSet = {
        ...refreshed,
        refresh_token: refreshed.refresh_token ?? current.refresh_token,
      };
      writeTokens(merged);
      return merged;
    })
    .catch((error: unknown) => {
      clearTokens();
      if (error instanceof Error) {
        throw new SessionExpiredError(error.message);
      }
      throw new SessionExpiredError();
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export async function withAccessToken<T>(
  clientId: string,
  request: (accessToken: string) => Promise<T>,
): Promise<T> {
  let tokens = readTokens();
  if (!tokens) {
    throw new SessionExpiredError();
  }

  if (tokens.expires_at <= Date.now() + REFRESH_WINDOW_MS) {
    tokens = await refreshSession(clientId);
  }

  try {
    return await request(tokens.access_token);
  } catch (error) {
    if (error instanceof ApiError && !error.authenticated) {
      tokens = await refreshSession(clientId);
      return request(tokens.access_token);
    }
    throw error;
  }
}
