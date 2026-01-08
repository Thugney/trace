import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { tasksAPI, goalsAPI } from '../services/api';
import { Task, MonthlyGoal } from '../types';
import { Plus, Check, Star, Trophy, Gift, Target, Award, Edit2, Trash2, Repeat, Clock, AlertTriangle, Calendar, Camera } from 'lucide-react';
import clsx from 'clsx';
import PhotoProof from '../components/PhotoProof';
import Avatar from '../components/Avatar';

// Category icons map
const categoryIcons: Record<string, string> = {
  'read-book': '📚',
  'tigrinya': '✍️',
  'clean-room': '🛏️',
  'clean-kitchen': '🍽️',
  'school': '🎒',
  'watch-movies': '📺',
  'homework': '📝',
  'exercise': '🏃',
  'chore': '🧹',
  'other': '📌'
};

// Priority colors
const priorityColors: Record<string, string> = {
  high: 'text-red-600 bg-red-100',
  medium: 'text-yellow-600 bg-yellow-100',
  low: 'text-green-600 bg-green-100'
};

// Goal type labels for kid-friendly display
const goalTypeLabels: Record<string, string> = {
  'kroner': '💰 Money',
  'money': '💰 Money',
  'movie-night': '🎬 Movie Night',
  'treat': '🍭 Special Treat',
  'toy': '🎁 Toy or Gift',
  'game': '🎮 Game Time',
  'outing': '🚗 Fun Outing',
  'activity': '🎪 Fun Activity',
  'other': '🎯 Reward'
};

const getGoalTypeLabel = (type: string | undefined): string => {
  if (!type) return '🎯 Reward';
  return goalTypeLabels[type.toLowerCase()] || `🎯 ${type}`;
};

export default function TasksManager() {
  const { currentProfile, isParent, profiles } = useProfile();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [monthlyGoal, setMonthlyGoal] = useState<MonthlyGoal | null>(null);
  const [allGoals, setAllGoals] = useState<MonthlyGoal[]>([]);
  const [pendingGoals, setPendingGoals] = useState<MonthlyGoal[]>([]);
  const [pendingTaskApprovals, setPendingTaskApprovals] = useState<Task[]>([]);
  const [pendingPhotoProofs, setPendingPhotoProofs] = useState<Task[]>([]);
  const [selectedChild, setSelectedChild] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showBonusPoints, setShowBonusPoints] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingGoal, setEditingGoal] = useState<MonthlyGoal | null>(null);
  const [showPhotoProof, setShowPhotoProof] = useState(false);
  const [photoProofTask, setPhotoProofTask] = useState<Task | null>(null);

  const displayProfileId = isParent ? selectedChild || currentProfile?.id : currentProfile?.id;
  const children = profiles.filter(p => p.type === 'child');
  const incompleteTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  useEffect(() => {
    if (displayProfileId) {
      loadTasks();
      loadProgress();
      loadMonthlyGoal();
      loadAllGoals();
    }
  }, [displayProfileId]);

  useEffect(() => {
    if (isParent && currentProfile) {
      loadPendingGoals();
      loadPendingTaskApprovals();
      loadPendingPhotoProofs();
    }
  }, [isParent, currentProfile]);

  const loadTasks = async () => {
    if (!displayProfileId) return;

    try {
      setLoading(true);
      const response = await tasksAPI.getByProfile(displayProfileId);
      // Show all tasks to everyone - unapproved ones will have a "Pending Approval" badge
      setTasks(response.data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    if (!displayProfileId) return;

    try {
      const response = await tasksAPI.getProgress(displayProfileId);
      setProgress(response.data);
    } catch (error) {
      console.error('Failed to load progress:', error);
    }
  };

  const loadMonthlyGoal = async () => {
    if (!displayProfileId) return;

    try {
      const response = await goalsAPI.getCurrent(displayProfileId);
      // Show all goals - pending ones will have a badge
      setMonthlyGoal(response.data);
    } catch (error) {
      console.error('Failed to load monthly goal:', error);
    }
  };

  const loadAllGoals = async () => {
    if (!displayProfileId) return;
    try {
      const response = await goalsAPI.getByProfile(displayProfileId);
      // Show all goals - pending ones will have a badge
      setAllGoals(response.data);
    } catch (error) {
      console.error('Failed to load all goals:', error);
    }
  };

  const loadPendingGoals = async () => {
    if (!currentProfile?.id) return;

    try {
      const response = await goalsAPI.getPending(currentProfile.id);
      setPendingGoals(response.data);
    } catch (error) {
      console.error('Failed to load pending goals:', error);
    }
  };

  const loadPendingTaskApprovals = async () => {
    if (!currentProfile?.id) return;

    try {
      const response = await tasksAPI.getPending(currentProfile.id);
      setPendingTaskApprovals(response.data);
    } catch (error) {
      console.error('Failed to load pending task approvals:', error);
    }
  };

  const loadPendingPhotoProofs = async () => {
    if (!currentProfile?.id) return;

    try {
      const response = await tasksAPI.getPendingProofs(currentProfile.id);
      setPendingPhotoProofs(response.data);
    } catch (error) {
      console.error('Failed to load pending photo proofs:', error);
    }
  };

  const handleVerifyProof = async (taskId: number, approved: boolean) => {
    if (!currentProfile?.id) return;

    try {
      const response = await tasksAPI.verifyProof(taskId, approved, currentProfile.id);
      await loadPendingPhotoProofs();
      await loadTasks();

      if (approved) {
        alert(`✅ Photo approved! Task completed. ${response.data.pointsEarned} points awarded.`);
      } else {
        alert('❌ Photo rejected. Child can upload a new photo.');
      }
    } catch (error: any) {
      console.error('Failed to verify proof:', error);
      alert(error.response?.data?.error || 'Failed to verify photo');
    }
  };

  const handleCompleteTask = async (taskId: number, task?: Task) => {
    // Check if task requires photo proof
    const taskData = task || tasks.find(t => t.id === taskId);
    const proofRequired = taskData?.proof_required === true || taskData?.proof_required === 1;
    const hasProof = !!taskData?.proof_photo_url;

    // If photo proof is required and not yet uploaded, show the photo modal
    if (proofRequired && !hasProof) {
      setPhotoProofTask(taskData || null);
      setShowPhotoProof(true);
      return;
    }

    try {
      const response = await tasksAPI.complete(taskId);
      await loadTasks();
      await loadProgress();

      // Show celebration for kids
      if (!isParent) {
        alert(`🎉 Great job! You earned ${response.data.pointsEarned} points and ${response.data.starsEarned} stars!`);
      }
    } catch (error: any) {
      console.error('Failed to complete task:', error);
      alert(error.response?.data?.error || 'Failed to complete task');
    }
  };

  // Handle photo proof uploaded - DON'T auto-complete, wait for parent verification
  const handlePhotoProofUploaded = async () => {
    if (!photoProofTask) return;

    setShowPhotoProof(false);
    await loadTasks();

    // Show message that parent needs to verify
    if (!isParent) {
      alert('📸 Photo uploaded! Your parent will review and approve it.');
    }

    setPhotoProofTask(null);
  };

  const handleAddTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const category = formData.get('category') as string;
    const isTracking = category === 'watch-movies';
    const isRecurring = formData.get('is_recurring') === 'on';
    const estimatedMinutes = formData.get('estimated_minutes') as string;

    try {
      await tasksAPI.create({
        profile_id: displayProfileId!,
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        category: category as any,
        difficulty: isTracking ? 'easy' : (formData.get('difficulty') as any),
        earns_points: !isTracking,
        created_by: currentProfile?.id,
        priority: (formData.get('priority') as 'high' | 'medium' | 'low') || 'medium',
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? (formData.get('recurrence_pattern') as 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly') : undefined,
        due_date: formData.get('due_date') as string || undefined,
        estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : undefined
      });

      await loadTasks();
      if (isParent) {
        await loadPendingTaskApprovals();
      }
      setShowAddTask(false);

      // Show message to kids that their task needs parent approval
      if (!isParent) {
        alert('✅ Task created! It will appear once your parent approves it.');
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('Failed to create task');
    }
  };

  const handleAddGoal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      await goalsAPI.create({
        profile_id: displayProfileId!,
        month: currentMonth,
        goal_description: formData.get('description') as string,
        goal_points: parseInt(formData.get('points') as string, 10),
        goal_type: formData.get('type') as string,
        created_by: currentProfile?.id
      });

      await loadMonthlyGoal();
      await loadAllGoals();
      if (isParent) {
        await loadPendingGoals();
      }
      setShowAddGoal(false);

      // Show message to kids that their goal needs parent approval
      if (!isParent) {
        alert('✅ Goal created! It will appear once your parent approves it.');
      }
    } catch (error) {
      console.error('Failed to create goal:', error);
      alert('Failed to create goal');
    }
  };

  const handleAwardBonus = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      await goalsAPI.awardBonusPoints(
        displayProfileId!,
        parseInt(formData.get('points') as string, 10) || 0,
        parseInt(formData.get('stars') as string, 10) || 0,
        formData.get('reason') as string,
        currentProfile?.id // Pass the parent's ID who is awarding
      );

      await loadProgress();
      setShowBonusPoints(false);
      alert('Bonus points awarded! 🎉 The child will see a surprise notification!');
    } catch (error) {
      console.error('Failed to award bonus:', error);
      alert('Failed to award bonus points');
    }
  };

  const handleMarkGoalAchieved = async () => {
    if (!monthlyGoal) return;

    try {
      await goalsAPI.update(monthlyGoal.id, { achieved: true, reward_given: true });
      await loadMonthlyGoal();
      alert('Goal marked as achieved! 🎉');
    } catch (error) {
      console.error('Failed to update goal:', error);
      alert('Failed to update goal');
    }
  };

  const handleApproveGoal = async (goalId: number) => {
    if (!currentProfile?.id) return;

    try {
      await goalsAPI.approve(goalId, currentProfile.id);
      await loadPendingGoals();
      await loadAllGoals();
      await loadMonthlyGoal();
      alert('✅ Goal approved!');
    } catch (error) {
      console.error('Failed to approve goal:', error);
      alert('Failed to approve goal');
    }
  };

  const handleRejectGoal = async (goalId: number) => {
    if (!currentProfile?.id) return;

    if (!confirm('Are you sure you want to reject this goal?')) return;

    try {
      await goalsAPI.reject(goalId, currentProfile.id);
      await loadPendingGoals();
      alert('Goal rejected');
    } catch (error) {
      console.error('Failed to reject goal:', error);
      alert('Failed to reject goal');
    }
  };

  const handleApproveTask = async (taskId: number) => {
    if (!currentProfile?.id) return;

    try {
      await tasksAPI.approve(taskId, currentProfile.id);
      await loadPendingTaskApprovals();
      await loadTasks();
      alert('✅ Task approved!');
    } catch (error) {
      console.error('Failed to approve task:', error);
      alert('Failed to approve task');
    }
  };

  const handleRejectTask = async (taskId: number) => {
    if (!currentProfile?.id) return;

    if (!confirm('Are you sure you want to reject this task?')) return;

    try {
      await tasksAPI.reject(taskId, currentProfile.id);
      await loadPendingTaskApprovals();
      alert('Task rejected');
    } catch (error) {
      console.error('Failed to reject task:', error);
      alert('Failed to reject task');
    }
  };

  const handleEditTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTask) return;

    const formData = new FormData(e.currentTarget);
    const category = formData.get('category') as string;
    const isTracking = category === 'watch-movies';

    try {
      await tasksAPI.update(editingTask.id, {
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        category: category as any,
        difficulty: isTracking ? 'easy' : (formData.get('difficulty') as any),
        earns_points: !isTracking,
        due_date: (formData.get('due_date') as string) || undefined
      });

      await loadTasks();
      setEditingTask(null);
      alert('✅ Task updated!');
    } catch (error) {
      console.error('Failed to update task:', error);
      alert('Failed to update task');
    }
  };

  const handleEditGoal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingGoal) return;

    const formData = new FormData(e.currentTarget);

    try {
      await goalsAPI.update(editingGoal.id, {
        goal_description: formData.get('description') as string,
        goal_points: parseInt(formData.get('points') as string, 10),
        goal_type: formData.get('type') as string
      });

      await loadMonthlyGoal();
      await loadAllGoals();
      setEditingGoal(null);
      alert('✅ Goal updated!');
    } catch (error) {
      console.error('Failed to update goal:', error);
      alert('Failed to update goal');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await tasksAPI.delete(taskId);
      await loadTasks();
      alert('Task deleted');
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('Failed to delete task');
    }
  };

  const handleDeleteGoal = async (goalId: number) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
      await goalsAPI.delete(goalId);
      await loadMonthlyGoal();
      await loadAllGoals();
      alert('Goal deleted');
    } catch (error) {
      console.error('Failed to delete goal:', error);
      alert('Failed to delete goal');
    }
  };

  if (!currentProfile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please select a profile first</p>
      </div>
    );
  }

  const goalProgress = monthlyGoal && progress
    ? Math.min(100, (progress.current.total_points / monthlyGoal.goal_points) * 100)
    : 0;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isParent ? 'Task Management' : 'My Tasks'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isParent ? 'Manage tasks for your kids' : 'Complete tasks to earn points and stars'}
          </p>
        </div>

        <div className="flex space-x-2">
          {isParent && displayProfileId && (
            <button onClick={() => setShowBonusPoints(true)} className="btn btn-secondary">
              <Award size={20} className="mr-2" />
              Award Bonus
            </button>
          )}
          <button onClick={() => setShowAddTask(true)} className="btn btn-primary">
            <Plus size={20} className="mr-2" />
            Add Task
          </button>
        </div>
      </div>

      {/* Child Selector for Parents */}
      {isParent && children.length > 0 && (
        <div className="card mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Child
          </label>
          <div className="flex flex-wrap gap-2">
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child.id)}
                className={clsx(
                  'px-4 py-2 rounded-lg font-medium transition-colors',
                  selectedChild === child.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                )}
              >
<Avatar avatar={child.avatar} size="sm" alt={child.name} className="inline-block mr-1" /> {child.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pending Goals for Parents to Review */}
      {isParent && pendingGoals.length > 0 && (
        <div className="card mb-6 bg-yellow-50 border-2 border-yellow-300">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Trophy className="mr-2 text-yellow-600" size={24} />
            Pending Goal Approvals
          </h3>
          <div className="space-y-3">
            {pendingGoals.map(goal => (
              <div key={goal.id} className="bg-white p-4 rounded-lg border border-yellow-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <Avatar avatar={goal.child_avatar} size="sm" alt={goal.child_name || 'Child'} className="mr-2" />
                      <div>
                        <p className="font-semibold text-gray-900">{goal.child_name}</p>
                        <p className="text-sm text-gray-600">wants to set a goal</p>
                      </div>
                    </div>
                    <p className="text-gray-800 mb-2">{goal.goal_description}</p>
                    <div className="flex items-center text-sm text-gray-600">
                      <Star className="mr-1" size={16} />
                      <span>{goal.goal_points} points • {getGoalTypeLabel(goal.goal_type)}</span>
                    </div>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleApproveGoal(goal.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => handleRejectGoal(goal.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Tasks for Parents to Review */}
      {isParent && pendingTaskApprovals.length > 0 && (
        <div className="card mb-6 bg-blue-50 border-2 border-blue-300">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Check className="mr-2 text-blue-600" size={24} />
            Pending Task Approvals
          </h3>
          <div className="space-y-3">
            {pendingTaskApprovals.map(task => (
              <div key={task.id} className="bg-white p-4 rounded-lg border border-blue-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <Avatar avatar={task.child_avatar} size="sm" alt={task.child_name || 'Child'} className="mr-2" />
                      <div>
                        <p className="font-semibold text-gray-900">{task.child_name}</p>
                        <p className="text-sm text-gray-600">created a task</p>
                      </div>
                    </div>
                    <h4 className="text-gray-900 font-bold mb-1">{task.title}</h4>
                    {task.description && (
                      <p className="text-gray-700 mb-2 text-sm">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="badge badge-primary">{task.points} pts</span>
                      <span className="badge badge-warning">{task.difficulty}</span>
                      <span className="text-gray-600">• {task.category}</span>
                      {task.due_date && (
                        <span className="text-gray-600">• Due: {new Date(task.due_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleApproveTask(task.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => handleRejectTask(task.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Photo Proofs for Parents to Verify */}
      {isParent && pendingPhotoProofs.length > 0 && (
        <div className="card mb-6 bg-purple-50 border-2 border-purple-300">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Camera className="mr-2 text-purple-600" size={24} />
            Photo Proofs to Verify ({pendingPhotoProofs.length})
          </h3>
          <div className="space-y-4">
            {pendingPhotoProofs.map(task => (
              <div key={task.id} className="bg-white p-4 rounded-lg border border-purple-200">
                <div className="flex items-start gap-4">
                  {/* Photo Preview */}
                  <div className="flex-shrink-0">
                    <img
                      src={task.proof_photo_url ? `/api${task.proof_photo_url}` : ''}
                      alt="Photo proof"
                      className="w-32 h-32 object-cover rounded-lg border-2 border-purple-300 cursor-pointer hover:opacity-80"
                      onClick={() => task.proof_photo_url && window.open(`/api${task.proof_photo_url}`, '_blank')}
                      title="Click to view full size"
                    />
                    <p className="text-xs text-gray-500 mt-1 text-center">Click to enlarge</p>
                  </div>

                  {/* Task Details */}
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <Avatar avatar={task.child_avatar} size="sm" alt={task.child_name || 'Child'} className="mr-2" />
                      <div>
                        <p className="font-semibold text-gray-900">{task.child_name}</p>
                        <p className="text-sm text-gray-600">uploaded proof for task</p>
                      </div>
                    </div>
                    <h4 className="text-gray-900 font-bold mb-1">{task.title}</h4>
                    {task.description && (
                      <p className="text-gray-700 mb-2 text-sm">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-sm mb-3">
                      <span className="badge badge-primary">{task.points} pts</span>
                      <span className="badge badge-warning">{task.difficulty}</span>
                    </div>

                    {/* Approve/Reject Buttons */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleVerifyProof(task.id, true)}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium flex items-center"
                      >
                        <Check size={16} className="mr-1" />
                        Approve & Complete
                      </button>
                      <button
                        onClick={() => handleVerifyProof(task.id, false)}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                      >
                        ✗ Reject Photo
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Goal Card */}
      {!isParent && (
        <div className="card bg-gradient-to-r from-green-500 to-teal-600 text-white mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center">
              <Target size={32} className="mr-3" />
              <div>
                <h3 className="text-xl font-bold">Monthly Goal</h3>
                <p className="text-green-100 text-sm">
                  {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            {!monthlyGoal && (
              <button
                onClick={() => setShowAddGoal(true)}
                className="btn bg-white text-green-600 hover:bg-green-50 btn-sm"
              >
                <Plus size={16} className="mr-1" />
                Set Goal
              </button>
            )}
          </div>

          {monthlyGoal ? (
            <>
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span>🎯 {monthlyGoal.goal_description}</span>
                  <span className="font-bold">
                    {progress?.current.total_points || 0} / {monthlyGoal.goal_points} points
                  </span>
                </div>
                <div className="w-full bg-green-700 rounded-full h-4">
                  <div
                    className="bg-white rounded-full h-4 transition-all duration-500"
                    style={{ width: `${goalProgress}%` }}
                  />
                </div>
              </div>
              {monthlyGoal.achieved ? (
                <div className="bg-white text-green-600 px-4 py-2 rounded-lg font-bold text-center">
                  🎉 Goal Achieved! Reward: {getGoalTypeLabel(monthlyGoal.goal_type)}
                </div>
              ) : goalProgress >= 100 ? (
                <div className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-lg font-bold text-center">
                  ⭐ Goal Reached! Ask parent for reward!
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-center py-4 text-green-100">
              <p>No goal set for this month</p>
              <p className="text-sm mt-1">Set a goal to work towards!</p>
            </div>
          )}
        </div>
      )}

      {/* All Approved Goals */}
      {allGoals.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Trophy className="mr-2 text-yellow-600" size={24} />
            {isParent ? 'All Goals' : 'My Goals'}
            <span className="ml-2 text-sm font-normal text-gray-600">({allGoals.length} total)</span>
          </h3>
          <div className="space-y-3">
            {allGoals.map((goal) => {
              const goalProgress = progress && goal.parent_approved
                ? Math.min(100, (progress.current.total_points / goal.goal_points) * 100)
                : 0;

              return (
                <div key={goal.id} className={clsx(
                  'p-4 rounded-lg border-2',
                  goal.achieved ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
                )}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="font-semibold text-gray-900">{goal.goal_description}</p>
                        {goal.achieved && <span className="text-green-600 text-xl">✅</span>}
                        {!goal.parent_approved && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Pending Approval</span>}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>📅 {new Date(goal.created_at).toLocaleDateString()}</span>
                        <span>🎯 {goal.goal_points} points</span>
                        <span>{getGoalTypeLabel(goal.goal_type)}</span>
                      </div>
                    </div>
                    {!goal.achieved && (
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => setEditingGoal(goal)}
                          className="btn btn-secondary btn-sm"
                          title="Edit goal"
                        >
                          <Edit2 size={16} />
                        </button>
                        {isParent && (
                          <button
                            onClick={() => handleDeleteGoal(goal.id)}
                            className="btn btn-secondary btn-sm text-red-600 hover:bg-red-100"
                            title="Delete goal"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {goal.parent_approved && !goal.achieved && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{Math.round(goalProgress)}%</span>
                      </div>
                      <div className="w-full bg-gray-300 rounded-full h-2">
                        <div
                          className={clsx(
                            'rounded-full h-2 transition-all',
                            goalProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'
                          )}
                          style={{ width: `${goalProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {goal.achieved && (
                    <div className="mt-2 text-sm text-green-700 font-medium">
                      🎉 Achieved! Reward given: {goal.reward_given ? 'Yes' : 'Pending'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Parent View: Monthly Goal Management */}
      {isParent && selectedChild && monthlyGoal && (
        <div className="card bg-blue-50 border-2 border-blue-200 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-bold text-blue-900">
                {profiles.find(p => p.id === selectedChild)?.name}'s Goal
              </h3>
              <p className="text-blue-700">
                {monthlyGoal.goal_description} • {progress?.current.total_points || 0} / {monthlyGoal.goal_points} points
              </p>
              <div className="w-full bg-blue-200 rounded-full h-3 mt-2">
                <div
                  className="bg-blue-600 rounded-full h-3"
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
            </div>
            {!monthlyGoal.achieved && goalProgress >= 100 && (
              <button
                onClick={handleMarkGoalAchieved}
                className="btn btn-success ml-4"
              >
                Mark Achieved
              </button>
            )}
            {monthlyGoal.achieved && (
              <span className="ml-4 px-4 py-2 bg-green-100 text-green-700 rounded-lg font-bold">
                ✅ Achieved!
              </span>
            )}
          </div>
        </div>
      )}

      {/* Progress Card */}
      {progress && !isParent && (
        <div className="card bg-gradient-to-r from-primary-500 to-purple-600 text-white mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <Trophy size={32} className="mx-auto mb-2" />
              <p className="text-2xl font-bold">{progress.current.level}</p>
              <p className="text-sm text-primary-100">Level</p>
            </div>
            <div>
              <Star size={32} className="mx-auto mb-2" />
              <p className="text-2xl font-bold">{progress.current.total_stars}</p>
              <p className="text-sm text-primary-100">Stars</p>
            </div>
            <div>
              <Gift size={32} className="mx-auto mb-2" />
              <p className="text-2xl font-bold">{progress.current.total_points}</p>
              <p className="text-sm text-primary-100">Points</p>
            </div>
          </div>

          {progress.weekly && (
            <div className="mt-4 pt-4 border-t border-primary-400">
              <p className="text-sm text-primary-100">This Week</p>
              <p className="text-lg font-semibold">
                {progress.weekly.tasks_completed_this_week} tasks • {progress.weekly.points_this_week} points
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tasks List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incomplete Tasks */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">
            Pending Tasks ({incompleteTasks.length})
          </h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="spinner"></div>
            </div>
          ) : incompleteTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No pending tasks</p>
              <p className="text-sm mt-1">
                {isParent ? 'Add tasks for your kids' : 'All caught up! 🎉'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {incompleteTasks.map(task => (
                <div
                  key={task.id}
                  className={clsx(
                    'p-4 border-2 rounded-lg transition-all',
                    !task.parent_approved && 'border-orange-300 bg-orange-50 opacity-75',
                    task.parent_approved && task.priority === 'high' && 'border-red-300 bg-red-50',
                    task.parent_approved && task.priority === 'medium' && 'border-yellow-300 bg-yellow-50',
                    task.parent_approved && task.priority === 'low' && 'border-green-300 bg-green-50',
                    task.parent_approved && !task.priority && task.earns_points && task.difficulty === 'hard' && 'border-red-300 bg-red-50',
                    task.parent_approved && !task.priority && task.earns_points && task.difficulty === 'medium' && 'border-yellow-300 bg-yellow-50',
                    task.parent_approved && !task.priority && task.earns_points && task.difficulty === 'easy' && 'border-green-300 bg-green-50',
                    task.parent_approved && !task.earns_points && 'border-gray-300 bg-gray-50'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{categoryIcons[task.category] || '📌'}</span>
                        <h3 className="font-semibold text-gray-900">{task.title}</h3>
                        {task.is_recurring === 1 && (
                          <span title="Recurring task"><Repeat size={14} className="text-blue-600" /></span>
                        )}
                        {!task.parent_approved && (
                          <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-medium">
                            ⏳ Pending Approval
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      )}
                      <div className="flex flex-wrap items-center mt-2 gap-2">
                        {task.earns_points ? (
                          <>
                            <span className="badge badge-primary">{task.points} pts</span>
                            <span className="badge badge-warning">
                              {task.difficulty}
                            </span>
                          </>
                        ) : (
                          <span className="badge bg-gray-500 text-white">
                            📍 Tracking Only
                          </span>
                        )}
                        {task.priority && task.priority !== 'medium' && (
                          <span className={clsx('badge', priorityColors[task.priority])}>
                            {task.priority === 'high' ? '🔴 High' : '🟢 Low'}
                          </span>
                        )}
                        {task.due_date && (
                          <span className="text-xs text-gray-600 flex items-center">
                            <Calendar size={12} className="mr-1" />
                            {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                        {task.estimated_minutes && (
                          <span className="text-xs text-gray-600 flex items-center">
                            <Clock size={12} className="mr-1" />
                            {task.estimated_minutes} min
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      {(isParent || task.parent_approved) && (
                        <button
                          onClick={() => setEditingTask(task)}
                          className="btn btn-secondary btn-sm"
                          title="Edit task"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      {isParent && (
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="btn btn-secondary btn-sm text-red-600 hover:bg-red-100"
                          title="Delete task"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      {task.parent_approved ? (
                        <button
                          onClick={() => handleCompleteTask(task.id, task)}
                          className="btn btn-success btn-sm"
                          title={task.proof_required ? 'Complete with photo proof' : 'Mark as complete'}
                        >
                          {task.proof_required ? <Camera size={16} /> : <Check size={16} />}
                        </button>
                      ) : (
                        <span className="text-xs text-orange-600 italic">
                          Needs parent approval
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed Tasks */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">
            Completed Tasks ({completedTasks.length})
          </h2>

          {completedTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No completed tasks yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {completedTasks.slice(0, 10).map(task => (
                <div key={task.id} className="p-4 bg-gray-50 rounded-lg opacity-60">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 line-through">{task.title}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Completed {new Date(task.completed_at!).toLocaleDateString()}
                      </p>
                    </div>
                    <Check size={20} className="text-green-600" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Add New Task</h2>

            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  className="input"
                  placeholder="Task title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  className="input"
                  placeholder="Task description"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  name="category"
                  required
                  className="input"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">Select category</option>
                  <option value="read-book">📚 Read Book</option>
                  <option value="tigrinya">✍️ Tigrinya Practice</option>
                  <option value="clean-room">🛏️ Clean Room</option>
                  <option value="clean-kitchen">🍽️ Clean Kitchen</option>
                  <option value="school">🎒 School Work</option>
                  <option value="watch-movies">📺 Watch Movies/Screen Time (Tracking Only)</option>
                  <option value="other">📌 Other</option>
                </select>
              </div>

              {/* Only show difficulty if NOT tracking task */}
              {selectedCategory && selectedCategory !== 'watch-movies' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Difficulty * (affects points earned)
                  </label>
                  <select name="difficulty" required className="input">
                    <option value="easy">Easy (10 pts)</option>
                    <option value="medium">Medium (20 pts)</option>
                    <option value="hard">Hard (30 pts)</option>
                  </select>
                </div>
              )}

              {selectedCategory === 'watch-movies' && (
                <div className="p-4 bg-gray-100 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>📍 Tracking Task:</strong> This task logs screen time but doesn't earn points.
                    It's for tracking purposes only.
                  </p>
                </div>
              )}

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <AlertTriangle size={16} className="inline mr-1" />
                  Priority
                </label>
                <select name="priority" className="input" defaultValue="medium">
                  <option value="high">🔴 High - Do first!</option>
                  <option value="medium">🟡 Medium - Normal</option>
                  <option value="low">🟢 Low - When you have time</option>
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar size={16} className="inline mr-1" />
                  Due Date (optional)
                </label>
                <input type="date" name="due_date" className="input" />
              </div>

              {/* Estimated Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock size={16} className="inline mr-1" />
                  Estimated Time (minutes)
                </label>
                <select name="estimated_minutes" className="input">
                  <option value="">Not set</option>
                  <option value="5">5 minutes</option>
                  <option value="10">10 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>

              {/* Recurring Task */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" name="is_recurring" className="w-5 h-5 rounded" />
                  <Repeat size={16} className="text-blue-600" />
                  <span className="font-medium text-gray-700">Make this a recurring task</span>
                </label>
                <div className="mt-3">
                  <select name="recurrence_pattern" className="input">
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays only</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 weeks</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Recurring tasks automatically create a new copy when completed
                  </p>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  Add Task
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTask(false);
                    setSelectedCategory('');
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

      {/* Add Goal Modal */}
      {showAddGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-lg w-full">
            <h2 className="text-2xl font-bold mb-4">Set Monthly Goal</h2>

            <form onSubmit={handleAddGoal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What do you want to earn? *
                </label>
                <input
                  type="text"
                  name="description"
                  required
                  className="input"
                  placeholder="e.g., 100 kroner, Movie night, New toy"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What reward do you want? 🎁
                </label>
                <select name="type" className="input">
                  <option value="kroner">💰 Money (Kroner)</option>
                  <option value="movie-night">🎬 Movie Night</option>
                  <option value="treat">🍭 Special Treat</option>
                  <option value="toy">🎁 Toy or Gift</option>
                  <option value="game">🎮 Game Time</option>
                  <option value="outing">🚗 Fun Outing</option>
                  <option value="other">🎯 Other Reward</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  How many points do you need? *
                </label>
                <input
                  type="number"
                  name="points"
                  required
                  min="10"
                  className="input"
                  placeholder="e.g., 500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Complete tasks and earn bonus points for good behavior to reach your goal!
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  <Target size={20} className="mr-2" />
                  Set Goal
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddGoal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Award Bonus Points Modal */}
      {showBonusPoints && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-lg w-full">
            <h2 className="text-2xl font-bold mb-4">Award Bonus Points</h2>
            <p className="text-gray-600 mb-4">
              Reward good behavior (sammearbeid/cooperation) with bonus points!
            </p>

            <form onSubmit={handleAwardBonus} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Bonus *
                </label>
                <input
                  type="text"
                  name="reason"
                  required
                  className="input"
                  placeholder="e.g., Helped sibling, Great teamwork"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bonus Points
                  </label>
                  <input
                    type="number"
                    name="points"
                    min="0"
                    defaultValue="10"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bonus Stars
                  </label>
                  <input
                    type="number"
                    name="stars"
                    min="0"
                    defaultValue="1"
                    className="input"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  <Award size={20} className="mr-2" />
                  Award Bonus
                </button>
                <button
                  type="button"
                  onClick={() => setShowBonusPoints(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Edit Task</h2>

            <form onSubmit={handleEditTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  className="input"
                  defaultValue={editingTask.title}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  className="input"
                  rows={3}
                  defaultValue={editingTask.description || ''}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  name="category"
                  required
                  className="input"
                  defaultValue={editingTask.category}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">Select category</option>
                  <option value="read-book">📚 Read Book</option>
                  <option value="tigrinya">✍️ Tigrinya Practice</option>
                  <option value="clean-room">🛏️ Clean Room</option>
                  <option value="clean-kitchen">🍽️ Clean Kitchen</option>
                  <option value="school">🎒 School Work</option>
                  <option value="watch-movies">📺 Watch Movies/Screen Time (Tracking Only)</option>
                  <option value="other">📌 Other</option>
                </select>
              </div>

              {selectedCategory !== 'watch-movies' && editingTask.category !== 'watch-movies' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Difficulty * (affects points earned)
                  </label>
                  <select name="difficulty" required className="input" defaultValue={editingTask.difficulty}>
                    <option value="easy">Easy (10 pts)</option>
                    <option value="medium">Medium (20 pts)</option>
                    <option value="hard">Hard (30 pts)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date (optional)
                </label>
                <input
                  type="date"
                  name="due_date"
                  className="input"
                  defaultValue={editingTask.due_date?.split('T')[0] || ''}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  <Edit2 size={20} className="mr-2" />
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTask(null);
                    setSelectedCategory('');
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

      {/* Edit Goal Modal */}
      {editingGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-lg w-full">
            <h2 className="text-2xl font-bold mb-4">Edit Goal</h2>

            <form onSubmit={handleEditGoal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What do you want to earn? *
                </label>
                <input
                  type="text"
                  name="description"
                  required
                  className="input"
                  defaultValue={editingGoal.goal_description}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What reward do you want? 🎁
                </label>
                <select name="type" className="input" defaultValue={editingGoal.goal_type}>
                  <option value="kroner">💰 Money (Kroner)</option>
                  <option value="movie-night">🎬 Movie Night</option>
                  <option value="treat">🍭 Special Treat</option>
                  <option value="toy">🎁 Toy or Gift</option>
                  <option value="game">🎮 Game Time</option>
                  <option value="outing">🚗 Fun Outing</option>
                  <option value="other">🎯 Other Reward</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  How many points do you need? *
                </label>
                <input
                  type="number"
                  name="points"
                  required
                  min="10"
                  className="input"
                  defaultValue={editingGoal.goal_points}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  <Edit2 size={20} className="mr-2" />
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingGoal(null)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Proof Modal */}
      {showPhotoProof && photoProofTask && (
        <PhotoProof
          taskId={photoProofTask.id}
          taskTitle={photoProofTask.title}
          onProofUploaded={handlePhotoProofUploaded}
          onCancel={() => {
            setShowPhotoProof(false);
            setPhotoProofTask(null);
          }}
        />
      )}
    </div>
  );
}
