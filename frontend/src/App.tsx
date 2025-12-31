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
        <Route path="/" element={<Dashboard />} />
        <Route path="/diet" element={<DietTracking />} />
        <Route path="/tasks" element={<TasksManager />} />
        <Route
          path="/school"
          element={
            currentProfile?.type === 'teacher' ? <SchoolDashboard /> : <SchoolStudent />
          }
        />
        <Route path="/school/enroll" element={<SchoolEnroll />} />
        <Route path="/ai" element={<AIAssistant />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<AdminPanel />} />
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
