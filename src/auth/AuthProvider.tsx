import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  fetchLibrary,
  fetchStatus,
} from "../lib/api";
import {
  getRedirectUri,
  hasEnvClientId,
  resolveClientId,
  saveClientId,
} from "../lib/config";
import { parseLibrary } from "../lib/library";
import {
  buildAuthorizeUrl,
  clearOAuthTransaction,
  exchangeAuthorizationCode,
  OAuthError,
  pollDeviceToken,
  readOAuthTransaction,
  requestDeviceCode,
  revokeToken,
  storeOAuthTransaction,
} from "../lib/oauth";
import { createPkcePair, randomUrlSafe } from "../lib/pkce";
import {
  clearTokens,
  readTokens,
  SessionExpiredError,
  withAccessToken,
  writeTokens,
} from "../lib/token-store";
import type { DeviceFlowState, LibraryData, Usage } from "../lib/types";
import { estimatedUsage, parseUsage } from "../lib/usage";
import {
  AuthContext,
  type AuthContextValue,
  type AuthPhase,
} from "./auth-context";

function messageForError(error: unknown): string {
  if (
    error instanceof OAuthError ||
    error instanceof SessionExpiredError ||
    error instanceof Error
  ) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<AuthPhase>("booting");
  const [clientId, setClientId] = useState<string>(() => resolveClientId());
  const [usage, setUsage] = useState<Usage | null>(null);
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceFlowState | null>(null);

  const bootedRef = useRef(false);
  const deviceAbortRef = useRef<AbortController | null>(null);
  const redirectUri = useMemo(() => getRedirectUri(), []);
  const usingEnvClientId = hasEnvClientId();

  const loadSession = useCallback(async () => {
    if (!readTokens()) {
      setPhase("signed_out");
      setLibrary(null);
      setUsage(null);
      return;
    }

    setPhase("signed_in");
    setBusyMessage("Loading your iBroadcast library…");
    try {
      const status = await withAccessToken(clientId, fetchStatus);
      const rawLibrary = await withAccessToken(clientId, fetchLibrary);
      const parsed = parseLibrary(rawLibrary);
      setUsage(parseUsage(status) ?? estimatedUsage(parsed));
      setLibrary(parsed);
      setLastSynced(new Date());
      setError(null);
      setDevice(null);
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        clearTokens();
        setPhase("signed_out");
        setLibrary(null);
        setUsage(null);
        setLastSynced(null);
      }
      setError(messageForError(caught));
    } finally {
      setBusyMessage(null);
    }
  }, [clientId]);

  useEffect(() => {
    if (bootedRef.current) {
      return;
    }
    bootedRef.current = true;
    void loadSession();
  }, [loadSession]);

  const connect = useCallback(async () => {
    setError(null);
    const activeClientId = resolveClientId();
    if (!activeClientId) {
      setError("Add your iBroadcast client ID before connecting.");
      return;
    }

    try {
      const { verifier, challenge } = await createPkcePair();
      const state = randomUrlSafe(48);
      storeOAuthTransaction({
        state,
        verifier,
        redirectUri,
        clientId: activeClientId,
        createdAt: Date.now(),
      });
      window.location.assign(
        buildAuthorizeUrl({
          clientId: activeClientId,
          redirectUri,
          state,
          challenge,
        }),
      );
    } catch (caught) {
      setError(messageForError(caught));
    }
  }, [redirectUri]);

  const completeCallback = useCallback(
    async (code: string, state: string) => {
      const transaction = readOAuthTransaction();
      if (!transaction) {
        setPhase("signed_out");
        setError(
          "This sign-in link expired or belongs to another tab. Start the connection again.",
        );
        return false;
      }
      if (transaction.state !== state) {
        clearOAuthTransaction();
        setPhase("signed_out");
        setError(
          "Security check failed: the OAuth state did not match. Start the connection again.",
        );
        return false;
      }

      setBusyMessage("Finishing sign-in with iBroadcast…");
      try {
        const tokens = await exchangeAuthorizationCode({
          clientId: transaction.clientId,
          code,
          redirectUri: transaction.redirectUri,
          verifier: transaction.verifier,
        });
        clearOAuthTransaction();
        writeTokens(tokens);
        if (clientId !== transaction.clientId) {
          saveClientId(transaction.clientId);
          setClientId(transaction.clientId);
        }
        setPhase("signed_in");
        setError(null);
        setBusyMessage(null);
        await loadSession();
        return true;
      } catch (caught) {
        clearOAuthTransaction();
        setPhase("signed_out");
        setError(messageForError(caught));
        setBusyMessage(null);
        return false;
      }
    },
    [clientId, loadSession],
  );

  const startDeviceFlow = useCallback(async () => {
    setError(null);
    deviceAbortRef.current?.abort();
    const activeClientId = resolveClientId();
    if (!activeClientId) {
      setError("Add your iBroadcast client ID before connecting.");
      return;
    }

    setDevice({ status: "requesting" });

    let response;
    try {
      response = await requestDeviceCode(activeClientId);
    } catch (caught) {
      setDevice({
        status: "error",
        message: messageForError(caught),
      });
      return;
    }

    const controller = new AbortController();
    deviceAbortRef.current = controller;
    const expiresAt = Date.now() + (response.expires_in ?? 600) * 1000;
    setDevice({
      status: "waiting",
      userCode: response.user_code,
      verificationUri: response.verification_uri,
      verificationUriComplete: response.verification_uri_complete,
      expiresAt,
      message: "Waiting for you to approve the code on iBroadcast…",
    });

    void (async () => {
      let intervalMs = Math.max(2, response.interval ?? 5) * 1000;
      try {
        while (!controller.signal.aborted) {
          await sleep(intervalMs, controller.signal);
          if (Date.now() > expiresAt) {
            setDevice((current) =>
              current
                ? {
                    ...current,
                    status: "expired",
                    message: "This code expired. Request a new one.",
                  }
                : current,
            );
            return;
          }

          try {
            const tokens = await pollDeviceToken({
              clientId: activeClientId,
              deviceCode: response.device_code,
            });
            if (controller.signal.aborted) {
              return;
            }
            writeTokens(tokens);
            setDevice((current) =>
              current
                ? {
                    ...current,
                    status: "success",
                    message: "Connected. Loading your library…",
                  }
                : current,
            );
            setPhase("signed_in");
            setError(null);
            await loadSession();
            return;
          } catch (caught) {
            if (!(caught instanceof OAuthError)) {
              throw caught;
            }
            if (caught.code === "authorization_pending") {
              continue;
            }
            if (caught.code === "slow_down") {
              intervalMs += 5_000;
              continue;
            }
            if (caught.code === "expired_token") {
              setDevice((current) =>
                current
                  ? {
                      ...current,
                      status: "expired",
                      message: "This code expired. Request a new one.",
                    }
                  : current,
              );
              return;
            }
            if (caught.code === "access_denied") {
              setDevice((current) =>
                current
                  ? {
                      ...current,
                      status: "denied",
                      message: "The sign-in request was denied on iBroadcast.",
                    }
                  : current,
              );
              return;
            }
            setDevice((current) =>
              current
                ? {
                    ...current,
                    status: "error",
                    message: caught.message,
                  }
                : current,
            );
            return;
          }
        }
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }
        setDevice((current) =>
          current
            ? {
                ...current,
                status: "error",
                message: messageForError(caught),
              }
            : current,
        );
      } finally {
        if (deviceAbortRef.current === controller) {
          deviceAbortRef.current = null;
        }
      }
    })();
  }, [loadSession]);

  const cancelDeviceFlow = useCallback(() => {
    deviceAbortRef.current?.abort();
    deviceAbortRef.current = null;
    setDevice(null);
  }, []);

  const logout = useCallback(async () => {
    deviceAbortRef.current?.abort();
    const tokens = readTokens();
    setBusyMessage("Disconnecting from iBroadcast…");
    if (tokens?.refresh_token) {
      try {
        await revokeToken({
          clientId,
          refreshToken: tokens.refresh_token,
        });
      } catch {
        // Local sign-out still proceeds if revocation is unavailable.
      }
    }
    clearTokens();
    clearOAuthTransaction();
    setLibrary(null);
    setUsage(null);
    setLastSynced(null);
    setDevice(null);
    setError(null);
    setPhase("signed_out");
    setBusyMessage(null);
  }, [clientId]);

  const refresh = useCallback(async () => {
    setError(null);
    await loadSession();
  }, [loadSession]);

  const refreshStatus = useCallback(async () => {
    if (!readTokens()) {
      return;
    }
    try {
      const status = await withAccessToken(clientId, fetchStatus);
      setUsage((current) => {
        const next = parseUsage(status);
        if (next) {
          return next;
        }
        if (library) {
          return current ?? estimatedUsage(library);
        }
        return current;
      });
    } catch {
      // Best effort only.
    }
  }, [clientId, library]);

  const updateClientId = useCallback((nextClientId: string) => {
    const trimmed = nextClientId.trim();
    saveClientId(trimmed);
    setClientId(trimmed);
    clearTokens();
    clearOAuthTransaction();
    setLibrary(null);
    setUsage(null);
    setLastSynced(null);
    setDevice(null);
    setError(null);
    setPhase("signed_out");
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value: AuthContextValue = {
    phase,
    clientId,
    usingEnvClientId,
    redirectUri,
    usage,
    library,
    lastSynced,
    busyMessage,
    error,
    device,
    connect,
    startDeviceFlow,
    cancelDeviceFlow,
    completeCallback,
    logout,
    refresh,
    refreshStatus,
    updateClientId,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
