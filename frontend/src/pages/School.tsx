
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
  const [submissionFiles, setSubmissionFiles] = useState<Record<number, File | null>>({});
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('');

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
      const response = await schoolAPI.createSubmission({
        assignment_id: assignmentId,
        student_id: isParent ? selectedStudentId || undefined : undefined,
        notes
      });

      const file = submissionFiles[assignmentId];
      if (file) {
        await schoolAPI.uploadSubmissionAttachment(
          response.data.id,
          file,
          isParent ? selectedStudentId || undefined : undefined
        );
      }

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

  const studentStats = useMemo(() => {
    const totalAssignments = assignments.length;
    const submitted = assignments.filter(item => item.submission_status).length;
    const approved = assignments.filter(item => item.submission_status === 'approved').length;
    const needsRevision = assignments.filter(item => item.submission_status === 'needs_revision').length;
    return { totalAssignments, submitted, approved, needsRevision };
  }, [assignments]);

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
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Sora:wght@400;500;600;700&display=swap');

        .school-shell {
          --ink: #0f172a;
          --muted: #475569;
          --accent: #0f766e;
          --accent-2: #f59e0b;
          --accent-3: #0284c7;
          --surface: rgba(255, 255, 255, 0.9);
          font-family: 'Sora', 'Segoe UI', sans-serif;
          color: var(--ink);
        }

        .school-bg {
          min-height: calc(100vh - 120px);
          padding: 28px;
          background-image:
            radial-gradient(circle at top left, rgba(14, 116, 144, 0.14), transparent 50%),
            radial-gradient(circle at 20% 80%, rgba(245, 158, 11, 0.18), transparent 40%),
            linear-gradient(135deg, #f8fafc 0%, #eef2f7 45%, #fef3c7 100%);
        }

        .school-card {
          background: var(--surface);
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 24px;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
        }

        .school-hero {
          background: linear-gradient(120deg, rgba(15, 118, 110, 0.18), rgba(2, 132, 199, 0.16));
          border: 1px solid rgba(15, 118, 110, 0.25);
        }

        .school-title {
          font-family: 'Fraunces', 'Times New Roman', serif;
          letter-spacing: -0.5px;
        }

        .school-kicker {
          text-transform: uppercase;
          letter-spacing: 0.2em;
          font-size: 11px;
          color: rgba(15, 118, 110, 0.8);
        }

        .school-input {
          width: 100%;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.5);
          padding: 10px 12px;
          background: #fff;
          font-size: 14px;
          color: var(--ink);
        }

        .school-input:focus {
          outline: none;
          border-color: rgba(15, 118, 110, 0.6);
          box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
        }

        .school-btn {
          border-radius: 14px;
          padding: 10px 16px;
          font-weight: 600;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .school-btn-primary {
          background: linear-gradient(135deg, #0f766e, #0ea5e9);
          color: #fff;
          box-shadow: 0 12px 24px rgba(2, 132, 199, 0.25);
        }

        .school-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 32px rgba(2, 132, 199, 0.3);
        }

        .school-btn-ghost {
          background: rgba(148, 163, 184, 0.15);
          color: var(--ink);
        }

        .school-pill {
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 600;
        }
      `}</style>

      <div className="school-bg">
        <div className="max-w-7xl mx-auto space-y-8">
          <section className="school-card school-hero p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="school-kicker">Church Education</div>
                <h1 className="school-title text-3xl md:text-4xl text-slate-900 mt-2">Church School Studio</h1>
                <p className="text-sm text-slate-600 mt-2 max-w-2xl">
                  {isTeacher && 'Create classes, publish assignments, and review submissions with a modern workflow.'}
                  {isParent && 'Enroll your children, track progress, and stay on top of teacher feedback.'}
                  {isChild && 'View your assignments, submit your work, and follow teacher feedback.'}
                  {isAdmin && 'Oversee the school system, view class activity, and manage access in one place.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {isTeacher && (
                  <div className="flex items-center gap-3">
                    <span className="school-pill bg-white text-emerald-700">{teacherStats.totalStudents} Students</span>
                    <span className="school-pill bg-white text-sky-700">{teacherStats.totalAssignments} Assignments</span>
                    <span className="school-pill bg-white text-amber-700">{teacherStats.needsReview} Needs review</span>
                  </div>
                )}
                {(isParent || isChild) && (
                  <div className="flex items-center gap-3">
                    <span className="school-pill bg-white text-emerald-700">{studentStats.submitted}/{studentStats.totalAssignments} Submitted</span>
                    <span className="school-pill bg-white text-amber-700">{studentStats.needsRevision} Revisions</span>
                  </div>
                )}
                {isAdmin && (
                  <div className="flex items-center gap-3">
                    <span className="school-pill bg-white text-slate-700">{classes.length} Classes</span>
                    <span className="school-pill bg-white text-slate-700">{teachers.length} Teachers</span>
                    <span className="school-pill bg-white text-slate-700">{children.length} Students</span>
                  </div>
                )}
              </div>
            </div>
          </section>
          {isTeacher && (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-3 space-y-6">
                <div className="school-card p-5 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">My Classes</h2>
                    <p className="text-xs text-slate-500">Select a class to manage.</p>
                  </div>
                  <div className="space-y-2">
                    {classes.map(cls => (
                      <button
                        key={cls.id}
                        onClick={() => setSelectedClassId(cls.id)}
                        className={`w-full text-left px-4 py-3 rounded-2xl border transition ${
                          selectedClassId === cls.id
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 hover:border-emerald-200 text-slate-700'
                        }`}
                      >
                        <div className="font-semibold">{cls.name}</div>
                        {cls.description && <div className="text-xs text-slate-500 mt-1">{cls.description}</div>}
                      </button>
                    ))}
                    {classes.length === 0 && (
                      <div className="text-sm text-slate-500">No classes yet. Create one below.</div>
                    )}
                  </div>
                </div>

                <div className="school-card p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700">Create a new class</h3>
                  <input
                    className="school-input"
                    placeholder="Class name"
                    value={classForm.name}
                    onChange={(event) => setClassForm(prev => ({ ...prev, name: event.target.value }))}
                  />
                  <textarea
                    className="school-input min-h-[80px]"
                    placeholder="Short description"
                    value={classForm.description}
                    onChange={(event) => setClassForm(prev => ({ ...prev, description: event.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className="school-input"
                      placeholder="Min age"
                      value={classForm.age_min}
                      onChange={(event) => setClassForm(prev => ({ ...prev, age_min: event.target.value }))}
                    />
                    <input
                      className="school-input"
                      placeholder="Max age"
                      value={classForm.age_max}
                      onChange={(event) => setClassForm(prev => ({ ...prev, age_max: event.target.value }))}
                    />
                  </div>
                  <button className="school-btn school-btn-primary w-full" onClick={handleCreateClass}>
                    Create class
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6 space-y-6">
                <div className="school-card p-6 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Assignments</h2>
                      <p className="text-xs text-slate-500">Track and publish work for {selectedClass?.name || 'your class'}.</p>
                    </div>
                    <span className="school-pill bg-emerald-50 text-emerald-700">{assignments.length} total</span>
                  </div>

                  {assignments.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                      No assignments yet. Publish the first one below.
                    </div>
                  )}

                  <div className="space-y-3">
                    {assignments.map(assignment => (
                      <div key={assignment.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-800">{assignment.title}</div>
                            <div className="text-xs text-slate-500 mt-1">
                              {assignmentTypes.find(type => type.value === assignment.type)?.label || assignment.type}
                              {assignment.due_date && ` • Due ${formatDate(assignment.due_date)}`}
                            </div>
                          </div>
                          <span className="school-pill bg-slate-100 text-slate-600">{assignment.type.toUpperCase()}</span>
                        </div>
                        {assignment.description && (
                          <p className="text-sm text-slate-600 mt-3">{assignment.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="school-card p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900">Assignment Studio</h3>
                  <div className="grid gap-3">
                    <input
                      className="school-input"
                      placeholder="Assignment title"
                      value={assignmentForm.title}
                      onChange={(event) => setAssignmentForm(prev => ({ ...prev, title: event.target.value }))}
                    />
                    <textarea
                      className="school-input min-h-[120px]"
                      placeholder="Instructions and details"
                      value={assignmentForm.description}
                      onChange={(event) => setAssignmentForm(prev => ({ ...prev, description: event.target.value }))}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Type</label>
                        <select
                          className="school-input"
                          value={assignmentForm.type}
                          onChange={(event) => setAssignmentForm(prev => ({
                            ...prev,
                            type: event.target.value as AssignmentFormState['type']
                          }))}
                        >
                          {assignmentTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Due date</label>
                        <input
                          type="date"
                          className="school-input"
                          value={assignmentForm.due_date}
                          onChange={(event) => setAssignmentForm(prev => ({ ...prev, due_date: event.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Video link</label>
                        <input
                          className="school-input"
                          placeholder="Optional YouTube link"
                          value={assignmentForm.youtube_link}
                          onChange={(event) => setAssignmentForm(prev => ({ ...prev, youtube_link: event.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Attachment</label>
                      <input
                        type="file"
                        className="school-input"
                        onChange={(event) => setAssignmentFile(event.target.files?.[0] || null)}
                      />
                    </div>
                    <button onClick={handleCreateAssignment} className="school-btn school-btn-primary w-full">
                      Publish assignment
                    </button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3 space-y-6">
                <div className="school-card p-5 space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900">Class Roster</h3>
                  <div className="space-y-2">
                    {classStudents.map(student => (
                      <div key={student.id} className="rounded-2xl border border-slate-200 p-3">
                        <div className="font-semibold text-slate-800">{student.name}</div>
                        <div className="text-xs text-slate-500">Age {student.age ?? 'N/A'}</div>
                      </div>
                    ))}
                    {classStudents.length === 0 && (
                      <div className="text-sm text-slate-500">No students enrolled yet.</div>
                    )}
                  </div>
                </div>

                <div className="school-card p-5 space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900">Submissions Inbox</h3>
                  <div className="space-y-2">
                    {teacherSubmissions.map(submission => (
                      <button
                        key={submission.id}
                        onClick={() => setSelectedSubmissionId(submission.id)}
                        className={`w-full text-left rounded-2xl border p-3 transition ${
                          selectedSubmissionId === submission.id
                            ? 'border-amber-400 bg-amber-50'
                            : 'border-slate-200 hover:border-amber-200'
                        }`}
                      >
                        <div className="font-semibold text-slate-800">{submission.student_name || 'Student'}</div>
                        <div className="text-xs text-slate-500">{submission.notes || 'No notes provided'}</div>
                        <div className="text-xs text-amber-700 mt-2">{formatStatus(submission.status)}</div>
                      </button>
                    ))}
                    {teacherSubmissions.length === 0 && (
                      <div className="text-sm text-slate-500">No submissions yet.</div>
                    )}
                  </div>
                </div>

                <div className="school-card p-5 space-y-3">
                  <h3 className="text-lg font-semibold text-slate-900">Feedback Desk</h3>
                  <p className="text-xs text-slate-500">Select a submission and share feedback.</p>
                  <textarea
                    className="school-input min-h-[110px]"
                    placeholder="Feedback comment"
                    value={feedbackText}
                    onChange={(event) => setFeedbackText(event.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="school-input"
                      value={feedbackRating}
                      onChange={(event) => setFeedbackRating(event.target.value)}
                    >
                      <option value="">Rating</option>
                      <option value="excellent">Excellent</option>
                      <option value="very_good">Very good</option>
                      <option value="good">Good</option>
                      <option value="needs_improvement">Needs improvement</option>
                    </select>
                    <select
                      className="school-input"
                      value={feedbackStatus}
                      onChange={(event) => setFeedbackStatus(event.target.value)}
                    >
                      <option value="">Status</option>
                      <option value="approved">Approved</option>
                      <option value="needs_revision">Needs revision</option>
                    </select>
                  </div>
                  <button onClick={handleSendFeedback} className="school-btn school-btn-primary w-full">
                    Send feedback
                  </button>
                </div>
              </div>
            </section>
          )}
          {(isParent || isChild) && (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 space-y-6">
                <div className="school-card p-5 space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900">{isParent ? 'Your Kids' : 'Your Profile'}</h3>
                  {isParent && (
                    <select
                      className="school-input"
                      value={selectedStudentId ?? ''}
                      onChange={(event) => setSelectedStudentId(Number(event.target.value))}
                    >
                      {children.map(child => (
                        <option key={child.id} value={child.id}>{child.name}</option>
                      ))}
                    </select>
                  )}
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">Assignments</div>
                    <div className="text-2xl font-semibold text-slate-800">{studentStats.totalAssignments}</div>
                    <div className="text-xs text-emerald-600 mt-1">{studentStats.submitted} submitted</div>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-4">
                    <div className="text-xs text-amber-700">Needs revision</div>
                    <div className="text-2xl font-semibold text-amber-800">{studentStats.needsRevision}</div>
                  </div>
                </div>

                {isParent && (
                  <div className="school-card p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Enroll in a class</h3>
                    <p className="text-xs text-slate-500">Pick a class and enroll the selected child.</p>
                    <div className="space-y-3">
                      {availableClasses.map(cls => (
                        <div key={cls.id} className="rounded-2xl border border-slate-200 p-3">
                          <div className="font-semibold text-slate-800">{cls.name}</div>
                          {cls.description && <p className="text-xs text-slate-500 mt-1">{cls.description}</p>}
                          <div className="text-xs text-slate-500 mt-1">Ages {cls.age_min ?? '-'} to {cls.age_max ?? '-'}</div>
                          <button
                            className="school-btn school-btn-ghost w-full mt-3"
                            onClick={() => selectedStudentId && handleEnrollStudent(selectedStudentId, cls.id)}
                            disabled={!selectedStudentId}
                          >
                            Enroll child
                          </button>
                        </div>
                      ))}
                      {availableClasses.length === 0 && (
                        <div className="text-sm text-slate-500">All classes are already enrolled.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-8 space-y-6">
                <div className="school-card p-6 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Assignments & Progress</h3>
                      <p className="text-xs text-slate-500">Submit work and keep up with feedback.</p>
                    </div>
                    <span className="school-pill bg-slate-100 text-slate-600">{enrolledClasses.length} enrolled class(es)</span>
                  </div>

                  {assignments.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                      No assignments yet. Once teachers publish work, it will appear here.
                    </div>
                  )}

                  <div className="space-y-4">
                    {assignments.map(assignment => {
                      const submission = submissionsByAssignment.get(assignment.id);
                      return (
                        <div key={assignment.id} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="font-semibold text-slate-800">{assignment.title}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                {assignment.class_name} • {formatDate(assignment.due_date)}
                              </div>
                            </div>
                            <span className="school-pill bg-slate-100 text-slate-600">{formatStatus(submission?.status)}</span>
                          </div>
                          {assignment.description && (
                            <p className="text-sm text-slate-600 mt-2">{assignment.description}</p>
                          )}
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <textarea
                              className="school-input min-h-[90px]"
                              placeholder="Notes for the teacher"
                              value={submissionNotes[assignment.id] || ''}
                              onChange={(event) =>
                                setSubmissionNotes(prev => ({ ...prev, [assignment.id]: event.target.value }))
                              }
                            />
                            <input
                              type="file"
                              className="school-input"
                              onChange={(event) =>
                                setSubmissionFiles(prev => ({
                                  ...prev,
                                  [assignment.id]: event.target.files?.[0] || null
                                }))
                              }
                            />
                            <button
                              onClick={() => handleSubmitAssignment(assignment.id)}
                              className="school-btn school-btn-primary"
                            >
                              Submit work
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {feedback.length > 0 && (
                  <div className="school-card p-6 space-y-3">
                    <h3 className="text-lg font-semibold text-slate-900">Teacher Feedback</h3>
                    <div className="space-y-2">
                      {feedback.map(item => (
                        <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                          <div className="font-semibold text-slate-800">{item.teacher_name || 'Teacher'}</div>
                          <div className="text-sm text-slate-600 mt-1">{item.comment}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {isAdmin && (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 school-card p-5 space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">System Snapshot</h3>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Classes</div>
                  <div className="text-2xl font-semibold text-slate-800">{classes.length}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Teachers</div>
                  <div className="text-2xl font-semibold text-slate-800">{teachers.length}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Students</div>
                  <div className="text-2xl font-semibold text-slate-800">{children.length}</div>
                </div>
                <p className="text-xs text-slate-500">
                  Use the Admin panel to manage access permissions and feature availability.
                </p>
              </div>

              <div className="lg:col-span-8 school-card p-6 space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">All Classes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {classes.map(cls => (
                    <div key={cls.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="font-semibold text-slate-800">{cls.name}</div>
                      {cls.description && <p className="text-sm text-slate-600 mt-1">{cls.description}</p>}
                      <div className="text-xs text-slate-500 mt-2">Ages {cls.age_min ?? '-'} to {cls.age_max ?? '-'}</div>
                    </div>
                  ))}
                  {classes.length === 0 && (
                    <div className="text-sm text-slate-500">No classes created yet.</div>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
