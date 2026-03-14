import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ConsoleLayout } from "./layouts/console-layout.js";
import { AgentsPage } from "./pages/agents-page.js";
import { AuthProfilesPage } from "./pages/auth-profiles-page.js";
import { BindingsPage } from "./pages/bindings-page.js";
import { OverviewPage } from "./pages/overview-page.js";
import { SessionsPage } from "./pages/sessions-page.js";
import { TopologyPage } from "./pages/topology-page.js";
import { WorkspacesPage } from "./pages/workspaces-page.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<ConsoleLayout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/bindings" element={<BindingsPage />} />
          <Route path="/auth-profiles" element={<AuthProfilesPage />} />
          <Route path="/topology" element={<TopologyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
