import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// Layouts
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Listings from './pages/Listings';
import CreateListing from './pages/CreateListing';
import Rules from './pages/Rules';
import EbayAccounts from './pages/EbayAccounts';
import Subscription from './pages/Subscription';
import Settings from './pages/Settings';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminSettings from './pages/admin/AdminSettings';

// Components
import ProtectedRoute from './components/ProtectedRoute';

const App = () => {
  return (
    <Router>
      <AnimatePresence mode="wait">
        <Routes>
          {/* Public Routes */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
          </Route>

          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>

          {/* User Protected Routes */}
          <Route element={<ProtectedRoute adminOnly={false} />}>
            <Route element={<DashboardLayout isAdmin={false} />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/listings" element={<Listings />} />
              <Route path="/create-listing" element={<CreateListing />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/ebay-accounts" element={<EbayAccounts />} />
              {/* Alias for ebay callback to handle it on the same page */}
              <Route path="/ebay-callback" element={<EbayAccounts />} />
              <Route path="/subscription" element={<Subscription />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>

          {/* Admin Protected Routes */}
          <Route element={<ProtectedRoute adminOnly={true} />}>
            <Route element={<DashboardLayout isAdmin={true} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Router>
  );
};

export default App;
