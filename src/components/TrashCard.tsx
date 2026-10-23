import { formatBytes, pluralize } from "../lib/format";
import type { TrashSummary } from "../lib/types";
import { TrashIcon } from "./Icons";

export function TrashCard({
  trash,
  onEmpty,
  busy,
}: {
  trash: TrashSummary;
  onEmpty: () => void;
  busy: boolean;
}) {
  const count = trash.ids.length;
  return (
    <section className="panel trash-panel" aria-labelledby="trash-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Reclaimable space</p>
          <h2 id="trash-heading">Trash</h2>
        </div>
        <span className="trash-icon-badge">
          <TrashIcon size={18} />
        </span>
      </div>

      <div className="trash-reading">
        <span className="trash-size">{formatBytes(trash.size)}</span>
        <span className="trash-count">
          {count.toLocaleString()} {pluralize(count, "track")} in trash
        </span>
      </div>

      <p className="trash-copy">
        Moving tracks to trash does not free storage. Emptying trash permanently
        deletes them and reclaims this space.
      </p>

      {trash.unknownSizeCount > 0 ? (
        <p className="trash-note">
          {trash.unknownSizeCount.toLocaleString()} trashed{" "}
          {pluralize(trash.unknownSizeCount, "track")} have an unknown size, so
          the reclaimable total may be higher.
        </p>
      ) : null}

      <button
        type="button"
        className="button button-danger-outline button-block"
        onClick={onEmpty}
        disabled={count === 0 || busy}
      >
        <TrashIcon size={17} />
        Empty trash
      </button>
    </section>
  );
}
