
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

const assignmentTypes: Array<{ value: AssignmentFormState['type']; label: string }> = [
  { value: 'homework', label: 'Homework' },
  { value: 'psalm', label: 'Psalm' },
  { value: 'alphabet', label: 'Alphabet' },
  { value: 'video', label: 'Video' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'other', label: 'Other' }
];

const formatDate = (value?: string | null) => {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatStatus = (status?: string | null) => {
  if (!status) return 'Not submitted';
  if (status === 'submitted') return 'Submitted';
  if (status === 'approved') return 'Approved';
  if (status === 'needs_revision') return 'Needs revision';
  return status;
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
    const loadTeacherClass = async () => {
      try {
        const [assignmentsRes, studentsRes, submissionsRes] = await Promise.all([
          schoolAPI.getAssignments({ class_id: selectedClassId }),
          schoolAPI.getClassStudents(selectedClassId),
          schoolAPI.getSubmissions()
        ]);
        setAssignments(assignmentsRes.data);
        setClassStudents(studentsRes.data);
        setSubmissions(submissionsRes.data as SubmissionWithClass[]);
        setSelectedSubmissionId(null);
      } catch (error) {
        console.error('Failed to load teacher class data:', error);
        showToast('Failed to load class data', 'error');
      }
    };
    loadTeacherClass();
  }, [selectedClassId, isTeacher, showToast]);

  useEffect(() => {
    if (!selectedStudentId || !(isParent || isChild)) return;
    const loadStudentData = async () => {
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
        showToast('Failed to load assignments', 'error');
      }
    };
    loadStudentData();
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
      showToast('Enrollment saved', 'success');
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
      showToast('Submission sent', 'success');
    } catch (error) {
      console.error('Failed to submit assignment:', error);
      showToast('Failed to submit assignment', 'error');
    }
  };

  const handleSendFeedback = async () => {
    if (!selectedSubmissionId) {
      showToast('Select a submission', 'error');
      return;
    }
    if (!feedbackText.trim()) {
      showToast('Feedback comment is required', 'error');
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
      const refreshed = await schoolAPI.getSubmissions();
      setSubmissions(refreshed.data as SubmissionWithClass[]);
      showToast('Feedback sent', 'success');
    } catch (error) {
      console.error('Failed to save feedback:', error);
      showToast('Failed to save feedback', 'error');
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

  // Student progress data for teachers - shows each student's submission status per assignment
  const studentProgressData = useMemo(() => {
    if (!isTeacher) return [];
    return classStudents.map(student => {
      const studentSubs = teacherSubmissions.filter(sub => sub.student_id === student.id);
      const submittedCount = studentSubs.length;
      const approvedCount = studentSubs.filter(sub => sub.status === 'approved').length;
      const needsRevisionCount = studentSubs.filter(sub => sub.status === 'needs_revision').length;
      const pendingCount = studentSubs.filter(sub => sub.status === 'submitted').length;

      // Map each assignment to its submission status for this student
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

  // Group assignments by class for parent/child view
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

  // Get feedback for a specific assignment
  const getFeedbackForAssignment = (assignmentId: number) => {
    const submission = submissionsByAssignment.get(assignmentId);
    if (!submission) return [];
    return feedback.filter(f => f.submission_id === submission.id);
  };

  // Check if assignment is overdue
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

  return (
    <div className="school-shell">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');

        .school-shell {
          --ink: #0f172a;
          --ink-secondary: #334155;
          --muted: #64748b;
          --accent: #6366f1;
          --accent-soft: rgba(99, 102, 241, 0.12);
          --accent-2: #f59e0b;
          --accent-3: #06b6d4;
          --success: #10b981;
          --warning: #f59e0b;
          --surface: rgba(255, 255, 255, 0.72);
          --surface-elevated: rgba(255, 255, 255, 0.88);
          --border: rgba(148, 163, 184, 0.18);
          --border-hover: rgba(99, 102, 241, 0.4);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: var(--ink);
        }

        .school-bg {
          min-height: calc(100vh - 120px);
          padding: 32px;
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #fafbff 0%, #f0f4ff 50%, #fef7f0 100%);
        }

        .school-bg::before {
          content: '';
          position: absolute;
          top: -200px;
          right: -200px;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
          border-radius: 50%;
          animation: float-slow 20s ease-in-out infinite;
          pointer-events: none;
        }

        .school-bg::after {
          content: '';
          position: absolute;
          bottom: -150px;
          left: -100px;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, transparent 70%);
          border-radius: 50%;
          animation: float-slow 25s ease-in-out infinite reverse;
          pointer-events: none;
        }

        @keyframes float-slow {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -20px) scale(1.05); }
        }

        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        @keyframes pulse-soft {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        @keyframes slide-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .school-card {
          background: var(--surface);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--border);
          border-radius: 28px;
          box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.03),
            0 10px 20px -2px rgba(0, 0, 0, 0.04),
            0 25px 50px -12px rgba(0, 0, 0, 0.06);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          animation: slide-up 0.5s ease-out both;
        }

        .school-card:hover {
          box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.04),
            0 15px 30px -2px rgba(0, 0, 0, 0.06),
            0 35px 60px -12px rgba(99, 102, 241, 0.12);
          transform: translateY(-2px);
        }

        .school-hero {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(6, 182, 212, 0.06) 50%, rgba(245, 158, 11, 0.05) 100%);
          border: 1px solid rgba(99, 102, 241, 0.15);
          position: relative;
          overflow: hidden;
        }

        .school-hero::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.3), rgba(6, 182, 212, 0.3), transparent);
        }

        .school-hero::after {
          content: '';
          position: absolute;
          top: -50%;
          right: -20%;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%);
          border-radius: 50%;
          pointer-events: none;
        }

        .school-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 800;
          letter-spacing: -0.03em;
          background: linear-gradient(135deg, #1e293b 0%, #475569 50%, #6366f1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .school-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 11px;
          font-weight: 700;
          color: var(--accent);
          padding: 6px 14px;
          background: var(--accent-soft);
          border-radius: 100px;
          margin-bottom: 8px;
        }

        .school-kicker::before {
          content: '';
          width: 6px;
          height: 6px;
          background: var(--accent);
          border-radius: 50%;
          animation: pulse-soft 2s ease-in-out infinite;
        }

        .school-section-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .school-input {
          width: 100%;
          border-radius: 16px;
          border: 1.5px solid var(--border);
          padding: 14px 18px;
          background: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          font-weight: 500;
          color: var(--ink);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
        }

        .school-input::placeholder {
          color: var(--muted);
          font-weight: 400;
        }

        .school-input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow:
            0 0 0 4px var(--accent-soft),
            0 4px 12px rgba(99, 102, 241, 0.1);
          background: #fff;
        }

        .school-input:hover:not(:focus) {
          border-color: rgba(148, 163, 184, 0.4);
          background: #fff;
        }

        .school-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 16px;
          padding: 14px 24px;
          font-weight: 600;
          font-size: 14px;
          letter-spacing: -0.01em;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          border: none;
          position: relative;
          overflow: hidden;
        }

        .school-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%);
          opacity: 0;
          transition: opacity 0.3s;
        }

        .school-btn:hover::after {
          opacity: 1;
        }

        .school-btn-primary {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
          background-size: 200% 200%;
          color: #fff;
          box-shadow:
            0 4px 12px rgba(99, 102, 241, 0.3),
            0 8px 24px rgba(139, 92, 246, 0.2);
        }

        .school-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow:
            0 8px 20px rgba(99, 102, 241, 0.4),
            0 16px 40px rgba(139, 92, 246, 0.25);
          background-position: 100% 100%;
        }

        .school-btn-primary:active {
          transform: translateY(0);
        }

        .school-btn-ghost {
          background: rgba(99, 102, 241, 0.08);
          color: var(--accent);
          border: 1.5px solid transparent;
        }

        .school-btn-ghost:hover {
          background: rgba(99, 102, 241, 0.14);
          border-color: rgba(99, 102, 241, 0.2);
          transform: translateY(-1px);
        }

        .school-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 100px;
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: -0.01em;
          backdrop-filter: blur(8px);
          border: 1px solid transparent;
          transition: all 0.3s ease;
        }

        .school-pill-emerald {
          background: rgba(16, 185, 129, 0.12);
          color: #059669;
          border-color: rgba(16, 185, 129, 0.2);
        }

        .school-pill-sky {
          background: rgba(6, 182, 212, 0.12);
          color: #0891b2;
          border-color: rgba(6, 182, 212, 0.2);
        }

        .school-pill-amber {
          background: rgba(245, 158, 11, 0.12);
          color: #d97706;
          border-color: rgba(245, 158, 11, 0.2);
        }

        .school-pill-violet {
          background: rgba(99, 102, 241, 0.12);
          color: #6366f1;
          border-color: rgba(99, 102, 241, 0.2);
        }

        .school-pill-slate {
          background: rgba(100, 116, 139, 0.1);
          color: #475569;
          border-color: rgba(100, 116, 139, 0.15);
        }

        .school-stat-card {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 255, 0.9) 100%);
          backdrop-filter: blur(12px);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 20px;
          transition: all 0.3s ease;
        }

        .school-stat-card:hover {
          border-color: var(--border-hover);
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.08);
        }

        .school-stat-value {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 800;
          font-size: 32px;
          letter-spacing: -0.03em;
          background: linear-gradient(135deg, var(--ink) 0%, var(--ink-secondary) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .school-item-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(8px);
          border: 1.5px solid var(--border);
          border-radius: 20px;
          padding: 20px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }

        .school-item-card:hover {
          background: rgba(255, 255, 255, 0.9);
          border-color: var(--border-hover);
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(99, 102, 241, 0.1);
        }

        .school-item-card.selected {
          background: rgba(99, 102, 241, 0.06);
          border-color: var(--accent);
          box-shadow:
            0 0 0 4px var(--accent-soft),
            0 8px 24px rgba(99, 102, 241, 0.12);
        }

        .school-empty-state {
          background: linear-gradient(135deg, rgba(248, 250, 255, 0.8) 0%, rgba(255, 255, 255, 0.6) 100%);
          border: 2px dashed rgba(148, 163, 184, 0.3);
          border-radius: 20px;
          padding: 40px;
          text-align: center;
        }

        .school-empty-icon {
          width: 56px;
          height: 56px;
          margin: 0 auto 16px;
          background: var(--accent-soft);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
        }

        .school-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          margin-bottom: 8px;
        }

        .school-description {
          font-size: 14px;
          line-height: 1.6;
          color: var(--ink-secondary);
        }

        .school-badge-type {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
          color: #6366f1;
          border: 1px solid rgba(99, 102, 241, 0.15);
        }

        .animate-in { animation: slide-up 0.4s ease-out both; }
        .animate-in-1 { animation-delay: 0.05s; }
        .animate-in-2 { animation-delay: 0.1s; }
        .animate-in-3 { animation-delay: 0.15s; }
        .animate-in-4 { animation-delay: 0.2s; }
      `}</style>

      <div className="school-bg">
        <div className="max-w-7xl mx-auto space-y-8">
          <section className="school-card school-hero p-8 md:p-10 relative z-10">
            <div className="flex flex-wrap items-start justify-between gap-8">
              <div className="space-y-4">
                <div className="school-kicker">Church Education</div>
                <h1 className="school-title text-4xl md:text-5xl">Church School Studio</h1>
                <p className="school-description max-w-xl">
                  {isTeacher && 'Create classes, publish assignments, and review submissions with a modern workflow.'}
                  {isParent && 'Enroll your children, track progress, and stay on top of teacher feedback.'}
                  {isChild && 'View your assignments, submit your work, and follow teacher feedback.'}
                  {isAdmin && 'Oversee the school system, view class activity, and manage access in one place.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                {isTeacher && (
                  <>
                    <span className="school-pill school-pill-emerald">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>
                      {teacherStats.totalStudents} Students
                    </span>
                    <span className="school-pill school-pill-sky">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      {teacherStats.totalAssignments} Assignments
                    </span>
                    <span className="school-pill school-pill-amber">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {teacherStats.needsReview} Pending
                    </span>
                  </>
                )}
                {(isParent || isChild) && (
                  <>
                    <span className="school-pill school-pill-emerald">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {studentStats.submitted}/{studentStats.totalAssignments} Submitted
                    </span>
                    <span className="school-pill school-pill-amber">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      {studentStats.needsRevision} Revisions
                    </span>
                  </>
                )}
                {isAdmin && (
                  <>
                    <span className="school-pill school-pill-violet">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                      {classes.length} Classes
                    </span>
                    <span className="school-pill school-pill-sky">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      {teachers.length} Teachers
                    </span>
                    <span className="school-pill school-pill-emerald">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>
                      {children.length} Students
                    </span>
                  </>
                )}
              </div>
            </div>
          </section>
          {isTeacher && (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
              {/* Left Sidebar - Classes */}
              <div className="lg:col-span-3 space-y-6">
                <div className="school-card p-6 space-y-5 animate-in animate-in-1">
                  <div>
                    <h2 className="school-section-title text-lg text-slate-900">My Classes</h2>
                    <p className="text-sm text-slate-500 mt-1">Select a class to manage</p>
                  </div>
                  <div className="space-y-3">
                    {classes.map(cls => (
                      <button
                        key={cls.id}
                        onClick={() => setSelectedClassId(cls.id)}
                        className={`school-item-card w-full text-left ${selectedClassId === cls.id ? 'selected' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-800 truncate">{cls.name}</div>
                            {cls.description && <div className="text-xs text-slate-500 mt-0.5 truncate">{cls.description}</div>}
                          </div>
                        </div>
                      </button>
                    ))}
                    {classes.length === 0 && (
                      <div className="school-empty-state py-8">
                        <div className="school-empty-icon">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        </div>
                        <p className="text-sm text-slate-500">No classes yet</p>
                        <p className="text-xs text-slate-400 mt-1">Create one below</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="school-card p-6 space-y-4 animate-in animate-in-2">
                  <div>
                    <h3 className="school-section-title text-base text-slate-900">Create New Class</h3>
                    <p className="text-sm text-slate-500 mt-1">Set up a new learning space</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="school-label">Class Name</label>
                      <input
                        className="school-input"
                        placeholder="e.g. Sunday School Juniors"
                        value={classForm.name}
                        onChange={(event) => setClassForm(prev => ({ ...prev, name: event.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="school-label">Description</label>
                      <textarea
                        className="school-input min-h-[80px] resize-none"
                        placeholder="Brief description of this class..."
                        value={classForm.description}
                        onChange={(event) => setClassForm(prev => ({ ...prev, description: event.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="school-label">Min Age</label>
                        <input
                          className="school-input"
                          placeholder="5"
                          type="number"
                          value={classForm.age_min}
                          onChange={(event) => setClassForm(prev => ({ ...prev, age_min: event.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="school-label">Max Age</label>
                        <input
                          className="school-input"
                          placeholder="12"
                          type="number"
                          value={classForm.age_max}
                          onChange={(event) => setClassForm(prev => ({ ...prev, age_max: event.target.value }))}
                        />
                      </div>
                    </div>
                    <button className="school-btn school-btn-primary w-full" onClick={handleCreateClass}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      Create Class
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Content Area - Tabbed */}
              <div className="lg:col-span-9 space-y-6">
                {/* Tab Navigation */}
                <div className="school-card p-2 animate-in animate-in-1">
                  <div className="flex gap-1">
                    {[
                      { id: 'assignments' as const, label: 'Assignments', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', count: assignments.length },
                      { id: 'students' as const, label: 'Students', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z', count: classStudents.length },
                      { id: 'submissions' as const, label: 'Submissions', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', count: teacherSubmissions.filter(s => s.status === 'submitted').length }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setTeacherTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-medium text-sm transition-all ${
                          teacherTab === tab.id
                            ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} /></svg>
                        {tab.label}
                        {tab.count > 0 && (
                          <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            teacherTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                          }`}>{tab.count}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assignments Tab */}
                {teacherTab === 'assignments' && (
                  <div className="space-y-6 animate-in">
                    {/* Assignment List */}
                    <div className="school-card p-6 space-y-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h2 className="school-section-title text-xl text-slate-900">Assignments</h2>
                          <p className="text-sm text-slate-500 mt-1">Track and publish work for {selectedClass?.name || 'your class'}</p>
                        </div>
                        <span className="school-pill school-pill-violet">{assignments.length} total</span>
                      </div>

                      {assignments.length === 0 ? (
                        <div className="school-empty-state">
                          <div className="school-empty-icon">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </div>
                          <p className="text-sm font-medium text-slate-600">No assignments yet</p>
                          <p className="text-xs text-slate-400 mt-1">Create one using the form below</p>
                        </div>
                      ) : (
                        <div className="grid gap-4">
                          {assignments.map(assignment => {
                            const submissionCount = teacherSubmissions.filter(s => s.assignment_id === assignment.id).length;
                            return (
                              <div key={assignment.id} className="school-item-card hover:cursor-default p-5">
                                <div className="flex items-start gap-4">
                                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-50 to-blue-100 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-6 h-6 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <h4 className="font-semibold text-slate-800 text-lg">{assignment.title}</h4>
                                        <div className="flex items-center gap-3 mt-1">
                                          <span className="school-badge-type">{assignmentTypes.find(t => t.value === assignment.type)?.label || assignment.type}</span>
                                          {assignment.due_date && (
                                            <span className="text-sm text-slate-500">Due {formatDate(assignment.due_date)}</span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="school-pill school-pill-emerald text-xs">
                                          {submissionCount}/{classStudents.length} submitted
                                        </span>
                                      </div>
                                    </div>
                                    {assignment.description && (
                                      <p className="text-sm text-slate-600 mt-3">{assignment.description}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Create Assignment Form */}
                    <div className="school-card p-6 space-y-5">
                      <div>
                        <h3 className="school-section-title text-lg text-slate-900">Create New Assignment</h3>
                        <p className="text-sm text-slate-500 mt-1">Publish work for your students</p>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="school-label">Title</label>
                          <input
                            className="school-input"
                            placeholder="e.g. Memorize Psalm 23"
                            value={assignmentForm.title}
                            onChange={(event) => setAssignmentForm(prev => ({ ...prev, title: event.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="school-label">Instructions</label>
                          <textarea
                            className="school-input min-h-[100px] resize-none"
                            placeholder="Describe what students need to do..."
                            value={assignmentForm.description}
                            onChange={(event) => setAssignmentForm(prev => ({ ...prev, description: event.target.value }))}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="school-label">Type</label>
                            <select
                              className="school-input"
                              value={assignmentForm.type}
                              onChange={(event) => setAssignmentForm(prev => ({
                                ...prev,
                                type: event.target.value as AssignmentFormState['type']
                              }))}
                            >
                              {assignmentTypes.map(type => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="school-label">Due Date</label>
                            <input
                              type="date"
                              className="school-input"
                              value={assignmentForm.due_date}
                              onChange={(event) => setAssignmentForm(prev => ({ ...prev, due_date: event.target.value }))}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="school-label">Video Link (Optional)</label>
                          <input
                            className="school-input"
                            placeholder="YouTube URL"
                            value={assignmentForm.youtube_link}
                            onChange={(event) => setAssignmentForm(prev => ({ ...prev, youtube_link: event.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="school-label">Attachment (Optional)</label>
                          <div className="school-input flex items-center gap-3 cursor-pointer hover:border-violet-300">
                            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                            <input
                              type="file"
                              className="flex-1 bg-transparent border-none p-0 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                              onChange={(event) => setAssignmentFile(event.target.files?.[0] || null)}
                            />
                          </div>
                        </div>
                        <button onClick={handleCreateAssignment} className="school-btn school-btn-primary w-full">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                          Publish Assignment
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Students Tab */}
                {teacherTab === 'students' && (
                  <div className="school-card p-6 space-y-5 animate-in">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="school-section-title text-xl text-slate-900">Student Progress</h2>
                        <p className="text-sm text-slate-500 mt-1">Track each student's submissions and progress in {selectedClass?.name || 'your class'}</p>
                      </div>
                      <span className="school-pill school-pill-emerald">{classStudents.length} enrolled</span>
                    </div>

                    {classStudents.length === 0 ? (
                      <div className="school-empty-state">
                        <div className="school-empty-icon">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>
                        </div>
                        <p className="text-sm font-medium text-slate-600">No students enrolled yet</p>
                        <p className="text-xs text-slate-400 mt-1">Students will appear here once enrolled by their parents</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {studentProgressData.map(({ student, submittedCount, approvedCount, needsRevisionCount, pendingCount, totalAssignments, assignmentStatuses }) => (
                          <div key={student.id} className="school-item-card p-5">
                            <div
                              className="flex items-center gap-4 cursor-pointer"
                              onClick={() => setExpandedStudentId(expandedStudentId === student.id ? null : student.id)}
                            >
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-lg font-semibold text-emerald-700">{student.name?.charAt(0) || '?'}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h4 className="font-semibold text-slate-800">{student.name}</h4>
                                    <p className="text-sm text-slate-500">Age {student.age ?? 'N/A'}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {needsRevisionCount > 0 && (
                                      <span className="school-pill school-pill-amber text-xs">{needsRevisionCount} needs revision</span>
                                    )}
                                    {pendingCount > 0 && (
                                      <span className="school-pill school-pill-sky text-xs">{pendingCount} pending review</span>
                                    )}
                                    <span className="school-pill school-pill-emerald text-xs">{submittedCount}/{totalAssignments} submitted</span>
                                    <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedStudentId === student.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                  </div>
                                </div>
                                {/* Progress bar */}
                                <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full flex">
                                    <div className="bg-emerald-500 transition-all" style={{ width: `${(approvedCount / Math.max(totalAssignments, 1)) * 100}%` }}></div>
                                    <div className="bg-sky-500 transition-all" style={{ width: `${(pendingCount / Math.max(totalAssignments, 1)) * 100}%` }}></div>
                                    <div className="bg-amber-500 transition-all" style={{ width: `${(needsRevisionCount / Math.max(totalAssignments, 1)) * 100}%` }}></div>
                                  </div>
                                </div>
                                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> {approvedCount} approved</span>
                                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500"></span> {pendingCount} pending</span>
                                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> {needsRevisionCount} needs revision</span>
                                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"></span> {totalAssignments - submittedCount} not submitted</span>
                                </div>
                              </div>
                            </div>

                            {/* Expanded Assignment Details */}
                            {expandedStudentId === student.id && (
                              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                                <h5 className="text-sm font-semibold text-slate-700 mb-3">Assignment Status</h5>
                                {assignmentStatuses.map(({ assignment, status }) => (
                                  <div key={assignment.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                        status === 'approved' ? 'bg-emerald-100' :
                                        status === 'submitted' ? 'bg-sky-100' :
                                        status === 'needs_revision' ? 'bg-amber-100' :
                                        'bg-slate-200'
                                      }`}>
                                        {status === 'approved' && <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                        {status === 'submitted' && <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                        {status === 'needs_revision' && <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                                        {status === 'not_submitted' && <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>}
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-slate-800">{assignment.title}</p>
                                        {assignment.due_date && <p className="text-xs text-slate-500">Due {formatDate(assignment.due_date)}</p>}
                                      </div>
                                    </div>
                                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                      status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                      status === 'submitted' ? 'bg-sky-100 text-sky-700' :
                                      status === 'needs_revision' ? 'bg-amber-100 text-amber-700' :
                                      'bg-slate-200 text-slate-600'
                                    }`}>{formatStatus(status)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Submissions Tab */}
                {teacherTab === 'submissions' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in">
                    {/* Submissions List */}
                    <div className="school-card p-6 space-y-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h2 className="school-section-title text-xl text-slate-900">Submissions</h2>
                          <p className="text-sm text-slate-500 mt-1">Review student work</p>
                        </div>
                        {teacherSubmissions.filter(s => s.status === 'submitted').length > 0 && (
                          <span className="school-pill school-pill-amber">{teacherSubmissions.filter(s => s.status === 'submitted').length} pending</span>
                        )}
                      </div>

                      {teacherSubmissions.length === 0 ? (
                        <div className="school-empty-state">
                          <div className="school-empty-icon">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                          </div>
                          <p className="text-sm font-medium text-slate-600">No submissions yet</p>
                          <p className="text-xs text-slate-400 mt-1">Student submissions will appear here</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[600px] overflow-y-auto">
                          {teacherSubmissions.map(submission => {
                            const assignment = assignments.find(a => a.id === submission.assignment_id);
                            return (
                              <button
                                key={submission.id}
                                onClick={() => setSelectedSubmissionId(submission.id)}
                                className={`school-item-card w-full text-left p-4 ${selectedSubmissionId === submission.id ? 'selected' : ''}`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0">
                                    <span className="text-sm font-semibold text-amber-700">{(submission.student_name || 'S').charAt(0)}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <p className="font-medium text-slate-800">{submission.student_name || 'Student'}</p>
                                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                        submission.status === 'submitted' ? 'bg-amber-100 text-amber-700' :
                                        submission.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                        submission.status === 'needs_revision' ? 'bg-red-100 text-red-700' :
                                        'bg-slate-100 text-slate-600'
                                      }`}>{formatStatus(submission.status)}</span>
                                    </div>
                                    <p className="text-sm text-violet-600 font-medium mt-1">{assignment?.title || 'Unknown Assignment'}</p>
                                    {submission.notes && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{submission.notes}</p>}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Feedback Form */}
                    <div className="school-card p-6 space-y-5">
                      <div>
                        <h3 className="school-section-title text-xl text-slate-900">Give Feedback</h3>
                        <p className="text-sm text-slate-500 mt-1">
                          {selectedSubmissionId
                            ? `Providing feedback for ${teacherSubmissions.find(s => s.id === selectedSubmissionId)?.student_name || 'student'}`
                            : 'Select a submission to give feedback'}
                        </p>
                      </div>

                      {selectedSubmissionId ? (
                        <>
                          {/* Show submission details */}
                          {(() => {
                            const submission = teacherSubmissions.find(s => s.id === selectedSubmissionId);
                            const assignment = assignments.find(a => a.id === submission?.assignment_id);
                            return submission && (
                              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
                                <p className="text-sm font-semibold text-slate-800">{assignment?.title}</p>
                                {assignment?.description && <p className="text-xs text-slate-600 mt-1">{assignment.description}</p>}
                                {submission.notes && (
                                  <div className="mt-3 pt-3 border-t border-slate-200">
                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Student Notes</p>
                                    <p className="text-sm text-slate-700 mt-1">{submission.notes}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          <div className="space-y-4">
                            <div>
                              <label className="school-label">Your Feedback</label>
                              <textarea
                                className="school-input min-h-[120px] resize-none"
                                placeholder="Write your feedback here..."
                                value={feedbackText}
                                onChange={(event) => setFeedbackText(event.target.value)}
                              />
                            </div>
                            <div>
                              <label className="school-label">Rating</label>
                              <select
                                className="school-input"
                                value={feedbackRating}
                                onChange={(event) => setFeedbackRating(event.target.value)}
                              >
                                <option value="">Select rating...</option>
                                <option value="excellent">Excellent</option>
                                <option value="very_good">Very Good</option>
                                <option value="good">Good</option>
                                <option value="needs_improvement">Needs Improvement</option>
                              </select>
                            </div>
                            <div>
                              <label className="school-label">Update Status</label>
                              <select
                                className="school-input"
                                value={feedbackStatus}
                                onChange={(event) => setFeedbackStatus(event.target.value)}
                              >
                                <option value="">Keep current status</option>
                                <option value="approved">Approved</option>
                                <option value="needs_revision">Needs Revision</option>
                              </select>
                            </div>
                            <button onClick={handleSendFeedback} className="school-btn school-btn-primary w-full">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                              Send Feedback
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="school-empty-state">
                          <div className="school-empty-icon">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                          </div>
                          <p className="text-sm font-medium text-slate-600">Select a submission</p>
                          <p className="text-xs text-slate-400 mt-1">Click on a submission from the list to provide feedback</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
          {(isParent || isChild) && (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
              {/* Left Sidebar - Child Selector & Stats */}
              <div className="lg:col-span-3 space-y-6">
                <div className="school-card p-6 animate-in animate-in-1">
                  {isParent && (
                    <div className="mb-6">
                      <label className="school-label">Select Child</label>
                      <select
                        className="school-input text-lg font-medium"
                        value={selectedStudentId ?? ''}
                        onChange={(event) => setSelectedStudentId(Number(event.target.value))}
                      >
                        {children.map(child => (
                          <option key={child.id} value={child.id}>{child.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Progress Summary */}
                  <div className="text-center mb-6">
                    <div className="text-4xl font-bold text-violet-600">{studentStats.submitted}/{studentStats.totalAssignments}</div>
                    <div className="text-sm text-slate-500 mt-1">Tasks Completed</div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full flex">
                        <div className="bg-emerald-500 transition-all" style={{ width: `${(studentStats.approved / Math.max(studentStats.totalAssignments, 1)) * 100}%` }}></div>
                        <div className="bg-sky-500 transition-all" style={{ width: `${((studentStats.submitted - studentStats.approved - studentStats.needsRevision) / Math.max(studentStats.totalAssignments, 1)) * 100}%` }}></div>
                        <div className="bg-amber-500 transition-all" style={{ width: `${(studentStats.needsRevision / Math.max(studentStats.totalAssignments, 1)) * 100}%` }}></div>
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                      <span className="text-slate-600">{studentStats.approved} Approved</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-sky-500"></span>
                      <span className="text-slate-600">{studentStats.submitted - studentStats.approved - studentStats.needsRevision} Pending</span>
                    </div>
                    {studentStats.needsRevision > 0 && (
                      <div className="flex items-center gap-2 col-span-2">
                        <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                        <span className="text-amber-700 font-medium">{studentStats.needsRevision} Needs Revision</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Enroll in New Classes */}
                {isParent && availableClasses.length > 0 && (
                  <div className="school-card p-6 animate-in animate-in-2">
                    <h3 className="font-semibold text-slate-800 mb-4">Available Classes</h3>
                    <div className="space-y-3">
                      {availableClasses.map(cls => (
                        <div key={cls.id} className="flex items-center justify-between">
                          <span className="text-sm text-slate-700">{cls.name}</span>
                          <button
                            className="text-sm text-violet-600 hover:text-violet-700 font-medium"
                            onClick={() => selectedStudentId && handleEnrollStudent(selectedStudentId, cls.id)}
                          >
                            Enroll
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Main Content - Assignments */}
              <div className="lg:col-span-9 space-y-8 animate-in animate-in-2">
                {assignmentsByClass.length === 0 ? (
                  <div className="school-card p-12 text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    </div>
                    <p className="text-lg font-medium text-slate-600">No assignments yet</p>
                    <p className="text-sm text-slate-400 mt-1">Once teachers publish work, it will appear here</p>
                  </div>
                ) : (
                  assignmentsByClass.map(({ classInfo, assignments: classAssignments }) => {
                    const classSubmitted = classAssignments.filter(a => a.submission_status).length;

                    return (
                      <div key={classInfo.id}>
                        {/* Class Header - Clean, not boxed */}
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                            </div>
                            <div>
                              <h2 className="text-xl font-bold text-slate-800">{classInfo.name}</h2>
                              <p className="text-sm text-slate-500">{classSubmitted} of {classAssignments.length} completed</p>
                            </div>
                          </div>
                        </div>

                        {/* Assignments - Single card per assignment, clean layout */}
                        <div className="space-y-4">
                          {classAssignments.map(assignment => {
                            const submission = submissionsByAssignment.get(assignment.id);
                            const assignmentFeedback = getFeedbackForAssignment(assignment.id);
                            const overdueStatus = !submission?.status && isOverdue(assignment.due_date);
                            const needsRevision = submission?.status === 'needs_revision';
                            const isApproved = submission?.status === 'approved';

                            return (
                              <div
                                key={assignment.id}
                                className={`school-card p-6 ${needsRevision ? 'ring-2 ring-amber-300 bg-amber-50/30' : ''} ${overdueStatus ? 'ring-2 ring-red-300 bg-red-50/30' : ''} ${isApproved ? 'bg-emerald-50/30' : ''}`}
                              >
                                {/* Assignment Title Row */}
                                <div className="flex items-start justify-between gap-4 mb-4">
                                  <div>
                                    <h3 className="text-lg font-semibold text-slate-800">{assignment.title}</h3>
                                    <div className="flex items-center gap-3 mt-2 text-sm">
                                      <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600">{assignmentTypes.find(t => t.value === assignment.type)?.label || assignment.type}</span>
                                      {assignment.due_date && (
                                        <span className={overdueStatus ? 'text-red-600 font-medium' : 'text-slate-500'}>
                                          {overdueStatus ? 'Overdue' : `Due ${formatDate(assignment.due_date)}`}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className={`px-4 py-2 rounded-xl font-medium text-sm ${
                                    isApproved ? 'bg-emerald-100 text-emerald-700' :
                                    needsRevision ? 'bg-amber-100 text-amber-700' :
                                    submission?.status === 'submitted' ? 'bg-sky-100 text-sky-700' :
                                    'bg-slate-100 text-slate-600'
                                  }`}>
                                    {isApproved ? 'Approved' : needsRevision ? 'Needs Revision' : submission?.status === 'submitted' ? 'Submitted' : 'Not Started'}
                                  </div>
                                </div>

                                {assignment.description && (
                                  <p className="text-slate-600 mb-4">{assignment.description}</p>
                                )}

                                {/* Feedback - if any */}
                                {assignmentFeedback.length > 0 && (
                                  <div className="mb-4 p-4 rounded-xl bg-emerald-50 border-l-4 border-emerald-500">
                                    <p className="text-sm font-semibold text-emerald-800 mb-1">Teacher Feedback</p>
                                    {assignmentFeedback.map(fb => (
                                      <p key={fb.id} className="text-sm text-slate-700">{fb.comment}</p>
                                    ))}
                                  </div>
                                )}

                                {/* Submission Area - Simple and clean */}
                                {!isApproved && (
                                  <div className="pt-4 border-t border-slate-100">
                                    <div className="flex gap-4 items-end">
                                      <div className="flex-1">
                                        <textarea
                                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none resize-none text-sm"
                                          placeholder="Add notes for your teacher..."
                                          rows={2}
                                          value={submissionNotes[assignment.id] || ''}
                                          onChange={(event) =>
                                            setSubmissionNotes(prev => ({ ...prev, [assignment.id]: event.target.value }))
                                          }
                                        />
                                      </div>
                                      <button
                                        onClick={() => handleSubmitAssignment(assignment.id)}
                                        className={`px-6 py-3 rounded-xl font-medium text-white transition-all ${
                                          needsRevision
                                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                                            : 'bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600'
                                        }`}
                                      >
                                        {needsRevision ? 'Resubmit' : (submission?.status ? 'Update' : 'Submit')}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}

          {isAdmin && (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
              {/* Admin Sidebar - Stats */}
              <div className="lg:col-span-3 space-y-6">
                <div className="school-card p-6 space-y-5 animate-in animate-in-1">
                  <div>
                    <h3 className="school-section-title text-lg text-slate-900">School Overview</h3>
                    <p className="text-sm text-slate-500 mt-1">System statistics</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </div>
                        <span className="text-sm font-medium text-slate-700">Classes</span>
                      </div>
                      <span className="text-2xl font-bold text-violet-700">{classes.length}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-sky-50 to-cyan-50 border border-sky-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                        <span className="text-sm font-medium text-slate-700">Teachers</span>
                      </div>
                      <span className="text-2xl font-bold text-sky-700">{teachers.length}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>
                        </div>
                        <span className="text-sm font-medium text-slate-700">Students</span>
                      </div>
                      <span className="text-2xl font-bold text-emerald-700">{children.length}</span>
                    </div>
                  </div>
                </div>

                {/* Teacher List */}
                <div className="school-card p-6 space-y-4 animate-in animate-in-2">
                  <div>
                    <h3 className="school-section-title text-base text-slate-900">Teachers</h3>
                    <p className="text-sm text-slate-500 mt-1">Active teaching staff</p>
                  </div>
                  <div className="space-y-2">
                    {teachers.map(teacher => (
                      <div key={teacher.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-100 to-cyan-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-sky-700">{teacher.name?.charAt(0) || '?'}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-800 text-sm truncate">{teacher.name}</div>
                        </div>
                      </div>
                    ))}
                    {teachers.length === 0 && (
                      <p className="text-sm text-slate-500 text-center py-4">No teachers registered</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Main Content - Classes with Details */}
              <div className="lg:col-span-9 school-card p-6 space-y-5 animate-in animate-in-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="school-section-title text-xl text-slate-900">All Classes</h3>
                    <p className="text-sm text-slate-500 mt-1">View class details and assignments</p>
                  </div>
                  <span className="school-pill school-pill-violet">{classes.length} total</span>
                </div>
                {classes.length === 0 ? (
                  <div className="school-empty-state">
                    <div className="school-empty-icon">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    </div>
                    <p className="text-sm font-medium text-slate-600">No classes created yet</p>
                    <p className="text-xs text-slate-400 mt-1">Teachers can create classes from their dashboard</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {classes.map(cls => (
                      <div key={cls.id} className="school-item-card p-5">
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-7 h-7 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h4 className="font-semibold text-slate-800 text-lg">{cls.name}</h4>
                                {cls.description && <p className="text-sm text-slate-600 mt-1">{cls.description}</p>}
                              </div>
                              <span className="school-pill school-pill-slate">Ages {cls.age_min ?? '-'} - {cls.age_max ?? '-'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
