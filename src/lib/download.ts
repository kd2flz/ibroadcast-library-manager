import { ApiError, fetchStatus } from "./api";
import type { Track } from "./types";
import { createZip, type ZipEntry } from "./zip";

// Keep each archive modest: it is built in memory and uses 32-bit offsets.
const MAX_PART_BYTES = 1_000_000_000;

export interface DownloadProgress {
  done: number;
  total: number;
  part: number;
  message: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function safeName(value: string): string {
  return (
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
      .replace(/^\.+/, "_")
      .trim()
      .slice(0, 120) || "Unknown"
  );
}

function extensionFor(contentType: string | null, file: string): string {
  const type = (contentType ?? "").toLowerCase();
  if (type.includes("flac")) return "flac";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("wav")) return "wav";
  if (type.includes("mp4") || type.includes("aac") || type.includes("m4a")) {
    return "m4a";
  }
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  const match = /\.([a-z0-9]{2,4})$/i.exec(file);
  return match?.[1]?.toLowerCase() ?? "mp3";
}

function entryName(track: Track, ext: string, used: Set<string>): string {
  const number = track.trackNumber
    ? `${String(track.trackNumber).padStart(2, "0")} - `
    : "";
  const base = `${safeName(track.artist)}/${safeName(track.album)}/${number}${safeName(track.title)}`;
  let name = `${base}.${ext}`;
  for (let n = 2; used.has(name); n += 1) {
    name = `${base} (${n}).${ext}`;
  }
  used.add(name);
  return name;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export interface DownloadResult {
  downloadedIds: string[];
  failed: { track: Track; reason: string }[];
  parts: number;
}

/**
 * Downloads the original files for the tracks and saves them as one or more
 * zip archives. Uses the Authorization header (never the URL) for the token.
 */
export async function downloadTracksAsZip(
  tracks: Track[],
  token: string,
  label: string,
  onProgress: (progress: DownloadProgress) => void,
  signal: AbortSignal,
): Promise<DownloadResult> {
  const status = await fetchStatus(token);
  const settings = asRecord(status.settings);
  const user = asRecord(status.user);
  const server =
    typeof settings?.streaming_server === "string"
      ? settings.streaming_server.replace(/\/+$/, "")
      : null;
  if (!server) {
    throw new ApiError("iBroadcast did not return a streaming server.");
  }
  const userId = user?.id !== undefined ? String(user.id) : "";

  const result: DownloadResult = { downloadedIds: [], failed: [], parts: 0 };
  const used = new Set<string>();
  let entries: ZipEntry[] = [];
  let entryIds: string[] = [];
  let partBytes = 0;
  let part = 1;
  let done = 0;

  function flush() {
    if (entries.length === 0) return;
    const suffix = part > 1 || tracks.length > entries.length ? `-part${part}` : "";
    saveBlob(createZip(entries), `${safeName(label)}${suffix}.zip`);
    result.downloadedIds.push(...entryIds);
    result.parts += 1;
    part += 1;
    entries = [];
    entryIds = [];
    partBytes = 0;
  }

  for (const track of tracks) {
    if (signal.aborted) break;
    onProgress({
      done,
      total: tracks.length,
      part,
      message: `${track.artist} – ${track.title}`,
    });
    try {
      if (!track.file) throw new Error("No file path in library data.");
      const path = track.file.replace(/^\/?[^/]+/, "/orig");
      const query = new URLSearchParams({
        file_id: track.id,
        user_id: userId,
        platform: "ibroadcast-library-manager",
        version: "1.0.0",
      });
      const response = await fetch(`${server}${path}?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!response.ok) {
        throw new Error(
          response.status === 401 || response.status === 403
            ? "iBroadcast refused the download (not authorized)."
            : `Download failed (${response.status}).`,
        );
      }
      const data = new Uint8Array(await response.arrayBuffer());
      if (partBytes > 0 && partBytes + data.length > MAX_PART_BYTES) flush();
      const ext = extensionFor(response.headers.get("content-type"), track.file);
      entries.push({ name: entryName(track, ext, used), data });
      entryIds.push(track.id);
      partBytes += data.length;
    } catch (caught) {
      if (signal.aborted) break;
      result.failed.push({
        track,
        reason: caught instanceof Error ? caught.message : "Download failed.",
      });
      // An authorization problem will affect every file; stop early.
      if (done === 0 && result.failed.length >= 3 && entries.length === 0) break;
    }
    done += 1;
  }
  flush();
  onProgress({ done, total: tracks.length, part, message: "Done" });
  return result;
}
