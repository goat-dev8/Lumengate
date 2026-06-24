import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { VerifyPage } from './pages/VerifyPage';
import { TransferPage } from './pages/TransferPage';
import { AuditorPage } from './pages/AuditorPage';
import { AdminPage } from './pages/AdminPage';
import { CompliancePage } from './pages/CompliancePage';
import { MarketplacePage } from './pages/MarketplacePage';
import { PortfolioPage } from './pages/PortfolioPage';
import { SettingsPage } from './pages/SettingsPage';
import { ActivityPage } from './pages/ActivityPage';
import { OfferingDetailRoute } from './pages/OfferingDetailPage';

function AppRoutes() {
  const location = useLocation();
  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<Navigate to="/app/home" replace />} />
      <Route path="/app/home" element={<DashboardPage />} />
      <Route path="/app/dashboard" element={<Navigate to="/app/home" replace />} />
      <Route path="/app/verify" element={<VerifyPage />} />
      <Route path="/app/send" element={<TransferPage />} />
      <Route path="/app/auditor" element={<AuditorPage />} />
      <Route path="/app/admin" element={<AdminPage />} />
      <Route path="/app/passport" element={<Navigate to="/app/verify" replace />} />
      <Route path="/app/marketplace" element={<MarketplacePage />} />
      <Route path="/app/marketplace/:offeringId" element={<OfferingDetailRoute />} />
      <Route path="/app/portfolio" element={<PortfolioPage />} />
      <Route path="/app/compliance" element={<CompliancePage />} />
      <Route path="/app/activity" element={<ActivityPage />} />
      <Route path="/app/settings" element={<SettingsPage />} />
      <Route path="/app/credential" element={<Navigate to="/app/verify" replace />} />
      <Route path="/app/prove" element={<Navigate to="/app/verify" replace />} />
      <Route path="/app/transfer" element={<Navigate to="/app/send" replace />} />
    </Routes>
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
