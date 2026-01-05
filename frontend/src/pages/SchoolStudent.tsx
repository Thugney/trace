import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { schoolAPI } from '../services/api';
import {
  BookOpen,
  CheckCircle,
  Clock,
  Youtube,
  FileText,
  Send,
  AlertCircle,
  UserPlus,
  Trophy,
  Star,
  Sparkles,
  Play,
  Download,
  ClipboardList
} from 'lucide-react';
import StudentQuizView from '../components/StudentQuizView';

import type { SchoolAssignment, SchoolEnrollment } from '../types/school';

export default function SchoolStudent() {
  const { currentProfile } = useProfile();
  const [enrollments, setEnrollments] = useState<(SchoolEnrollment & { class_name: string })[]>([]);
  const [assignments, setAssignments] = useState<
    (SchoolAssignment & { class_name: string; has_submitted: boolean; submission_status?: string })[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<SchoolAssignment | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState('');

  const [showQuiz, setShowQuiz] = useState(false);
  const [selectedQuizAssignment, setSelectedQuizAssignment] = useState<SchoolAssignment | null>(null);

  // Gamification state
  const [achievements, setAchievements] = useState<any[]>([]);
  const [points, setPoints] = useState<{ points: number; level: number; level_name: string; points_to_next_level: number } | null>(null);

  useEffect(() => {
    if (currentProfile) {
      loadStudentData();
    }
  }, [currentProfile]);

  const loadStudentData = async () => {
    if (!currentProfile) return;
    setLoading(true);
    try {
      const enrollResponse = await schoolAPI.getStudentEnrollments(currentProfile.id);
      setEnrollments(enrollResponse.data);

      const assignmentsResponse = await schoolAPI.getStudentAssignments(currentProfile.id);
      setAssignments(assignmentsResponse.data);

      const [achievementsResponse, pointsResponse] = await Promise.all([
        schoolAPI.getStudentAchievements(currentProfile.id),
        schoolAPI.getStudentPoints(currentProfile.id)
      ]);
      setAchievements(achievementsResponse.data);
      setPoints(pointsResponse.data);
    } catch (error) {
      console.error('Failed to load student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || !selectedAssignment) return;

    try {
      await schoolAPI.submitWork(
        selectedAssignment.id,
        currentProfile.id,
        submissionNotes || undefined
      );

      setSelectedAssignment(null);
      setSubmissionNotes('');
      loadStudentData();
    } catch (error: any) {
      console.error('Failed to submit work:', error);
      alert(error.response?.data?.error || 'Failed to submit work. Please try again.');
    }
  };

  const getAssignmentTypeIcon = (type: string) => {
    switch (type) {
      case 'psalm':
        return <BookOpen size={24} className="text-green-600" />;
      case 'video':
        return <Youtube size={24} className="text-red-500" />;
      case 'alphabet':
        return <FileText size={24} className="text-orange-500" />;
      case 'quiz':
        return <ClipboardList size={24} className="text-purple-600" />;
      case 'homework':
        return <FileText size={24} className="text-blue-600" />;
      default:
        return <FileText size={24} className="text-gray-600" />;
    }
  };

  const getStatusBadge = (assignment: any) => {
    if (!assignment.has_submitted) {
      return (
        <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-yellow-100 text-yellow-800 border-2 border-yellow-300">
          <AlertCircle size={16} className="mr-2" />
          To Do
        </span>
      );
    }

    switch (assignment.submission_status) {
      case 'approved':
        return (
          <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-green-100 text-green-800 border-2 border-green-300">
            <CheckCircle size={16} className="mr-2" />
            Great Job!
          </span>
        );
      case 'needs_revision':
        return (
          <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-orange-100 text-orange-800 border-2 border-orange-300">
            <AlertCircle size={16} className="mr-2" />
            Try Again
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-blue-100 text-blue-800 border-2 border-blue-300">
            <Clock size={16} className="mr-2" />
            Waiting...
          </span>
        );
    }
  };

  if (!currentProfile) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">📚</div>
          <p className="text-xl text-gray-600">Please log in to see your assignments!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      {/* Fun Header */}
      <div className="mb-6 text-center md:text-left">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center justify-center md:justify-start gap-3">
              <span className="text-4xl">📖</span>
              My School Work
            </h1>
            <p className="text-gray-600 mt-1 text-lg">Tigrinya Church School</p>
          </div>
          {currentProfile?.type === 'parent' && (
            <Link
              to="/school/enroll"
              className="btn btn-primary text-lg py-3 px-6"
            >
              <UserPlus size={24} className="mr-2" />
              Enroll Children
            </Link>
          )}
        </div>
      </div>

      {/* Points & Level - Big and Fun */}
      {points && (
        <div className="mb-6 rounded-2xl p-6 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 text-white shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 rounded-2xl p-4">
                <Star size={40} className="text-yellow-300" fill="currentColor" />
              </div>
              <div className="text-center sm:text-left">
                <div className="text-sm opacity-90 uppercase tracking-wide">Level {points.level}</div>
                <div className="text-2xl md:text-3xl font-bold">{points.level_name}</div>
              </div>
            </div>
            <div className="text-center bg-white/10 rounded-2xl px-6 py-3">
              <div className="text-4xl md:text-5xl font-bold">{points.points}</div>
              <div className="text-sm opacity-90">Total Points</div>
            </div>
          </div>
          {points.points_to_next_level > 0 && (
            <div className="mt-5">
              <div className="flex justify-between text-sm mb-2">
                <span className="flex items-center gap-1">
                  <Sparkles size={16} />
                  Keep going!
                </span>
                <span className="font-bold">{points.points_to_next_level} points to level up!</span>
              </div>
              <div className="bg-white/20 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-yellow-300 h-4 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(10, 100 - (points.points_to_next_level / (points.level === 1 ? 20 : points.level === 2 ? 30 : points.level === 3 ? 50 : 100)) * 100)}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Achievements - Fun Badges */}
      {achievements.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Trophy size={28} className="text-yellow-500" />
            <h2 className="text-xl font-bold text-gray-900">My Achievements</h2>
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-bold">
              {achievements.length} earned!
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {achievements.map((ach) => (
              <div
                key={ach.id}
                className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-4 text-center border-2 border-yellow-200 hover:scale-105 transition-transform"
              >
                <div className="text-5xl mb-2">{ach.icon}</div>
                <h3 className="font-bold text-gray-900">{ach.name}</h3>
                <div className="mt-2 text-sm text-purple-600 font-bold bg-purple-100 rounded-full px-3 py-1 inline-block">
                  +{ach.points} pts
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Classes */}
      {enrollments.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">🏫</span> My Classes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {enrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border-2 border-blue-200"
              >
                <h3 className="font-bold text-lg text-gray-900">{enrollment.class_name}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Joined: {new Date(enrollment.enrolled_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assignments - Big Cards for Kids */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="text-2xl">📋</span> My Assignments
        </h2>
        {loading ? (
          <div className="text-center py-12">
            <div className="text-6xl animate-bounce mb-4">📚</div>
            <p className="text-lg text-gray-600">Loading your assignments...</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-8 text-center border-2 border-dashed border-gray-300">
            <div className="text-6xl mb-4">🎉</div>
            <p className="text-xl text-gray-600">No assignments yet - enjoy your break!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className={`rounded-2xl p-5 border-2 transition-all ${
                  assignment.has_submitted && assignment.submission_status === 'approved'
                    ? 'bg-green-50 border-green-200'
                    : assignment.has_submitted
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-gray-200 hover:border-primary-300 hover:shadow-lg'
                }`}
              >
                {/* Header with type icon and status */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-3 rounded-xl ${
                      assignment.type === 'quiz' ? 'bg-purple-100' :
                      assignment.type === 'video' ? 'bg-red-100' :
                      assignment.type === 'psalm' ? 'bg-green-100' :
                      assignment.type === 'alphabet' ? 'bg-orange-100' :
                      'bg-blue-100'
                    }`}>
                      {getAssignmentTypeIcon(assignment.type)}
                    </div>
                    <div>
                      <h3 className="text-lg md:text-xl font-bold text-gray-900">{assignment.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {assignment.class_name} • <span className="capitalize">{assignment.type.replace('_', ' ')}</span>
                      </p>
                    </div>
                  </div>
                  <div className="self-start">{getStatusBadge(assignment)}</div>
                </div>

                {/* Description */}
                {assignment.description && (
                  <p className="text-gray-700 mb-4 text-base leading-relaxed">{assignment.description}</p>
                )}

                {/* Due date with overdue indicator */}
                {assignment.due_date && (() => {
                  const dueDate = new Date(assignment.due_date);
                  const now = new Date();
                  const isOverdue = dueDate < now && !assignment.has_submitted;
                  const isDueSoon = !isOverdue && dueDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000 && !assignment.has_submitted;

                  return (
                    <div className={`flex items-center gap-2 mb-4 rounded-lg px-3 py-2 inline-flex ${
                      isOverdue ? 'bg-red-100 text-red-700' :
                      isDueSoon ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      <Clock size={18} />
                      <span className="font-medium">
                        {isOverdue ? '⚠️ OVERDUE! Was due: ' : isDueSoon ? '⏰ Due soon: ' : 'Due: '}
                        {dueDate.toLocaleDateString()}
                      </span>
                    </div>
                  );
                })()}

                {/* Video Link - Big and Clear */}
                {assignment.youtube_link && (
                  <a
                    href={assignment.youtube_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 w-full py-4 px-6 mb-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-lg transition-colors"
                  >
                    <Play size={24} fill="currentColor" />
                    Watch Video Lesson
                  </a>
                )}

                {/* Attachment Download */}
                {assignment.attachment_url && (
                  <a
                    href={assignment.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 w-full py-4 px-6 mb-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-lg transition-colors"
                  >
                    <Download size={24} />
                    Download Materials
                  </a>
                )}

                {/* Action Buttons - Big for Kids */}
                {!assignment.has_submitted && (
                  <>
                    {assignment.type === 'quiz' ? (
                      <button
                        onClick={() => {
                          setSelectedQuizAssignment(assignment);
                          setShowQuiz(true);
                        }}
                        className="w-full py-4 px-6 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-colors"
                      >
                        <ClipboardList size={24} />
                        Start Quiz
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelectedAssignment(assignment)}
                        className="w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-colors"
                      >
                        <Send size={24} />
                        Submit My Work
                      </button>
                    )}
                  </>
                )}

                {assignment.has_submitted && assignment.submission_status === 'needs_revision' && assignment.type !== 'quiz' && (
                  <button
                    onClick={() => setSelectedAssignment(assignment)}
                    className="w-full py-4 px-6 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-colors"
                  >
                    <Send size={24} />
                    Try Again
                  </button>
                )}

                {assignment.type === 'quiz' && assignment.has_submitted && (
                  <button
                    onClick={() => loadStudentData()}
                    className="w-full py-4 px-6 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-colors"
                  >
                    <CheckCircle size={24} />
                    Quiz Completed!
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quiz Modal */}
      {showQuiz && selectedQuizAssignment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <StudentQuizView
              assignmentId={selectedQuizAssignment.id}
              studentId={currentProfile?.id || 0}
              onSuccess={() => {
                setShowQuiz(false);
                setSelectedQuizAssignment(null);
                loadStudentData();
              }}
              onCancel={() => {
                setShowQuiz(false);
                setSelectedQuizAssignment(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Submit Work Modal - Kid Friendly */}
      {selectedAssignment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">📝</div>
              <h2 className="text-2xl font-bold text-gray-900">Submit Your Work</h2>
              <p className="text-gray-600 mt-2">{selectedAssignment.title}</p>
            </div>

            <form onSubmit={handleSubmitWork} className="space-y-5">
              <div>
                <label className="block text-lg font-medium text-gray-700 mb-2">
                  Tell your teacher about your work (optional)
                </label>
                <textarea
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  className="w-full p-4 text-lg border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors"
                  rows={4}
                  placeholder="I learned that..."
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  className="flex-1 py-4 px-6 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <Send size={24} />
                  Submit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAssignment(null);
                    setSubmissionNotes('');
                  }}
                  className="flex-1 py-4 px-6 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold text-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
