const GB = 1_000_000_000;
const MB = 1_000_000;
const KB = 1_000;

function trimDecimal(value: number): string {
  return value
    .toFixed(1)
    .replace(/\.0$/, "")
    .replace(/(\.\d)0$/, "$1");
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return "Unknown";
  }

  const value = Math.max(0, bytes);
  if (value >= GB) {
    const gb = value / GB;
    return `${trimDecimal(gb >= 100 ? Math.round(gb) : gb)} GB`;
  }
  if (value >= MB) {
    return `${trimDecimal(value / MB)} MB`;
  }
  if (value >= KB) {
    return `${trimDecimal(value / KB)} KB`;
  }
  return `${Math.round(value)} B`;
}

export function formatPercent(percent: number | null): string {
  if (percent === null || !Number.isFinite(percent)) {
    return "—";
  }
  if (percent >= 999) {
    return "999%";
  }
  return `${Math.max(0, Math.round(percent))}%`;
}

export function formatDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return count === 1 ? singular : plural;
}

export function formatTrackCount(count: number): string {
  return `${count.toLocaleString()} ${pluralize(count, "track")}`;
}

export function formatFolderCount(count: number): string {
  return `${count.toLocaleString()} ${pluralize(count, "folder")}`;
}
