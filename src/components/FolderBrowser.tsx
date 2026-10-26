import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatBytes,
  formatFolderCount,
  formatTrackCount,
  pluralize,
} from "../lib/format";
import {
  buildFolderTree,
  collectFolderTreeIds,
  filterFolderTree,
  flattenFolderTree,
  nodeFolderPaths,
  sortFolderTree,
  type FolderSortMode,
} from "../lib/folder-tree";
import type { FolderSummary } from "../lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  ChevronRightIcon,
  FolderIcon,
  SearchIcon,
  TrashIcon,
  DownloadIcon,
} from "./Icons";

type ViewMode = "flat" | "tree";
const VIEW_STORAGE_KEY = "ibm.folderView";

function readViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === "tree" ? "tree" : "flat";
  } catch {
    return "flat";
  }
}

function persistViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, mode);
  } catch {
    // View preference is optional.
  }
}

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

function sortFolders(
  folders: FolderSummary[],
  mode: FolderSortMode,
): FolderSummary[] {
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

function FolderRow({
  label,
  path,
  tree,
  depth,
  trackCount,
  size,
  unknownSizeCount,
  trashedCount,
  downloaded,
  selected,
  indeterminate,
  expandable,
  expanded,
  onSelect,
  onToggleExpanded,
}: {
  label: string;
  path: string;
  tree: boolean;
  depth: number;
  trackCount: number;
  size: number;
  unknownSizeCount: number;
  trashedCount: number;
  downloaded: { done: number; total: number };
  selected: boolean;
  indeterminate: boolean;
  expandable: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpanded: () => void;
}) {
  return (
    <tr
      className={`${selected ? "is-selected" : ""} ${
        indeterminate ? "is-partial" : ""
      }`}
      onClick={onSelect}
    >
      <td className="col-check">
        <SelectionCheckbox
          checked={selected}
          indeterminate={indeterminate}
          onChange={onSelect}
          label={`Select ${path}`}
        />
      </td>
      <td>
        <div
          className={`folder-name ${tree ? "tree-label" : ""}`}
          style={depth > 0 ? { paddingLeft: `${depth * 18}px` } : undefined}
        >
          {tree ? (
            expandable ? (
              <button
                type="button"
                className={`tree-chevron ${expanded ? "is-expanded" : ""}`}
                aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
                aria-expanded={expanded}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleExpanded();
                }}
              >
                <ChevronRightIcon size={12} />
              </button>
            ) : (
              <span className="tree-chevron-spacer" aria-hidden="true" />
            )
          ) : null}
          <span className="folder-icon">
            <FolderIcon size={17} />
          </span>
          <span title={path}>{label}</span>
        </div>
      </td>
      <td className="col-number">{trackCount.toLocaleString()}</td>
      <td className="col-number">
        <span className="size-value">{formatBytes(size)}</span>
        {unknownSizeCount > 0 ? (
          <span className="size-unknown">
            +{unknownSizeCount.toLocaleString()} unknown
          </span>
        ) : null}
      </td>
      <td className="col-number col-downloaded">
        {downloaded.done > 0 ? (
          <span
            className={
              downloaded.done === downloaded.total
                ? "downloaded-badge is-complete"
                : "downloaded-badge"
            }
          >
            {downloaded.done === downloaded.total
              ? "Downloaded"
              : `${downloaded.done.toLocaleString()}/${downloaded.total.toLocaleString()}`}
          </span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td className="col-number col-trashed">
        {trashedCount > 0 ? (
          <span className="trash-count-badge">
            {trashedCount.toLocaleString()}
          </span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
    </tr>
  );
}

type GroupMode = "folder" | "tag" | "genre";

function downloadedCount(
  folders: FolderSummary[],
  ids: Set<string>,
): { done: number; total: number } {
  const seen = new Set<string>();
  let done = 0;
  for (const folder of folders) {
    for (const track of folder.tracks) {
      if (seen.has(track.id)) continue;
      seen.add(track.id);
      if (ids.has(track.id)) done += 1;
    }
  }
  return { done, total: seen.size };
}

export function FolderBrowser({
  folders: folderGroups,
  tagFolders,
  genreFolders,
  busy,
  onTrash,
  onDownload,
  downloadedIds,
  onClearDownloaded,
}: {
  folders: FolderSummary[];
  tagFolders: FolderSummary[];
  genreFolders: FolderSummary[];
  busy: boolean;
  onTrash: (folders: FolderSummary[]) => Promise<boolean>;
  onDownload: (folders: FolderSummary[]) => Promise<boolean>;
  downloadedIds: Set<string>;
  onClearDownloaded: (folders: FolderSummary[] | null) => void;
}) {
  const [groupMode, setGroupMode] = useState<GroupMode>("folder");
  const folders =
    groupMode === "tag"
      ? tagFolders
      : groupMode === "genre"
        ? genreFolders
        : folderGroups;
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<FolderSortMode>("size-desc");
  const [view, setView] = useState<ViewMode>(() => {
    const stored = readViewMode();
    if (stored === "tree") return "tree";
    return "tree";
  });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const searchActive = search.trim().length > 0;

  const visibleFlatFolders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? folders.filter((folder) => folder.path.toLowerCase().includes(needle))
      : folders;
    return sortFolders(filtered, sort);
  }, [folders, search, sort]);

  const folderTree = useMemo(() => buildFolderTree(folders), [folders]);
  const sortedTree = useMemo(
    () => sortFolderTree(folderTree, sort),
    [folderTree, sort],
  );
  const filteredTree = useMemo(
    () => filterFolderTree(sortedTree, search),
    [sortedTree, search],
  );
  const visibleTree = useMemo(
    () => flattenFolderTree(filteredTree, expandedIds, searchActive),
    [filteredTree, expandedIds, searchActive],
  );

  const selectedFolders = useMemo(
    () => folders.filter((folder) => selectedPaths.has(folder.path)),
    [folders, selectedPaths],
  );

  const visibleSelectablePaths = useMemo(() => {
    const paths = new Set<string>();
    if (view === "flat") {
      for (const folder of visibleFlatFolders) {
        paths.add(folder.path);
      }
    } else {
      for (const { node } of visibleTree) {
        for (const path of nodeFolderPaths(node)) {
          paths.add(path);
        }
      }
    }
    return paths;
  }, [view, visibleFlatFolders, visibleTree]);

  const allVisibleSelected =
    visibleSelectablePaths.size > 0 &&
    [...visibleSelectablePaths].every((path) => selectedPaths.has(path));
  const someVisibleSelected = [...visibleSelectablePaths].some((path) =>
    selectedPaths.has(path),
  );

  const selectedUnique = useMemo(() => {
    const seen = new Map<string, number | null>();
    for (const folder of selectedFolders) {
      for (const track of folder.tracks) seen.set(track.id, track.size);
    }
    let size = 0;
    let unknown = 0;
    for (const value of seen.values()) {
      if (value === null) unknown += 1;
      else size += value;
    }
    return { count: seen.size, size, unknown };
  }, [selectedFolders]);
  const selectedTrackCount = selectedUnique.count;
  const selectedSize = selectedUnique.size;
  const selectedUnknownCount = selectedUnique.unknown;

  function changeView(nextView: ViewMode) {
    setView(nextView);
    persistViewMode(nextView);
  }

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

  function toggleSubtree(paths: string[]) {
    setSelectedPaths((current) => {
      const next = new Set(current);
      const allSelected = paths.every((path) => next.has(path));
      for (const path of paths) {
        if (allSelected) {
          next.delete(path);
        } else {
          next.add(path);
        }
      }
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const path of visibleSelectablePaths) {
          next.delete(path);
        }
      } else {
        for (const path of visibleSelectablePaths) {
          next.add(path);
        }
      }
      return next;
    });
  }

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleDownload() {
    const success = await onDownload(selectedFolders);
    if (success) {
      setSelectedPaths(new Set());
    }
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
  const visibleRowCount =
    view === "flat" ? visibleFlatFolders.length : visibleTree.length;

  return (
    <section className="panel folders-panel" aria-labelledby="folders-heading">
      <div className="panel-heading folders-heading">
        <div>
          <p className="eyebrow">Upload folders</p>
          <h2 id="folders-heading">
            {groupMode === "folder" ? "Browse by folder" : groupMode === "tag" ? "Browse by tag" : "Browse by genre"}
          </h2>
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
        <div className="folder-toolbar-right">
          <div
            className="view-toggle view-toggle-elegant"
            role="group"
            aria-label="View mode: folders or upload tree"
          >
            <button
              type="button"
              className={view === "flat" ? "is-active" : ""}
              aria-pressed={view === "flat"}
              title="Show folders as a flat list"
              onClick={() => changeView("flat")}
            >
              <span className="view-toggle-icon">▦</span>
              List
            </button>
            <button
              type="button"
              className={view === "tree" ? "is-active" : ""}
              aria-pressed={view === "tree"}
              title="Show upload paths as a nested tree (bulk delete by branch)"
              onClick={() => changeView("tree")}
            >
              <span className="view-toggle-icon">≡</span>
              Tree
            </button>
          </div>
          <label className="sort-field">
            <span>Group by</span>
            <select
              value={groupMode}
              onChange={(event) => {
                setGroupMode(event.target.value as GroupMode);
                setSelectedPaths(new Set());
                setExpandedIds(new Set());
              }}
            >
              <option value="folder">Folder</option>
              <option value="tag">Tag / Album</option>
              <option value="genre">Genre / Album</option>
            </select>
          </label>
          <label className="sort-field">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as FolderSortMode)
              }
            >
              <option value="size-desc">Largest first</option>
              <option value="size-asc">Smallest first</option>
              <option value="name">Folder name</option>
              <option value="tracks">Track count</option>
            </select>
          </label>
        </div>
      </div>

      {view === "tree" ? (
        <div className="tree-controls">
          <span>
            Row totals include nested folders. Select a row to queue its entire
            subtree.
          </span>
          {!searchActive ? (
            <div className="tree-actions">
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={() =>
                  setExpandedIds(new Set(collectFolderTreeIds(folderTree)))
                }
              >
                Expand all
              </button>
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={() => setExpandedIds(new Set())}
              >
                Collapse all
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

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
              className="button button-secondary button-small"
              onClick={() => void handleDownload()}
              disabled={busy}
              title="Download the original files as a zip"
            >
              <DownloadIcon size={15} />
              Download
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
              <th className="col-number col-downloaded" scope="col">
                Downloaded
              </th>
              <th className="col-number col-trashed" scope="col">
                In trash
              </th>
            </tr>
          </thead>
          <tbody>
            {view === "flat"
              ? visibleFlatFolders.map((folder) => {
                  const selected = selectedPaths.has(folder.path);
                  return (
                    <FolderRow
                      key={folder.path}
                      label={folder.path}
                      path={folder.path}
                      tree={false}
                      depth={0}
                      trackCount={folder.tracks.length}
                      size={folder.size}
                      unknownSizeCount={folder.unknownSizeCount}
                      trashedCount={folder.trashedCount}
                      downloaded={downloadedCount([folder], downloadedIds)}
                      selected={selected}
                      indeterminate={false}
                      expandable={false}
                      expanded={false}
                      onSelect={() => toggleFolder(folder.path)}
                      onToggleExpanded={() => undefined}
                    />
                  );
                })
              : visibleTree.map(({ node, depth }) => {
                  const paths = nodeFolderPaths(node);
                  let selectedCount = 0;
                  for (const path of paths) {
                    if (selectedPaths.has(path)) {
                      selectedCount += 1;
                    }
                  }
                  const selected =
                    paths.length > 0 && selectedCount === paths.length;
                  const indeterminate = selectedCount > 0 && !selected;
                  const expandable = node.children.length > 0 && !searchActive;
                  return (
                    <FolderRow
                      key={node.id}
                      label={node.name}
                      path={node.path}
                      tree
                      depth={depth}
                      trackCount={node.trackCount}
                      size={node.size}
                      unknownSizeCount={node.unknownSizeCount}
                      trashedCount={node.trashedCount}
                      downloaded={downloadedCount(node.subtreeFolders, downloadedIds)}
                      selected={selected}
                      indeterminate={indeterminate}
                      expandable={expandable}
                      expanded={expandedIds.has(node.id) || searchActive}
                      onSelect={() => toggleSubtree(paths)}
                      onToggleExpanded={() => toggleExpanded(node.id)}
                    />
                  );
                })}
          </tbody>
        </table>

        {visibleRowCount === 0 ? (
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

      {downloadedIds.size > 0 ? (
        <p className="folder-footnote">
          {downloadedIds.size.toLocaleString()} tracks marked as downloaded on
          this device.{" "}
          {selectedFolders.length > 0 ? (
            <button
              type="button"
              className="text-button"
              onClick={() => onClearDownloaded(selectedFolders)}
            >
              Clear for selection
            </button>
          ) : null}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => onClearDownloaded(null)}
          >
            Clear all
          </button>
        </p>
      ) : null}
      <p className="folder-footnote">
        {view === "tree"
          ? "Tree view groups tracks by their upload path. Sizes, track counts, and trash counts include every nested folder."
          : "Folders are derived from each track’s upload path. Move to trash works first; storage is only reclaimed after you empty the trash."}
      </p>

      <ConfirmDialog
        open={confirmOpen}
        title={`Move ${formatTrackCount(selectedTrackCount)} to trash?`}
        description="This moves every active track in the selected folder paths to iBroadcast trash. It does not free storage, and the tracks remain restorable until the trash is emptied."
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
