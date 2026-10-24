import type { FolderSummary } from "./types";

export type FolderSortMode = "size-desc" | "size-asc" | "name" | "tracks";

export interface FolderTreeNode {
  id: string;
  name: string;
  path: string;
  depth: number;
  folders: FolderSummary[];
  subtreeFolders: FolderSummary[];
  children: FolderTreeNode[];
  trackCount: number;
  folderCount: number;
  size: number;
  unknownSizeCount: number;
  trashedCount: number;
}

interface MutableNode {
  id: string;
  name: string;
  depth: number;
  children: Map<string, MutableNode>;
  folders: FolderSummary[];
}

function pathSegments(path: string): string[] {
  if (path === "Root") {
    return ["Root"];
  }
  return path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function finalizeNode(node: MutableNode): FolderTreeNode {
  const children = [...node.children.values()]
    .map(finalizeNode)
    .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));

  const subtreeFolders = [
    ...node.folders,
    ...children.flatMap((child) => child.subtreeFolders),
  ];

  let size = 0;
  let unknownSizeCount = 0;
  let trashedCount = 0;
  let trackCount = 0;
  for (const folder of subtreeFolders) {
    size += folder.size;
    unknownSizeCount += folder.unknownSizeCount;
    trashedCount += folder.trashedCount;
    trackCount += folder.tracks.length;
  }

  const leadingSlash = subtreeFolders.some((folder) =>
    folder.path.startsWith("/"),
  );

  return {
    id: node.id,
    name: node.name,
    path: leadingSlash ? `/${node.id}` : node.id,
    depth: node.depth,
    folders: node.folders,
    subtreeFolders,
    children,
    trackCount,
    folderCount: subtreeFolders.length,
    size,
    unknownSizeCount,
    trashedCount,
  };
}

export function buildFolderTree(folders: FolderSummary[]): FolderTreeNode[] {
  const roots = new Map<string, MutableNode>();

  for (const folder of folders) {
    const segments = pathSegments(folder.path);
    if (segments.length === 0) {
      continue;
    }

    let level = roots;
    let parent: MutableNode | null = null;
    const idParts: string[] = [];

    for (const segment of segments) {
      idParts.push(segment);
      const id = idParts.join("/");
      let node = level.get(segment);
      if (!node) {
        node = {
          id,
          name: segment,
          depth: idParts.length - 1,
          children: new Map(),
          folders: [],
        };
        level.set(segment, node);
      }
      parent = node;
      level = node.children;
    }

    parent?.folders.push(folder);
  }

  return [...roots.values()]
    .map(finalizeNode)
    .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
}

export function sortFolderTree(
  nodes: FolderTreeNode[],
  mode: FolderSortMode,
): FolderTreeNode[] {
  const sorted = nodes.map((node) => ({
    ...node,
    children: sortFolderTree(node.children, mode),
  }));

  switch (mode) {
    case "size-asc":
      sorted.sort(
        (a, b) => a.size - b.size || a.name.localeCompare(b.name),
      );
      break;
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "tracks":
      sorted.sort(
        (a, b) =>
          b.trackCount - a.trackCount ||
          b.size - a.size ||
          a.name.localeCompare(b.name),
      );
      break;
    case "size-desc":
    default:
      sorted.sort(
        (a, b) => b.size - a.size || a.name.localeCompare(b.name),
      );
      break;
  }

  return sorted;
}

export function filterFolderTree(
  nodes: FolderTreeNode[],
  query: string,
): FolderTreeNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return nodes;
  }

  const filtered: FolderTreeNode[] = [];
  for (const node of nodes) {
    if (
      node.name.toLowerCase().includes(needle) ||
      node.path.toLowerCase().includes(needle)
    ) {
      filtered.push(node);
      continue;
    }
    const matchingChildren = filterFolderTree(node.children, query);
    if (matchingChildren.length > 0) {
      filtered.push({ ...node, children: matchingChildren });
    }
  }
  return filtered;
}

export function collectFolderTreeIds(nodes: FolderTreeNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    ids.push(...collectFolderTreeIds(node.children));
  }
  return ids;
}

export interface VisibleFolderNode {
  node: FolderTreeNode;
  depth: number;
}

export function flattenFolderTree(
  nodes: FolderTreeNode[],
  expandedIds: Set<string>,
  forceExpanded = false,
  depth = 0,
): VisibleFolderNode[] {
  const visible: VisibleFolderNode[] = [];
  for (const node of nodes) {
    visible.push({ node, depth });
    if (
      node.children.length > 0 &&
      (forceExpanded || expandedIds.has(node.id))
    ) {
      visible.push(
        ...flattenFolderTree(node.children, expandedIds, forceExpanded, depth + 1),
      );
    }
  }
  return visible;
}

export function nodeFolderPaths(node: FolderTreeNode): string[] {
  return node.subtreeFolders.map((folder) => folder.path);
}
