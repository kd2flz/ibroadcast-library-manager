import { describe, expect, it } from "vitest";
import { parseLibrary } from "./library";
import { createZip } from "./zip";

const raw = {
  tracks: {
    map: { title: 0, album_id: 1, size: 2, genre: 3, path: 4, file: 5, trashed: 6 },
    "1": ["A", 10, 100, "Rock", "/m/a", "/128/a/b/1", false],
    "2": ["B", 10, 200, "Rock", "/m/a", "/128/a/b/2", false],
    "3": ["C", 11, 300, "", "/m/b", "/128/a/b/3", false],
    "4": ["D", 11, 400, "Rock", "/m/b", "/128/a/b/4", true],
  },
  albums: { map: { name: 0 }, "10": ["Album X"], "11": ["Album Y"] },
  tags: { "9": { name: "Fav/Set", tracks: [1, 3] } },
} as never;

describe("parseLibrary groupings", () => {
  const lib = parseLibrary(raw);

  it("groups by genre then album, skipping trashed tracks", () => {
    const paths = lib.genreFolders.map((f) => f.path).sort();
    expect(paths).toEqual(["No genre/Album Y", "Rock/Album X"]);
    expect(lib.genreFolders.find((f) => f.path === "Rock/Album X")?.size).toBe(300);
  });

  it("groups by tag, sanitises slashes, and puts untagged tracks together", () => {
    const paths = lib.tagFolders.map((f) => f.path).sort();
    expect(paths).toEqual(["Fav-Set/Album X", "Fav-Set/Album Y", "Untagged/Album X"]);
  });

  it("keeps the file path for downloads", () => {
    expect(lib.tracksById["1"]?.file).toBe("/128/a/b/1");
  });
});

describe("createZip", () => {
  it("writes a valid stored archive", async () => {
    const blob = createZip([{ name: "a.txt", data: new TextEncoder().encode("hi") }]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(bytes.length - 22 + 10, true)).toBe(1);
  });
});
