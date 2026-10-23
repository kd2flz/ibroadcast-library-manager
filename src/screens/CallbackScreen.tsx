import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/auth-context";
import { LogoMark, ShieldIcon } from "../components/Icons";
import { Notice } from "../components/Notice";
import { clearOAuthTransaction } from "../lib/oauth";
import { readTokens } from "../lib/token-store";

export function CallbackScreen({
  onNavigateHome,
}: {
  onNavigateHome: () => void;
}) {
  const { completeCallback, error, busyMessage } = useAuth();
  const [localError, setLocalError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    if (readTokens()) {
      onNavigateHome();
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    if (oauthError) {
      clearOAuthTransaction();
      const description = params.get("error_description");
      const message = description
        ? `${oauthError}: ${description}`
        : oauthError;
      queueMicrotask(() => setLocalError(message));
      return;
    }

    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) {
      queueMicrotask(() =>
        setLocalError(
          "iBroadcast did not return an authorization code. Start the connection again.",
        ),
      );
      return;
    }

    void completeCallback(code, state).then((success) => {
      if (success) {
        onNavigateHome();
      }
    });
  }, [completeCallback, onNavigateHome]);

  const message = localError ?? error;

  return (
    <div className="callback-shell">
      <div className="callback-card">
        <div className="brand callback-brand">
          <LogoMark size={40} />
          <div>
            <span className="brand-name">Library Manager</span>
            <span className="brand-sub">for iBroadcast</span>
          </div>
        </div>

        {message ? (
          <>
            <h1>Sign-in did not finish</h1>
            <Notice tone="error">{message}</Notice>
            <p className="callback-help">
              No library changes were made. Return to the connect screen to try
              again.
            </p>
            <button
              type="button"
              className="button button-primary button-block"
              onClick={onNavigateHome}
            >
              Back to connect
            </button>
          </>
        ) : (
          <>
            <div className="callback-spinner">
              <span className="spinner spinner-large" />
            </div>
            <h1>Finishing sign-in</h1>
            <p className="callback-help" role="status">
              {busyMessage ??
                "Validating the OAuth response and loading your iBroadcast library…"}
            </p>
            <div className="callback-security">
              <ShieldIcon size={17} />
              <span>PKCE verifier and state are checked before any token is stored.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
