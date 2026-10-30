import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, CheckSquare, Bot, StickyNote, Settings, LogOut, Users, Map, Menu, X, ChevronRight, Trophy, Gift, Calendar, Shield, BookOpen, ShoppingCart, Puzzle, GraduationCap, Utensils } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { useAge } from '../context/AgeContext';
import { useFeatureFlags } from '../context/FeatureFlagsContext';
import { useProfileFeatures } from '../context/ProfileFeaturesContext';
import { usePermissions } from '../context/PermissionsContext';
import { clearStoredAuth, profilesAPI } from '../services/api';
import Avatar from './Avatar';
import { NotificationBell } from './NotificationBell';
import clsx from 'clsx';

interface LayoutProps {
  children: ReactNode;
}

// Magical nav items for kids - fun emojis with colors!
interface KidNavItem {
  path: string;
  emoji: string;
  label: string;
  color: string;
  hoverAnim: string;
  labels?: {
    young?: string;
    middle?: string;
    older?: string;
  };
}

const KID_NAV_ITEMS: KidNavItem[] = [
  { path: '/child/dashboard', emoji: '🦸', label: 'Home', labels: { young: 'Play', middle: 'Home', older: 'Dashboard' }, color: 'from-amber-400 to-orange-500', hoverAnim: 'hover:animate-bounce' },
  { path: '/tasks', emoji: '🦹', label: 'Missions', labels: { young: 'My Jobs', middle: 'Missions', older: 'Tasks' }, color: 'from-violet-500 to-purple-600', hoverAnim: 'hover:animate-pulse' },
  { path: '/h5p/play', emoji: '🧩', label: 'Quizzes', labels: { young: 'Fun Quizzes', middle: 'Quizzes', older: 'Quizzes' }, color: 'from-pink-500 to-rose-500', hoverAnim: 'hover:animate-wiggle-more' },
  { path: '/learn', emoji: '🎓', label: 'Learn', labels: { young: 'Learn', middle: 'Learn', older: 'Learn' }, color: 'from-indigo-500 to-sky-500', hoverAnim: 'hover:animate-float' },
  { path: '/books', emoji: '📚', label: 'Story Books', labels: { young: 'Stories', middle: 'Books', older: 'Library' }, color: 'from-teal-400 to-cyan-500', hoverAnim: 'hover:animate-float' },
  { path: '/calendar', emoji: '🦉', label: 'My Days', labels: { young: 'My Days', middle: 'Calendar', older: 'Calendar' }, color: 'from-cyan-400 to-blue-500', hoverAnim: 'hover:animate-float' },
  { path: '/shop', emoji: '🐯', label: 'Treasure Shop', labels: { young: 'Prize Shop', middle: 'Shop', older: 'Rewards' }, color: 'from-emerald-400 to-green-500', hoverAnim: 'hover:animate-jiggle' },
  { path: '/notes', emoji: '🦊', label: 'Secret Notes', labels: { young: 'Notes', middle: 'Notes', older: 'Notes' }, color: 'from-yellow-400 to-amber-500', hoverAnim: 'hover:animate-pulse' },
  { path: '/leaderboard', emoji: '🏆', label: 'Champions', labels: { young: 'Champions', middle: 'Leaderboard', older: 'Leaderboard' }, color: 'from-yellow-500 to-orange-500', hoverAnim: 'hover:animate-tada-sm' },
  { path: '/journey', emoji: '🐲', label: 'Adventure Map', labels: { young: 'Adventure', middle: 'Journey', older: 'Journey' }, color: 'from-indigo-500 to-purple-500', hoverAnim: 'hover:animate-float' },
  { path: '/shopping/help', emoji: '🛒', label: 'Shopping Helper', labels: { young: 'Shopping!', middle: 'Shopping', older: 'Shopping' }, color: 'from-emerald-500 to-teal-500', hoverAnim: 'hover:animate-bounce' },
  { path: '/diet', emoji: '🥗', label: 'My Food', labels: { young: 'My Food', middle: 'Food Log', older: 'Diet' }, color: 'from-lime-400 to-green-500', hoverAnim: 'hover:animate-jiggle' },
  { path: '/ai', emoji: '🤖', label: 'AI Buddy', labels: { young: 'AI Buddy', middle: 'AI Buddy', older: 'AI Helper' }, color: 'from-blue-500 to-indigo-600', hoverAnim: 'hover:animate-robot' },
  { path: '/settings', emoji: '🧠', label: 'Settings', labels: { young: 'Settings', middle: 'Settings', older: 'Settings' }, color: 'from-slate-400 to-slate-600', hoverAnim: 'hover:animate-spin-slow' },
];

// Feature key mapping for nav items
const NAV_PATH_FEATURES: Record<string, string> = {
  '/tasks': 'tasks',
  '/notes': 'notes',
  '/shop': 'rewards',
  '/calendar': 'calendar',
  '/quizzes': 'quizzes',
  '/quizzes/builder': 'quizzes',
  '/leaderboard': 'leaderboard',
  '/journey': 'journey',
  '/ai': 'ai',
  '/school': 'school',
  '/shopping': 'shopping',
  '/shopping/help': 'shopping',
  '/books': 'books',
  '/activities': 'activities',
  '/activities/builder': 'activities',
  '/h5p': 'quizzes',
  '/h5p/play': 'quizzes',
  '/diet': 'diet',
  '/learn': 'learn',
};

export default function Layout({ children }: LayoutProps) {
  const { currentProfile, setCurrentProfile } = useProfile();
  const { settings } = useAge();
  const { flags } = useFeatureFlags();
  const { isFeatureEnabled } = useProfileFeatures();
  const { hasCoreAppAccess, hasChurchSchoolAccess, family, isLoading: permissionsLoading } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

  const isActive = (path: string) => location.pathname === path || (path === '/learn' && location.pathname.startsWith('/learn/'));
  const isChild = currentProfile?.type === 'child';

  // Family B users (church school only) should not see core app features
  // Only consider it Family B if we have loaded permissions and confirmed family type is B
  const isFamilyB = family?.type === 'B';

  // While permissions are loading, default to showing core app features for non-teachers
  // This prevents a flash of wrong UI - the correct nav will show after permissions load
  const effectiveHasCoreAppAccess = permissionsLoading
    ? (currentProfile?.type === 'admin' || currentProfile?.type === 'parent' || currentProfile?.type === 'child')
    : hasCoreAppAccess;

  // Check if a nav path is enabled based on profile features AND module permissions
  const isNavPathEnabled = (path: string): boolean => {
    const featureKey = NAV_PATH_FEATURES[path];

    // Learn is an opt-in pilot: parents/admins always see it so they can switch it on
    if (path === '/learn') {
      if (currentProfile?.type === 'parent' || currentProfile?.type === 'admin') return true;
      return isFeatureEnabled('learn');
    }

    // Core app paths require core_app module access
    const coreAppPaths = ['/tasks', '/notes', '/shop', '/calendar', '/leaderboard', '/journey',
                          '/ai', '/shopping', '/shopping/help', '/books', '/activities',
                          '/activities/builder', '/h5p', '/h5p/play', '/diet', '/quizzes',
                          '/quizzes/builder', '/parent/dashboard', '/child/dashboard', '/controls'];

    // Check if this is a core app path
    if (coreAppPaths.some(p => path.startsWith(p))) {
      // Family B cannot access core app features (only check when not loading)
      // Use effectiveHasCoreAppAccess which handles the loading state
      if (!permissionsLoading && (isFamilyB || !effectiveHasCoreAppAccess)) {
        return false;
      }
    }

    // Check if this is a church school path
    if (path === '/school') {
      // Church school access rules:
      // - Family B always has access
      // - Family A parents can always access (to enroll children)
      // - Family A children need enrollment to access
      // - Teachers always have access
      if (!permissionsLoading) {
        const isParentOrTeacher = currentProfile?.type === 'parent' || currentProfile?.type === 'teacher';
        // Parents and teachers always see School nav (to manage enrollments)
        // Children need churchSchool access (granted when enrolled)
        if (!isParentOrTeacher && !hasChurchSchoolAccess) {
          return false;
        }
      }
    }

    // Check feature flag restriction
    if (!featureKey) return true;
    return isFeatureEnabled(featureKey);
  };

  const getNavItems = () => {
    if (!currentProfile) return [];
    const { type } = currentProfile;

    // School only mode or Family B - show church school navigation only
    // Important: Only apply Family B restriction when we've confirmed family type (not while loading)
    const showChurchSchoolOnly = flags.school_only_mode || (!permissionsLoading && isFamilyB);
    const learnAllowedInSchoolOnly = Boolean(flags.school_only_allowed_features?.includes('learn'));
    const learnNavItem = { path: '/learn', icon: GraduationCap, label: 'Learn' };
    if (showChurchSchoolOnly) {
      if (type === 'admin') {
        return [
          { path: '/admin/dashboard', icon: Home, label: 'Dashboard' },
          { path: '/admin', icon: Users, label: 'Users' },
          { path: '/school', icon: BookOpen, label: 'Church School' },
          { path: '/settings', icon: Settings, label: 'Settings' }
        ].filter(item => isNavPathEnabled(item.path));
      }

      if (type === 'parent' || type === 'teacher') {
        return [
          { path: '/school', icon: BookOpen, label: 'Church School' },
          ...(type === 'parent' && learnAllowedInSchoolOnly ? [learnNavItem] : []),
          { path: '/settings', icon: Settings, label: 'Settings' }
        ].filter(item => isNavPathEnabled(item.path));
      }

      if (type === 'child') {
        return [
          { path: '/school', icon: BookOpen, label: 'Church School' },
          ...(learnAllowedInSchoolOnly ? [learnNavItem] : []),
          { path: '/settings', icon: Settings, label: 'Settings' }
        ].filter(item => isNavPathEnabled(item.path));
      }
    }

    if (type === 'admin') {
      return [
        { path: '/admin/dashboard', icon: Home, label: 'Dashboard' },
        { path: '/admin', icon: Users, label: 'Users' },
        learnNavItem,
        { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
        { path: '/journey', icon: Map, label: 'Journey' },
        { path: '/settings', icon: Settings, label: 'Settings' }
      ].filter(item => isNavPathEnabled(item.path));
    }

    if (type === 'parent') {
      const items = [
        { path: '/parent/dashboard', icon: Home, label: 'Dashboard' },
        { path: '/school', icon: BookOpen, label: 'Church School' },
        { path: '/tasks', icon: CheckSquare, label: 'Tasks' },
        { path: '/h5p', icon: Puzzle, label: 'Quiz Builder' },
        learnNavItem,
        { path: '/books', icon: BookOpen, label: 'Books' },
        { path: '/shopping', icon: ShoppingCart, label: 'Shopping' },
        { path: '/diet', icon: Utensils, label: 'Diet' },
        { path: '/calendar', icon: Calendar, label: 'Calendar' },
        { path: '/shop', icon: Gift, label: 'Shop' },
        { path: '/notes', icon: StickyNote, label: 'Notes' },
        { path: '/controls', icon: Shield, label: 'Controls' },
        { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
        { path: '/journey', icon: Map, label: 'Journey' },
        { path: '/settings', icon: Settings, label: 'Settings' }
      ];
      return items.filter(item => isNavPathEnabled(item.path));
    }

    if (type === 'teacher') {
      return [
        { path: '/school', icon: BookOpen, label: 'Church School' },
        { path: '/settings', icon: Settings, label: 'Settings' }
      ].filter(item => isNavPathEnabled(item.path));
    }

    if (type === 'child') {
      const items = [
        { path: '/child/dashboard', icon: Home, label: 'Home' },
        { path: '/school', icon: BookOpen, label: 'Church School' },
        { path: '/tasks', icon: CheckSquare, label: 'Tasks' },
        { path: '/h5p/play', icon: Puzzle, label: 'Quizzes' },
        learnNavItem,
        { path: '/shopping/help', icon: ShoppingCart, label: 'Shopping' },
        { path: '/diet', icon: Utensils, label: 'Diet' },
        { path: '/calendar', icon: Calendar, label: 'Calendar' },
        { path: '/shop', icon: Gift, label: 'Shop' },
        { path: '/notes', icon: StickyNote, label: 'Notes' },
        { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
        { path: '/journey', icon: Map, label: 'Journey' }
      ];

      if (currentProfile.ai_enabled === 1 && isNavPathEnabled('/ai')) {
        items.push({ path: '/ai', icon: Bot, label: 'AI Helper' });
      }
      items.push({ path: '/settings', icon: Settings, label: 'Settings' });
      // Filter items based on feature access AND module permissions
      return items.filter(item => isNavPathEnabled(item.path));
    }

    return [];
  };

  // Get kid nav items filtered by what's available
  const getKidNavItems = (): KidNavItem[] => {
    if (!currentProfile || currentProfile.type !== 'child') return [];
    const ageGroup = settings.ageGroup;
    const ageKey: 'young' | 'middle' | 'older' | undefined =
      ageGroup === 'young' || ageGroup === 'middle' || ageGroup === 'older'
        ? ageGroup
        : undefined;

    // Family B or school_only_mode: only show church school navigation
    // Important: Only apply Family B restriction when we've confirmed family type (not while loading)
    const showChurchSchoolOnly = flags.school_only_mode || (!permissionsLoading && isFamilyB);
    const churchSchoolOnlyItems: KidNavItem[] = [
      { path: '/school', emoji: '📖', label: 'Church School', labels: { young: 'School', middle: 'Church School', older: 'Church School' }, color: 'from-amber-400 to-orange-500', hoverAnim: 'hover:animate-bounce' },
      ...(flags.school_only_allowed_features?.includes('learn') ? KID_NAV_ITEMS.filter(item => item.path === '/learn') : []),
      { path: '/settings', emoji: '⚙️', label: 'Settings', labels: { young: 'Settings', middle: 'Settings', older: 'Settings' }, color: 'from-slate-400 to-slate-600', hoverAnim: 'hover:animate-spin-slow' }
    ];

    const baseItems = showChurchSchoolOnly
      ? churchSchoolOnlyItems
      : KID_NAV_ITEMS;

    const available = baseItems.filter(item => {
      // Check feature access AND module permissions
      if (!isNavPathEnabled(item.path)) return false;
      // Special check for AI
      if (item.path === '/ai') {
        return currentProfile.ai_enabled === 1;
      }
      return true;
    });

    return available.map(item => ({
      ...item,
      label: (ageKey && item.labels?.[ageKey]) || item.label
    }));
  };

  const visibleNavItems = getNavItems();

  const handleLogout = async () => {
    try {
      await profilesAPI.logout();
    } catch {
      // Session may already be gone; clearing local state is still correct
    }
    clearStoredAuth();
    setCurrentProfile(null);
    navigate('/');
    window.location.reload();
  };

  const handleNavClick = (path: string) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  const getRoleBadge = () => {
    if (!currentProfile) return null;
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      admin: { bg: 'bg-rose-50', text: 'text-rose-600', label: 'Admin' },
      parent: { bg: 'bg-sky-50', text: 'text-sky-600', label: 'Parent' },
      child: { bg: 'bg-violet-50', text: 'text-violet-600', label: 'Child' },
      teacher: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Teacher' }
    };
    const badge = badges[currentProfile.type];
    if (!badge) return null;
    return (
      <span className={`${badge.bg} ${badge.text} text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className={clsx(
      "min-h-screen",
      isChild ? (settings.themeClass || "bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50") : "bg-slate-50",
      mobileMenuOpen && "overflow-hidden h-screen"
    )}>
      {/* Header - Clean & Minimal (Fun for kids!) */}
      <header className={clsx(
        "sticky top-0 z-40 transition-all duration-300",
        isChild
          ? "bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 shadow-lg shadow-purple-500/20"
          : "bg-white border-b border-slate-100"
      )}>
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Left side */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className={clsx(
                  "lg:hidden p-2 -ml-2 rounded-xl transition-all duration-200",
                  isChild
                    ? "text-white/90 hover:text-white hover:bg-white/20 hover:scale-110"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                )}
              >
                <Menu size={22} />
              </button>

              <div className="flex items-center gap-3">
                {isChild ? (
                  // Fun animated logo for kids
                  <div className="relative group">
                    <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/30 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                      <span className="text-2xl">🌟</span>
                    </div>
                    <span className="absolute -top-1 -right-1 text-xs animate-bounce">✨</span>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">F</span>
                  </div>
                )}
                <span className={clsx(
                  "hidden sm:block text-lg font-bold",
                  isChild ? "text-white drop-shadow-md" : "text-slate-800"
                )}>
                  {isChild ? "My Fun Hub!" : "Family Hub"}
                </span>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-4">
              {currentProfile && (
                <div className={clsx(
                  "hidden sm:flex items-center gap-3 pr-4 border-r",
                  isChild ? "border-white/30" : "border-slate-100"
                )}>
                  <div className="text-right">
                    <p className={clsx(
                      "text-sm font-bold",
                      isChild ? "text-white drop-shadow-sm" : "text-slate-700"
                    )}>
                      {isChild ? `Hey, ${currentProfile.name}! 👋` : currentProfile.name}
                    </p>
                    {!isChild && (
                      <div className="flex items-center justify-end gap-2">
                        {getRoleBadge()}
                      </div>
                    )}
                  </div>
                  <div className={clsx(
                    "rounded-full transition-transform duration-300 hover:scale-110",
                    isChild && "ring-2 ring-white/50 shadow-lg"
                  )}>
                    <Avatar avatar={currentProfile.avatar} size="md" alt={currentProfile.name} />
                  </div>
                </div>
              )}

              <NotificationBell />

              <button
                onClick={handleLogout}
                className={clsx(
                  "p-2 rounded-xl transition-all duration-200",
                  isChild
                    ? "text-white/80 hover:text-white hover:bg-white/20 hover:scale-110"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                )}
                title="Sign out"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div
        className={clsx(
          'fixed inset-0 z-50 lg:hidden transition-all duration-300',
          mobileMenuOpen ? 'visible' : 'invisible'
        )}
      >
        <div
          className={clsx(
            'absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity duration-300',
            mobileMenuOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={() => setMobileMenuOpen(false)}
        />

        <div
          className={clsx(
            'absolute left-0 top-0 h-full w-72 shadow-2xl transform transition-transform duration-300 ease-out',
            isChild ? 'bg-gradient-to-b from-indigo-50 to-white' : 'bg-white',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* Mobile Menu Header */}
          <div className={clsx(
            "flex items-center justify-between p-4",
            isChild
              ? "bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500"
              : "border-b border-slate-100"
          )}>
            <div className="flex items-center gap-3">
              <div className={clsx(
                "rounded-full",
                isChild && "ring-2 ring-white/50 shadow-lg"
              )}>
                <Avatar avatar={currentProfile?.avatar} size="md" alt={currentProfile?.name || "User"} />
              </div>
              <div>
                <p className={clsx(
                  "font-bold",
                  isChild ? "text-white drop-shadow-sm" : "text-slate-800"
                )}>
                  {isChild ? `Hi ${currentProfile?.name}! ✨` : currentProfile?.name}
                </p>
                {!isChild && getRoleBadge()}
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className={clsx(
                "p-2 rounded-xl transition-colors",
                isChild
                  ? "text-white/80 hover:text-white hover:bg-white/20"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              )}
            >
              <X size={20} />
            </button>
          </div>

          {/* Mobile Navigation - Scrollable container */}
          <nav className="p-3 space-y-1.5 overflow-y-auto max-h-[calc(100vh-180px)]">
            {isChild ? (
              // Magical kid navigation
              getKidNavItems().map((item, index) => (
                <button
                  key={item.path}
                  onClick={() => handleNavClick(item.path)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all text-left group relative overflow-hidden',
                    isActive(item.path)
                      ? `bg-gradient-to-r ${item.color} text-white shadow-lg scale-[1.02]`
                      : 'bg-white hover:bg-gradient-to-r hover:' + item.color.replace('from-', 'from-').replace('to-', 'to-') + '/10 text-slate-700 hover:scale-[1.01]'
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <span className={clsx(
                    'text-2xl transition-transform duration-300',
                    isActive(item.path) ? 'scale-110' : 'group-hover:scale-125 group-hover:rotate-12'
                  )}>
                    {item.emoji}
                  </span>
                  <span className={clsx('flex-1 font-bold text-base', isActive(item.path) ? 'text-white' : 'text-slate-700')}>
                    {item.label}
                  </span>
                  {isActive(item.path) && (
                    <span className="text-white/80 text-lg animate-bounce">✨</span>
                  )}
                </button>
              ))
            ) : (
              // Regular navigation for parents/admins
              visibleNavItems.map(({ path, icon: Icon, label }) => (
                <button
                  key={path}
                  onClick={() => handleNavClick(path)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left group',
                    isActive(path)
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <Icon size={20} strokeWidth={isActive(path) ? 2.5 : 2} />
                  <span className={clsx('flex-1', isActive(path) && 'font-medium')}>{label}</span>
                  {isActive(path) && <ChevronRight size={16} className="text-indigo-400" />}
                </button>
              ))
            )}
          </nav>

          {/* Mobile Menu Footer */}
          <div className={clsx(
            "absolute bottom-0 left-0 right-0 p-4",
            isChild ? "bg-gradient-to-r from-indigo-50 to-purple-50" : "border-t border-slate-100"
          )}>
            {isChild && (
              <div className="text-center mb-3">
                <p className="text-sm font-bold text-purple-600">Keep being awesome! 🌟</p>
              </div>
            )}
            <button
              onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
              className={clsx(
                "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all",
                isChild
                  ? "bg-white/80 text-slate-600 hover:bg-white hover:shadow-md"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <LogOut size={18} />
              <span>{isChild ? 'See You Later!' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex max-w-7xl mx-auto">
        {/* Desktop Sidebar */}
        <aside className={clsx("hidden lg:block shrink-0", isChild ? "w-64" : "w-60")}>
          <div className="sticky top-16 p-4">
            {isChild ? (
              // Magical kid sidebar
              <nav className="space-y-2">
                {getKidNavItems().map((item, index) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onMouseEnter={() => setHoveredNav(item.path)}
                    onMouseLeave={() => setHoveredNav(null)}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group relative overflow-hidden',
                      isActive(item.path)
                        ? `bg-gradient-to-r ${item.color} text-white shadow-lg shadow-${item.color.split(' ')[0].replace('from-', '')}/30 transform scale-[1.02]`
                        : 'bg-white/60 hover:bg-white text-slate-600 hover:shadow-md hover:scale-[1.02]'
                    )}
                    style={{
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    {/* Animated background glow on hover */}
                    {!isActive(item.path) && hoveredNav === item.path && (
                      <div className={`absolute inset-0 bg-gradient-to-r ${item.color} opacity-10 animate-pulse`} />
                    )}

                    {/* Emoji with fun animation */}
                    <span className={clsx(
                      'text-2xl relative z-10 transition-all duration-300',
                      isActive(item.path)
                        ? 'scale-110 drop-shadow-lg'
                        : 'group-hover:scale-125 group-hover:rotate-12 group-hover:drop-shadow-md'
                    )}>
                      {item.emoji}
                    </span>

                    {/* Label */}
                    <span className={clsx(
                      'font-bold text-sm relative z-10 transition-colors',
                      isActive(item.path) ? 'text-white' : 'text-slate-700 group-hover:text-slate-900'
                    )}>
                      {item.label}
                    </span>

                    {/* Active sparkle indicator */}
                    {isActive(item.path) && (
                      <span className="ml-auto text-white/90 animate-pulse">✨</span>
                    )}
                  </Link>
                ))}

                {/* Fun decoration at bottom */}
                <div className="mt-6 p-4 bg-gradient-to-r from-pink-100 via-purple-100 to-indigo-100 rounded-2xl text-center">
                  <div className="text-3xl mb-1 animate-bounce">🌟</div>
                  <p className="text-xs font-bold text-purple-600">You're doing great!</p>
                </div>
              </nav>
            ) : (
              // Regular navigation for parents/admins
              <nav className="space-y-1">
                {visibleNavItems.map(({ path, icon: Icon, label }) => (
                  <Link
                    key={path}
                    to={path}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group',
                      isActive(path)
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    <Icon size={20} strokeWidth={isActive(path) ? 2.5 : 1.75} />
                    <span className={clsx('text-sm', isActive(path) && 'font-medium')}>{label}</span>
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
