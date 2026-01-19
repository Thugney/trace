import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ProfileProvider } from './context/ProfileContext';
import { AgeProvider } from './context/AgeContext';
import { FeatureFlagsProvider, useFeatureFlags } from './context/FeatureFlagsContext';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import ParentDashboard from './pages/ParentDashboard';
import ChildDashboard from './pages/ChildDashboard';
import DietTracking from './pages/DietTracking';
import TasksManager from './pages/TasksManager';
import AIAssistant from './pages/AIAssistant';
import Notes from './pages/Notes';
import Settings from './pages/Settings';
import AdminPanel from './pages/AdminPanel';
import MyJourney from './pages/MyJourney';
import FamilyLeaderboard from './pages/FamilyLeaderboard';
import RewardShop from './pages/RewardShop';
import CalendarView from './pages/CalendarView';
import ControlsPage from './pages/ControlsPage';
import QuizBuilder from './pages/QuizBuilder';
import QuizPlayer from './pages/QuizPlayer';
import School from './pages/School';
import BookLibrary from './pages/BookLibrary';
import BookReader from './pages/BookReader';
import ShoppingList from './pages/ShoppingList';
import ShoppingHelper from './pages/ShoppingHelper';
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
    } else if (currentProfile.type === 'child') {
      return <Navigate to="/child/dashboard" replace />;
    } else if (currentProfile.type === 'teacher') {
      return <Navigate to="/school" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { currentProfile, setCurrentProfile, isLoading } = useProfile();
  const { flags: featureFlags } = useFeatureFlags();
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
            ) : featureFlags.school_only_mode ? (
              <Navigate to="/school" replace />
            ) : currentProfile?.type === 'parent' ? (
              <Navigate to="/parent/dashboard" replace />
            ) : currentProfile?.type === 'child' ? (
              <Navigate to="/child/dashboard" replace />
            ) : currentProfile?.type === 'teacher' ? (
              <Navigate to="/school" replace />
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
            featureFlags.school_only_mode ? (
              <Navigate to="/school" replace />
            ) : (
              <ProtectedRoute allowedRoles={['parent']}>
                <ParentDashboard />
              </ProtectedRoute>
            )
          }
        />
        <Route
          path="/child/dashboard"
          element={
            featureFlags.school_only_mode ? (
              <Navigate to="/school" replace />
            ) : (
              <ProtectedRoute allowedRoles={['child']}>
                <ChildDashboard />
              </ProtectedRoute>
            )
          }
        />

        <Route
          path="/school"
          element={
            <ProtectedRoute allowedRoles={['admin', 'teacher', 'parent', 'child']}>
              <School />
            </ProtectedRoute>
          }
        />

        {/* Diet - Only shown when diet feature flag is enabled */}
        {featureFlags.diet_enabled && !featureFlags.school_only_mode && (
          <Route
            path="/diet"
            element={
              currentProfile?.type === 'child' && currentProfile?.diet_enabled !== 1 ? (
                <Navigate to="/" replace />
              ) : (
                <ProtectedRoute allowedRoles={['parent', 'admin', 'child']}>
                  <DietTracking />
                </ProtectedRoute>
              )
            }
          />
        )}

        {/* Tasks - Only parent, admin, child */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/tasks"
            element={
              <ProtectedRoute allowedRoles={['parent', 'admin', 'child']}>
                <TasksManager />
              </ProtectedRoute>
            }
          />
        )}


        {/* AI - Only children with ai_enabled=1 (admin controls access) */}
        {!featureFlags.school_only_mode && (
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
        )}

        {/* Notes - Only parent, admin, child */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/notes"
            element={
              <ProtectedRoute allowedRoles={['parent', 'admin', 'child']}>
                <Notes />
              </ProtectedRoute>
            }
          />
        )}

        {/* Settings */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={['parent', 'admin', 'child', 'teacher']}>
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

        {/* My Journey - Child, parent, admin */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/journey"
            element={
              <ProtectedRoute allowedRoles={['child', 'parent', 'admin']}>
                <MyJourney />
              </ProtectedRoute>
            }
          />
        )}

        {/* Family Leaderboard - All roles */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute allowedRoles={['child', 'parent', 'admin']}>
                <FamilyLeaderboard />
              </ProtectedRoute>
            }
          />
        )}

        {/* Reward Shop - Children and parents */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/shop"
            element={
              <ProtectedRoute allowedRoles={['child', 'parent', 'admin']}>
                <RewardShop />
              </ProtectedRoute>
            }
          />
        )}

        {/* Parental Controls - Parents only */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/controls"
            element={
              <ProtectedRoute allowedRoles={['parent']}>
                <ControlsPage />
              </ProtectedRoute>
            }
          />
        )}

        {/* Calendar View - All roles */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/calendar"
            element={
              <ProtectedRoute allowedRoles={['child', 'parent', 'admin']}>
                <CalendarView />
              </ProtectedRoute>
            }
          />
        )}

        {/* Quiz Builder - Parents and Admin */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/quizzes/builder"
            element={
              <ProtectedRoute allowedRoles={['parent', 'admin']}>
                <QuizBuilder />
              </ProtectedRoute>
            }
          />
        )}

        {/* Quiz Player - Children */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/quizzes"
            element={
              <ProtectedRoute allowedRoles={['child']}>
                <QuizPlayer />
              </ProtectedRoute>
            }
          />
        )}

        {/* Book Library - Parents and Children */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/books"
            element={
              <ProtectedRoute allowedRoles={['parent', 'admin', 'child']}>
                <BookLibrary />
              </ProtectedRoute>
            }
          />
        )}

        {/* Book Reader - All roles */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/books/read/:bookId"
            element={
              <ProtectedRoute allowedRoles={['parent', 'admin', 'child']}>
                <BookReader />
              </ProtectedRoute>
            }
          />
        )}

        {/* Shopping List - Parents */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/shopping"
            element={
              <ProtectedRoute allowedRoles={['parent', 'admin']}>
                <ShoppingList />
              </ProtectedRoute>
            }
          />
        )}

        {/* Shopping Helper - Children */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/shopping/help"
            element={
              <ProtectedRoute allowedRoles={['child']}>
                <ShoppingHelper />
              </ProtectedRoute>
            }
          />
        )}

        {/* Catch all - redirect to home (which redirects to role dashboard) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <FeatureFlagsProvider>
        <ProfileProvider>
          <AgeProvider>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </AgeProvider>
        </ProfileProvider>
      </FeatureFlagsProvider>
    </Router>
  );
}

export default App;
