import { formatBytes, formatDate, formatPercent, pluralize } from "../lib/format";
import type { LibraryData, Usage } from "../lib/types";
import { AlertIcon, CheckIcon, CloudIcon } from "./Icons";

function MeterStatus({ usage }: { usage: Usage }) {
  if (usage.estimated) {
    return (
      <div className="meter-state meter-state-info">
        <AlertIcon size={17} />
        <span>
          iBroadcast did not return account status. This meter is estimated from
          the library payload and its limit is unknown.
        </span>
      </div>
    );
  }
  if (usage.overLimit) {
    return (
      <div className="meter-state meter-state-danger">
        <AlertIcon size={17} />
        <span>
          Over your limit by {formatBytes(usage.overBy)}. New uploads may be
          blocked until you free space.
        </span>
      </div>
    );
  }
  if (usage.nearLimit) {
    return (
      <div className="meter-state meter-state-warning">
        <AlertIcon size={17} />
        <span>
          You are close to your storage limit at {formatPercent(usage.usedPercent)}{" "}
          used. Emptying trash is the fastest way to reclaim space.
        </span>
      </div>
    );
  }
  return (
    <div className="meter-state meter-state-ok">
      <CheckIcon size={17} />
      <span>Your library is within its storage limit.</span>
    </div>
  );
}

export function StorageMeter({
  usage,
  library,
}: {
  usage: Usage;
  library?: LibraryData;
}) {
  const limitText = usage.unlimited
    ? "Unlimited"
    : usage.storageLimit !== null
      ? formatBytes(usage.storageLimit)
      : "Limit unavailable";
  const remainingText = usage.unlimited
    ? "Unlimited"
    : usage.remaining !== null
      ? formatBytes(usage.remaining)
      : "Unknown";
  const percent = usage.usedPercent ?? 0;
  const barWidth = Math.min(100, Math.max(0, percent));
  const stateClass = usage.overLimit
    ? "is-over"
    : usage.nearLimit
      ? "is-near"
      : "";

  const gap = library
    ? Math.abs(usage.storageUsed - library.totalStoredSize)
    : 0;
  const gapThreshold = library
    ? Math.max(50_000_000, usage.storageUsed * 0.02)
    : 0;

  return (
    <section className="panel meter-panel" aria-labelledby="storage-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Account storage</p>
          <h2 id="storage-heading">Storage used</h2>
        </div>
        <span className="tier-badge">
          <CloudIcon size={15} />
          {usage.estimated ? "Estimated" : usage.tierLabel}
        </span>
      </div>

      <div className="meter-reading">
        <span className="meter-used">{formatBytes(usage.storageUsed)}</span>
        <span className="meter-limit">of {limitText}</span>
      </div>

      <div
        className={`meter-track ${stateClass} ${usage.unlimited ? "is-unlimited" : ""}`}
        role="progressbar"
        aria-label="Storage used"
        aria-valuemin={0}
        aria-valuemax={usage.unlimited || usage.storageLimit === null ? undefined : 100}
        aria-valuenow={usage.unlimited ? undefined : Math.round(percent)}
        aria-valuetext={
          usage.unlimited
            ? `${formatBytes(usage.storageUsed)} used of unlimited storage`
            : usage.storageLimit !== null
              ? `${formatBytes(usage.storageUsed)} used of ${formatBytes(usage.storageLimit)}, ${formatPercent(usage.usedPercent)}`
              : `${formatBytes(usage.storageUsed)} used; storage limit unavailable`
        }
      >
        <span
          className="meter-fill"
          style={{ width: usage.unlimited ? "100%" : `${barWidth}%` }}
        />
        {usage.nearLimit && !usage.overLimit ? (
          <span className="meter-threshold" aria-hidden="true" />
        ) : null}
      </div>

      <dl className="meter-stats">
        <div>
          <dt>Used</dt>
          <dd>{formatPercent(usage.usedPercent)}</dd>
        </div>
        <div>
          <dt>Remaining</dt>
          <dd>{remainingText}</dd>
        </div>
        <div>
          <dt>Plan</dt>
          <dd>{usage.tierLabel}</dd>
        </div>
      </dl>

      <MeterStatus usage={usage} />

      {library ? (
        <p className="meter-note">
          Computed from your library files: {formatBytes(library.totalStoredSize)}{" "}
          ({formatBytes(library.totalActiveSize)} active +{" "}
          {formatBytes(library.trash.size)} in trash).
        </p>
      ) : null}

      {library && !usage.estimated && gap > gapThreshold ? (
        <p className="meter-note meter-note-warning">
          <strong>
            iBroadcast’s usage figure ({formatBytes(usage.storageUsed)}) differs
            from your library files ({formatBytes(library.totalStoredSize)}) by{" "}
            {formatBytes(gap)}.
          </strong>{" "}
          {usage.storageUsed > library.totalStoredSize
            ? `Once iBroadcast recalculates after deletions, expect usage to fall to about ${formatBytes(library.totalStoredSize + usage.hiddenFiles)}`
            : "iBroadcast’s figure may be behind recent uploads."}
          {usage.storageUsed > library.totalStoredSize ? ". " : " "}
          The headline above is iBroadcast’s own number (the same one
          media.ibroadcast.com shows), which your plan limit is checked
          against, and it can lag behind deletions.
        </p>
      ) : null}

      {usage.hiddenFiles > 0 ? (
        <p className="meter-note">
          Account usage includes {usage.hiddenFiles.toLocaleString()} hidden{" "}
          {pluralize(usage.hiddenFiles, "file")} that do not appear in upload
          folders.
        </p>
      ) : null}

      {usage.fallbackLimit && usage.storageLimit !== null ? (
        <p className="meter-note">
          iBroadcast did not report a limit, so this uses the published{" "}
          {formatBytes(usage.storageLimit)} limit for the {usage.tierLabel} plan.
        </p>
      ) : null}

      {usage.enforced && usage.enforcedFrom ? (
        <p className="meter-note">
          Storage enforcement applies from {formatDate(usage.enforcedFrom) ?? usage.enforcedFrom}.
        </p>
      ) : null}
    </section>
  );
}
