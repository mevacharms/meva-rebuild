import MevaLandingPage from "./pages/MevaLandingPage";
import MevaHubPage from "./pages/MevaHubPage";
import MevaIdPage from "./pages/MevaIdPage";

export default function App() {
  const rawPath = window.location.pathname;
  const path =
    rawPath.length > 1 && rawPath.endsWith("/")
      ? rawPath.slice(0, -1)
      : rawPath;

  if (path === "/m") {
    return <MevaHubPage />;
  }

  if (path.startsWith("/m/")) {
    return <MevaIdPage />;
  }

  return <MevaLandingPage />;
}