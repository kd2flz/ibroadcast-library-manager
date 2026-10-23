import type { RawLibrary } from "./types";

export const API_BASE = "https://api.ibroadcast.com";
export const LIBRARY_URL = "https://library.ibroadcast.com";
export const APP_CLIENT = "ibroadcast-library-manager";
export const APP_VERSION = "1.0.0";
export const DEVICE_NAME = "Library Manager (Web)";

export class ApiError extends Error {
  authenticated: boolean;
  code: string;

  constructor(message: string, options?: { authenticated?: boolean; code?: string }) {
    super(message);
    this.name = "ApiError";
    this.authenticated = options?.authenticated ?? true;
    this.code = options?.code ?? "api_error";
  }
}

function baseBody(mode: string): Record<string, unknown> {
  return {
    client: APP_CLIENT,
    version: APP_VERSION,
    device_name: DEVICE_NAME,
    user_agent: `${APP_CLIENT}/${APP_VERSION}`,
    mode,
  };
}

async function readPayload(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : { message: text };
  } catch {
    return { message: text };
  }
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
  accessToken: string,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": `${APP_CLIENT}/${APP_VERSION}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "Could not reach iBroadcast. Check your connection and try again.",
      { code: "network_error" },
    );
  }

  const payload = await readPayload(response);
  const authenticated = payload.authenticated !== false;
  const result = payload.result;

  if (!response.ok || result === false || authenticated === false) {
    const message =
      typeof payload.message === "string" && payload.message.trim()
        ? payload.message
        : `iBroadcast request failed (${response.status}).`;
    throw new ApiError(message, {
      authenticated,
      code: authenticated ? "request_failed" : "authentication_failed",
    });
  }

  return payload;
}

async function apiMode(
  mode: string,
  accessToken: string,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return postJson(
    `${API_BASE}/${mode}`,
    { ...baseBody(mode), ...extra },
    accessToken,
  );
}

export async function fetchStatus(
  accessToken: string,
): Promise<Record<string, unknown>> {
  return apiMode("status", accessToken);
}

export async function fetchLibrary(
  accessToken: string,
): Promise<RawLibrary> {
  const payload = await postJson(
    LIBRARY_URL,
    baseBody("library"),
    accessToken,
  );
  const library = payload.library;
  if (!library || typeof library !== "object") {
    throw new ApiError("iBroadcast returned an empty library.");
  }
  return library as RawLibrary;
}

export async function trashTracks(
  trackIds: string[],
  accessToken: string,
): Promise<void> {
  await apiMode("trash", accessToken, { tracks: trackIds });
}

export async function emptyTrash(
  trackIds: string[],
  accessToken: string,
): Promise<void> {
  await apiMode("empty_trash", accessToken, { tracks: trackIds });
}

export async function restoreTracks(
  trackIds: string[],
  accessToken: string,
): Promise<void> {
  await apiMode("restore", accessToken, { tracks: trackIds });
}
