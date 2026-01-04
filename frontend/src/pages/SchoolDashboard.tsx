import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { schoolAPI } from '../services/api';
import {
  BookOpen,
  Users,
  Plus,
  CheckCircle,
  Clock,
  Youtube,
  FileText,
  Award,
  Trash2,
  Send
} from 'lucide-react';
import QuizCreationForm from '../components/QuizCreationForm';
import type {
  SchoolClass,
  SchoolAssignment,
  StudentProgress,
  AssignmentType
} from '../types/school';

type TabType = 'assignments' | 'students' | 'submissions';

export default function SchoolDashboard() {
  const { currentProfile } = useProfile();
  const [activeTab, setActiveTab] = useState<TabType>('assignments');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<SchoolAssignment[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [studentsProgress, setStudentsProgress] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<SchoolAssignment | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'homework' as AssignmentType,
    youtube_link: '',
    due_date: ''
  });

  const [feedbackData, setFeedbackData] = useState({
    comment: '',
    rating: 'very_good' as 'excellent' | 'very_good' | 'good' | 'needs_improvement'
  });

  const [showQuizForm, setShowQuizForm] = useState(false);
  const [quizAssignmentId, setQuizAssignmentId] = useState<number | null>(null);
  useEffect(() => {
    loadClasses();
    if (currentProfile?.type === 'teacher') {
      loadAllStudentsProgress();
    }
  }, [currentProfile]);

  useEffect(() => {
    if (selectedClass) {
      loadClassData();
    }
  }, [selectedClass, activeTab]);

  const loadClasses = async () => {
    try {
      const response = await schoolAPI.getClasses();
      setClasses(response.data);
      if (response.data.length > 0 && !selectedClass) {
        setSelectedClass(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load classes:', error);
    }
  };

  const loadClassData = async () => {
    if (!selectedClass) return;
    setLoading(true);
    try {
      if (activeTab === 'assignments') {
        const response = await schoolAPI.getClassAssignments(selectedClass);
        setAssignments(response.data);
      } else if (activeTab === 'students') {
        const response = await schoolAPI.getClassStudents(selectedClass);
        setStudents(response.data);
      }
    } catch (error) {
      console.error('Failed to load class data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllStudentsProgress = async () => {
    try {
      const response = await schoolAPI.getAllStudentsProgress();
      setStudentsProgress(response.data);
    } catch (error) {
      console.error('Failed to load students progress:', error);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || !selectedClass) return;

    try {
      // Save the type before resetting form
      const assignmentType = formData.type;

      const response = await schoolAPI.createAssignment({
        class_id: selectedClass,
        teacher_id: currentProfile.id,
        title: formData.title,
        description: formData.description || undefined,
        type: formData.type,
        youtube_link: formData.youtube_link || undefined,
        due_date: formData.due_date || undefined
      });

      setShowCreateForm(false);
      setFormData({
        title: '',
        description: '',
        type: 'homework',
        youtube_link: '',
        due_date: ''
      });

      // Check the saved type (not the reset formData)
      if (assignmentType === 'quiz') {
        setQuizAssignmentId(response.data.id);
        setShowQuizForm(true);
      } else {
        loadClassData();
      }
    } catch (error) {
      console.error('Failed to create assignment:', error);
    }
  };

  const handleDeleteAssignment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;

    try {
      await schoolAPI.deleteAssignment(id);
      loadClassData();
    } catch (error) {
      console.error('Failed to delete assignment:', error);
    }
  };

  const loadSubmissions = async (assignment: SchoolAssignment) => {
    try {
      const response = await schoolAPI.getAssignmentSubmissions(assignment.id);
      setSubmissions(response.data);
      setSelectedAssignment(assignment);
    } catch (error) {
      console.error('Failed to load submissions:', error);
    }
  };

  const handleSubmitFeedback = async (submissionId: number) => {
    if (!currentProfile || !feedbackData.comment.trim()) return;

    try {
      await schoolAPI.addFeedback(
        submissionId,
        currentProfile.id,
        feedbackData.comment,
        feedbackData.rating
      );

      setSelectedSubmission(null);
      setFeedbackData({ comment: '', rating: 'very_good' });

      // Reload submissions to see updated status
      if (selectedAssignment) {
        loadSubmissions(selectedAssignment);
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const getAssignmentTypeIcon = (type: string) => {
    switch (type) {
      case 'psalm':
        return <BookOpen size={18} className="text-purple-600" />;
      case 'video':
        return <Youtube size={18} className="text-red-600" />;
      case 'alphabet':
        return <FileText size={18} className="text-blue-600" />;
      default:
        return <FileText size={18} className="text-gray-600" />;
    }
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'excellent':
        return 'text-green-600 bg-green-50';
      case 'very_good':
        return 'text-blue-600 bg-blue-50';
      case 'good':
        return 'text-yellow-600 bg-yellow-50';
      case 'needs_improvement':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (!currentProfile) {
    return <div className="p-8 text-center">Please log in to access the school dashboard.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tigrinya Church School</h1>
          <p className="text-gray-600 mt-1">Manage classes, assignments, and student progress</p>
        </div>
        {currentProfile.type === 'teacher' && (
          <div className="flex items-center space-x-3">
            <Link
              to="/school/enroll"
              className="btn btn-secondary flex items-center"
            >
              <Users size={20} className="mr-2" />
              Manage Enrollment
            </Link>
            {activeTab === 'assignments' && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn btn-primary flex items-center"
              >
                <Plus size={20} className="mr-2" />
                New Assignment
              </button>
            )}
          </div>
        )}
      </div>

      {/* Class selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Class</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClass(cls.id)}
              className={`card p-4 text-left transition-all ${
                selectedClass === cls.id
                  ? 'border-2 border-primary-500 bg-primary-50'
                  : 'border-2 border-transparent hover:border-gray-300'
              }`}
            >
              <h3 className="font-semibold text-gray-900">{cls.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{cls.description}</p>
              <p className="text-xs text-gray-500 mt-1">
                Ages {cls.age_min} - {cls.age_max}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('assignments')}
            className={`pb-4 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'assignments'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={20} className="inline mr-2" />
            Assignments
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`pb-4 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'students'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={20} className="inline mr-2" />
            Students
          </button>
          <button
            onClick={() => setActiveTab('submissions')}
            className={`pb-4 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'submissions'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <CheckCircle size={20} className="inline mr-2" />
            Progress
          </button>
        </div>
      </div>

      {/* Create Assignment Form */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Create New Assignment</h2>
            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as AssignmentType })}
                  className="input"
                >
                  <option value="homework">Homework</option>
                  <option value="psalm">Psalm</option>
                  <option value="alphabet">Alphabet Practice</option>
                  <option value="video">Video Lesson</option>
                  <option value="other">Other</option>
<option value="quiz">Quiz</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  YouTube Link (optional)
                </label>
                <input
                  type="url"
                  value={formData.youtube_link}
                  onChange={(e) => setFormData({ ...formData, youtube_link: e.target.value })}
                  className="input"
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date (optional)
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="input"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  Create Assignment
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quiz Creation Modal */}
      {showQuizForm && quizAssignmentId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <QuizCreationForm
              assignmentId={quizAssignmentId}
              onSuccess={() => {
                setShowQuizForm(false);
                setQuizAssignmentId(null);
                loadClassData();
              }}
              onCancel={() => {
                setShowQuizForm(false);
                setQuizAssignmentId(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Assignments Tab */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : assignments.length === 0 ? (
            <div className="card p-8 text-center">
              <FileText size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">No assignments yet. Create your first assignment!</p>
            </div>
          ) : (
            assignments.map((assignment) => (
              <div key={assignment.id} className="card p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {getAssignmentTypeIcon(assignment.type)}
                      <h3 className="text-xl font-semibold text-gray-900">{assignment.title}</h3>
                    </div>
                    {assignment.description && (
                      <p className="text-gray-600 mb-3">{assignment.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      <span className="capitalize">{assignment.type.replace('_', ' ')}</span>
                      {assignment.due_date && (
                        <span className="flex items-center">
                          <Clock size={14} className="mr-1" />
                          Due: {new Date(assignment.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {assignment.youtube_link && (
                        <a
                          href={assignment.youtube_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-red-600 hover:text-red-700"
                        >
                          <Youtube size={14} className="mr-1" />
                          Watch Video
                        </a>
                      )}
                    </div>
                  </div>
                  {currentProfile.type === 'teacher' && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => loadSubmissions(assignment)}
                        className="btn btn-secondary text-sm"
                      >
                        View Submissions
                      </button>
                      <button
                        onClick={() => handleDeleteAssignment(assignment.id)}
                        className="btn bg-red-100 text-red-700 hover:bg-red-200 text-sm"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Students Tab */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : students.length === 0 ? (
            <div className="card p-8 text-center">
              <Users size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">No students enrolled in this class yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map((student) => (
                <div key={student.id} className="card p-4">
                  <div className="flex items-center space-x-3">
                    <div className="text-3xl">{student.avatar || '👤'}</div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{student.student_name}</h3>
                      <p className="text-sm text-gray-600">{student.age} years old</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Progress Tab */}
      {activeTab === 'submissions' && (
        <div className="space-y-4">
          {studentsProgress.length === 0 ? (
            <div className="card p-8 text-center">
              <Award size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">No student progress data available yet.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Assignments
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Submitted
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Approved
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Completion Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {studentsProgress.map((progress) => (
                      <tr key={progress.student_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{progress.student_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {progress.total_assignments}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {progress.submitted_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {progress.approved_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className="bg-green-600 h-2 rounded-full"
                                style={{ width: `${progress.completion_rate}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-700">{progress.completion_rate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Submissions Modal */}
      {selectedAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Submissions: {selectedAssignment.title}</h2>
              <button
                onClick={() => {
                  setSelectedAssignment(null);
                  setSubmissions([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {submissions.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No submissions yet.</p>
              ) : (
                submissions.map((submission) => (
                  <div key={submission.id} className="card p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{submission.student_name}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Submitted: {new Date(submission.submitted_at).toLocaleDateString()}
                        </p>
                        {submission.notes && (
                          <p className="text-gray-700 mt-2">{submission.notes}</p>
                        )}
                        <div className="mt-2">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                              submission.status === 'approved'
                                ? 'bg-green-100 text-green-800'
                                : submission.status === 'needs_revision'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {submission.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                      {currentProfile.type === 'teacher' && (
                        <button
                          onClick={() => setSelectedSubmission(submission)}
                          className="btn btn-primary text-sm"
                        >
                          <Send size={16} className="mr-2" />
                          Give Feedback
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h2 className="text-2xl font-bold mb-4">
              Give Feedback - {selectedSubmission.student_name}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                <div className="grid grid-cols-2 gap-2">
                  {['excellent', 'very_good', 'good', 'needs_improvement'].map((rating) => (
                    <button
                      key={rating}
                      onClick={() =>
                        setFeedbackData({ ...feedbackData, rating: rating as any })
                      }
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        feedbackData.rating === rating
                          ? getRatingColor(rating) + ' border-2 border-current'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {rating.replace('_', ' ').toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                <textarea
                  value={feedbackData.comment}
                  onChange={(e) => setFeedbackData({ ...feedbackData, comment: e.target.value })}
                  className="input"
                  rows={4}
                  placeholder="Provide your feedback here..."
                  required
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => handleSubmitFeedback(selectedSubmission.id)}
                  className="btn btn-primary flex-1"
                  disabled={!feedbackData.comment.trim()}
                >
                  Submit Feedback
                </button>
                <button
                  onClick={() => {
                    setSelectedSubmission(null);
                    setFeedbackData({ comment: '', rating: 'very_good' });
                  }}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
