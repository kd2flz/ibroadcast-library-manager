export interface TokenSet {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope?: string[];
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  interval?: number;
  expires_in?: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export type LibraryFieldMap = Record<string, number>;

export interface RawLibraryCollection {
  map?: LibraryFieldMap;
  [id: string]: unknown;
}

export interface RawLibrary {
  tracks?: RawLibraryCollection;
  albums?: RawLibraryCollection;
  artists?: RawLibraryCollection;
  playlists?: RawLibraryCollection;
  tags?: Record<string, unknown>;
  trash?: RawLibraryCollection;
  [key: string]: unknown;
}

export interface DecodedItem {
  id: string;
  [field: string]: unknown;
}

export interface Track {
  id: string;
  title: string;
  path: string;
  size: number | null;
  trashed: boolean;
  artist: string;
  album: string;
  artistId: string;
  albumId: string;
  trackNumber: number | null;
  year: number | null;
  length: number | null;
  genre: string | null;
  file: string | null;
  tags: string[];
}

export interface FolderSummary {
  path: string;
  tracks: Track[];
  size: number;
  unknownSizeCount: number;
  trashedCount: number;
}

export interface TrashSummary {
  ids: string[];
  tracks: Track[];
  size: number;
  unknownSizeCount: number;
}

export interface LibraryData {
  tracks: Track[];
  activeTracks: Track[];
  tracksById: Record<string, Track>;
  folders: FolderSummary[];
  tagFolders: FolderSummary[];
  genreFolders: FolderSummary[];
  trash: TrashSummary;
  totalActiveSize: number;
  totalActiveUnknownSizeCount: number;
  totalStoredSize: number;
  generatedAt: string;
}

export interface Usage {
  tier: string;
  tierLabel: string;
  storageUsed: number;
  storageLimit: number | null;
  limitKnown: boolean;
  usedPercent: number | null;
  remaining: number | null;
  overBy: number;
  nearLimit: boolean;
  overLimit: boolean;
  unlimited: boolean;
  hiddenFiles: number;
  enforced: boolean;
  enforcedFrom: string | null;
  fallbackLimit: boolean;
  estimated: boolean;
}

export interface OAuthTransaction {
  state: string;
  verifier: string;
  redirectUri: string;
  clientId: string;
  createdAt: number;
}

export type DeviceFlowStatus =
  | "requesting"
  | "waiting"
  | "success"
  | "expired"
  | "denied"
  | "error";

export interface DeviceFlowState {
  status: DeviceFlowStatus;
  userCode?: string;
  verificationUri?: string;
  verificationUriComplete?: string;
  expiresAt?: number;
  message?: string;
}
