import MevaLandingPage from "./pages/MevaLandingPage";
import MevaHubPage from "./pages/MevaHubPage";
import MevaPublicPage from "./pages/MevaPublicPage";

export default function App() {
  const rawPath = window.location.pathname;
  const path =
    rawPath.length > 1 && rawPath.endsWith("/")
      ? rawPath.slice(0, -1)
      : rawPath;

  if (path === "/hub") {
    return <MevaHubPage />;
  }

  if (path === "/m" || path.startsWith("/m/")) {
    return <MevaPublicPage />;
  }

  return <MevaLandingPage />;
}