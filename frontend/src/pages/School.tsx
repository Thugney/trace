
import { useEffect, useMemo, useState } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useToast } from '../components/Toast';
import { profilesAPI, schoolAPI } from '../services/api';
import type { Profile, SchoolAssignment, SchoolClass, SchoolFeedback, SchoolSubmission } from '../types';

type AssignmentFormState = {
  title: string;
  description: string;
  type: 'homework' | 'psalm' | 'alphabet' | 'video' | 'quiz' | 'other';
  youtube_link: string;
  due_date: string;
};

type ClassFormState = {
  name: string;
  description: string;
  age_min: string;
  age_max: string;
};

type SubmissionWithClass = SchoolSubmission & { class_id?: number };

const emptyAssignmentForm: AssignmentFormState = {
  title: '',
  description: '',
  type: 'homework',
  youtube_link: '',
  due_date: ''
};

const emptyClassForm: ClassFormState = {
  name: '',
  description: '',
  age_min: '',
  age_max: ''
};

const assignmentTypes: Array<{ value: AssignmentFormState['type']; label: string; icon: string }> = [
  { value: 'homework', label: 'Homework', icon: '📝' },
  { value: 'psalm', label: 'Psalm', icon: '📖' },
  { value: 'alphabet', label: 'Alphabet', icon: '🔤' },
  { value: 'video', label: 'Video', icon: '🎬' },
  { value: 'quiz', label: 'Quiz', icon: '❓' },
  { value: 'other', label: 'Other', icon: '📋' }
];

const formatDate = (value?: string | null) => {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function School() {
  const { currentProfile } = useProfile();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [allClasses, setAllClasses] = useState<SchoolClass[]>([]);
  const [enrolledClasses, setEnrolledClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<SchoolAssignment[]>([]);
  const [classStudents, setClassStudents] = useState<Profile[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionWithClass[]>([]);
  const [feedback, setFeedback] = useState<SchoolFeedback[]>([]);
  const [children, setChildren] = useState<Profile[]>([]);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>(emptyAssignmentForm);
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [classForm, setClassForm] = useState<ClassFormState>(emptyClassForm);
  const [submissionNotes, setSubmissionNotes] = useState<Record<number, string>>({});
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [teacherTab, setTeacherTab] = useState<'assignments' | 'students' | 'submissions'>('assignments');
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [expandedStudentId, setExpandedStudentId] = useState<number | null>(null);

  const isAdmin = currentProfile?.type === 'admin';
  const isTeacher = currentProfile?.type === 'teacher';
  const isParent = currentProfile?.type === 'parent';
  const isChild = currentProfile?.type === 'child';

  const selectedClass = classes.find(cls => cls.id === selectedClassId) || null;

  const teacherSubmissions = useMemo(() => {
    if (!selectedClassId) return [];
    return submissions.filter(submission => submission.class_id === selectedClassId);
  }, [submissions, selectedClassId]);

  const submissionsByAssignment = useMemo(() => {
    const map = new Map<number, SchoolSubmission>();
    submissions.forEach(submission => {
      map.set(submission.assignment_id, submission);
    });
    return map;
  }, [submissions]);

  useEffect(() => {
    if (!currentProfile) return;

    const loadBase = async () => {
      try {
        setLoading(true);
        const classesRes = await schoolAPI.getClasses();
        setClasses(classesRes.data);

        if (isTeacher && classesRes.data.length > 0) {
          setSelectedClassId(classesRes.data[0].id);
        }

        if (isParent) {
          const profilesRes = await profilesAPI.getAll();
          const kids = profilesRes.data.filter(profile => profile.type === 'child');
          setChildren(kids);
          setSelectedStudentId(kids[0]?.id ?? null);
          const allClassesRes = await schoolAPI.getAllClasses();
          setAllClasses(allClassesRes.data);
        }

        if (isAdmin) {
          const profilesRes = await profilesAPI.getAll();
          setTeachers(profilesRes.data.filter(profile => profile.type === 'teacher'));
          setChildren(profilesRes.data.filter(profile => profile.type === 'child'));
        }

        if (isChild) {
          setSelectedStudentId(currentProfile.id);
        }
      } catch (error) {
        console.error('Failed to load school data:', error);
        showToast('Failed to load school data', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadBase();
  }, [currentProfile, isAdmin, isTeacher, isParent, isChild, showToast]);

  useEffect(() => {
    if (!selectedClassId || !isTeacher) return;
    const loadTeacherClass = async (showError = true) => {
      try {
        const [assignmentsRes, studentsRes, submissionsRes] = await Promise.all([
          schoolAPI.getAssignments({ class_id: selectedClassId }),
          schoolAPI.getClassStudents(selectedClassId),
          schoolAPI.getSubmissions()
        ]);
        setAssignments(assignmentsRes.data);
        setClassStudents(studentsRes.data);
        setSubmissions(submissionsRes.data as SubmissionWithClass[]);
      } catch (error) {
        console.error('Failed to load teacher class data:', error);
        if (showError) showToast('Failed to load class data', 'error');
      }
    };
    loadTeacherClass();
    const interval = setInterval(() => loadTeacherClass(false), 15000);
    return () => clearInterval(interval);
  }, [selectedClassId, isTeacher, showToast]);

  useEffect(() => {
    if (!selectedStudentId || !(isParent || isChild)) return;
    const loadStudentData = async (showError = true) => {
      try {
        const [assignmentsRes, submissionsRes, feedbackRes, enrollmentsRes] = await Promise.all([
          schoolAPI.getAssignments({ student_id: selectedStudentId }),
          schoolAPI.getSubmissions({ student_id: selectedStudentId }),
          schoolAPI.getFeedback({ student_id: selectedStudentId }),
          schoolAPI.getClasses({ student_id: selectedStudentId })
        ]);
        setAssignments(assignmentsRes.data);
        setSubmissions(submissionsRes.data as SubmissionWithClass[]);
        setFeedback(feedbackRes.data);
        setEnrolledClasses(enrollmentsRes.data);
      } catch (error) {
        console.error('Failed to load student data:', error);
        if (showError) showToast('Failed to load assignments', 'error');
      }
    };
    loadStudentData();
    const interval = setInterval(() => loadStudentData(false), 15000);
    return () => clearInterval(interval);
  }, [selectedStudentId, isParent, isChild, showToast]);

  const handleCreateClass = async () => {
    if (!classForm.name.trim()) {
      showToast('Class name is required', 'error');
      return;
    }
    try {
      const created = await schoolAPI.createClass({
        name: classForm.name.trim(),
        description: classForm.description.trim() || undefined,
        age_min: classForm.age_min ? Number(classForm.age_min) : undefined,
        age_max: classForm.age_max ? Number(classForm.age_max) : undefined
      });
      setClassForm(emptyClassForm);
      setClasses(prev => [...prev, created.data]);
      setSelectedClassId(created.data.id);
      setShowCreateClass(false);
      showToast('Class created', 'success');
    } catch (error) {
      console.error('Failed to create class:', error);
      showToast('Failed to create class', 'error');
    }
  };

  const handleEnrollStudent = async (studentId: number, classId: number) => {
    try {
      await schoolAPI.enrollStudent(studentId, classId);
      const enrollmentsRes = await schoolAPI.getClasses({ student_id: studentId });
      setEnrolledClasses(enrollmentsRes.data);
      showToast('Enrolled successfully', 'success');
    } catch (error) {
      console.error('Failed to enroll student:', error);
      showToast('Failed to enroll student', 'error');
    }
  };

  const handleCreateAssignment = async () => {
    if (!selectedClassId) {
      showToast('Select a class first', 'error');
      return;
    }
    if (!assignmentForm.title.trim()) {
      showToast('Title is required', 'error');
      return;
    }

    try {
      const assignmentRes = await schoolAPI.createAssignment({
        class_id: selectedClassId,
        title: assignmentForm.title.trim(),
        description: assignmentForm.description.trim() || undefined,
        type: assignmentForm.type,
        youtube_link: assignmentForm.youtube_link.trim() || undefined,
        due_date: assignmentForm.due_date || undefined
      });

      if (assignmentFile) {
        await schoolAPI.uploadAssignmentAttachment(assignmentRes.data.id, assignmentFile);
        setAssignmentFile(null);
      }

      setAssignmentForm(emptyAssignmentForm);
      setShowCreateAssignment(false);
      const updatedAssignments = await schoolAPI.getAssignments({ class_id: selectedClassId });
      setAssignments(updatedAssignments.data);
      showToast('Assignment published', 'success');
    } catch (error) {
      console.error('Failed to create assignment:', error);
      showToast('Failed to create assignment', 'error');
    }
  };

  const handleSubmitAssignment = async (assignmentId: number) => {
    try {
      const notes = submissionNotes[assignmentId] || '';
      await schoolAPI.createSubmission({
        assignment_id: assignmentId,
        student_id: isParent ? selectedStudentId || undefined : undefined,
        notes
      });

      const updatedSubmissions = await schoolAPI.getSubmissions({ student_id: selectedStudentId || undefined });
      setSubmissions(updatedSubmissions.data as SubmissionWithClass[]);
      showToast('Submitted successfully', 'success');
    } catch (error) {
      console.error('Failed to submit assignment:', error);
      showToast('Failed to submit', 'error');
    }
  };

  const handleSendFeedback = async () => {
    if (!selectedSubmissionId) {
      showToast('Select a submission', 'error');
      return;
    }
    if (!feedbackText.trim()) {
      showToast('Feedback is required', 'error');
      return;
    }

    try {
      await schoolAPI.createFeedback({
        submission_id: selectedSubmissionId,
        comment: feedbackText.trim(),
        rating: feedbackRating || undefined,
        status: feedbackStatus || undefined
      });
      setFeedbackText('');
      setFeedbackRating('');
      setFeedbackStatus('');
      setSelectedSubmissionId(null);
      const refreshed = await schoolAPI.getSubmissions();
      setSubmissions(refreshed.data as SubmissionWithClass[]);
      showToast('Feedback sent', 'success');
    } catch (error) {
      console.error('Failed to save feedback:', error);
      showToast('Failed to send feedback', 'error');
    }
  };

  const availableClasses = useMemo(() => {
    if (!selectedStudentId) return allClasses;
    return allClasses.filter(cls => !enrolledClasses.some(enrolled => enrolled.id === cls.id));
  }, [allClasses, enrolledClasses, selectedStudentId]);

  const teacherStats = useMemo(() => {
    const totalAssignments = assignments.length;
    const totalStudents = classStudents.length;
    const totalSubmissions = teacherSubmissions.length;
    const needsReview = teacherSubmissions.filter(item => item.status === 'submitted').length;
    return { totalAssignments, totalStudents, totalSubmissions, needsReview };
  }, [assignments, classStudents, teacherSubmissions]);

  const studentProgressData = useMemo(() => {
    if (!isTeacher) return [];
    return classStudents.map(student => {
      const studentSubs = teacherSubmissions.filter(sub => sub.student_id === student.id);
      const submittedCount = studentSubs.length;
      const approvedCount = studentSubs.filter(sub => sub.status === 'approved').length;
      const needsRevisionCount = studentSubs.filter(sub => sub.status === 'needs_revision').length;
      const pendingCount = studentSubs.filter(sub => sub.status === 'submitted').length;

      const assignmentStatuses = assignments.map(assignment => {
        const sub = studentSubs.find(s => s.assignment_id === assignment.id);
        return {
          assignment,
          submission: sub || null,
          status: sub?.status || 'not_submitted'
        };
      });

      return {
        student,
        submittedCount,
        approvedCount,
        needsRevisionCount,
        pendingCount,
        totalAssignments: assignments.length,
        assignmentStatuses
      };
    });
  }, [isTeacher, classStudents, teacherSubmissions, assignments]);

  const studentStats = useMemo(() => {
    const totalAssignments = assignments.length;
    const submitted = assignments.filter(item => item.submission_status).length;
    const approved = assignments.filter(item => item.submission_status === 'approved').length;
    const needsRevision = assignments.filter(item => item.submission_status === 'needs_revision').length;
    return { totalAssignments, submitted, approved, needsRevision };
  }, [assignments]);

  const assignmentsByClass = useMemo(() => {
    if (!isParent && !isChild) return [];

    const grouped = new Map<number, { classInfo: SchoolClass; assignments: SchoolAssignment[] }>();

    assignments.forEach(assignment => {
      const classId = assignment.class_id;
      if (!grouped.has(classId)) {
        const classInfo = enrolledClasses.find(c => c.id === classId);
        if (classInfo) {
          grouped.set(classId, { classInfo, assignments: [] });
        }
      }
      grouped.get(classId)?.assignments.push(assignment);
    });

    return Array.from(grouped.values());
  }, [isParent, isChild, assignments, enrolledClasses]);

  const getFeedbackForAssignment = (assignmentId: number) => {
    const submission = submissionsByAssignment.get(assignmentId);
    if (!submission) return [];
    return feedback.filter(f => f.submission_id === submission.id);
  };

  const isOverdue = (dueDate?: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  // ============ TEACHER VIEW ============
  if (isTeacher) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Church School</h1>
            <p className="text-slate-500 mt-1">Manage your classes and assignments</p>
          </div>

          {/* Class Selector - Horizontal Pills */}
          <div className="mb-8">
            <div className="flex items-center gap-3 flex-wrap">
              {classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`px-5 py-2.5 rounded-full font-medium transition-all ${
                    selectedClassId === cls.id
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {cls.name}
                </button>
              ))}
              <button
                onClick={() => setShowCreateClass(!showCreateClass)}
                className="px-4 py-2.5 rounded-full font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all flex items-center gap-2"
              >
                <span className="text-lg">+</span>
                New Class
              </button>
            </div>

            {/* Inline Create Class Form */}
            {showCreateClass && (
              <div className="mt-4 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Class Name</label>
                    <input
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                      placeholder="e.g. Sunday School Juniors"
                      value={classForm.name}
                      onChange={(e) => setClassForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Min Age</label>
                    <input
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                      placeholder="5"
                      type="number"
                      value={classForm.age_min}
                      onChange={(e) => setClassForm(prev => ({ ...prev, age_min: e.target.value }))}
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max Age</label>
                    <input
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                      placeholder="12"
                      type="number"
                      value={classForm.age_max}
                      onChange={(e) => setClassForm(prev => ({ ...prev, age_max: e.target.value }))}
                    />
                  </div>
                  <button
                    onClick={handleCreateClass}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreateClass(false)}
                    className="px-4 py-2.5 text-slate-500 hover:text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {selectedClass && (
            <>
              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-5 rounded-2xl border border-slate-100">
                  <div className="text-3xl font-bold text-slate-900">{teacherStats.totalStudents}</div>
                  <div className="text-sm text-slate-500">Students</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100">
                  <div className="text-3xl font-bold text-slate-900">{teacherStats.totalAssignments}</div>
                  <div className="text-sm text-slate-500">Assignments</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100">
                  <div className="text-3xl font-bold text-slate-900">{teacherStats.totalSubmissions}</div>
                  <div className="text-sm text-slate-500">Submissions</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-amber-100 bg-amber-50">
                  <div className="text-3xl font-bold text-amber-600">{teacherStats.needsReview}</div>
                  <div className="text-sm text-amber-700">Need Review</div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl w-fit">
                {[
                  { id: 'assignments' as const, label: 'Assignments' },
                  { id: 'students' as const, label: 'Students' },
                  { id: 'submissions' as const, label: 'Submissions' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setTeacherTab(tab.id)}
                    className={`px-4 py-1.5 rounded-lg font-medium text-sm transition-all ${
                      teacherTab === tab.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content Container */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-100 p-5 md:p-6">
                {/* Assignments Tab */}
                {teacherTab === 'assignments' && (
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-lg font-semibold text-slate-900">Assignments for {selectedClass.name}</h2>
                    <button
                      onClick={() => setShowCreateAssignment(!showCreateAssignment)}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-1"
                    >
                      <span>+</span> New
                    </button>
                  </div>

                  {/* Inline Create Assignment Form */}
                  {showCreateAssignment && (
                    <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <div className="lg:col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
                          <input
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none text-sm"
                            placeholder="e.g. Memorize Psalm 23"
                            value={assignmentForm.title}
                            onChange={(e) => setAssignmentForm(prev => ({ ...prev, title: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                          <select
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none bg-white text-sm"
                            value={assignmentForm.type}
                            onChange={(e) => setAssignmentForm(prev => ({ ...prev, type: e.target.value as AssignmentFormState['type'] }))}
                          >
                            {assignmentTypes.map(t => (
                              <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
                          <input
                            type="date"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none text-sm"
                            value={assignmentForm.due_date}
                            onChange={(e) => setAssignmentForm(prev => ({ ...prev, due_date: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 mt-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
                          <textarea
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none resize-none text-sm"
                            rows={2}
                            placeholder="Instructions for students..."
                            value={assignmentForm.description}
                            onChange={(e) => setAssignmentForm(prev => ({ ...prev, description: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Attachment (optional)</label>
                          <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-white transition-colors">
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span className="text-sm text-slate-500 truncate flex-1">
                              {assignmentFile ? assignmentFile.name : 'PDF, DOC, or image'}
                            </span>
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                              onChange={(e) => setAssignmentFile(e.target.files?.[0] || null)}
                            />
                            {assignmentFile && (
                              <button
                                onClick={(e) => { e.preventDefault(); setAssignmentFile(null); }}
                                className="text-slate-400 hover:text-red-500"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={handleCreateAssignment}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                        >
                          Publish
                        </button>
                        <button
                          onClick={() => setShowCreateAssignment(false)}
                          className="px-3 py-2 text-slate-500 hover:text-slate-700 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Assignment List */}
                  {assignments.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="text-5xl mb-4">📚</div>
                      <p className="text-slate-500">No assignments yet. Create your first one!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {assignments.map(assignment => {
                        const submissionCount = teacherSubmissions.filter(s => s.assignment_id === assignment.id).length;
                        const typeInfo = assignmentTypes.find(t => t.value === assignment.type);
                        return (
                          <div key={assignment.id} className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <div className="text-2xl">{typeInfo?.icon || '📋'}</div>
                                <div>
                                  <h3 className="font-semibold text-slate-900">{assignment.title}</h3>
                                  {assignment.description && (
                                    <p className="text-sm text-slate-500 mt-1">{assignment.description}</p>
                                  )}
                                  <div className="flex items-center gap-4 mt-2 text-sm">
                                    <span className="text-slate-400">{typeInfo?.label}</span>
                                    {assignment.due_date && (
                                      <span className="text-slate-400">Due {formatDate(assignment.due_date)}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-semibold text-slate-900">{submissionCount}/{classStudents.length}</div>
                                <div className="text-xs text-slate-400">submitted</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Students Tab */}
              {teacherTab === 'students' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-slate-900">Students in {selectedClass.name}</h2>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                      {classStudents.length} enrolled
                    </span>
                  </div>
                  {classStudents.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="text-5xl mb-4">👨‍🎓</div>
                      <p className="text-slate-500">No students enrolled yet</p>
                      <p className="text-sm text-slate-400 mt-1">Parents can enroll their children from their dashboard</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {studentProgressData.map(({ student, submittedCount, approvedCount, needsRevisionCount, pendingCount, totalAssignments, assignmentStatuses }) => {
                        const progressPercent = Math.round((approvedCount / Math.max(totalAssignments, 1)) * 100);
                        return (
                          <div
                            key={student.id}
                            className={`bg-gradient-to-br ${
                              progressPercent === 100 ? 'from-emerald-50 to-green-50 border-emerald-200' :
                              needsRevisionCount > 0 ? 'from-amber-50 to-orange-50 border-amber-200' :
                              'from-slate-50 to-white border-slate-200'
                            } p-5 rounded-2xl border transition-all hover:shadow-md cursor-pointer`}
                            onClick={() => setExpandedStudentId(expandedStudentId === student.id ? null : student.id)}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-200">
                                  {student.name?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-900">{student.name}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    {approvedCount > 0 && (
                                      <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">{approvedCount} done</span>
                                    )}
                                    {pendingCount > 0 && (
                                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{pendingCount} pending</span>
                                    )}
                                    {needsRevisionCount > 0 && (
                                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">{needsRevisionCount} revise</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-slate-900">{progressPercent}%</div>
                                <div className="text-xs text-slate-400">complete</div>
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mt-4 h-2 bg-slate-200 rounded-full overflow-hidden flex">
                              <div className="bg-emerald-500 transition-all" style={{ width: `${(approvedCount / Math.max(totalAssignments, 1)) * 100}%` }}></div>
                              <div className="bg-blue-400 transition-all" style={{ width: `${(pendingCount / Math.max(totalAssignments, 1)) * 100}%` }}></div>
                              <div className="bg-amber-400 transition-all" style={{ width: `${(needsRevisionCount / Math.max(totalAssignments, 1)) * 100}%` }}></div>
                            </div>
                            <div className="mt-1 text-xs text-slate-400 text-right">{submittedCount} of {totalAssignments} submitted</div>

                            {/* Expanded Details */}
                            {expandedStudentId === student.id && (
                              <div className="mt-4 pt-4 border-t border-slate-200/50 space-y-2">
                                {assignmentStatuses.map(({ assignment, status }) => (
                                  <div key={assignment.id} className="flex items-center justify-between py-2 px-3 bg-white/60 rounded-lg">
                                    <span className="text-sm text-slate-700">{assignment.title}</span>
                                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                                      status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                      status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                                      status === 'needs_revision' ? 'bg-amber-100 text-amber-700' :
                                      'bg-slate-100 text-slate-500'
                                    }`}>
                                      {status === 'approved' ? 'Approved' :
                                       status === 'submitted' ? 'Pending' :
                                       status === 'needs_revision' ? 'Revise' :
                                       'Not Done'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Submissions Tab */}
              {teacherTab === 'submissions' && (
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-6">Submissions to Review</h2>
                  {teacherSubmissions.filter(s => s.status === 'submitted').length === 0 ? (
                    <div className="text-center py-16">
                      <div className="text-5xl mb-4">✅</div>
                      <p className="text-slate-500">All caught up! No submissions to review.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {teacherSubmissions.filter(s => s.status === 'submitted').map(submission => {
                        const assignment = assignments.find(a => a.id === submission.assignment_id);
                        const student = classStudents.find(s => s.id === submission.student_id);
                        return (
                          <div key={submission.id} className={`bg-white p-5 rounded-2xl border transition-all ${selectedSubmissionId === submission.id ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-100'}`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                                  {student?.name?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <div className="font-medium text-slate-900">{student?.name || 'Unknown'}</div>
                                  <div className="text-sm text-slate-500">{assignment?.title}</div>
                                  {submission.notes && (
                                    <div className="mt-2 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                                      "{submission.notes}"
                                    </div>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => setSelectedSubmissionId(selectedSubmissionId === submission.id ? null : submission.id)}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                  selectedSubmissionId === submission.id
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                {selectedSubmissionId === submission.id ? 'Selected' : 'Review'}
                              </button>
                            </div>

                            {/* Feedback Form */}
                            {selectedSubmissionId === submission.id && (
                              <div className="mt-4 pt-4 border-t border-slate-100">
                                <div className="flex flex-wrap gap-4 items-end">
                                  <div className="flex-1 min-w-[200px]">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Feedback</label>
                                    <textarea
                                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none resize-none"
                                      rows={2}
                                      placeholder="Write feedback..."
                                      value={feedbackText}
                                      onChange={(e) => setFeedbackText(e.target.value)}
                                    />
                                  </div>
                                  <div className="w-36">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                    <select
                                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white"
                                      value={feedbackStatus}
                                      onChange={(e) => setFeedbackStatus(e.target.value)}
                                    >
                                      <option value="">Select...</option>
                                      <option value="approved">Approve</option>
                                      <option value="needs_revision">Needs Revision</option>
                                    </select>
                                  </div>
                                  <button
                                    onClick={handleSendFeedback}
                                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
                                  >
                                    Send Feedback
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              </div>
            </>
          )}

          {!selectedClass && classes.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🏫</div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Welcome to Church School</h2>
              <p className="text-slate-500 mb-6">Create your first class to get started</p>
              <button
                onClick={() => setShowCreateClass(true)}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
              >
                Create Your First Class
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============ PARENT/CHILD VIEW ============
  if (isParent || isChild) {
    const selectedChild = children.find(c => c.id === selectedStudentId);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">
              {isChild ? 'My Schoolwork' : 'Church School'}
            </h1>
            <p className="text-slate-500 mt-1">
              {isChild ? 'Complete your assignments' : `Tracking progress for ${selectedChild?.name || 'your child'}`}
            </p>
          </div>

          {/* Child Selector (Parent only) */}
          {isParent && children.length > 1 && (
            <div className="mb-8 flex items-center gap-3 flex-wrap">
              {children.map(child => (
                <button
                  key={child.id}
                  onClick={() => setSelectedStudentId(child.id)}
                  className={`px-5 py-2.5 rounded-full font-medium transition-all flex items-center gap-2 ${
                    selectedStudentId === child.id
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">
                    {child.name?.charAt(0)}
                  </div>
                  {child.name}
                </button>
              ))}
            </div>
          )}

          {/* Progress Summary */}
          <div className="mb-8 bg-white p-6 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-500">Overall Progress</span>
              <span className="text-2xl font-bold text-slate-900">{studentStats.submitted}/{studentStats.totalAssignments}</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 transition-all" style={{ width: `${(studentStats.approved / Math.max(studentStats.totalAssignments, 1)) * 100}%` }}></div>
              <div className="bg-blue-400 transition-all" style={{ width: `${((studentStats.submitted - studentStats.approved - studentStats.needsRevision) / Math.max(studentStats.totalAssignments, 1)) * 100}%` }}></div>
              <div className="bg-amber-400 transition-all" style={{ width: `${(studentStats.needsRevision / Math.max(studentStats.totalAssignments, 1)) * 100}%` }}></div>
            </div>
            <div className="flex items-center gap-6 mt-3 text-sm">
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> {studentStats.approved} Approved</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-400"></span> {studentStats.submitted - studentStats.approved - studentStats.needsRevision} Pending</span>
              {studentStats.needsRevision > 0 && (
                <span className="flex items-center gap-2 text-amber-600"><span className="w-3 h-3 rounded-full bg-amber-400"></span> {studentStats.needsRevision} Needs Revision</span>
              )}
            </div>
          </div>

          {/* Enrolled Classes & Enrollment (Parent only) */}
          {isParent && (
            <div className="mb-8 bg-white p-5 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Class Enrollment</h3>
                <span className="text-xs text-slate-400">{enrolledClasses.length} class{enrolledClasses.length !== 1 ? 'es' : ''} enrolled</span>
              </div>

              {/* Currently Enrolled */}
              {enrolledClasses.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2">Currently enrolled in:</p>
                  <div className="flex flex-wrap gap-2">
                    {enrolledClasses.map(cls => (
                      <span
                        key={cls.id}
                        className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-sm font-medium text-emerald-700 flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {cls.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Available to Enroll */}
              {availableClasses.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Available classes:</p>
                  <div className="flex flex-wrap gap-2">
                    {availableClasses.map(cls => (
                      <button
                        key={cls.id}
                        onClick={() => selectedStudentId && handleEnrollStudent(selectedStudentId, cls.id)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-sm font-medium text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-all flex items-center gap-1"
                      >
                        <span>+</span> {cls.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {enrolledClasses.length === 0 && availableClasses.length === 0 && (
                <p className="text-sm text-slate-400">No classes available. Teachers will create classes soon.</p>
              )}
            </div>
          )}

          {/* Assignments by Class */}
          {assignmentsByClass.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📚</div>
              <p className="text-slate-500">No assignments yet</p>
              {isParent && <p className="text-sm text-slate-400 mt-2">Enroll in a class to see assignments</p>}
            </div>
          ) : (
            <div className="space-y-10">
              {assignmentsByClass.map(({ classInfo, assignments: classAssignments }) => (
                <div key={classInfo.id}>
                  <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm">📖</span>
                    {classInfo.name}
                  </h2>
                  <div className="space-y-3">
                    {classAssignments.map(assignment => {
                      const submission = submissionsByAssignment.get(assignment.id);
                      const assignmentFeedback = getFeedbackForAssignment(assignment.id);
                      const overdueStatus = !submission?.status && isOverdue(assignment.due_date);
                      const needsRevision = submission?.status === 'needs_revision';
                      const isApproved = submission?.status === 'approved';
                      const isPending = submission?.status === 'submitted';
                      const typeInfo = assignmentTypes.find(t => t.value === assignment.type);

                      return (
                        <div
                          key={assignment.id}
                          className={`bg-white p-5 rounded-2xl border transition-all ${
                            isApproved ? 'border-emerald-200 bg-emerald-50/50' :
                            needsRevision ? 'border-amber-200 bg-amber-50/50' :
                            overdueStatus ? 'border-red-200 bg-red-50/50' :
                            'border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className="text-2xl">{typeInfo?.icon || '📋'}</div>
                              <div>
                                <h3 className="font-semibold text-slate-900">{assignment.title}</h3>
                                {assignment.description && (
                                  <p className="text-sm text-slate-500 mt-1">{assignment.description}</p>
                                )}
                                <div className="flex items-center gap-3 mt-2 text-sm">
                                  <span className="text-slate-400">{typeInfo?.label}</span>
                                  {assignment.due_date && (
                                    <span className={overdueStatus ? 'text-red-500 font-medium' : 'text-slate-400'}>
                                      {overdueStatus ? 'Overdue' : `Due ${formatDate(assignment.due_date)}`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                              isApproved ? 'bg-emerald-100 text-emerald-700' :
                              isPending ? 'bg-blue-100 text-blue-700' :
                              needsRevision ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {isApproved ? 'Approved' : isPending ? 'Pending' : needsRevision ? 'Revise' : 'Todo'}
                            </div>
                          </div>

                          {/* Feedback */}
                          {assignmentFeedback.length > 0 && (
                            <div className="mt-4 p-4 bg-emerald-50 rounded-xl border-l-4 border-emerald-500">
                              <p className="text-sm font-medium text-emerald-800 mb-1">Teacher Feedback</p>
                              {assignmentFeedback.map(fb => (
                                <p key={fb.id} className="text-sm text-slate-700">{fb.comment}</p>
                              ))}
                            </div>
                          )}

                          {/* Submit Area */}
                          {!isApproved && (
                            <div className="mt-4 pt-4 border-t border-slate-100 flex gap-3 items-end">
                              <div className="flex-1">
                                <textarea
                                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none resize-none text-sm"
                                  rows={2}
                                  placeholder="Add a note for your teacher..."
                                  value={submissionNotes[assignment.id] || ''}
                                  onChange={(e) => setSubmissionNotes(prev => ({ ...prev, [assignment.id]: e.target.value }))}
                                />
                              </div>
                              <button
                                onClick={() => handleSubmitAssignment(assignment.id)}
                                className={`px-5 py-2.5 rounded-xl font-medium text-white transition-colors ${
                                  needsRevision
                                    ? 'bg-amber-500 hover:bg-amber-600'
                                    : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                              >
                                {needsRevision ? 'Resubmit' : (submission?.status ? 'Update' : 'Submit')}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============ ADMIN VIEW ============
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">School Administration</h1>
            <p className="text-slate-500 mt-1">Overview of all classes and enrollment</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-100">
              <div className="text-4xl font-bold text-indigo-600">{classes.length}</div>
              <div className="text-slate-500 mt-1">Classes</div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100">
              <div className="text-4xl font-bold text-cyan-600">{teachers.length}</div>
              <div className="text-slate-500 mt-1">Teachers</div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100">
              <div className="text-4xl font-bold text-emerald-600">{children.length}</div>
              <div className="text-slate-500 mt-1">Students</div>
            </div>
          </div>

          {/* Classes */}
          <h2 className="text-xl font-semibold text-slate-900 mb-4">All Classes</h2>
          {classes.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
              <p className="text-slate-500">No classes created yet</p>
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              {classes.map(cls => (
                <div key={cls.id} className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-2xl">🏫</div>
                    <div>
                      <div className="font-semibold text-slate-900">{cls.name}</div>
                      {cls.description && <div className="text-sm text-slate-500">{cls.description}</div>}
                    </div>
                  </div>
                  <div className="text-sm text-slate-400">
                    Ages {cls.age_min ?? '-'} - {cls.age_max ?? '-'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Teachers */}
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Teachers</h2>
          {teachers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
              <p className="text-slate-500">No teachers registered</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {teachers.map(teacher => (
                <div key={teacher.id} className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-semibold">
                    {teacher.name?.charAt(0) || '?'}
                  </div>
                  <div className="font-medium text-slate-900">{teacher.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
