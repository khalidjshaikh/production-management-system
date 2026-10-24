import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { WellsPage } from './pages/WellsPage';
import { WellDetailPage } from './pages/WellDetailPage';
import { ProductionPage } from './pages/ProductionPage';
import { DowntimePage } from './pages/DowntimePage';
import { ForecastPage } from './pages/ForecastPage';
import { ForecastDetailPage } from './pages/ForecastDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="wells" element={<WellsPage />} />
        <Route path="wells/:id" element={<WellDetailPage />} />
        <Route path="production" element={<ProductionPage />} />
        <Route path="downtime" element={<DowntimePage />} />
        <Route path="forecast" element={<ForecastPage />} />
        <Route path="forecast/:id" element={<ForecastDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
