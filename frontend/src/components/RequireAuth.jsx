import { LoaderCircle } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext.jsx';

export default function RequireAuth({ children }) {
  const { configured, loading, user } = useAuthContext();
  const location = useLocation();

  if (loading) {
    return (
      <main className="auth-loading-screen">
        <LoaderCircle className="loading-icon" size={24} />
        <span>RESTORING YOUR SESSION</span>
      </main>
    );
  }

  if (!configured) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
