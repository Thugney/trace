import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ProfileProvider } from './context/ProfileContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import ParentDashboard from './pages/ParentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import ChildDashboard from './pages/ChildDashboard';
import DietTracking from './pages/DietTracking';
import TasksManager from './pages/TasksManager';
import AIAssistant from './pages/AIAssistant';
import Notes from './pages/Notes';
import Settings from './pages/Settings';
import SchoolDashboard from './pages/SchoolDashboard';
import SchoolStudent from './pages/SchoolStudent';
import SchoolEnroll from './pages/SchoolEnroll';
import AdminPanel from './pages/AdminPanel';
import Messages from './pages/Messages';
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
    if (currentProfile.type === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (currentProfile.type === 'parent') {
      return <Navigate to="/parent/dashboard" replace />;
    } else if (currentProfile.type === 'teacher') {
      return <Navigate to="/teacher/dashboard" replace />;
    } else if (currentProfile.type === 'child') {
      return <Navigate to="/child/dashboard" replace />;
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

    // ALL users go directly to their dashboard - NO profile selector
    setParentProfile(loggedInProfile);
    setCurrentProfile(loggedInProfile);
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

  // Everyone goes directly to their dashboard
  if (!currentProfile) {
    // This shouldn't happen, but just in case
    setCurrentProfile(parentProfile);
    return null;
  }

  return (
    <Layout>
      <Routes>
        {/* Home - Redirect to role-specific dashboard */}
        <Route
          path="/"
          element={
            currentProfile?.type === 'admin' ? (
              <Navigate to="/admin/dashboard" replace />
            ) : currentProfile?.type === 'parent' ? (
              <Navigate to="/parent/dashboard" replace />
            ) : currentProfile?.type === 'teacher' ? (
              <Navigate to="/teacher/dashboard" replace />
            ) : currentProfile?.type === 'child' ? (
              <Navigate to="/child/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Role-Specific Dashboards */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent/dashboard"
          element={
            <ProtectedRoute allowedRoles={['parent']}>
              <ParentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/dashboard"
          element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/child/dashboard"
          element={
            <ProtectedRoute allowedRoles={['child']}>
              <ChildDashboard />
            </ProtectedRoute>
          }
        />

        {/* Diet - Only parent, admin */}
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

        {/* AI - Only children with ai_enabled=1 (admin controls access) */}
        <Route
          path="/ai"
          element={
            currentProfile?.type === 'child' && currentProfile?.ai_enabled !== 1 ? (
              <Navigate to="/" replace />
            ) : (
              <ProtectedRoute allowedRoles={['child']}>
                <AIAssistant />
              </ProtectedRoute>
            )
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

        {/* Messages - Only teacher and parent */}
        <Route
          path="/messages"
          element={
            <ProtectedRoute allowedRoles={['teacher', 'parent']}>
              <Messages />
            </ProtectedRoute>
          }
        />

        {/* Catch all - redirect to home (which redirects to role dashboard) */}
        <Route path="*" element={<Navigate to="/" replace />} />
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
