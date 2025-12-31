import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { schoolAPI } from '../services/api';
import {
  BookOpen,
  CheckCircle,
  Clock,
  Youtube,
  FileText,
  Award,
  Send,
  AlertCircle
} from 'lucide-react';
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
  const [feedback, setFeedback] = useState<any[]>([]);

  useEffect(() => {
    if (currentProfile) {
      loadStudentData();
    }
  }, [currentProfile]);

  const loadStudentData = async () => {
    if (!currentProfile) return;
    setLoading(true);
    try {
      // Load enrollments
      const enrollResponse = await schoolAPI.getStudentEnrollments(currentProfile.id);
      setEnrollments(enrollResponse.data);

      // Load assignments
      const assignmentsResponse = await schoolAPI.getStudentAssignments(currentProfile.id);
      setAssignments(assignmentsResponse.data);
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
      loadStudentData(); // Reload to update submission status
    } catch (error: any) {
      console.error('Failed to submit work:', error);
      alert(error.response?.data?.error || 'Failed to submit work. Please try again.');
    }
  };

  const loadFeedback = async (assignmentId: number) => {
    try {
      // Find the submission for this assignment
      const assignment = assignments.find((a) => a.id === assignmentId);
      if (!assignment || !assignment.has_submitted) return;

      // We need to get the submission ID first - this requires an API enhancement
      // For now, we'll show a placeholder
      setFeedback([]);
    } catch (error) {
      console.error('Failed to load feedback:', error);
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

  const getStatusBadge = (assignment: any) => {
    if (!assignment.has_submitted) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <AlertCircle size={12} className="mr-1" />
          Not Submitted
        </span>
      );
    }

    switch (assignment.submission_status) {
      case 'approved':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle size={12} className="mr-1" />
            Approved
          </span>
        );
      case 'needs_revision':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <AlertCircle size={12} className="mr-1" />
            Needs Revision
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock size={12} className="mr-1" />
            Submitted
          </span>
        );
    }
  };

  if (!currentProfile) {
    return <div className="p-8 text-center">Please log in to view your assignments.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My School Assignments</h1>
        <p className="text-gray-600 mt-1">Tigrinya Church School</p>
      </div>

      {/* Enrolled Classes */}
      {enrollments.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">My Classes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {enrollments.map((enrollment) => (
              <div key={enrollment.id} className="card p-4">
                <h3 className="font-semibold text-gray-900">{enrollment.class_name}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Enrolled: {new Date(enrollment.enrolled_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assignments */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Assignments</h2>
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : assignments.length === 0 ? (
          <div className="card p-8 text-center">
            <FileText size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No assignments yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {getAssignmentTypeIcon(assignment.type)}
                      <h3 className="text-xl font-semibold text-gray-900">{assignment.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{assignment.class_name}</p>
                    {assignment.description && (
                      <p className="text-gray-700 mb-3">{assignment.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      <span className="capitalize">{assignment.type.replace('_', ' ')}</span>
                      {assignment.due_date && (
                        <span className="flex items-center">
                          <Clock size={14} className="mr-1" />
                          Due: {new Date(assignment.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>{getStatusBadge(assignment)}</div>
                </div>

                {assignment.youtube_link && (
                  <div className="mb-4">
                    <a
                      href={assignment.youtube_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-red-600 hover:text-red-700 font-medium"
                    >
                      <Youtube size={20} className="mr-2" />
                      Watch Video Lesson
                    </a>
                  </div>
                )}

                {!assignment.has_submitted && (
                  <button
                    onClick={() => setSelectedAssignment(assignment)}
                    className="btn btn-primary w-full sm:w-auto"
                  >
                    <Send size={16} className="mr-2" />
                    Submit Work
                  </button>
                )}

                {assignment.has_submitted && assignment.submission_status === 'needs_revision' && (
                  <button
                    onClick={() => setSelectedAssignment(assignment)}
                    className="btn bg-orange-600 hover:bg-orange-700 text-white w-full sm:w-auto"
                  >
                    <Send size={16} className="mr-2" />
                    Resubmit Work
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit Work Modal */}
      {selectedAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h2 className="text-2xl font-bold mb-4">Submit Work</h2>
            <p className="text-gray-700 mb-4">
              Assignment: <span className="font-semibold">{selectedAssignment.title}</span>
            </p>

            <form onSubmit={handleSubmitWork} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  className="input"
                  rows={4}
                  placeholder="Add any notes about your submission here..."
                />
              </div>

              <div className="flex space-x-3">
                <button type="submit" className="btn btn-primary flex-1">
                  <Send size={16} className="mr-2" />
                  Submit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAssignment(null);
                    setSubmissionNotes('');
                  }}
                  className="btn btn-secondary flex-1"
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
