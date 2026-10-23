import { useState } from "react";
import { useAuth } from "../auth/auth-context";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FolderBrowser } from "../components/FolderBrowser";
import {
  AlertIcon,
  LogoMark,
  LogOutIcon,
  RefreshIcon,
  ShieldIcon,
  TrashIcon,
} from "../components/Icons";
import { Notice, type NoticeTone } from "../components/Notice";
import { StorageMeter } from "../components/StorageMeter";
import { TrashCard } from "../components/TrashCard";
import { emptyTrash, trashTracks } from "../lib/api";
import { formatBytes, formatTrackCount } from "../lib/format";
import { collectFolderTrackIds } from "../lib/library";
import { withAccessToken } from "../lib/token-store";
import type { FolderSummary } from "../lib/types";
import { estimatedUsage } from "../lib/usage";

interface LocalNotice {
  tone: NoticeTone;
  text: string;
}

function messageForError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The request failed. Please try again.";
}

export function DashboardScreen() {
  const {
    clientId,
    usage,
    library,
    lastSynced,
    busyMessage,
    error,
    refresh,
    logout,
    clearError,
  } = useAuth();
  const [operation, setOperation] = useState<"trash" | "empty" | null>(null);
  const [notice, setNotice] = useState<LocalNotice | null>(null);
  const [emptyConfirmOpen, setEmptyConfirmOpen] = useState(false);

  const working = operation !== null || busyMessage !== null;

  async function handleTrash(folders: FolderSummary[]): Promise<boolean> {
    const ids = collectFolderTrackIds(folders);
    if (ids.length === 0) {
      setNotice({ tone: "warning", text: "Those folders have no active tracks." });
      return false;
    }

    setOperation("trash");
    setNotice(null);
    try {
      await withAccessToken(clientId, (token) => trashTracks(ids, token));
      setNotice({
        tone: "success",
        text: `Moved ${formatTrackCount(ids.length)} to trash. Storage will not change until you empty the trash.`,
      });
      await refresh();
      return true;
    } catch (caught) {
      setNotice({ tone: "error", text: messageForError(caught) });
      return false;
    } finally {
      setOperation(null);
    }
  }

  async function handleEmptyTrash() {
    if (!library || library.trash.ids.length === 0) {
      return;
    }
    const ids = library.trash.ids;
    const sizeKnown = library.trash.size;
    const unknown = library.trash.unknownSizeCount;

    setOperation("empty");
    setNotice(null);
    try {
      await withAccessToken(clientId, (token) => emptyTrash(ids, token));
      setEmptyConfirmOpen(false);
      setNotice({
        tone: "success",
        text: `Permanently deleted ${formatTrackCount(ids.length)} and reclaimed ${
          sizeKnown > 0 ? `about ${formatBytes(sizeKnown)}` : "storage"
        }${unknown > 0 ? ` (plus ${unknown.toLocaleString()} tracks with unknown size)` : ""}.`,
      });
      await refresh();
    } catch (caught) {
      setNotice({ tone: "error", text: messageForError(caught) });
    } finally {
      setOperation(null);
    }
  }

  if (!library) {
    return (
      <div className="dashboard-shell">
        <header className="topbar">
          <div className="brand">
            <LogoMark size={34} />
            <div>
              <span className="brand-name">Library Manager</span>
              <span className="brand-sub">for iBroadcast</span>
            </div>
          </div>
          <button
            type="button"
            className="button button-ghost button-small"
            onClick={() => void logout()}
          >
            <LogOutIcon size={16} />
            Disconnect
          </button>
        </header>
        <main className="center-state">
          {error ? (
            <section className="panel state-card" role="alert">
              <span className="state-icon state-icon-error">
                <AlertIcon size={24} />
              </span>
              <h1>Could not load your library</h1>
              <p>{error}</p>
              <div className="state-actions">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => void refresh()}
                >
                  <RefreshIcon size={17} />
                  Try again
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => void logout()}
                >
                  <LogOutIcon size={17} />
                  Disconnect
                </button>
              </div>
            </section>
          ) : (
            <section className="panel state-card" aria-live="polite">
              <span className="state-icon">
                <span className="spinner spinner-large" />
              </span>
              <h1>Loading your library</h1>
              <p>{busyMessage ?? "Fetching account status and tracks…"}</p>
              <p className="muted">
                Large iBroadcast libraries can take a moment on first load.
              </p>
            </section>
          )}
        </main>
      </div>
    );
  }

  const effectiveUsage = usage ?? estimatedUsage(library);
  const trashCount = library.trash.ids.length;
  const trashSize = library.trash.size;

  return (
    <div className="dashboard-shell">
      <header className="topbar">
        <div className="brand">
          <LogoMark size={34} />
          <div>
            <span className="brand-name">Library Manager</span>
            <span className="brand-sub">for iBroadcast</span>
          </div>
        </div>

        <div className="topbar-actions">
          <span className="sync-status">
            {lastSynced
              ? `Synced ${lastSynced.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : "Not synced"}
          </span>
          <button
            type="button"
            className="button button-ghost button-small"
            onClick={() => void refresh()}
            disabled={working}
          >
            {busyMessage ? (
              <span className="spinner spinner-small" />
            ) : (
              <RefreshIcon size={16} />
            )}
            Refresh
          </button>
          <button
            type="button"
            className="button button-ghost button-small"
            onClick={() => void logout()}
            disabled={operation !== null}
          >
            <LogOutIcon size={16} />
            Disconnect
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        {error ? (
          <Notice tone="error" onDismiss={clearError}>
            {error}
          </Notice>
        ) : null}
        {notice ? (
          <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Notice>
        ) : null}
        {busyMessage && library ? (
          <div className="refresh-strip" role="status">
            <span className="spinner spinner-small" />
            {busyMessage}
          </div>
        ) : null}

        <section className="meter-grid" aria-label="Storage overview">
          <StorageMeter usage={effectiveUsage} />
          <TrashCard
            trash={library.trash}
            onEmpty={() => setEmptyConfirmOpen(true)}
            busy={working}
          />
        </section>

        <FolderBrowser
          folders={library.folders}
          busy={working}
          onTrash={handleTrash}
        />

        <footer className="dashboard-footer">
          <div className="footer-security">
            <ShieldIcon size={16} />
            <span>
              Writes go directly to iBroadcast with your OAuth session. Storage
              numbers are never updated optimistically.
            </span>
          </div>
          <span>
            Folder sizes sum active track sizes; unknown sizes are excluded.
            iBroadcast reports storage using 1 GB = 10⁹ bytes.
          </span>
        </footer>
      </main>

      <ConfirmDialog
        open={emptyConfirmOpen}
        title="Empty trash permanently?"
        description="This permanently deletes every track currently in iBroadcast trash. It cannot be undone and cannot be reversed from Library Manager."
        confirmLabel="Empty trash"
        tone="danger"
        busy={operation === "empty"}
        onConfirm={() => void handleEmptyTrash()}
        onCancel={() => setEmptyConfirmOpen(false)}
      >
        <dl className="confirm-summary confirm-summary-danger">
          <div>
            <dt>Tracks</dt>
            <dd>{trashCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Reclaimable</dt>
            <dd>{formatBytes(trashSize)}</dd>
          </div>
        </dl>
        {library.trash.unknownSizeCount > 0 ? (
          <p className="confirm-warning">
            <AlertIcon size={16} />
            {library.trash.unknownSizeCount.toLocaleString()} trashed{" "}
            {library.trash.unknownSizeCount === 1 ? "track has" : "tracks have"}{" "}
            an unknown size, so the actual reclaimed space may differ.
          </p>
        ) : null}
        <p className="confirm-note">
          <TrashIcon size={16} />
          This frees storage immediately after iBroadcast processes the request.
          The list will refresh automatically.
        </p>
      </ConfirmDialog>
    </div>
  );
}
