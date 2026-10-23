import { useState } from "react";
import { useAuth } from "../auth/auth-context";
import { CopyButton } from "../components/CopyButton";
import {
  DeviceIcon,
  ExternalIcon,
  LogoMark,
  ShieldIcon,
} from "../components/Icons";
import { Notice } from "../components/Notice";

function DeviceFlowPanel() {
  const {
    device,
    startDeviceFlow,
    cancelDeviceFlow,
  } = useAuth();

  if (!device) {
    return (
      <div className="device-start">
        <p>
          Prefer not to redirect? iBroadcast can show a short code you approve
          in another tab.
        </p>
        <button
          type="button"
          className="button button-ghost"
          onClick={() => void startDeviceFlow()}
        >
          <DeviceIcon size={17} />
          Use a device code instead
        </button>
      </div>
    );
  }

  if (device.status === "requesting") {
    return (
      <div className="device-state">
        <span className="spinner" />
        <p>Requesting a device code from iBroadcast…</p>
        <button
          type="button"
          className="button button-ghost button-small"
          onClick={cancelDeviceFlow}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (device.status === "waiting" && device.userCode) {
    const verificationUrl =
      device.verificationUriComplete ?? device.verificationUri ?? "";
    return (
      <div className="device-state">
        <p className="device-label">Enter this code on iBroadcast</p>
        <div className="device-code-row">
          <span className="device-code">{device.userCode}</span>
          <CopyButton
            text={device.userCode}
            label="Copy code"
            className="button button-ghost button-small"
          />
        </div>
        {verificationUrl ? (
          <a
            className="button button-secondary button-block"
            href={verificationUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open iBroadcast verification
            <ExternalIcon size={16} />
          </a>
        ) : null}
        <div className="device-polling" role="status">
          <span className="pulse-dot" aria-hidden="true" />
          <span>{device.message ?? "Waiting for approval…"}</span>
        </div>
        <button
          type="button"
          className="button button-ghost button-small"
          onClick={cancelDeviceFlow}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="device-state">
      <Notice
        tone={
          device.status === "denied" || device.status === "error"
            ? "error"
            : "warning"
        }
      >
        {device.message ?? "The device code could not be completed."}
      </Notice>
      <div className="device-retry">
        <button
          type="button"
          className="button button-ghost button-small"
          onClick={() => void startDeviceFlow()}
        >
          Request a new code
        </button>
        <button
          type="button"
          className="text-button"
          onClick={cancelDeviceFlow}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function ConnectScreen() {
  const {
    clientId,
    usingEnvClientId,
    redirectUri,
    error,
    device,
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
          <ExternalIcon size={15} />
        </a>
      </header>

      <main className="connect-main">
        <section className="connect-hero" aria-labelledby="connect-title">
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

        <div className="connect-column">
          <section className="connect-card" aria-labelledby="signin-heading">
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
                  Only the public client ID is needed. Never enter a client
                  secret.
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
              <ExternalIcon size={17} />
            </button>

            <p className="consent-note">
              By connecting, you authorize this app to read and modify your
              iBroadcast library using the{" "}
              <code>user.library:read</code> and{" "}
              <code>user.library:write</code> scopes. Disconnect at any time to
              revoke the session.
            </p>
          </section>

          <section className="device-card" aria-labelledby="device-heading">
            <div className="device-card-heading">
              <span className="device-icon">
                <DeviceIcon size={20} />
              </span>
              <div>
                <h2 id="device-heading">Device code fallback</h2>
                <p>Useful when a redirect is blocked or you are on another device.</p>
              </div>
            </div>
            {device ? <DeviceFlowPanel /> : (
              <details className="device-details">
                <summary>Show device code option</summary>
                <div className="device-details-body">
                  <DeviceFlowPanel />
                </div>
              </details>
            )}
          </section>

          <div className="security-note">
            <ShieldIcon size={17} />
            <p>
              OAuth 2.0 with PKCE. Tokens stay in this tab’s session storage and
              are revoked when you disconnect. No passwords, no third-party
              trackers.
            </p>
          </div>
        </div>
      </main>

      <footer className="connect-footer">
        <span>Not affiliated with iBroadcast.</span>
        <span className="footer-dot" aria-hidden="true" />
        <a
          href="https://help.ibroadcast.com/en/developer/api"
          target="_blank"
          rel="noreferrer"
        >
          API documentation
        </a>
      </footer>
    </div>
  );
}
