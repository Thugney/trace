import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ProfileProvider } from './context/ProfileContext';
import { AgeProvider } from './context/AgeContext';
import { FeatureFlagsProvider, useFeatureFlags } from './context/FeatureFlagsContext';
import { ProfileFeaturesProvider } from './context/ProfileFeaturesContext';
import { PermissionsProvider, usePermissions } from './context/PermissionsContext';
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
import ActivityPlayer from './pages/ActivityPlayer';
import ActivityBuilder from './pages/ActivityBuilder';
import H5PManager from './pages/H5PManager';
import { useProfile } from './context/ProfileContext';

// Protected Route Component - Role-based
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

// Module Protected Route Component - Module-based access control
// Checks both role AND module permissions (core_app vs church_school)
function ModuleProtectedRoute({
  children,
  allowedRoles,
  requireModule
}: {
  children: React.ReactNode;
  allowedRoles: string[];
  requireModule?: 'core_app' | 'church_school';
}) {
  const { currentProfile } = useProfile();
  const { hasCoreAppAccess, hasChurchSchoolAccess, family, isLoading } = usePermissions();

  if (!currentProfile) {
    return <Navigate to="/" replace />;
  }

  // Wait for permissions to load
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check role first
  if (!allowedRoles.includes(currentProfile.type)) {
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

  // Check module access if required
  if (requireModule) {
    const isFamilyB = family?.type === 'B';

    if (requireModule === 'core_app' && !hasCoreAppAccess) {
      // Family B or no core_app access - redirect to church school
      if (isFamilyB || currentProfile.type === 'teacher') {
        return <Navigate to="/school" replace />;
      }
      return <Navigate to="/" replace />;
    }

    if (requireModule === 'church_school' && !hasChurchSchoolAccess) {
      // No church school access - redirect to home
      if (currentProfile.type === 'admin') {
        return <Navigate to="/admin/dashboard" replace />;
      } else if (currentProfile.type === 'parent') {
        return <Navigate to="/parent/dashboard" replace />;
      } else if (currentProfile.type === 'child') {
        return <Navigate to="/child/dashboard" replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { currentProfile, setCurrentProfile, isLoading } = useProfile();
  const { flags: featureFlags } = useFeatureFlags();
  const { family, isLoading: permissionsLoading } = usePermissions();
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
            // Admin always goes to admin dashboard
            currentProfile?.type === 'admin' ? (
              <Navigate to="/admin/dashboard" replace />
            ) : // School only mode OR Family B users go to church school
            featureFlags.school_only_mode || (!permissionsLoading && family?.type === 'B') ? (
              <Navigate to="/school" replace />
            ) : // Teachers always go to school
            currentProfile?.type === 'teacher' ? (
              <Navigate to="/school" replace />
            ) : // Parents with core app access go to parent dashboard
            currentProfile?.type === 'parent' ? (
              <Navigate to="/parent/dashboard" replace />
            ) : // Children with core app access go to child dashboard
            currentProfile?.type === 'child' ? (
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
            <ModuleProtectedRoute allowedRoles={['parent']} requireModule="core_app">
              <ParentDashboard />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="/child/dashboard"
          element={
            <ModuleProtectedRoute allowedRoles={['child']} requireModule="core_app">
              <ChildDashboard />
            </ModuleProtectedRoute>
          }
        />

        <Route
          path="/school"
          element={
            <ModuleProtectedRoute allowedRoles={['admin', 'teacher', 'parent', 'child']} requireModule="church_school">
              <School />
            </ModuleProtectedRoute>
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
                <ModuleProtectedRoute allowedRoles={['parent', 'admin', 'child']} requireModule="core_app">
                  <DietTracking />
                </ModuleProtectedRoute>
              )
            }
          />
        )}

        {/* Tasks - Only parent, admin, child */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/tasks"
            element={
              <ModuleProtectedRoute allowedRoles={['parent', 'admin', 'child']} requireModule="core_app">
                <TasksManager />
              </ModuleProtectedRoute>
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
                <ModuleProtectedRoute allowedRoles={['child']} requireModule="core_app">
                  <AIAssistant />
                </ModuleProtectedRoute>
              )
            }
          />
        )}

        {/* Notes - Only parent, admin, child */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/notes"
            element={
              <ModuleProtectedRoute allowedRoles={['parent', 'admin', 'child']} requireModule="core_app">
                <Notes />
              </ModuleProtectedRoute>
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
              <ModuleProtectedRoute allowedRoles={['child', 'parent', 'admin']} requireModule="core_app">
                <MyJourney />
              </ModuleProtectedRoute>
            }
          />
        )}

        {/* Family Leaderboard - All roles */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/leaderboard"
            element={
              <ModuleProtectedRoute allowedRoles={['child', 'parent', 'admin']} requireModule="core_app">
                <FamilyLeaderboard />
              </ModuleProtectedRoute>
            }
          />
        )}

        {/* Reward Shop - Children and parents */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/shop"
            element={
              <ModuleProtectedRoute allowedRoles={['child', 'parent', 'admin']} requireModule="core_app">
                <RewardShop />
              </ModuleProtectedRoute>
            }
          />
        )}

        {/* Parental Controls - Parents only */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/controls"
            element={
              <ModuleProtectedRoute allowedRoles={['parent']} requireModule="core_app">
                <ControlsPage />
              </ModuleProtectedRoute>
            }
          />
        )}

        {/* Calendar View - All roles */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/calendar"
            element={
              <ModuleProtectedRoute allowedRoles={['child', 'parent', 'admin']} requireModule="core_app">
                <CalendarView />
              </ModuleProtectedRoute>
            }
          />
        )}

        {/* Quiz Builder - Parents and Admin */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/quizzes/builder"
            element={
              <ModuleProtectedRoute allowedRoles={['parent', 'admin']} requireModule="core_app">
                <QuizBuilder />
              </ModuleProtectedRoute>
            }
          />
        )}

        {/* Quiz Player - Children */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/quizzes"
            element={
              <ModuleProtectedRoute allowedRoles={['child']} requireModule="core_app">
                <QuizPlayer />
              </ModuleProtectedRoute>
            }
          />
        )}

        {/* Book Library - Parents and Children */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/books"
            element={
              <ModuleProtectedRoute allowedRoles={['parent', 'admin', 'child']} requireModule="core_app">
                <BookLibrary />
              </ModuleProtectedRoute>
            }
          />
        )}

        {/* Book Reader - All roles */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/books/read/:bookId"
            element={
              <ModuleProtectedRoute allowedRoles={['parent', 'admin', 'child']} requireModule="core_app">
                <BookReader />
              </ModuleProtectedRoute>
            }
          />
        )}

        {/* Shopping List - Parents */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/shopping"
            element={
              <ModuleProtectedRoute allowedRoles={['parent', 'admin']} requireModule="core_app">
                <ShoppingList />
              </ModuleProtectedRoute>
            }
          />
        )}

        {/* Shopping Helper - Children */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/shopping/help"
            element={
              <ModuleProtectedRoute allowedRoles={['child']} requireModule="core_app">
                <ShoppingHelper />
              </ModuleProtectedRoute>
            }
          />
        )}

        {/* Activity Builder - Parents and Admin */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/activities/builder"
            element={
              <ModuleProtectedRoute allowedRoles={['parent', 'admin']} requireModule="core_app">
                <ActivityBuilder />
              </ModuleProtectedRoute>
            }
          />
        )}

        {/* Activity Player - Children */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/activities"
            element={
              <ModuleProtectedRoute allowedRoles={['child']} requireModule="core_app">
                <ActivityPlayer />
              </ModuleProtectedRoute>
            }
          />
        )}

        {/* H5P Manager - Parents and Admin */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/h5p"
            element={
              <ModuleProtectedRoute allowedRoles={['parent', 'admin']} requireModule="core_app">
                <H5PManager />
              </ModuleProtectedRoute>
            }
          />
        )}

        {/* H5P Player - Children */}
        {!featureFlags.school_only_mode && (
          <Route
            path="/h5p/play"
            element={
              <ModuleProtectedRoute allowedRoles={['child']} requireModule="core_app">
                <H5PManager />
              </ModuleProtectedRoute>
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
          <PermissionsProvider>
            <ProfileFeaturesProvider>
              <AgeProvider>
                <ToastProvider>
                  <AppRoutes />
                </ToastProvider>
              </AgeProvider>
            </ProfileFeaturesProvider>
          </PermissionsProvider>
        </ProfileProvider>
      </FeatureFlagsProvider>
    </Router>
  );
}

export default App;
