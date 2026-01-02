import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { profilesAPI, schoolAPI } from '../services/api';
import { Profile } from '../types';
import { Baby, CheckCircle, AlertCircle, Utensils, BookOpen, Award, GraduationCap, Clock, FileCheck } from 'lucide-react';

export default function ParentDashboard() {
  const { currentProfile } = useProfile();
  const [children, setChildren] = useState<Profile[]>([]);
  const [childrenStats, setChildrenStats] = useState<any[]>([]);
  const [childrenSchoolProgress, setChildrenSchoolProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFamilyData();
  }, [currentProfile]);

  const loadFamilyData = async () => {
    if (!currentProfile) return;

    try {
      setLoading(true);
      // Get all profiles
      const response = await profilesAPI.getAll();
      const allProfiles = response.data;

      // Filter children that belong to this parent
      const myKids = allProfiles.filter(
        (p: Profile) => p.type === 'child' && p.parent_id === currentProfile.id
      );
      setChildren(myKids);

      // Load stats for each child
      const statsPromises = myKids.map((child: Profile) =>
        profilesAPI.getStats(child.id).then((res) => ({
          ...child,
          stats: res.data
        }))
      );
      const stats = await Promise.all(statsPromises);
      setChildrenStats(stats);

      // Load school progress for each child
      const schoolProgressPromises = myKids.map(async (child: Profile) => {
        try {
          const [progressRes, assignmentsRes, enrollmentsRes] = await Promise.all([
            schoolAPI.getStudentProgress(child.id),
            schoolAPI.getStudentAssignments(child.id),
            schoolAPI.getStudentEnrollments(child.id)
          ]);
          return {
            ...child,
            progress: progressRes.data,
            assignments: assignmentsRes.data.slice(0, 5), // Show latest 5
            enrollments: enrollmentsRes.data
          };
        } catch (error) {
          return {
            ...child,
            progress: null,
            assignments: [],
            enrollments: []
          };
        }
      });
      const schoolProgress = await Promise.all(schoolProgressPromises);
      setChildrenSchoolProgress(schoolProgress);
    } catch (error) {
      console.error('Failed to load family data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {currentProfile?.name}! 👋
        </h1>
        <p className="text-gray-600 mt-2">Manage your family's learning and progress</p>
      </div>

      {/* Family Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Your Children</p>
              <p className="text-4xl font-bold mt-1">{children.length}</p>
              <p className="text-purple-100 text-xs mt-1">Active learners</p>
            </div>
            <Baby size={48} className="opacity-80" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Tasks</p>
              <p className="text-4xl font-bold mt-1">
                {childrenStats.reduce((sum, child) => sum + (child.stats?.tasks?.total_tasks || 0), 0)}
              </p>
              <p className="text-blue-100 text-xs mt-1">Across all children</p>
            </div>
            <CheckCircle size={48} className="opacity-80" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Completed</p>
              <p className="text-4xl font-bold mt-1">
                {childrenStats.reduce((sum, child) => sum + (child.stats?.tasks?.completed_tasks || 0), 0)}
              </p>
              <p className="text-green-100 text-xs mt-1">Tasks finished</p>
            </div>
            <Award size={48} className="opacity-80" />
          </div>
        </div>
      </div>

      {/* Children Overview */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Your Children</h2>
        {children.length === 0 ? (
          <div className="card p-8 text-center">
            <Baby size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Children Yet</h3>
            <p className="text-gray-600 mb-4">
              Add your children's profiles to start tracking their progress
            </p>
            <Link to="/settings" className="btn btn-primary inline-flex items-center">
              <Baby className="mr-2" size={20} />
              Add Child Profile
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {childrenStats.map((child) => (
              <div key={child.id} className="card">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="text-5xl">{child.avatar || '👤'}</div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900">{child.name}</h3>
                    <p className="text-sm text-gray-600">{child.age} years old</p>
                  </div>
                </div>

                {/* Child Stats */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="text-blue-600" size={20} />
                      <span className="text-sm font-medium text-gray-900">Tasks</span>
                    </div>
                    <span className="text-sm font-semibold text-blue-600">
                      {child.stats?.tasks?.completed_tasks || 0}/{child.stats?.tasks?.total_tasks || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Award className="text-purple-600" size={20} />
                      <span className="text-sm font-medium text-gray-900">Level</span>
                    </div>
                    <span className="text-sm font-semibold text-purple-600">
                      Level {child.stats?.progress?.level || 1}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="text-yellow-600 text-lg">⭐</div>
                      <span className="text-sm font-medium text-gray-900">Stars</span>
                    </div>
                    <span className="text-sm font-semibold text-yellow-600">
                      {child.stats?.progress?.total_stars || 0} stars
                    </span>
                  </div>

                  {child.stats?.tasks?.overdue_tasks > 0 && (
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="text-red-600" size={20} />
                        <span className="text-sm font-medium text-gray-900">Overdue</span>
                      </div>
                      <span className="text-sm font-semibold text-red-600">
                        {child.stats?.tasks?.overdue_tasks} tasks
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              to="/diet"
              className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Utensils className="text-primary-600" size={20} />
                <div>
                  <p className="font-medium">Family Diet Tracking</p>
                  <p className="text-sm text-gray-600">Log meals and monitor nutrition</p>
                </div>
              </div>
            </Link>

            <Link
              to="/tasks"
              className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <CheckCircle className="text-primary-600" size={20} />
                <div>
                  <p className="font-medium">Manage Tasks</p>
                  <p className="text-sm text-gray-600">Create and assign tasks to children</p>
                </div>
              </div>
            </Link>

            <Link
              to="/school"
              className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <BookOpen className="text-primary-600" size={20} />
                <div>
                  <p className="font-medium">School Progress</p>
                  <p className="text-sm text-gray-600">View children's school assignments</p>
                </div>
              </div>
            </Link>

            <Link
              to="/school/enroll"
              className="block p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors border-2 border-green-200"
            >
              <div className="flex items-center space-x-3">
                <GraduationCap className="text-green-600" size={20} />
                <div>
                  <p className="font-medium text-green-900">Enroll Children in Church School</p>
                  <p className="text-sm text-green-700">Saturday Tigrinya classes</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Family Progress */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Family Progress</h2>
          <div className="space-y-4">
            {children.length > 0 ? (
              children.map((child) => {
                const childStats = childrenStats.find((c) => c.id === child.id);
                const completionRate = childStats?.stats?.tasks?.total_tasks > 0
                  ? Math.round((childStats.stats.tasks.completed_tasks / childStats.stats.tasks.total_tasks) * 100)
                  : 0;

                return (
                  <div key={child.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">{child.avatar || '👤'}</span>
                        <span className="font-medium text-gray-900">{child.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-primary-600">{completionRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-600 text-center py-8">
                Add children to see their progress
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Children's School Progress */}
      {childrenSchoolProgress.length > 0 && (
        <div className="mt-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Children's School Progress</h2>
          <div className="space-y-6">
            {childrenSchoolProgress.map((child) => (
              <div key={child.id} className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-3xl">{child.avatar || '👤'}</span>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{child.name}</h3>
                      <p className="text-sm text-gray-600">
                        {child.enrollments.length} {child.enrollments.length === 1 ? 'class' : 'classes'} enrolled
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/school"
                    className="btn btn-sm btn-secondary"
                  >
                    View All
                  </Link>
                </div>

                {/* Progress Stats */}
                {child.progress && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <BookOpen className="text-blue-600" size={16} />
                        <div>
                          <p className="text-xs text-blue-600">Total</p>
                          <p className="text-lg font-bold text-blue-900">{child.progress.total_assignments || 0}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Clock className="text-yellow-600" size={16} />
                        <div>
                          <p className="text-xs text-yellow-600">Pending</p>
                          <p className="text-lg font-bold text-yellow-900">
                            {(child.progress.total_assignments || 0) - (child.progress.submitted_assignments || 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <FileCheck className="text-green-600" size={16} />
                        <div>
                          <p className="text-xs text-green-600">Submitted</p>
                          <p className="text-lg font-bold text-green-900">{child.progress.submitted_assignments || 0}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="text-purple-600" size={16} />
                        <div>
                          <p className="text-xs text-purple-600">Approved</p>
                          <p className="text-lg font-bold text-purple-900">{child.progress.approved_assignments || 0}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent Assignments */}
                {child.assignments && child.assignments.length > 0 ? (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Recent Assignments</h4>
                    <div className="space-y-2">
                      {child.assignments.map((assignment: any) => (
                        <div key={assignment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">{assignment.title}</p>
                            <p className="text-xs text-gray-600">{assignment.class_name}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {assignment.due_date && (
                              <span className="text-xs text-gray-500">
                                Due: {new Date(assignment.due_date).toLocaleDateString()}
                              </span>
                            )}
                            {assignment.has_submitted ? (
                              <span className={`text-xs px-2 py-1 rounded ${
                                assignment.submission_status === 'approved'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {assignment.submission_status === 'approved' ? '✓ Approved' : '📤 Submitted'}
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                                ⏳ Pending
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No assignments yet</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
