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
    setParentProfile(loggedInProfile);

    // If a child logs in, set them as current profile directly
    if (loggedInProfile.type === 'child') {
      setCurrentProfile(loggedInProfile);
    }
    // If a parent logs in, show profile selection
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

  // If child is logged in, skip profile selection
  if (parentProfile.type === 'child' && currentProfile) {
    // Already using child's profile, show dashboard
  } else if (!currentProfile) {
    // Parent logged in, show profile selection
    return <ProfileSelector parentProfile={parentProfile} />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/diet" element={<DietTracking />} />
        <Route path="/tasks" element={<TasksManager />} />
        <Route path="/ai" element={<AIAssistant />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/settings" element={<Settings />} />
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
