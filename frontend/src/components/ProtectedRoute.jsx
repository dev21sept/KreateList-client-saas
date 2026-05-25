import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const currentPath = window.location.pathname;
  const isBillingPath = currentPath === '/subscription' || currentPath === '/checkout';

  if (user.role !== 'admin' && user.subscription?.status !== 'active' && !isBillingPath) {
    return <Navigate to="/subscription" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
