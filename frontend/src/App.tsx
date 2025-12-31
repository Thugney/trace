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
  const { currentProfile, isLoading } = useProfile();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const authStatus = localStorage.getItem('family_auth');
    setIsAuthenticated(authStatus === 'true');
    setCheckingAuth(false);
  }, []);

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
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

  if (!isAuthenticated) {
    return <Login onAuthenticated={handleAuthenticated} />;
  }

  if (!currentProfile) {
    return <ProfileSelector />;
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
