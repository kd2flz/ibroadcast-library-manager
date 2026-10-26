import type {
  DecodedItem,
  FolderSummary,
  LibraryData,
  RawLibrary,
  Track,
  TrashSummary,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asId(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function asSize(value: unknown): number | null {
  const parsed = asNumber(value);
  return parsed === null || parsed < 0 ? null : parsed;
}

function decodeCollection(value: unknown): DecodedItem[] {
  const collection = asRecord(value);
  if (!collection) {
    return [];
  }
  const fieldMap = asRecord(collection.map);
  const fields = fieldMap
    ? Object.entries(fieldMap)
        .filter((entry): entry is [string, number] => typeof entry[1] === "number")
        .map(([field, index]) => [field, index] as const)
    : [];

  const items: DecodedItem[] = [];
  for (const [id, rawItem] of Object.entries(collection)) {
    if (id === "map") {
      continue;
    }
    const item: DecodedItem = { id };
    if (Array.isArray(rawItem)) {
      for (const [field, index] of fields) {
        item[field] = rawItem[index];
      }
    } else {
      const record = asRecord(rawItem);
      if (record) {
        for (const [field, value] of Object.entries(record)) {
          item[field] = value;
        }
      }
    }
    items.push(item);
  }
  return items;
}

export function normalizeFolderPath(path: string): string {
  const trimmed = path.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (!trimmed || trimmed === "/") {
    return "Root";
  }
  return trimmed;
}

function readTrashIds(raw: RawLibrary): string[] {
  const trash = asRecord(raw.trash);
  if (!trash) {
    return [];
  }
  const map = asRecord(trash.map);
  const tracksIndex = typeof map?.tracks === "number" ? map.tracks : 1;
  const container = trash["0"];
  if (!Array.isArray(container)) {
    return [];
  }
  const ids = container[tracksIndex];
  if (!Array.isArray(ids)) {
    return [];
  }
  return ids
    .map((id) => asId(id))
    .filter((id) => id.length > 0);
}

function buildFolders(tracks: Track[]): FolderSummary[] {
  const groups = new Map<
    string,
    { active: Track[]; trashedCount: number }
  >();

  for (const track of tracks) {
    let group = groups.get(track.path);
    if (!group) {
      group = { active: [], trashedCount: 0 };
      groups.set(track.path, group);
    }
    if (track.trashed) {
      group.trashedCount += 1;
    } else {
      group.active.push(track);
    }
  }

  const folders: FolderSummary[] = [];
  for (const [path, group] of groups) {
    if (group.active.length === 0) {
      continue;
    }
    let size = 0;
    let unknownSizeCount = 0;
    for (const track of group.active) {
      if (track.size === null) {
        unknownSizeCount += 1;
      } else {
        size += track.size;
      }
    }
    folders.push({
      path,
      tracks: group.active,
      size,
      unknownSizeCount,
      trashedCount: group.trashedCount,
    });
  }

  return folders.sort((a, b) => {
    if (b.size !== a.size) {
      return b.size - a.size;
    }
    return a.path.localeCompare(b.path);
  });
}

function groupLabel(value: string): string {
  return value.replace(/[\\/]+/g, "-").trim() || "Unknown";
}

/**
 * Groups active tracks as "<group>/<album>" pseudo-folders so the existing
 * list and tree views work unchanged. A track with several tags appears under
 * each tag; track IDs are de-duplicated when acting on a selection.
 */
export function buildAlbumGroups(
  tracks: Track[],
  groupsOf: (track: Track) => string[],
): FolderSummary[] {
  const groups = new Map<string, { active: Track[]; trashedCount: number }>();
  for (const track of tracks) {
    for (const group of groupsOf(track)) {
      const path = `${groupLabel(group)}/${groupLabel(track.album)}`;
      let entry = groups.get(path);
      if (!entry) {
        entry = { active: [], trashedCount: 0 };
        groups.set(path, entry);
      }
      if (track.trashed) {
        entry.trashedCount += 1;
      } else {
        entry.active.push(track);
      }
    }
  }
  const result: FolderSummary[] = [];
  for (const [path, entry] of groups) {
    if (entry.active.length === 0) continue;
    const { size, unknownSizeCount } = sizeOfTracks(entry.active);
    result.push({
      path,
      tracks: entry.active,
      size,
      unknownSizeCount,
      trashedCount: entry.trashedCount,
    });
  }
  return result.sort((x, y) => y.size - x.size || x.path.localeCompare(y.path));
}

function buildTrashSummary(
  ids: string[],
  tracksById: Record<string, Track>,
): TrashSummary {
  const uniqueIds = [...new Set(ids)];
  const tracks: Track[] = [];
  let size = 0;
  let unknownSizeCount = 0;

  for (const id of uniqueIds) {
    const track = tracksById[id];
    if (!track) {
      continue;
    }
    tracks.push(track);
    if (track.size === null) {
      unknownSizeCount += 1;
    } else {
      size += track.size;
    }
  }

  return {
    ids: uniqueIds,
    tracks,
    size,
    unknownSizeCount,
  };
}

export function parseLibrary(raw: RawLibrary): LibraryData {
  const artists = decodeCollection(raw.artists);
  const artistNames = new Map<string, string>();
  for (const artist of artists) {
    artistNames.set(
      artist.id,
      asText(artist.name) ?? (artist.id === "0" ? "Various Artists" : "Unknown artist"),
    );
  }

  const albums = decodeCollection(raw.albums);
  const albumNames = new Map<string, string>();
  for (const album of albums) {
    albumNames.set(album.id, asText(album.name) ?? "Unknown album");
  }

  const trackTags = new Map<string, string[]>();
  if (raw.tags && typeof raw.tags === "object") {
    for (const tagValue of Object.values(raw.tags)) {
      const tagObj = asRecord(tagValue);
      if (!tagObj) continue;
      const tagName = asText(tagObj.name);
      if (!tagName) continue;
      const trackIds = Array.isArray(tagObj.tracks) ? tagObj.tracks : [];
      for (const tid of trackIds) {
        const id = asId(tid);
        if (!id) continue;
        const existing = trackTags.get(id) ?? [];
        existing.push(tagName);
        trackTags.set(id, existing);
      }
    }
  }

  const tracks: Track[] = decodeCollection(raw.tracks).map((item) => {
    const artistId = asId(item.artist_id);
    const albumId = asId(item.album_id);
    const genre = asText(item.genre);
    return {
      id: item.id,
      title: asText(item.title) ?? "Untitled track",
      path: normalizeFolderPath(asText(item.path) ?? ""),
      size: asSize(item.size),
      trashed:
        item.trashed === true || item.trashed === 1 || item.trashed === "1",
      artist:
        artistNames.get(artistId) ??
        (artistId === "0" || !artistId ? "Various Artists" : "Unknown artist"),
      album: albumNames.get(albumId) ?? "Unknown album",
      artistId,
      albumId,
      trackNumber: asNumber(item.track),
      year: asNumber(item.year),
      length: asNumber(item.length),
      file: asText(item.file),
      genre: genre && genre !== "Unknown" ? genre : null,
      tags: trackTags.get(item.id) ?? [],
    };
  });

  const tracksById: Record<string, Track> = {};
  let totalStoredSize = 0;
  for (const track of tracks) {
    tracksById[track.id] = track;
    if (track.size !== null) {
      totalStoredSize += track.size;
    }
  }

  const explicitTrashIds = readTrashIds(raw);
  const derivedTrashIds = tracks
    .filter((track) => track.trashed)
    .map((track) => track.id);
  const trashIds =
    explicitTrashIds.length > 0 ? explicitTrashIds : derivedTrashIds;
  const trash = buildTrashSummary(trashIds, tracksById);

  const activeTracks = tracks.filter((track) => !track.trashed);
  let totalActiveSize = 0;
  let totalActiveUnknownSizeCount = 0;
  for (const track of activeTracks) {
    if (track.size === null) {
      totalActiveUnknownSizeCount += 1;
    } else {
      totalActiveSize += track.size;
    }
  }

  return {
    tracks,
    activeTracks,
    tracksById,
    folders: buildFolders(tracks),
    tagFolders: buildAlbumGroups(tracks, (track) =>
      track.tags.length > 0 ? track.tags : ["Untagged"],
    ),
    genreFolders: buildAlbumGroups(tracks, (track) => [
      track.genre ?? "No genre",
    ]),
    trash,
    totalActiveSize,
    totalActiveUnknownSizeCount,
    totalStoredSize,
    generatedAt: new Date().toISOString(),
  };
}

export function collectFolderTrackIds(folders: FolderSummary[]): string[] {
  const ids = new Set<string>();
  for (const folder of folders) {
    for (const track of folder.tracks) {
      ids.add(track.id);
    }
  }
  return [...ids];
}

export function sizeOfTracks(tracks: Track[]): {
  size: number;
  unknownSizeCount: number;
} {
  let size = 0;
  let unknownSizeCount = 0;
  for (const track of tracks) {
    if (track.size === null) {
      unknownSizeCount += 1;
    } else {
      size += track.size;
    }
  }
  return { size, unknownSizeCount };
}
