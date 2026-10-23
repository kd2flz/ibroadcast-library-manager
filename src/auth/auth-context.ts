import { createContext, useContext } from "react";
import type { DeviceFlowState, LibraryData, Usage } from "../lib/types";

export type AuthPhase = "booting" | "signed_out" | "signed_in";

export interface AuthContextValue {
  phase: AuthPhase;
  clientId: string;
  usingEnvClientId: boolean;
  redirectUri: string;
  usage: Usage | null;
  library: LibraryData | null;
  lastSynced: Date | null;
  busyMessage: string | null;
  error: string | null;
  device: DeviceFlowState | null;
  connect: () => Promise<void>;
  startDeviceFlow: () => Promise<void>;
  cancelDeviceFlow: () => void;
  completeCallback: (code: string, state: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateClientId: (clientId: string) => void;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
