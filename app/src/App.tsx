import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AppLayout } from './components/layout/AppLayout';
import { LandingPage } from './pages/LandingPage';
import { WelcomePage } from './pages/WelcomePage';
import { WelcomeGate } from './components/product/WelcomeGate';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((mod) => ({ default: mod.DashboardPage })),
);
const VerifyPage = lazy(() =>
  import('./pages/VerifyPage').then((mod) => ({ default: mod.VerifyPage })),
);
const TransferPage = lazy(() =>
  import('./pages/TransferPage').then((mod) => ({ default: mod.TransferPage })),
);
const AuditorPage = lazy(() =>
  import('./pages/AuditorPage').then((mod) => ({ default: mod.AuditorPage })),
);
const AdminPage = lazy(() =>
  import('./pages/AdminPage').then((mod) => ({ default: mod.AdminPage })),
);
const CompliancePage = lazy(() =>
  import('./pages/CompliancePage').then((mod) => ({ default: mod.CompliancePage })),
);
const MarketplacePage = lazy(() =>
  import('./pages/MarketplacePage').then((mod) => ({ default: mod.MarketplacePage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((mod) => ({ default: mod.SettingsPage })),
);
const OfferingDetailRoute = lazy(() =>
  import('./pages/OfferingDetailPage').then((mod) => ({ default: mod.OfferingDetailRoute })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--lg-background)]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#007dfc] border-t-transparent" />
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/home" element={<Navigate to="/app/home" replace />} />
      <Route path="/passport" element={<Navigate to="/app/verify" replace />} />
      <Route path="/invest" element={<Navigate to="/app/marketplace" replace />} />
      <Route path="/send" element={<Navigate to="/app/send" replace />} />
      <Route path="/receipt" element={<Navigate to="/app/compliance" replace />} />
      <Route path="/audit" element={<Navigate to="/app/auditor" replace />} />
      <Route path="/operators" element={<Navigate to="/app/admin" replace />} />
      <Route path="/app" element={<Navigate to="/app/welcome" replace />} />
      <Route path="/app/welcome" element={<WelcomeGate><WelcomePage /></WelcomeGate>} />
      <Route path="/app" element={<AppLayout />}>
        <Route path="home" element={<DashboardPage />} />
        <Route path="dashboard" element={<Navigate to="/app/home" replace />} />
        <Route path="verify" element={<VerifyPage />} />
        <Route path="send" element={<TransferPage />} />
        <Route path="auditor" element={<AuditorPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="passport" element={<Navigate to="/app/verify" replace />} />
        <Route path="marketplace" element={<MarketplacePage />} />
        <Route path="marketplace/:offeringId" element={<OfferingDetailRoute />} />
        <Route path="portfolio" element={<Navigate to="/app/home" replace />} />
        <Route path="compliance" element={<CompliancePage />} />
        <Route path="receipt" element={<Navigate to="/app/compliance" replace />} />
        <Route path="activity" element={<Navigate to="/app/compliance?tab=activity" replace />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="credential" element={<Navigate to="/app/verify" replace />} />
        <Route path="prove" element={<Navigate to="/app/verify" replace />} />
        <Route path="transfer" element={<Navigate to="/app/send" replace />} />
      </Route>
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
