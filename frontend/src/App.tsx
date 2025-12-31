import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ProfileProvider } from './context/ProfileContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import ProfileSelector from './pages/ProfileSelector';
import Dashboard from './pages/Dashboard';
import DietTracking from './pages/DietTracking';
import TasksManager from './pages/TasksManager';
import AIAssistant from './pages/AIAssistant';
import Notes from './pages/Notes';
import Settings from './pages/Settings';
import SchoolDashboard from './pages/SchoolDashboard';
import SchoolStudent from './pages/SchoolStudent';
import SchoolEnroll from './pages/SchoolEnroll';
import AdminPanel from './pages/AdminPanel';
import { useProfile } from './context/ProfileContext';

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { currentProfile } = useProfile();

  if (!currentProfile) {
    return <Navigate to="/" replace />;
  }

  // If user role is not in allowed roles, redirect based on their role
  if (!allowedRoles.includes(currentProfile.type)) {
    // Redirect to appropriate home page based on role
    if (currentProfile.type === 'teacher') {
      return <Navigate to="/school" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { currentProfile, setCurrentProfile, isLoading } = useProfile();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [parentProfile, setParentProfile] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const authStatus = localStorage.getItem('family_auth');
    const savedParent = localStorage.getItem('parent_profile');

    setIsAuthenticated(authStatus === 'true');
    if (savedParent) {
      try {
        setParentProfile(JSON.parse(savedParent));
      } catch (e) {
        console.error('Failed to parse parent profile:', e);
      }
    }
    setCheckingAuth(false);
  }, []);

  const handleAuthenticated = (loggedInProfile: any) => {
    setIsAuthenticated(true);

    // If a child, teacher, or admin logs in, set them as current profile directly (skip profile selection)
    if (loggedInProfile.type === 'child' || loggedInProfile.type === 'teacher' || loggedInProfile.type === 'admin') {
      setParentProfile(loggedInProfile);
      setCurrentProfile(loggedInProfile);
      return; // Don't show profile selection for kids, teachers, and admin
    }

    // If a parent logs in, store and show profile selection
    setParentProfile(loggedInProfile);
  };

  if (checkingAuth || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !parentProfile) {
    return <Login onAuthenticated={handleAuthenticated} />;
  }

  // If child, teacher, or admin logged in and profile is set, show dashboard (skip profile selection)
  if ((parentProfile.type === 'child' || parentProfile.type === 'teacher' || parentProfile.type === 'admin') && currentProfile) {
    // Child/teacher/admin goes directly to dashboard - continue to render Layout below
  } else if (!currentProfile) {
    // Parent logged in without selecting a profile - show profile selection
    return <ProfileSelector parentProfile={parentProfile} />;
  }

  return (
    <Layout>
      <Routes>
        {/* Dashboard - Not for teachers */}
        <Route
          path="/"
          element={
            currentProfile?.type === 'teacher' ? (
              <Navigate to="/school" replace />
            ) : (
              <Dashboard />
            )
          }
        />

        {/* Diet - Only parent, admin, child */}
        <Route
          path="/diet"
          element={
            <ProtectedRoute allowedRoles={['parent', 'admin']}>
              <DietTracking />
            </ProtectedRoute>
          }
        />

        {/* Tasks - Only parent, admin, child */}
        <Route
          path="/tasks"
          element={
            <ProtectedRoute allowedRoles={['parent', 'admin', 'child']}>
              <TasksManager />
            </ProtectedRoute>
          }
        />

        {/* School - Everyone */}
        <Route
          path="/school"
          element={
            currentProfile?.type === 'teacher' ? <SchoolDashboard /> : <SchoolStudent />
          }
        />

        {/* School Enrollment - Only parent and admin */}
        <Route
          path="/school/enroll"
          element={
            <ProtectedRoute allowedRoles={['parent', 'admin']}>
              <SchoolEnroll />
            </ProtectedRoute>
          }
        />

        {/* AI - Only parent, admin, child */}
        <Route
          path="/ai"
          element={
            <ProtectedRoute allowedRoles={['parent', 'admin', 'child']}>
              <AIAssistant />
            </ProtectedRoute>
          }
        />

        {/* Notes - Only parent, admin, child */}
        <Route
          path="/notes"
          element={
            <ProtectedRoute allowedRoles={['parent', 'admin', 'child']}>
              <Notes />
            </ProtectedRoute>
          }
        />

        {/* Settings - Only parent, admin */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={['parent', 'admin']}>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Admin Panel - Only admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminPanel />
            </ProtectedRoute>
          }
        />

        {/* Catch all - redirect based on role */}
        <Route
          path="*"
          element={
            currentProfile?.type === 'teacher' ? (
              <Navigate to="/school" replace />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <ProfileProvider>
        <AppRoutes />
      </ProfileProvider>
    </Router>
  );
}

export default App;
