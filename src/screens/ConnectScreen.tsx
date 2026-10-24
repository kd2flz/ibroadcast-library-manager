import { useState } from "react";
import { useAuth } from "../auth/auth-context";
import { CopyButton } from "../components/CopyButton";
import { LogoMark, ShieldIcon } from "../components/Icons";
import { Notice } from "../components/Notice";

export function ConnectScreen() {
  const {
    clientId,
    usingEnvClientId,
    redirectUri,
    error,
    connect,
    updateClientId,
    clearError,
  } = useAuth();
  const [clientIdInput, setClientIdInput] = useState(() => clientId);

  async function handleConnect() {
    if (!usingEnvClientId) {
      const trimmed = clientIdInput.trim();
      if (trimmed !== clientId) {
        updateClientId(trimmed);
      }
    }
    await connect();
  }

  return (
    <div className="connect-shell">
      <header className="connect-topbar">
        <div className="brand">
          <LogoMark size={36} />
          <div>
            <span className="brand-name">Library Manager</span>
            <span className="brand-sub">for iBroadcast</span>
          </div>
        </div>
        <a
          className="topbar-link"
          href="https://www.ibroadcast.com/"
          target="_blank"
          rel="noreferrer"
        >
          iBroadcast
        </a>
      </header>

      <main className="connect-main connect-main-compact">
        <section className="connect-hero connect-hero-compact" aria-labelledby="connect-title">
          <p className="eyebrow">Storage cleanup</p>
          <h1 id="connect-title">
            Reclaim iBroadcast
            <span className="gradient-text"> storage.</span>
          </h1>
          <p className="hero-copy">
            See storage used, sort upload folders by size, move tracks to trash,
            and permanently empty trash to free space.
          </p>
        </section>

        <section className="connect-card connect-card-compact" aria-labelledby="signin-heading">
          <div className="connect-card-heading">
            <div>
              <p className="eyebrow">Secure sign-in</p>
              <h2 id="signin-heading">Connect iBroadcast</h2>
            </div>
            <span className="shield-badge">
              <ShieldIcon size={20} />
            </span>
          </div>

          <p className="connect-card-copy">
            You will sign in on iBroadcast’s own page. Library Manager never
            sees or stores your password.
          </p>

          {error ? (
            <Notice tone="error" onDismiss={clearError}>
              {error}
            </Notice>
          ) : null}

          {!usingEnvClientId ? (
            <div className="field">
              <label htmlFor="client-id">iBroadcast client ID</label>
              <input
                id="client-id"
                type="text"
                value={clientIdInput}
                onChange={(event) => setClientIdInput(event.target.value)}
                placeholder="Paste your OAuth client ID"
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleConnect();
                  }
                }}
              />
              <p className="field-help">
                Register an app at media.ibroadcast.com → Apps → developer.
                Only the public client ID is needed.
              </p>
            </div>
          ) : (
            <div className="env-client">
              <span>Client ID configured at build time</span>
              <code>{clientId}</code>
            </div>
          )}

          <div className="redirect-box">
            <div>
              <span className="redirect-label">Redirect URI</span>
              <code>{redirectUri}</code>
            </div>
            <CopyButton text={redirectUri} label="Copy" />
          </div>

          <button
            type="button"
            className="button button-primary button-large button-block"
            onClick={() => void handleConnect()}
          >
            Connect iBroadcast
          </button>

          <p className="consent-note">
            Uses OAuth 2.0 with PKCE and the{" "}
            <code>user.library:read</code> and{" "}
            <code>user.library:write</code> scopes.
          </p>
        </section>
      </main>

      <footer className="connect-footer">
        <span>Not affiliated with iBroadcast.</span>
      </footer>
    </div>
  );
}
