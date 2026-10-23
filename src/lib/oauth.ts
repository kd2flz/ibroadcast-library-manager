import type {
  DeviceCodeResponse,
  OAuthTransaction,
  TokenResponse,
  TokenSet,
} from "./types";

export const OAUTH_BASE = "https://oauth.ibroadcast.com";
export const OAUTH_SCOPES = ["user.library:read", "user.library:write"];

const TRANSACTION_KEY = "ibm.oauth.transaction";
const TRANSACTION_TTL_MS = 15 * 60 * 1000;

export class OAuthError extends Error {
  code: string;
  description: string;

  constructor(code: string, description: string) {
    super(description || code);
    this.name = "OAuthError";
    this.code = code;
    this.description = description;
  }
}

function parseOAuthError(payload: unknown, fallback: string): OAuthError {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const code = typeof record.error === "string" ? record.error : fallback;
    const description =
      typeof record.error_description === "string"
        ? record.error_description
        : typeof record.message === "string"
          ? record.message
          : fallback;
    return new OAuthError(code, description);
  }
  return new OAuthError(fallback, fallback);
}

function isOAuthErrorPayload(payload: unknown): boolean {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      typeof (payload as Record<string, unknown>).error === "string",
  );
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function buildAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    state: input.state,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
    scope: OAUTH_SCOPES.join(" "),
    redirect_uri: input.redirectUri,
  });
  return `${OAUTH_BASE}/authorize?${params.toString()}`;
}

export function storeOAuthTransaction(transaction: OAuthTransaction): void {
  sessionStorage.setItem(TRANSACTION_KEY, JSON.stringify(transaction));
}

export function readOAuthTransaction(): OAuthTransaction | null {
  const raw = sessionStorage.getItem(TRANSACTION_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<OAuthTransaction>;
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.verifier !== "string" ||
      typeof parsed.redirectUri !== "string" ||
      typeof parsed.clientId !== "string" ||
      typeof parsed.createdAt !== "number"
    ) {
      clearOAuthTransaction();
      return null;
    }
    if (Date.now() - parsed.createdAt > TRANSACTION_TTL_MS) {
      clearOAuthTransaction();
      return null;
    }
    return parsed as OAuthTransaction;
  } catch {
    clearOAuthTransaction();
    return null;
  }
}

export function clearOAuthTransaction(): void {
  sessionStorage.removeItem(TRANSACTION_KEY);
}

function toTokenSet(payload: TokenResponse): TokenSet {
  if (!payload.access_token) {
    throw new OAuthError("invalid_token", "The token response was missing an access token.");
  }
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: Date.now() + (payload.expires_in ?? 3600) * 1000,
    scope: payload.scope?.split(" ").filter(Boolean),
  };
}

export async function exchangeAuthorizationCode(input: {
  clientId: string;
  code: string;
  redirectUri: string;
  verifier: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: input.clientId,
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.verifier,
  });

  const response = await fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await readJson(response);

  if (!response.ok || isOAuthErrorPayload(payload)) {
    throw parseOAuthError(payload, `Token request failed (${response.status}).`);
  }
  return toTokenSet(payload as TokenResponse);
}

export async function refreshAccessToken(input: {
  clientId: string;
  refreshToken: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: input.clientId,
    refresh_token: input.refreshToken,
  });

  const response = await fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await readJson(response);

  if (!response.ok || isOAuthErrorPayload(payload)) {
    throw parseOAuthError(payload, "Your session expired. Connect iBroadcast again.");
  }
  const tokens = toTokenSet(payload as TokenResponse);
  tokens.refresh_token ??= input.refreshToken;
  return tokens;
}

export async function revokeToken(input: {
  clientId: string;
  refreshToken: string;
}): Promise<void> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    refresh_token: input.refreshToken,
  });

  const response = await fetch(`${OAUTH_BASE}/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const payload = await readJson(response);
    throw parseOAuthError(payload, "Could not revoke the iBroadcast session.");
  }
}

export async function requestDeviceCode(clientId: string): Promise<DeviceCodeResponse> {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: OAUTH_SCOPES.join(" "),
  });
  const response = await fetch(`${OAUTH_BASE}/device/code?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  const payload = await readJson(response);

  if (!response.ok || isOAuthErrorPayload(payload)) {
    throw parseOAuthError(payload, `Device code request failed (${response.status}).`);
  }
  const data = payload as Partial<DeviceCodeResponse>;
  if (
    typeof data.device_code !== "string" ||
    typeof data.user_code !== "string" ||
    typeof data.verification_uri !== "string"
  ) {
    throw new OAuthError("invalid_response", "iBroadcast returned an incomplete device code.");
  }
  return data as DeviceCodeResponse;
}

export async function pollDeviceToken(input: {
  clientId: string;
  deviceCode: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "device_code",
    client_id: input.clientId,
    device_code: input.deviceCode,
  });

  const response = await fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await readJson(response);

  if (!response.ok || isOAuthErrorPayload(payload)) {
    throw parseOAuthError(payload, "Waiting for iBroadcast authorization.");
  }
  return toTokenSet(payload as TokenResponse);
}
