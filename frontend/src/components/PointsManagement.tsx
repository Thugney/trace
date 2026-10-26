import { useState, useEffect, useCallback } from 'react';
import { gamificationAPI, PointsAdjustmentEntry, tasksAPI } from '../services/api';
import { Profile, Task } from '../types';
import { Coins, Plus, Minus, History, ChevronDown, ChevronUp, Clock, AlertTriangle, Send } from 'lucide-react';
import Avatar from './Avatar';
import { useToast } from './Toast';
import playSounds from '../utils/sounds';

interface OverdueTask {
  id: number;
  title: string;
  due_at: string;
  points: number;
}

interface ChildPoints {
  profileId: number;
  name: string;
  avatar: string;
  totalPoints: number;
  history: PointsAdjustmentEntry[];
  overdueTasks: OverdueTask[];
}

interface Props {
  children: Profile[];
  parentId: number;
}

function parseLocalDateValue(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    return new Date(
      Number(dateMatch[1]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[3])
    );
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getTaskDueAt(task: Task): Date | null {
  const dueDate = parseLocalDateValue(task.due_date);
  if (!dueDate) {
    return null;
  }

  const timeMatch = task.scheduled_time?.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    dueDate.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
    return dueDate;
  }

  dueDate.setHours(23, 59, 59, 999);
  return dueDate;
}

export default function PointsManagement({ children, parentId }: Props) {
  const toast = useToast();
  const [childrenData, setChildrenData] = useState<ChildPoints[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedChild, setExpandedChild] = useState<number | null>(null);
  const [adjustingChild, setAdjustingChild] = useState<number | null>(null);
  const [adjustType, setAdjustType] = useState<'add' | 'deduct'>('deduct');
  const [amount, setAmount] = useState<number>(10);
  const [reason, setReason] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Common deduction reasons for quick selection
  const quickReasons = [
    { label: 'Task not completed on time', value: 'Did not complete scheduled task on time' },
    { label: 'Misbehavior', value: 'Misbehavior or not following rules' },
    { label: 'Incomplete homework', value: 'Did not complete homework' },
    { label: 'Screen time exceeded', value: 'Exceeded allowed screen time' },
    { label: 'Did not help with chores', value: 'Did not help with assigned chores' },
  ];

  const quickBonusReasons = [
    { label: 'Extra effort', value: 'Showed extra effort and dedication' },
    { label: 'Helping sibling', value: 'Helped their sibling with tasks' },
    { label: 'Good behavior', value: 'Exceptional good behavior today' },
    { label: 'Bonus reward', value: 'Bonus points for being helpful' },
  ];

  const loadData = useCallback(async () => {
    if (children.length === 0) return;

    setLoading(true);
    try {
      const results = await Promise.all(
        children.map(async (child) => {
          try {
            const [statsRes, historyRes, tasksRes] = await Promise.all([
              gamificationAPI.getStats(child.id),
              gamificationAPI.getPointsHistory(child.id, 20),
              tasksAPI.getByProfile(child.id, false) // Get incomplete tasks
            ]);

            // Find overdue tasks (scheduled but not completed)
            const now = new Date();
            const overdueTasks: OverdueTask[] = (tasksRes.data || [])
              .filter((task: Task) => {
                if (task.completed) return false;
                const dueAt = getTaskDueAt(task);
                return !!dueAt && dueAt.getTime() < now.getTime();
              })
              .sort((left: Task, right: Task) => {
                const leftDueAt = getTaskDueAt(left)?.getTime() || 0;
                const rightDueAt = getTaskDueAt(right)?.getTime() || 0;
                return leftDueAt - rightDueAt;
              })
              .map((task: Task) => ({
                id: task.id,
                title: task.title,
                due_at: getTaskDueAt(task)!.toISOString(),
                points: task.points || 10
              }));

            return {
              profileId: child.id,
              name: child.name,
              avatar: child.avatar || '👤',
              totalPoints: statsRes.data.points || 0,
              history: historyRes.data.history || [],
              overdueTasks
            };
          } catch (error) {
            console.error(`Failed to load data for ${child.name}:`, error);
            return null;
          }
        })
      );

      setChildrenData(results.filter(Boolean) as ChildPoints[]);
    } catch (error) {
      console.error('Failed to load points data:', error);
    } finally {
      setLoading(false);
    }
  }, [children]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdjust = async (childId: number) => {
    if (amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    if (!reason.trim() || reason.trim().length < 3) {
      toast.error('Please provide a reason (at least 3 characters)');
      return;
    }

    const child = childrenData.find(c => c.profileId === childId);
    if (!child) return;

    // For deductions, check if child has enough points
    if (adjustType === 'deduct' && child.totalPoints < amount) {
      toast.error(`${child.name} only has ${child.totalPoints} points`);
      return;
    }

    setSubmitting(true);
    try {
      const adjustedAmount = adjustType === 'deduct' ? -amount : amount;

      await gamificationAPI.adjustPoints(
        childId,
        adjustedAmount,
        reason.trim(),
        parentId,
        selectedTask || undefined
      );

      playSounds.notification();
      toast.success(
        adjustType === 'deduct'
          ? `Deducted ${amount} points from ${child.name}`
          : `Added ${amount} points to ${child.name}`
      );

      // Reset form
      setAdjustingChild(null);
      setAmount(10);
      setReason('');
      setSelectedTask(null);

      // Reload data
      await loadData();
    } catch (error: any) {
      console.error('Failed to adjust points:', error);
      toast.error(error.response?.data?.error || 'Failed to adjust points');
    } finally {
      setSubmitting(false);
    }
  };

  const startAdjustment = (childId: number, type: 'add' | 'deduct') => {
    setAdjustingChild(childId);
    setAdjustType(type);
    setAmount(10);
    setReason('');
    setSelectedTask(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="spinner"></div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="text-center py-8">
        <Coins size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">No children to manage</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <Coins className="text-yellow-600" size={24} />
        <h2 className="text-lg font-semibold text-gray-900">Points Management</h2>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Add or deduct points from your children. They will receive a notification explaining why.
      </p>

      {childrenData.map((child) => (
        <div
          key={child.profileId}
          className="border rounded-xl overflow-hidden bg-white shadow-sm"
        >
          {/* Child Header */}
          <div
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
            onClick={() => setExpandedChild(expandedChild === child.profileId ? null : child.profileId)}
          >
            <div className="flex items-center gap-3">
              <Avatar avatar={child.avatar} size="md" />
              <div>
                <h3 className="font-medium text-gray-900">{child.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-yellow-600">{child.totalPoints}</span>
                  <span className="text-sm text-gray-500">points</span>
                  {child.overdueTasks.length > 0 && (
                    <span className="ml-2 flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      <AlertTriangle size={12} />
                      {child.overdueTasks.length} overdue
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startAdjustment(child.profileId, 'add');
                }}
                className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
                title="Add points"
              >
                <Plus size={18} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startAdjustment(child.profileId, 'deduct');
                }}
                className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                title="Deduct points"
              >
                <Minus size={18} />
              </button>
              {expandedChild === child.profileId ? (
                <ChevronUp size={20} className="text-gray-400" />
              ) : (
                <ChevronDown size={20} className="text-gray-400" />
              )}
            </div>
          </div>

          {/* Adjustment Form */}
          {adjustingChild === child.profileId && (
            <div className="border-t p-4 bg-gray-50">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                {adjustType === 'deduct' ? (
                  <>
                    <Minus size={16} className="text-red-600" />
                    Deduct Points from {child.name}
                  </>
                ) : (
                  <>
                    <Plus size={16} className="text-green-600" />
                    Add Points to {child.name}
                  </>
                )}
              </h4>

              <div className="space-y-4">
                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <div className="flex items-center gap-2">
                    {[5, 10, 20, 50].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setAmount(preset)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          amount === preset
                            ? adjustType === 'deduct'
                              ? 'bg-red-600 text-white'
                              : 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
                      min="1"
                      max={adjustType === 'deduct' ? child.totalPoints : 1000}
                      className="w-20 px-3 py-1.5 border rounded-lg text-center"
                    />
                  </div>
                  {adjustType === 'deduct' && amount > child.totalPoints && (
                    <p className="text-xs text-red-600 mt-1">
                      Max deduction: {child.totalPoints} points
                    </p>
                  )}
                </div>

                {/* Related Task (for deductions) */}
                {adjustType === 'deduct' && child.overdueTasks.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Related Task (optional)
                    </label>
                    <select
                      value={selectedTask || ''}
                      onChange={(e) => {
                        const taskId = e.target.value ? parseInt(e.target.value) : null;
                        setSelectedTask(taskId);
                        // Auto-fill reason if task selected
                        if (taskId) {
                          const task = child.overdueTasks.find(t => t.id === taskId);
                          if (task) {
                            setReason(`Did not complete "${task.title}" on time`);
                            setAmount(task.points || 10);
                          }
                        }
                      }}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Select an overdue task...</option>
                      {child.overdueTasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title} (was due {formatDate(task.due_at)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Quick Reasons */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quick Reasons
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(adjustType === 'deduct' ? quickReasons : quickBonusReasons).map((qr) => (
                      <button
                        key={qr.value}
                        onClick={() => setReason(qr.value)}
                        className={`px-3 py-1 text-xs rounded-full transition-colors ${
                          reason === qr.value
                            ? adjustType === 'deduct'
                              ? 'bg-red-600 text-white'
                              : 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {qr.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reason Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason (required)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain why points are being adjusted..."
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {child.name} will see this reason in their notification
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleAdjust(child.profileId)}
                    disabled={submitting || !reason.trim() || amount <= 0}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                      adjustType === 'deduct'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    <Send size={16} />
                    {submitting
                      ? 'Processing...'
                      : adjustType === 'deduct'
                      ? `Deduct ${amount} Points`
                      : `Add ${amount} Points`}
                  </button>
                  <button
                    onClick={() => setAdjustingChild(null)}
                    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* History Panel */}
          {expandedChild === child.profileId && (
            <div className="border-t p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <History size={16} />
                Recent Adjustments
              </h4>

              {child.history.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No point adjustments yet
                </p>
              ) : (
                <div className="space-y-2">
                  {child.history.map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-3 rounded-lg ${
                        entry.amount < 0 ? 'bg-red-50' : 'bg-green-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {entry.amount < 0 ? (
                            <Minus size={14} className="text-red-600" />
                          ) : (
                            <Plus size={14} className="text-green-600" />
                          )}
                          <span
                            className={`font-bold ${
                              entry.amount < 0 ? 'text-red-700' : 'text-green-700'
                            }`}
                          >
                            {entry.amount < 0 ? '' : '+'}{entry.amount} pts
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock size={12} />
                          {formatDate(entry.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{entry.reason}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        by {entry.adjusted_by_name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
