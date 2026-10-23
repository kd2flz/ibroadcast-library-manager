import { useEffect, useRef, type ReactNode } from "react";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "primary",
  busy = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    confirmRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onCancel();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onCancel();
        }
      }}
    >
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
      >
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-description">{description}</p>
        {children ? <div className="dialog-details">{children}</div> : null}
        <div className="dialog-actions">
          <button
            type="button"
            className="button button-ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`button ${tone === "danger" ? "button-danger" : "button-primary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <span className="spinner spinner-small" /> : null}
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
