import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { schoolAPI } from '../services/api';
import { GraduationCap, Users, BookOpen, CheckCircle, Clock } from 'lucide-react';

export default function TeacherDashboard() {
  const { currentProfile } = useProfile();
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    totalAssignments: 0,
    pendingSubmissions: 0
  });
  const [recentAssignments, setRecentAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeacherData();
  }, [currentProfile]);

  const loadTeacherData = async () => {
    try {
      setLoading(true);

      // Get all classes
      const classesResponse = await schoolAPI.getClasses();
      const classes = classesResponse.data;

      // Get all students progress
      const progressResponse = await schoolAPI.getAllStudentsProgress();
      const studentsProgress = progressResponse.data;

      // Get assignments for all classes (teacher's assignments)
      const assignmentsPromises = classes.map((cls: any) =>
        schoolAPI.getClassAssignments(cls.id)
      );
      const assignmentsResponses = await Promise.all(assignmentsPromises);
      const allAssignments = assignmentsResponses.flatMap((res) => res.data);

      // Filter assignments created by this teacher
      const myAssignments = allAssignments.filter(
        (assignment: any) => assignment.teacher_id === currentProfile?.id
      );

      // Get recent assignments
      const recent = myAssignments
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      setRecentAssignments(recent);

      // Calculate stats
      setStats({
        totalClasses: classes.length,
        totalStudents: studentsProgress.length,
        totalAssignments: myAssignments.length,
        pendingSubmissions: 0 // Will be calculated when we have submissions data
      });
    } catch (error) {
      console.error('Failed to load teacher data:', error);
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
        <div className="flex items-center space-x-3 mb-2">
          <GraduationCap className="text-green-600" size={32} />
          <h1 className="text-3xl font-bold text-gray-900">
            Teacher Dashboard
          </h1>
        </div>
        <p className="text-gray-600">Welcome back, {currentProfile?.name}!</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">My Classes</p>
              <p className="text-4xl font-bold mt-1">{stats.totalClasses}</p>
              <p className="text-green-100 text-xs mt-1">Active classes</p>
            </div>
            <GraduationCap size={48} className="opacity-80" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">My Students</p>
              <p className="text-4xl font-bold mt-1">{stats.totalStudents}</p>
              <p className="text-blue-100 text-xs mt-1">Total students</p>
            </div>
            <Users size={48} className="opacity-80" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Assignments</p>
              <p className="text-4xl font-bold mt-1">{stats.totalAssignments}</p>
              <p className="text-purple-100 text-xs mt-1">Created by you</p>
            </div>
            <BookOpen size={48} className="opacity-80" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Pending Review</p>
              <p className="text-4xl font-bold mt-1">{stats.pendingSubmissions}</p>
              <p className="text-orange-100 text-xs mt-1">Submissions</p>
            </div>
            <Clock size={48} className="opacity-80" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              to="/school"
              className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <GraduationCap className="text-primary-600" size={20} />
                <div>
                  <p className="font-medium">Manage Classes</p>
                  <p className="text-sm text-gray-600">View and organize your classes</p>
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
                  <p className="font-medium">Create Assignment</p>
                  <p className="text-sm text-gray-600">Add new homework or lessons</p>
                </div>
              </div>
            </Link>

            <Link
              to="/school"
              className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <CheckCircle className="text-primary-600" size={20} />
                <div>
                  <p className="font-medium">Review Submissions</p>
                  <p className="text-sm text-gray-600">Grade student work and give feedback</p>
                </div>
              </div>
            </Link>

            <Link
              to="/school"
              className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Users className="text-primary-600" size={20} />
                <div>
                  <p className="font-medium">Student Progress</p>
                  <p className="text-sm text-gray-600">Track performance and completion rates</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Assignments */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Recent Assignments</h2>
          <div className="space-y-3">
            {recentAssignments.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
                <p>No assignments created yet</p>
                <Link to="/school" className="btn btn-primary mt-4 inline-flex items-center">
                  Create Your First Assignment
                </Link>
              </div>
            ) : (
              recentAssignments.map((assignment) => (
                <div key={assignment.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{assignment.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{assignment.class_name}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                          {assignment.type}
                        </span>
                        {assignment.due_date && (
                          <span className="text-xs text-gray-500 flex items-center">
                            <Clock size={12} className="mr-1" />
                            Due: {new Date(assignment.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Student Overview */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Class Overview</h2>
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">
            View detailed class information, student progress, and manage assignments
          </p>
          <Link to="/school" className="btn btn-primary inline-flex items-center">
            <GraduationCap className="mr-2" size={20} />
            Go to School System
          </Link>
        </div>
      </div>
    </div>
  );
}
