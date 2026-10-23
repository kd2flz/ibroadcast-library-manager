import type { ReactNode } from "react";
import { AlertIcon, CheckIcon, CloseIcon, ShieldIcon } from "./Icons";

export type NoticeTone = "error" | "success" | "info" | "warning";

export function Notice({
  tone,
  children,
  onDismiss,
}: {
  tone: NoticeTone;
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const Icon =
    tone === "success" ? CheckIcon : tone === "info" ? ShieldIcon : AlertIcon;
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon size={18} className="notice-icon" />
      <div className="notice-body">{children}</div>
      {onDismiss ? (
        <button
          type="button"
          className="icon-button notice-close"
          aria-label="Dismiss message"
          onClick={onDismiss}
        >
          <CloseIcon size={16} />
        </button>
      ) : null}
    </div>
  );
}
