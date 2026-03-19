import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ConsoleLayout } from "./layouts/console-layout.js";
import { AgentsPage } from "./pages/agents-page.js";
import { ActivityPage } from "./pages/activity-page.js";
import { AuthProfilesPage } from "./pages/auth-profiles-page.js";
import { BindingsPage } from "./pages/bindings-page.js";
import { CoveragePage } from "./pages/coverage-page.js";
import { CronDetailPage } from "./pages/cron-detail-page.js";
import { CronPage } from "./pages/cron-page.js";
import { FleetMapPage } from "./pages/fleet-map-page.js";
import { EvidenceDetailPage } from "./pages/evidence-detail-page.js";
import { EvidencePage } from "./pages/evidence-page.js";
import { FindingDetailPage } from "./pages/finding-detail-page.js";
import { FindingsPage } from "./pages/findings-page.js";
import { LogsPage } from "./pages/logs-page.js";
import { NodesPage } from "./pages/nodes-page.js";
import { OverviewPage } from "./pages/overview-page.js";
import { RecommendationDetailPage } from "./pages/recommendation-detail-page.js";
import { RecommendationsPage } from "./pages/recommendations-page.js";
import { RisksPage } from "./pages/risks-page.js";
import { SessionsPage } from "./pages/sessions-page.js";
import { TargetDetailPage } from "./pages/target-detail-page.js";
import { TargetsPage } from "./pages/targets-page.js";
import { TopologyPage } from "./pages/topology-page.js";
import { WorkspacesPage } from "./pages/workspaces-page.js";
import { StreamingProvider } from "./components/streaming-provider.js";

export function App() {
  return (
    <StreamingProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<ConsoleLayout />}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/targets" element={<TargetsPage />} />
            <Route path="/targets/:id" element={<TargetDetailPage />} />
            <Route path="/coverage" element={<CoveragePage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/cron" element={<CronPage />} />
            <Route path="/cron/:id" element={<CronDetailPage />} />
            <Route path="/nodes" element={<NodesPage />} />
            <Route path="/risks" element={<RisksPage />} />
            <Route path="/findings" element={<FindingsPage />} />
            <Route path="/recommendations" element={<RecommendationsPage />} />
            <Route path="/recommendations/:id" element={<RecommendationDetailPage />} />
            <Route path="/findings/:id" element={<FindingDetailPage />} />
            <Route path="/evidence" element={<EvidencePage />} />
            <Route path="/evidence/:id" element={<EvidenceDetailPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/workspaces" element={<WorkspacesPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/bindings" element={<BindingsPage />} />
            <Route path="/auth-profiles" element={<AuthProfilesPage />} />
            <Route path="/topology" element={<TopologyPage />} />
            <Route path="/fleet-map" element={<FleetMapPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StreamingProvider>
  );
}
