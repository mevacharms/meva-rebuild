import MevaLandingPage from "./pages/MevaLandingPage";
import MevaHubPage from "./pages/MevaHubPage";
import MevaPublicPage from "./pages/MevaPublicPage";

export default function App() {
  const path = window.location.pathname;

  if (path === "/hub") {
    return <MevaHubPage />;
  }

  if (path.startsWith("/m/")) {
    return <MevaPublicPage />;
  }

  return <MevaLandingPage />;
}