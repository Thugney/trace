
import { useEffect, useMemo, useState } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useToast } from '../components/Toast';
import { profilesAPI, schoolAPI, regularSchoolAPI } from '../services/api';
import type { Profile, SchoolSubject, SchoolAssignment, SchoolClass, SchoolFeedback, SchoolSubmission, SchoolAttachment, RegularSchoolSubject, RegularSchoolHomework, RegularSchoolStats } from '../types';

type AssignmentFormState = {
  title: string;
  description: string;
  type: 'homework' | 'psalm' | 'alphabet' | 'video' | 'quiz' | 'other';
  youtube_link: string;
  due_date: string;
  subject_id: number | null;
  max_points: number;
};

type ClassFormState = {
  name: string;
  description: string;
  age_min: string;
  age_max: string;
};

type SubmissionWithClass = SchoolSubmission & { class_id?: number };

// Class leaderboards stay off until the church-school organization boundary is
// confirmed and an anonymized/opt-in design exists (docs/familyhub-learn-architecture.md §6).
// The backend does not serve /school/leaderboard.
const SCHOOL_LEADERBOARD_ENABLED = false;

const emptyAssignmentForm: AssignmentFormState = {
  title: '',
  description: '',
  type: 'homework',
  youtube_link: '',
  due_date: '',
  subject_id: null,
  max_points: 10
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
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [gradePoints, setGradePoints] = useState<number>(0);
  const [teacherTab, setTeacherTab] = useState<'assignments' | 'students' | 'submissions' | 'leaderboard'>('assignments');
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [expandedStudentId, setExpandedStudentId] = useState<number | null>(null);
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<number | null>(null);
  const [assignmentAttachments, setAssignmentAttachments] = useState<Record<number, SchoolAttachment[]>>({});
  const [loadingAttachments, setLoadingAttachments] = useState<Record<number, boolean>>({});

  // Church School subjects
  const [classSubjects, setClassSubjects] = useState<SchoolSubject[]>([]);
  const [showCreateChurchSubject, setShowCreateChurchSubject] = useState(false);
  const [churchSubjectForm, setChurchSubjectForm] = useState({ name: '', icon: '📚', color: 'indigo' });

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<{
    rank: number;
    student_id: number;
    student_name: string;
    student_avatar?: string;
    total_points: number;
    assignments_graded: number;
    assignments_submitted: number;
    total_assignments: number;
    avg_score_percent: number;
    current_level: number;
    all_time_points: number;
  }[]>([]);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'all' | 'month' | 'week'>('all');
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // School type toggle (church vs regular)
  const [schoolMode, setSchoolMode] = useState<'church' | 'regular'>('church');

  // Regular School state
  const [regularSubjects, setRegularSubjects] = useState<RegularSchoolSubject[]>([]);
  const [regularHomework, setRegularHomework] = useState<RegularSchoolHomework[]>([]);
  const [regularStats, setRegularStats] = useState<RegularSchoolStats | null>(null);
  const [showCreateSubject, setShowCreateSubject] = useState(false);
  const [showCreateHomework, setShowCreateHomework] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [subjectForm, setSubjectForm] = useState({ name: '', icon: '📚', color: 'indigo' });
  const [homeworkForm, setHomeworkForm] = useState({ title: '', description: '', due_date: '', points: '10' });

  // Feature access
  const [myFeatures, setMyFeatures] = useState<Record<string, boolean>>({});

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

        // Load feature access
        try {
          const featuresRes = await profilesAPI.getMyFeatures();
          setMyFeatures(featuresRes.data.features);
        } catch (e) {
          console.error('Failed to load features:', e);
        }

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
        const [assignmentsRes, studentsRes, submissionsRes, subjectsRes] = await Promise.all([
          schoolAPI.getAssignments({ class_id: selectedClassId }),
          schoolAPI.getClassStudents(selectedClassId),
          schoolAPI.getSubmissions(),
          schoolAPI.getClassSubjects(selectedClassId)
        ]);
        setAssignments(assignmentsRes.data);
        setClassStudents(studentsRes.data);
        setSubmissions(submissionsRes.data as SubmissionWithClass[]);
        setClassSubjects(subjectsRes.data);
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

        // Load leaderboard for the first enrolled class
        if (SCHOOL_LEADERBOARD_ENABLED && enrollmentsRes.data.length > 0 && !selectedClassId) {
          const firstClass = enrollmentsRes.data[0];
          setSelectedClassId(firstClass.id);
          try {
            const leaderboardRes = await schoolAPI.getLeaderboard(firstClass.id, leaderboardPeriod);
            setLeaderboard(leaderboardRes.data.leaderboard);
          } catch (e) {
            console.error('Failed to load leaderboard:', e);
          }
        }
      } catch (error) {
        console.error('Failed to load student data:', error);
        if (showError) showToast('Failed to load assignments', 'error');
      }
    };
    loadStudentData();
    const interval = setInterval(() => loadStudentData(false), 15000);
    return () => clearInterval(interval);
  }, [selectedStudentId, isParent, isChild, showToast]);

  // Load regular school data when in regular mode
  useEffect(() => {
    if (schoolMode !== 'regular' || !selectedStudentId || !(isParent || isChild)) return;
    const loadRegularSchoolData = async () => {
      try {
        const [subjectsRes, homeworkRes, statsRes] = await Promise.all([
          regularSchoolAPI.getSubjects(selectedStudentId),
          regularSchoolAPI.getHomework({ student_id: selectedStudentId }),
          regularSchoolAPI.getStats(selectedStudentId)
        ]);
        setRegularSubjects(subjectsRes.data);
        setRegularHomework(homeworkRes.data);
        setRegularStats(statsRes.data);
      } catch (error) {
        console.error('Failed to load regular school data:', error);
      }
    };
    loadRegularSchoolData();
  }, [schoolMode, selectedStudentId, isParent, isChild]);

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

  const handleUnenrollStudent = async (studentId: number, classId: number, className: string) => {
    if (!confirm(`Remove from "${className}"? This will keep their progress but they won't see new assignments.`)) {
      return;
    }
    try {
      await schoolAPI.unenrollStudent(studentId, classId);
      const enrollmentsRes = await schoolAPI.getClasses({ student_id: studentId });
      setEnrolledClasses(enrollmentsRes.data);
      showToast('Unenrolled from class', 'success');
    } catch (error) {
      console.error('Failed to unenroll student:', error);
      showToast('Failed to unenroll', 'error');
    }
  };

  // Church School subject handlers
  const handleCreateChurchSubject = async () => {
    if (!selectedClassId || !churchSubjectForm.name.trim()) {
      showToast('Subject name is required', 'error');
      return;
    }
    try {
      await schoolAPI.createSubject(selectedClassId, {
        name: churchSubjectForm.name.trim(),
        icon: churchSubjectForm.icon,
        color: churchSubjectForm.color
      });
      const subjectsRes = await schoolAPI.getClassSubjects(selectedClassId);
      setClassSubjects(subjectsRes.data);
      setChurchSubjectForm({ name: '', icon: '📚', color: 'indigo' });
      setShowCreateChurchSubject(false);
      showToast('Subject created', 'success');
    } catch (error) {
      console.error('Failed to create church subject:', error);
      showToast('Failed to create subject', 'error');
    }
  };

  const handleSeedDefaultSubjects = async () => {
    if (!selectedClassId) return;
    try {
      await schoolAPI.seedDefaultSubjects(selectedClassId);
      const subjectsRes = await schoolAPI.getClassSubjects(selectedClassId);
      setClassSubjects(subjectsRes.data);
      showToast('Default subjects added', 'success');
    } catch (error) {
      console.error('Failed to seed subjects:', error);
      showToast('Failed to add default subjects', 'error');
    }
  };

  const handleDeleteChurchSubject = async (subjectId: number, subjectName: string) => {
    if (!confirm(`Delete "${subjectName}"? Assignments will keep their data but won't be linked to this subject.`)) {
      return;
    }
    try {
      await schoolAPI.deleteSubject(subjectId);
      if (selectedClassId) {
        const subjectsRes = await schoolAPI.getClassSubjects(selectedClassId);
        setClassSubjects(subjectsRes.data);
      }
      showToast('Subject deleted', 'success');
    } catch (error) {
      console.error('Failed to delete church subject:', error);
      showToast('Failed to delete subject', 'error');
    }
  };

  // Regular School handlers
  const handleCreateSubject = async () => {
    if (!selectedStudentId || !subjectForm.name.trim()) {
      showToast('Subject name is required', 'error');
      return;
    }
    try {
      await regularSchoolAPI.createSubject({
        student_id: selectedStudentId,
        name: subjectForm.name.trim(),
        icon: subjectForm.icon,
        color: subjectForm.color
      });
      const [subjectsRes, statsRes] = await Promise.all([
        regularSchoolAPI.getSubjects(selectedStudentId),
        regularSchoolAPI.getStats(selectedStudentId)
      ]);
      setRegularSubjects(subjectsRes.data);
      setRegularStats(statsRes.data);
      setSubjectForm({ name: '', icon: '📚', color: 'indigo' });
      setShowCreateSubject(false);
      showToast('Subject created', 'success');
    } catch (error) {
      console.error('Failed to create subject:', error);
      showToast('Failed to create subject', 'error');
    }
  };

  const handleDeleteSubject = async (subjectId: number, subjectName: string) => {
    if (!confirm(`Delete "${subjectName}"? This will also delete all homework for this subject.`)) {
      return;
    }
    try {
      await regularSchoolAPI.deleteSubject(subjectId);
      if (selectedStudentId) {
        const [subjectsRes, homeworkRes, statsRes] = await Promise.all([
          regularSchoolAPI.getSubjects(selectedStudentId),
          regularSchoolAPI.getHomework({ student_id: selectedStudentId }),
          regularSchoolAPI.getStats(selectedStudentId)
        ]);
        setRegularSubjects(subjectsRes.data);
        setRegularHomework(homeworkRes.data);
        setRegularStats(statsRes.data);
      }
      showToast('Subject deleted', 'success');
    } catch (error) {
      console.error('Failed to delete subject:', error);
      showToast('Failed to delete subject', 'error');
    }
  };

  const handleCreateHomework = async () => {
    if (!selectedStudentId || !selectedSubjectId || !homeworkForm.title.trim()) {
      showToast('Title and subject are required', 'error');
      return;
    }
    try {
      await regularSchoolAPI.createHomework({
        subject_id: selectedSubjectId,
        student_id: selectedStudentId,
        title: homeworkForm.title.trim(),
        description: homeworkForm.description.trim() || undefined,
        due_date: homeworkForm.due_date || undefined,
        points: parseInt(homeworkForm.points) || 10
      });
      const [homeworkRes, statsRes] = await Promise.all([
        regularSchoolAPI.getHomework({ student_id: selectedStudentId }),
        regularSchoolAPI.getStats(selectedStudentId)
      ]);
      setRegularHomework(homeworkRes.data);
      setRegularStats(statsRes.data);
      setHomeworkForm({ title: '', description: '', due_date: '', points: '10' });
      setShowCreateHomework(false);
      showToast('Homework added', 'success');
    } catch (error) {
      console.error('Failed to create homework:', error);
      showToast('Failed to add homework', 'error');
    }
  };

  const handleCompleteHomework = async (homeworkId: number) => {
    try {
      const result = await regularSchoolAPI.completeHomework(homeworkId);
      if (selectedStudentId) {
        const [homeworkRes, statsRes] = await Promise.all([
          regularSchoolAPI.getHomework({ student_id: selectedStudentId }),
          regularSchoolAPI.getStats(selectedStudentId)
        ]);
        setRegularHomework(homeworkRes.data);
        setRegularStats(statsRes.data);
      }
      showToast(`Completed! +${result.data.points_awarded} points`, 'success');
    } catch (error) {
      console.error('Failed to complete homework:', error);
      showToast('Failed to mark complete', 'error');
    }
  };

  const handleDeleteHomework = async (homeworkId: number) => {
    if (!confirm('Delete this homework?')) return;
    try {
      await regularSchoolAPI.deleteHomework(homeworkId);
      if (selectedStudentId) {
        const [homeworkRes, statsRes] = await Promise.all([
          regularSchoolAPI.getHomework({ student_id: selectedStudentId }),
          regularSchoolAPI.getStats(selectedStudentId)
        ]);
        setRegularHomework(homeworkRes.data);
        setRegularStats(statsRes.data);
      }
      showToast('Homework deleted', 'success');
    } catch (error) {
      console.error('Failed to delete homework:', error);
      showToast('Failed to delete', 'error');
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
        due_date: assignmentForm.due_date || undefined,
        subject_id: assignmentForm.subject_id || undefined,
        max_points: assignmentForm.max_points || 10
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


  // Grade submission with points
  const handleGradeSubmission = async (submissionId: number, maxPoints: number) => {
    if (gradePoints < 0 || gradePoints > maxPoints) {
      showToast(`Points must be between 0 and ${maxPoints}`, 'error');
      return;
    }

    try {
      const result = await schoolAPI.gradeSubmission(submissionId, {
        points_earned: gradePoints,
        feedback: feedbackText.trim() || undefined,
        status: feedbackStatus || 'approved'
      });

      setFeedbackText('');
      setFeedbackStatus('');
      setGradePoints(0);
      setSelectedSubmissionId(null);

      // Refresh submissions
      const refreshed = await schoolAPI.getSubmissions();
      setSubmissions(refreshed.data as SubmissionWithClass[]);

      // Refresh leaderboard if viewing it
      if (SCHOOL_LEADERBOARD_ENABLED && selectedClassId) {
        loadLeaderboard(selectedClassId);
      }

      showToast(`Graded! Student earned ${result.data.totalPointsAwarded} points (Level ${result.data.studentLevel})`, 'success');
    } catch (error) {
      console.error('Failed to grade submission:', error);
      showToast('Failed to grade submission', 'error');
    }
  };

  // Toggle assignment details and fetch attachments
  const handleToggleAssignment = async (assignmentId: number) => {
    if (expandedAssignmentId === assignmentId) {
      // Collapse
      setExpandedAssignmentId(null);
      return;
    }

    // Expand and fetch attachments if not already loaded
    setExpandedAssignmentId(assignmentId);

    if (!assignmentAttachments[assignmentId] && !loadingAttachments[assignmentId]) {
      setLoadingAttachments(prev => ({ ...prev, [assignmentId]: true }));
      try {
        const studentId = isChild ? currentProfile?.id : selectedStudentId;
        const response = await schoolAPI.getAssignmentAttachments(assignmentId, studentId || undefined);
        setAssignmentAttachments(prev => ({ ...prev, [assignmentId]: response.data }));
      } catch (error) {
        console.error('Failed to load attachments:', error);
      } finally {
        setLoadingAttachments(prev => ({ ...prev, [assignmentId]: false }));
      }
    }
  };

  // Load leaderboard
  const loadLeaderboard = async (classId: number) => {
    try {
      setLoadingLeaderboard(true);
      const response = await schoolAPI.getLeaderboard(classId, leaderboardPeriod);
      setLeaderboard(response.data.leaderboard);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      showToast('Failed to load leaderboard', 'error');
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // Load leaderboard when tab changes or period changes
  useEffect(() => {
    if (SCHOOL_LEADERBOARD_ENABLED && teacherTab === 'leaderboard' && selectedClassId) {
      loadLeaderboard(selectedClassId);
    }
  }, [teacherTab, selectedClassId, leaderboardPeriod]);

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
              <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
                {[
                  { id: 'assignments' as const, label: 'Assignments', icon: '📝' },
                  { id: 'students' as const, label: 'Students', icon: '👥' },
                  { id: 'submissions' as const, label: 'Grade', icon: '✏️' },
                  ...(SCHOOL_LEADERBOARD_ENABLED ? [{ id: 'leaderboard' as const, label: 'Leaderboard', icon: '🏆' }] : [])
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setTeacherTab(tab.id)}
                    className={`px-4 py-1.5 rounded-lg font-medium text-sm transition-all flex items-center gap-1.5 ${
                      teacherTab === tab.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content Container */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-100 p-5 md:p-6">
                {/* Assignments Tab */}
                {teacherTab === 'assignments' && (
                  <div>
                    {/* Subjects Section */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-700">Subjects</h3>
                        <div className="flex gap-2">
                          {classSubjects.length === 0 && (
                            <button
                              onClick={handleSeedDefaultSubjects}
                              className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                            >
                              + Add Language & Religion
                            </button>
                          )}
                          <button
                            onClick={() => setShowCreateChurchSubject(!showCreateChurchSubject)}
                            className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                          >
                            + Custom Subject
                          </button>
                        </div>
                      </div>

                      {showCreateChurchSubject && (
                        <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2">
                          <input
                            className="flex-1 px-2 py-1 text-sm rounded border border-slate-200"
                            placeholder="Subject name"
                            value={churchSubjectForm.name}
                            onChange={(e) => setChurchSubjectForm(prev => ({ ...prev, name: e.target.value }))}
                          />
                          <select
                            className="px-2 py-1 text-sm rounded border border-slate-200 bg-white"
                            value={churchSubjectForm.icon}
                            onChange={(e) => setChurchSubjectForm(prev => ({ ...prev, icon: e.target.value }))}
                          >
                            <option value="📚">📚</option>
                            <option value="🗣️">🗣️</option>
                            <option value="⛪">⛪</option>
                            <option value="✝️">✝️</option>
                            <option value="📖">📖</option>
                            <option value="🎵">🎵</option>
                            <option value="✏️">✏️</option>
                          </select>
                          <button
                            onClick={handleCreateChurchSubject}
                            className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => setShowCreateChurchSubject(false)}
                            className="px-2 py-1 text-sm text-slate-500 hover:text-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {classSubjects.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {classSubjects.map(subj => (
                            <div
                              key={subj.id}
                              className="group flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-sm"
                            >
                              <span>{subj.icon}</span>
                              <span className="font-medium text-slate-700">{subj.name}</span>
                              <span className="text-xs text-slate-400">({subj.assignment_count || 0})</span>
                              <button
                                onClick={() => handleDeleteChurchSubject(subj.id, subj.name)}
                                className="ml-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">No subjects yet. Add Language & Religion to organize assignments.</p>
                      )}
                    </div>

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
                          <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
                          <select
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none bg-white text-sm"
                            value={assignmentForm.subject_id || ''}
                            onChange={(e) => setAssignmentForm(prev => ({ ...prev, subject_id: e.target.value ? Number(e.target.value) : null }))}
                          >
                            <option value="">No subject</option>
                            {classSubjects.map(s => (
                              <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                            ))}
                          </select>
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
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Max Points</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none text-sm"
                            value={assignmentForm.max_points}
                            onChange={(e) => setAssignmentForm(prev => ({ ...prev, max_points: Math.max(1, Math.min(100, parseInt(e.target.value) || 10)) }))}
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

              {/* Submissions Tab - Grading */}
              {teacherTab === 'submissions' && (
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-6">Grade Submissions</h2>
                  {teacherSubmissions.filter(s => !s.graded_at).length === 0 ? (
                    <div className="text-center py-16">
                      <div className="text-5xl mb-4">✅</div>
                      <p className="text-slate-500">All caught up! No submissions to grade.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {teacherSubmissions.filter(s => !s.graded_at).map(submission => {
                        const assignment = assignments.find(a => a.id === submission.assignment_id);
                        const student = classStudents.find(s => s.id === submission.student_id);
                        const maxPoints = assignment?.max_points || 10;
                        const isSelected = selectedSubmissionId === submission.id;

                        return (
                          <div key={submission.id} className={`bg-white p-5 rounded-2xl border transition-all ${isSelected ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-100 hover:border-slate-200'}`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                                  {student?.name?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-900">{student?.name || 'Unknown'}</div>
                                  <div className="text-sm text-slate-500 flex items-center gap-2">
                                    <span>{assignment?.title}</span>
                                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                                      Max: {maxPoints} pts
                                    </span>
                                  </div>
                                  {submission.notes && (
                                    <div className="mt-2 p-3 bg-slate-50 rounded-lg text-sm text-slate-600 italic">
                                      "{submission.notes}"
                                    </div>
                                  )}
                                  <div className="text-xs text-slate-400 mt-1">
                                    Submitted: {new Date(submission.submitted_at).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedSubmissionId(null);
                                    setGradePoints(0);
                                  } else {
                                    setSelectedSubmissionId(submission.id);
                                    setGradePoints(maxPoints); // Default to full points
                                  }
                                }}
                                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                {isSelected ? 'Grading...' : 'Grade'}
                              </button>
                            </div>

                            {/* Grading Form */}
                            {isSelected && (
                              <div className="mt-4 pt-4 border-t border-slate-100">
                                <div className="grid gap-4 md:grid-cols-[1fr,auto,auto,auto]">
                                  {/* Points Input */}
                                  <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                      Points Earned
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        min="0"
                                        max={maxPoints}
                                        className="w-20 px-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-center text-lg font-semibold"
                                        value={gradePoints}
                                        onChange={(e) => setGradePoints(Math.max(0, Math.min(maxPoints, parseInt(e.target.value) || 0)))}
                                      />
                                      <span className="text-slate-500 text-lg">/ {maxPoints}</span>
                                      <div className="flex gap-1 ml-2">
                                        {[0, Math.floor(maxPoints * 0.5), Math.floor(maxPoints * 0.75), maxPoints].map(pts => (
                                          <button
                                            key={pts}
                                            onClick={() => setGradePoints(pts)}
                                            className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                                              gradePoints === pts
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                          >
                                            {pts}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Status */}
                                  <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                    <select
                                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white"
                                      value={feedbackStatus}
                                      onChange={(e) => setFeedbackStatus(e.target.value)}
                                    >
                                      <option value="approved">Approve</option>
                                      <option value="needs_revision">Needs Revision</option>
                                    </select>
                                  </div>

                                  {/* Submit Button */}
                                  <div className="flex items-end">
                                    <button
                                      onClick={() => handleGradeSubmission(submission.id, maxPoints)}
                                      className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
                                    >
                                      <span>✓</span> Submit Grade
                                    </button>
                                  </div>
                                </div>

                                {/* Feedback (optional) */}
                                <div className="mt-3">
                                  <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Feedback (optional)
                                  </label>
                                  <textarea
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none resize-none"
                                    rows={2}
                                    placeholder="Great work! Keep it up..."
                                    value={feedbackText}
                                    onChange={(e) => setFeedbackText(e.target.value)}
                                  />
                                </div>

                                {/* On-time bonus indicator */}
                                {assignment?.due_date && new Date(submission.submitted_at) <= new Date(assignment.due_date) && (
                                  <div className="mt-2 text-sm text-emerald-600 flex items-center gap-1">
                                    <span>⭐</span> On-time bonus: +{Math.round(maxPoints * 0.1)} points will be added automatically!
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Recently Graded Section */}
                  {teacherSubmissions.filter(s => s.graded_at).length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-lg font-semibold text-slate-700 mb-4">Recently Graded</h3>
                      <div className="space-y-2">
                        {teacherSubmissions.filter(s => s.graded_at).slice(0, 5).map(submission => {
                          const assignment = assignments.find(a => a.id === submission.assignment_id);
                          const student = classStudents.find(s => s.id === submission.student_id);
                          const totalPoints = (submission.points_earned || 0) + (submission.on_time_bonus || 0);

                          return (
                            <div key={submission.id} className="bg-slate-50 p-3 rounded-xl flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-medium">
                                  {student?.name?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-slate-700">{student?.name}</div>
                                  <div className="text-xs text-slate-500">{assignment?.title}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-emerald-600">
                                  {submission.points_earned}/{submission.points_possible}
                                  {(submission.on_time_bonus || 0) > 0 && (
                                    <span className="text-xs text-emerald-500 ml-1">+{submission.on_time_bonus}</span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {totalPoints} total pts
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Leaderboard Tab */}
              {teacherTab === 'leaderboard' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-slate-900">Class Leaderboard</h2>
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                      {[
                        { id: 'all' as const, label: 'All Time' },
                        { id: 'month' as const, label: 'This Month' },
                        { id: 'week' as const, label: 'This Week' }
                      ].map(period => (
                        <button
                          key={period.id}
                          onClick={() => setLeaderboardPeriod(period.id)}
                          className={`px-3 py-1 text-sm rounded-md transition-colors ${
                            leaderboardPeriod === period.id
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {period.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {loadingLeaderboard ? (
                    <div className="text-center py-16">
                      <div className="text-4xl mb-4 animate-bounce">🏆</div>
                      <p className="text-slate-500">Loading leaderboard...</p>
                    </div>
                  ) : leaderboard.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="text-5xl mb-4">📊</div>
                      <p className="text-slate-500">No data yet. Grade some submissions to see the leaderboard!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {leaderboard.map((student, index) => {
                        const isTopThree = index < 3;
                        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;

                        return (
                          <div
                            key={student.student_id}
                            className={`p-4 rounded-xl border transition-all ${
                              isTopThree
                                ? index === 0
                                  ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200'
                                  : index === 1
                                  ? 'bg-gradient-to-r from-slate-50 to-gray-50 border-gray-200'
                                  : 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200'
                                : 'bg-white border-slate-100 hover:border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              {/* Rank */}
                              <div className={`w-10 text-center font-bold text-lg ${
                                isTopThree ? 'text-2xl' : 'text-slate-400'
                              }`}>
                                {medal || student.rank}
                              </div>

                              {/* Avatar */}
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                                isTopThree
                                  ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                                  : 'bg-gradient-to-br from-slate-400 to-slate-500'
                              }`}>
                                {student.student_avatar || student.student_name?.charAt(0) || '?'}
                              </div>

                              {/* Name & Stats */}
                              <div className="flex-1">
                                <div className="font-semibold text-slate-900">{student.student_name}</div>
                                <div className="flex items-center gap-3 text-sm text-slate-500">
                                  <span>Level {student.current_level || 1}</span>
                                  <span>•</span>
                                  <span>{student.assignments_graded}/{student.total_assignments} graded</span>
                                  <span>•</span>
                                  <span>{student.avg_score_percent}% avg</span>
                                </div>
                              </div>

                              {/* Points */}
                              <div className="text-right">
                                <div className={`text-2xl font-bold ${
                                  isTopThree ? 'text-indigo-600' : 'text-slate-700'
                                }`}>
                                  {student.total_points}
                                </div>
                                <div className="text-xs text-slate-400">points</div>
                              </div>
                            </div>
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
            <div className="mb-6 flex items-center gap-3 flex-wrap">
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

          {/* School Mode Toggle - only show if user has access to both */}
          {(myFeatures.school !== false || myFeatures.regular_school !== false) && (
            <div className="mb-8 flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit">
              {myFeatures.school !== false && (
                <button
                  onClick={() => setSchoolMode('church')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    schoolMode === 'church'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  ⛪ Church School
                </button>
              )}
              {myFeatures.regular_school !== false && (
                <button
                  onClick={() => setSchoolMode('regular')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    schoolMode === 'regular'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  🏫 Regular School
                </button>
              )}
            </div>
          )}

          {/* Church School View */}
          {schoolMode === 'church' && myFeatures.school !== false && (
            <>
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

          {/* Class Leaderboard for Students */}
          {SCHOOL_LEADERBOARD_ENABLED && enrolledClasses.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <span>🏆</span> Class Leaderboard
                </h2>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                  {[
                    { id: 'all' as const, label: 'All' },
                    { id: 'month' as const, label: 'Month' },
                    { id: 'week' as const, label: 'Week' }
                  ].map(period => (
                    <button
                      key={period.id}
                      onClick={() => setLeaderboardPeriod(period.id)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        leaderboardPeriod === period.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Class Tabs if enrolled in multiple classes */}
              {enrolledClasses.length > 1 && (
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                  {enrolledClasses.map(cls => (
                    <button
                      key={cls.id}
                      onClick={() => {
                        setSelectedClassId(cls.id);
                        loadLeaderboard(cls.id);
                      }}
                      className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                        selectedClassId === cls.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      {cls.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Leaderboard Display */}
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                {loadingLeaderboard ? (
                  <div className="text-center py-12">
                    <div className="text-3xl mb-2 animate-bounce">🏆</div>
                    <p className="text-sm text-slate-500">Loading...</p>
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-3xl mb-2">📊</div>
                    <p className="text-sm text-slate-500">No rankings yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {leaderboard.slice(0, 10).map((student, index) => {
                      // For children: highlight their own entry
                      // For parents: highlight their selected child's entry
                      const targetStudentId = isChild ? currentProfile?.id : selectedStudentId;
                      const isCurrentUser = targetStudentId != null && student.student_id === targetStudentId;
                      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;

                      return (
                        <div
                          key={student.student_id}
                          className={`flex items-center gap-3 p-4 ${
                            isCurrentUser
                              ? 'bg-indigo-50 border-l-4 border-indigo-500'
                              : index < 3 ? 'bg-gradient-to-r from-yellow-50/50 to-transparent' : ''
                          }`}
                        >
                          {/* Rank */}
                          <div className={`w-8 text-center font-bold ${index < 3 ? 'text-xl' : 'text-slate-400'}`}>
                            {medal || student.rank}
                          </div>

                          {/* Avatar */}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                            index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' :
                            index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400' :
                            index === 2 ? 'bg-gradient-to-br from-orange-400 to-amber-600' :
                            'bg-gradient-to-br from-slate-400 to-slate-500'
                          }`}>
                            {student.student_avatar || student.student_name?.charAt(0) || '?'}
                          </div>

                          {/* Name */}
                          <div className="flex-1">
                            <div className={`font-medium ${isCurrentUser ? 'text-indigo-700' : 'text-slate-900'}`}>
                              {student.student_name}
                              {isCurrentUser && <span className="text-xs ml-2 text-indigo-500">{isChild ? '(You)' : '⭐'}</span>}
                            </div>
                            <div className="text-xs text-slate-500">
                              Level {student.current_level || 1} • {student.avg_score_percent}% avg
                            </div>
                          </div>

                          {/* Points */}
                          <div className="text-right">
                            <div className={`text-lg font-bold ${isCurrentUser ? 'text-indigo-600' : 'text-slate-700'}`}>
                              {student.total_points}
                            </div>
                            <div className="text-xs text-slate-400">pts</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

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
                        className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-sm font-medium text-emerald-700 flex items-center gap-1.5 group"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {cls.name}
                        <button
                          onClick={() => selectedStudentId && handleUnenrollStudent(selectedStudentId, cls.id, cls.name)}
                          className="ml-1 w-4 h-4 rounded-full bg-emerald-200 hover:bg-red-400 hover:text-white text-emerald-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                          title="Leave class"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
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

                      const isExpanded = expandedAssignmentId === assignment.id;
                      const attachments = assignmentAttachments[assignment.id] || [];
                      const isLoadingAtt = loadingAttachments[assignment.id];

                      return (
                        <div
                          key={assignment.id}
                          className={`bg-white rounded-2xl border transition-all ${
                            isApproved ? 'border-emerald-200 bg-emerald-50/50' :
                            needsRevision ? 'border-amber-200 bg-amber-50/50' :
                            overdueStatus ? 'border-red-200 bg-red-50/50' :
                            'border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          {/* Clickable Header */}
                          <button
                            onClick={() => handleToggleAssignment(assignment.id)}
                            className="w-full p-5 text-left"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <div className="text-2xl">{typeInfo?.icon || '📋'}</div>
                                <div>
                                  <h3 className="font-semibold text-slate-900">{assignment.title}</h3>
                                  {!isExpanded && assignment.description && (
                                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{assignment.description}</p>
                                  )}
                                  <div className="flex items-center gap-3 mt-2 text-sm">
                                    <span className="text-slate-400">{typeInfo?.label}</span>
                                    {assignment.due_date && (
                                      <span className={overdueStatus ? 'text-red-500 font-medium' : 'text-slate-400'}>
                                        {overdueStatus ? 'Overdue' : `Due ${formatDate(assignment.due_date)}`}
                                      </span>
                                    )}
                                    {assignment.max_points && (
                                      <span className="text-slate-400">{assignment.max_points} pts</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                                  isApproved ? 'bg-emerald-100 text-emerald-700' :
                                  isPending ? 'bg-blue-100 text-blue-700' :
                                  needsRevision ? 'bg-amber-100 text-amber-700' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {isApproved ? 'Approved' : isPending ? 'Pending' : needsRevision ? 'Revise' : 'Todo'}
                                </div>
                                <svg
                                  className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          </button>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="px-5 pb-5 border-t border-slate-100">
                              {/* Full Description */}
                              {assignment.description && (
                                <div className="mt-4">
                                  <h4 className="text-sm font-medium text-slate-700 mb-1">Description</h4>
                                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{assignment.description}</p>
                                </div>
                              )}

                              {/* YouTube Link */}
                              {assignment.youtube_link && (
                                <div className="mt-4">
                                  <h4 className="text-sm font-medium text-slate-700 mb-2">Video</h4>
                                  <a
                                    href={assignment.youtube_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
                                  >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                                    </svg>
                                    Watch Video
                                  </a>
                                </div>
                              )}

                              {/* Attachments (Teacher Uploads) */}
                              <div className="mt-4">
                                <h4 className="text-sm font-medium text-slate-700 mb-2">
                                  Materials from Teacher
                                  {isLoadingAtt && <span className="ml-2 text-xs text-slate-400">Loading...</span>}
                                </h4>
                                {!isLoadingAtt && attachments.length === 0 && (
                                  <p className="text-sm text-slate-400">No attachments</p>
                                )}
                                {attachments.length > 0 && (
                                  <div className="space-y-2">
                                    {attachments.map(att => (
                                      <a
                                        key={att.id}
                                        href={att.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                                      >
                                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span className="text-sm text-slate-700">{att.file_name || 'Download'}</span>
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Feedback - always visible if exists */}
                          {assignmentFeedback.length > 0 && (
                            <div className={`mx-5 mb-4 p-4 rounded-xl border-l-4 ${
                              isApproved
                                ? 'bg-emerald-50 border-emerald-500'
                                : needsRevision
                                  ? 'bg-amber-50 border-amber-500'
                                  : 'bg-blue-50 border-blue-500'
                            }`}>
                              <div className="flex items-center gap-2 mb-2">
                                {isApproved ? (
                                  <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                ) : needsRevision ? (
                                  <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                  </svg>
                                )}
                                <span className={`text-sm font-semibold ${
                                  isApproved ? 'text-emerald-800' : needsRevision ? 'text-amber-800' : 'text-blue-800'
                                }`}>
                                  {isApproved ? 'Approved by Teacher' : needsRevision ? 'Revision Requested' : 'Teacher Feedback'}
                                </span>
                              </div>
                              {assignmentFeedback.map(fb => (
                                <div key={fb.id} className="text-sm text-slate-700">
                                  <p className="italic">"{fb.comment}"</p>
                                  {fb.rating && (
                                    <p className="mt-1 text-xs text-slate-500">Rating: {fb.rating}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Submit Area - show when expanded or always for pending assignments */}
                          {!isApproved && (isExpanded || !submission?.status) && (
                            <div className="mx-5 mb-5 pt-4 border-t border-slate-100 flex gap-3 items-end">
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
            </>
          )}

          {/* Regular School View */}
          {schoolMode === 'regular' && myFeatures.regular_school !== false && (
            <>
              {/* Child Indicator for Regular School */}
              {isParent && selectedChild && (
                <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold">
                    {selectedChild.name?.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-indigo-900">Managing homework for {selectedChild.name}</div>
                    <div className="text-sm text-indigo-600">Each child has their own subjects and homework</div>
                  </div>
                </div>
              )}

              {/* Stats Summary */}
              {regularStats && (
                <div className="mb-8 bg-white p-6 rounded-2xl border border-slate-100">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-indigo-600">{regularStats.subject_count}</div>
                      <div className="text-sm text-slate-500">Subjects</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-emerald-600">{regularStats.completed}</div>
                      <div className="text-sm text-slate-500">Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-amber-600">{regularStats.pending}</div>
                      <div className="text-sm text-slate-500">Pending</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-violet-600">{regularStats.points_earned}</div>
                      <div className="text-sm text-slate-500">Points Earned</div>
                    </div>
                  </div>
                  {regularStats.overdue > 0 && (
                    <div className="mt-4 px-4 py-2 bg-red-50 text-red-700 rounded-xl text-sm text-center">
                      ⚠️ {regularStats.overdue} homework overdue!
                    </div>
                  )}
                  {regularStats.due_today > 0 && (
                    <div className="mt-4 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl text-sm text-center">
                      📅 {regularStats.due_today} homework due today
                    </div>
                  )}
                </div>
              )}

              {/* Subjects Management (Parent only) */}
              {isParent && (
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-900">Subjects</h2>
                    <button
                      onClick={() => setShowCreateSubject(!showCreateSubject)}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                    >
                      {showCreateSubject ? 'Cancel' : '+ Add Subject'}
                    </button>
                  </div>

                  {showCreateSubject && (
                    <div className="mb-4 p-4 bg-white rounded-xl border border-slate-200">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                          type="text"
                          placeholder="Subject name (e.g., Math)"
                          value={subjectForm.name}
                          onChange={(e) => setSubjectForm(prev => ({ ...prev, name: e.target.value }))}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                        <select
                          value={subjectForm.icon}
                          onChange={(e) => setSubjectForm(prev => ({ ...prev, icon: e.target.value }))}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        >
                          <option value="📚">📚 Book</option>
                          <option value="🔢">🔢 Math</option>
                          <option value="📖">📖 Reading</option>
                          <option value="🔬">🔬 Science</option>
                          <option value="🌍">🌍 Geography</option>
                          <option value="🎨">🎨 Art</option>
                          <option value="🎵">🎵 Music</option>
                          <option value="💻">💻 Computer</option>
                          <option value="🏃">🏃 PE</option>
                          <option value="✍️">✍️ Writing</option>
                        </select>
                        <button
                          onClick={handleCreateSubject}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                        >
                          Create Subject
                        </button>
                      </div>
                    </div>
                  )}

                  {regularSubjects.length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-xl border border-slate-100">
                      <div className="text-4xl mb-2">📚</div>
                      <p className="text-slate-500">No subjects yet. Add subjects like Math, Reading, Science.</p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {regularSubjects.map(subject => (
                        <div
                          key={subject.id}
                          className="px-4 py-2 bg-white border border-slate-200 rounded-xl flex items-center gap-2 group"
                        >
                          <span className="text-lg">{subject.icon}</span>
                          <span className="font-medium text-slate-700">{subject.name}</span>
                          <span className="text-xs text-slate-400">
                            ({subject.pending_count || 0} pending)
                          </span>
                          <button
                            onClick={() => handleDeleteSubject(subject.id, subject.name)}
                            className="ml-1 w-5 h-5 rounded-full bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Add Homework (Parent only) */}
              {isParent && (
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-900">Add Homework</h2>
                    {regularSubjects.length > 0 && (
                      <button
                        onClick={() => setShowCreateHomework(!showCreateHomework)}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                      >
                        {showCreateHomework ? 'Cancel' : '+ Add Homework'}
                      </button>
                    )}
                  </div>

                  {regularSubjects.length === 0 ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                      <span className="font-medium">👆 First, add subjects above</span> (Math, Reading, Science, etc.)
                      — then you can assign homework for each subject.
                    </div>
                  ) : showCreateHomework && (
                    <div className="p-4 bg-white rounded-xl border border-slate-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <select
                          value={selectedSubjectId || ''}
                          onChange={(e) => setSelectedSubjectId(Number(e.target.value) || null)}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        >
                          <option value="">Select subject...</option>
                          {regularSubjects.map(s => (
                            <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Homework title"
                          value={homeworkForm.title}
                          onChange={(e) => setHomeworkForm(prev => ({ ...prev, title: e.target.value }))}
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                      <textarea
                        placeholder="Description (optional)"
                        value={homeworkForm.description}
                        onChange={(e) => setHomeworkForm(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3"
                        rows={2}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Due Date</label>
                          <input
                            type="date"
                            value={homeworkForm.due_date}
                            onChange={(e) => setHomeworkForm(prev => ({ ...prev, due_date: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Points</label>
                          <input
                            type="number"
                            value={homeworkForm.points}
                            onChange={(e) => setHomeworkForm(prev => ({ ...prev, points: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            min="1"
                            max="100"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={handleCreateHomework}
                            className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                          >
                            Add Homework
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Homework List */}
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">
                  {isChild ? 'My Homework' : 'Homework'}
                </h2>
                {regularHomework.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
                    <div className="text-5xl mb-3">✨</div>
                    <p className="text-slate-500">No homework yet!</p>
                    {isParent && regularSubjects.length === 0 && (
                      <p className="text-sm text-slate-400 mt-1">Add subjects first, then add homework</p>
                    )}
                    {isParent && regularSubjects.length > 0 && (
                      <p className="text-sm text-slate-400 mt-1">Click "+ Add Homework" above to assign homework</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {regularHomework.map(hw => {
                      const isOverdueHw = hw.status === 'pending' && hw.due_date && new Date(hw.due_date) < new Date();
                      const isDueToday = hw.status === 'pending' && hw.due_date &&
                        new Date(hw.due_date).toDateString() === new Date().toDateString();

                      return (
                        <div
                          key={hw.id}
                          className={`p-4 rounded-xl border transition-all ${
                            hw.status === 'completed'
                              ? 'bg-emerald-50 border-emerald-200'
                              : isOverdueHw
                                ? 'bg-red-50 border-red-200'
                                : isDueToday
                                  ? 'bg-amber-50 border-amber-200'
                                  : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <span className="text-2xl">{hw.subject_icon}</span>
                              <div>
                                <h3 className={`font-medium ${hw.status === 'completed' ? 'text-emerald-700 line-through' : 'text-slate-900'}`}>
                                  {hw.title}
                                </h3>
                                {hw.description && (
                                  <p className="text-sm text-slate-500 mt-0.5">{hw.description}</p>
                                )}
                                <div className="flex items-center gap-3 mt-2 text-sm">
                                  <span className="text-slate-400">{hw.subject_name}</span>
                                  {hw.due_date && (
                                    <span className={
                                      isOverdueHw ? 'text-red-600 font-medium' :
                                      isDueToday ? 'text-amber-600 font-medium' :
                                      'text-slate-400'
                                    }>
                                      {isOverdueHw ? 'Overdue!' : isDueToday ? 'Due Today' : `Due ${formatDate(hw.due_date)}`}
                                    </span>
                                  )}
                                  <span className="text-violet-600 font-medium">+{hw.points} pts</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {hw.status === 'pending' ? (
                                <>
                                  <button
                                    onClick={() => handleCompleteHomework(hw.id)}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                                  >
                                    ✓ Done
                                  </button>
                                  {isParent && (
                                    <button
                                      onClick={() => handleDeleteHomework(hw.id)}
                                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                                  ✓ Completed
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
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
