import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatBytes,
  formatFolderCount,
  formatTrackCount,
  pluralize,
} from "../lib/format";
import type { FolderSummary } from "../lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  FolderIcon,
  SearchIcon,
  TrashIcon,
} from "./Icons";

type SortMode = "size-desc" | "size-asc" | "name" | "tracks";

function SelectionCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="checkbox"
      checked={checked}
      aria-label={label}
      onChange={onChange}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

function sortFolders(folders: FolderSummary[], mode: SortMode): FolderSummary[] {
  const sorted = [...folders];
  switch (mode) {
    case "size-asc":
      sorted.sort((a, b) => a.size - b.size || a.path.localeCompare(b.path));
      break;
    case "name":
      sorted.sort((a, b) => a.path.localeCompare(b.path));
      break;
    case "tracks":
      sorted.sort(
        (a, b) =>
          b.tracks.length - a.tracks.length || b.size - a.size,
      );
      break;
    case "size-desc":
    default:
      sorted.sort((a, b) => b.size - a.size || a.path.localeCompare(b.path));
      break;
  }
  return sorted;
}

export function FolderBrowser({
  folders,
  busy,
  onTrash,
}: {
  folders: FolderSummary[];
  busy: boolean;
  onTrash: (folders: FolderSummary[]) => Promise<boolean>;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("size-desc");
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const visibleFolders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? folders.filter((folder) => folder.path.toLowerCase().includes(needle))
      : folders;
    return sortFolders(filtered, sort);
  }, [folders, search, sort]);

  const selectedFolders = useMemo(
    () => folders.filter((folder) => selectedPaths.has(folder.path)),
    [folders, selectedPaths],
  );

  const selectedTrackCount = selectedFolders.reduce(
    (total, folder) => total + folder.tracks.length,
    0,
  );
  const selectedSize = selectedFolders.reduce(
    (total, folder) => total + folder.size,
    0,
  );
  const selectedUnknownCount = selectedFolders.reduce(
    (total, folder) => total + folder.unknownSizeCount,
    0,
  );
  const allVisibleSelected =
    visibleFolders.length > 0 &&
    visibleFolders.every((folder) => selectedPaths.has(folder.path));
  const someVisibleSelected = visibleFolders.some((folder) =>
    selectedPaths.has(folder.path),
  );

  function toggleFolder(path: string) {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const folder of visibleFolders) {
          next.delete(folder.path);
        }
      } else {
        for (const folder of visibleFolders) {
          next.add(folder.path);
        }
      }
      return next;
    });
  }

  async function handleConfirm() {
    const success = await onTrash(selectedFolders);
    setConfirmOpen(false);
    if (success) {
      setSelectedPaths(new Set());
    }
  }

  const totalTracks = folders.reduce(
    (total, folder) => total + folder.tracks.length,
    0,
  );

  return (
    <section className="panel folders-panel" aria-labelledby="folders-heading">
      <div className="panel-heading folders-heading">
        <div>
          <p className="eyebrow">Upload folders</p>
          <h2 id="folders-heading">Browse by folder</h2>
          <p className="panel-subtitle">
            {formatFolderCount(folders.length)} · {formatTrackCount(totalTracks)}{" "}
            · sorted by size by default
          </p>
        </div>
      </div>

      <div className="folder-toolbar">
        <label className="search-field">
          <SearchIcon size={17} />
          <span className="sr-only">Search folders</span>
          <input
            type="search"
            placeholder="Search folder paths"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="sort-field">
          <span>Sort</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
          >
            <option value="size-desc">Largest first</option>
            <option value="size-asc">Smallest first</option>
            <option value="name">Folder name</option>
            <option value="tracks">Track count</option>
          </select>
        </label>
      </div>

      {selectedFolders.length > 0 ? (
        <div className="selection-bar">
          <div>
            <strong>
              {formatFolderCount(selectedFolders.length)} ·{" "}
              {formatTrackCount(selectedTrackCount)}
            </strong>
            <span>
              {formatBytes(selectedSize)}
              {selectedUnknownCount > 0
                ? ` + ${selectedUnknownCount.toLocaleString()} unknown-sized ${pluralize(selectedUnknownCount, "track")}`
                : ""}
            </span>
          </div>
          <div className="selection-actions">
            <button
              type="button"
              className="button button-ghost button-small"
              onClick={() => setSelectedPaths(new Set())}
            >
              Clear
            </button>
            <button
              type="button"
              className="button button-primary button-small"
              onClick={() => setConfirmOpen(true)}
              disabled={busy}
            >
              <TrashIcon size={15} />
              Move to trash
            </button>
          </div>
        </div>
      ) : null}

      <div className="folder-table-wrap">
        <table className="folder-table">
          <thead>
            <tr>
              <th className="col-check" scope="col">
                <SelectionCheckbox
                  checked={allVisibleSelected}
                  indeterminate={!allVisibleSelected && someVisibleSelected}
                  onChange={toggleAllVisible}
                  label="Select all visible folders"
                />
              </th>
              <th scope="col">Folder</th>
              <th className="col-number" scope="col">
                Tracks
              </th>
              <th className="col-number" scope="col">
                Size
              </th>
              <th className="col-number col-trashed" scope="col">
                In trash
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleFolders.map((folder) => {
              const selected = selectedPaths.has(folder.path);
              return (
                <tr
                  key={folder.path}
                  className={selected ? "is-selected" : ""}
                  onClick={() => toggleFolder(folder.path)}
                >
                  <td className="col-check">
                    <SelectionCheckbox
                      checked={selected}
                      indeterminate={false}
                      onChange={() => toggleFolder(folder.path)}
                      label={`Select ${folder.path}`}
                    />
                  </td>
                  <td>
                    <div className="folder-name">
                      <span className="folder-icon">
                        <FolderIcon size={17} />
                      </span>
                      <span title={folder.path}>{folder.path}</span>
                    </div>
                  </td>
                  <td className="col-number">
                    {folder.tracks.length.toLocaleString()}
                  </td>
                  <td className="col-number">
                    <span className="size-value">{formatBytes(folder.size)}</span>
                    {folder.unknownSizeCount > 0 ? (
                      <span className="size-unknown">
                        +{folder.unknownSizeCount.toLocaleString()} unknown
                      </span>
                    ) : null}
                  </td>
                  <td className="col-number col-trashed">
                    {folder.trashedCount > 0 ? (
                      <span className="trash-count-badge">
                        {folder.trashedCount.toLocaleString()}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {visibleFolders.length === 0 ? (
          <div className="empty-state">
            <FolderIcon size={28} />
            <p>
              {folders.length === 0
                ? "No active tracks were found in this library."
                : `No folders match “${search.trim()}”.`}
            </p>
            {folders.length > 0 ? (
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={() => setSearch("")}
              >
                Clear search
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="folder-footnote">
        Folders are derived from each track’s upload path. Move to trash works
        first; storage is only reclaimed after you empty the trash.
      </p>

      <ConfirmDialog
        open={confirmOpen}
        title={`Move ${formatTrackCount(selectedTrackCount)} to trash?`}
        description="This moves the selected folder contents to iBroadcast trash. It does not free storage, and the tracks remain restorable until the trash is emptied."
        confirmLabel="Move to trash"
        busy={busy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirmOpen(false)}
      >
        <dl className="confirm-summary">
          <div>
            <dt>Folders</dt>
            <dd>{selectedFolders.length.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Tracks</dt>
            <dd>{selectedTrackCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Total size</dt>
            <dd>
              {formatBytes(selectedSize)}
              {selectedUnknownCount > 0
                ? ` + ${selectedUnknownCount.toLocaleString()} unknown`
                : ""}
            </dd>
          </div>
        </dl>
        {selectedFolders.length > 0 ? (
          <ul className="confirm-folder-list">
            {selectedFolders.slice(0, 6).map((folder) => (
              <li key={folder.path}>{folder.path}</li>
            ))}
            {selectedFolders.length > 6 ? (
              <li className="muted">
                + {(selectedFolders.length - 6).toLocaleString()} more folders
              </li>
            ) : null}
          </ul>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}
