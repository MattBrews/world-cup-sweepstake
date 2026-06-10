import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import FixturesPage from './pages/FixturesPage';
import StandingsPage from './pages/StandingsPage';
import StatsPage from './pages/StatsPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminManagePage from './pages/AdminManagePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/sweepstake/:slug" element={<DashboardPage />} />
      <Route path="/sweepstake/:slug/fixtures" element={<FixturesPage />} />
      <Route path="/sweepstake/:slug/standings" element={<StandingsPage />} />
      <Route path="/sweepstake/:slug/stats" element={<StatsPage />} />
      <Route path="/admin" element={<AdminLoginPage />} />
      <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
      <Route path="/admin/:slug" element={<AdminManagePage />} />
    </Routes>
  );
}
