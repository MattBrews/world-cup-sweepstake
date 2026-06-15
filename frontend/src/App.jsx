import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import FixturesPage from './pages/FixturesPage';
import StatsPage from './pages/StatsPage';
import ParticipantsPage from './pages/ParticipantsPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminManagePage from './pages/AdminManagePage';
import AdminV2DataPage from './pages/AdminV2DataPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/sweepstake/:publicId" element={<DashboardPage />} />
      <Route path="/sweepstake/:publicId/fixtures" element={<FixturesPage />} />
      <Route path="/sweepstake/:publicId/stats" element={<StatsPage />} />
      <Route path="/sweepstake/:publicId/participants" element={<ParticipantsPage />} />
      <Route path="/admin" element={<AdminLoginPage />} />
      <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
      <Route path="/admin/v2-data" element={<AdminV2DataPage />} />
      <Route path="/admin/:slug" element={<AdminManagePage />} />
    </Routes>
  );
}
