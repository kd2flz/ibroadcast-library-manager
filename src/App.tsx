import { useCallback, useEffect, useState } from "react";
import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./auth/auth-context";
import { LogoMark } from "./components/Icons";
import { CallbackScreen } from "./screens/CallbackScreen";
import { ConnectScreen } from "./screens/ConnectScreen";
import { DashboardScreen } from "./screens/DashboardScreen";

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

function BootScreen() {
  return (
    <div className="boot-shell">
      <LogoMark size={42} />
      <span className="spinner" />
      <p>Starting Library Manager…</p>
    </div>
  );
}

function ActiveScreen() {
  const { phase } = useAuth();
  if (phase === "booting") {
    return <BootScreen />;
  }
  if (phase === "signed_in") {
    return <DashboardScreen />;
  }
  return <ConnectScreen />;
}

function AppRoutes() {
  const [pathname, setPathname] = useState(() =>
    normalizePath(window.location.pathname),
  );

  useEffect(() => {
    function onPopState() {
      setPathname(normalizePath(window.location.pathname));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigateHome = useCallback(() => {
    window.history.replaceState({}, "", "/");
    setPathname("/");
  }, []);

  if (pathname === "/callback") {
    return <CallbackScreen onNavigateHome={navigateHome} />;
  }

  return <ActiveScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
