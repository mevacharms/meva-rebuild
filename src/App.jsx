import { useEffect } from "react";
import MevaLandingPage from "./pages/MevaLandingPage";
import MevaPublicPage from "./pages/MevaPublicPage";

function HubRedirect() {
  useEffect(() => {
    window.location.replace("/m");
  }, []);

  return null;
}

export default function App() {
  const rawPath = window.location.pathname;
  const path =
    rawPath.length > 1 && rawPath.endsWith("/")
      ? rawPath.slice(0, -1)
      : rawPath;

  if (path === "/hub") {
    return <HubRedirect />;
  }

  if (path === "/m" || path.startsWith("/m/")) {
    return <MevaPublicPage />;
  }

  return <MevaLandingPage />;
}