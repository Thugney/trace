import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { tasksAPI } from '../services/api';
import { Task } from '../types';
import { Plus, Check, Star, Trophy, Gift } from 'lucide-react';
import clsx from 'clsx';

export default function TasksManager() {
  const { currentProfile, isParent, profiles } = useProfile();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [selectedChild, setSelectedChild] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);

  const displayProfileId = isParent ? selectedChild || currentProfile?.id : currentProfile?.id;

  useEffect(() => {
    if (displayProfileId) {
      loadTasks();
      loadProgress();
    }
  }, [displayProfileId]);

  const loadTasks = async () => {
    if (!displayProfileId) return;

    try {
      setLoading(true);
      const response = await tasksAPI.getByProfile(displayProfileId);
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

  const handleCompleteTask = async (taskId: number) => {
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

  const handleAddTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      await tasksAPI.create({
        profile_id: displayProfileId!,
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        category: formData.get('category') as any,
        difficulty: formData.get('difficulty') as any,
        created_by: currentProfile?.id
      });

      await loadTasks();
      setShowAddTask(false);
      e.currentTarget.reset();
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('Failed to create task');
    }
  };

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const children = profiles.filter(p => p.type === 'child');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isParent ? 'Task Management' : 'My Tasks'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isParent ? 'Manage tasks for your kids' : 'Complete tasks to earn points and stars'}
          </p>
        </div>

        {isParent && (
          <button onClick={() => setShowAddTask(true)} className="btn btn-primary">
            <Plus size={20} className="mr-2" />
            Add Task
          </button>
        )}
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
                {child.avatar} {child.name}
              </button>
            ))}
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
        {/* Pending Tasks */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">
            Pending Tasks ({pendingTasks.length})
          </h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="spinner"></div>
            </div>
          ) : pendingTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No pending tasks</p>
              <p className="text-sm mt-1">
                {isParent ? 'Add tasks for your kids' : 'All caught up! 🎉'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingTasks.map(task => (
                <div
                  key={task.id}
                  className={clsx(
                    'p-4 border-2 rounded-lg transition-all',
                    task.difficulty === 'hard' && 'border-red-300 bg-red-50',
                    task.difficulty === 'medium' && 'border-yellow-300 bg-yellow-50',
                    task.difficulty === 'easy' && 'border-green-300 bg-green-50'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="badge badge-primary">{task.category}</span>
                        <span className={clsx(
                          'badge',
                          task.difficulty === 'hard' && 'badge-danger',
                          task.difficulty === 'medium' && 'badge-warning',
                          task.difficulty === 'easy' && 'badge-success'
                        )}>
                          {task.difficulty}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900">{task.title}</h3>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <span>⭐ {task.points} points</span>
                        {task.due_date && (
                          <span>📅 Due: {new Date(task.due_date).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    {!isParent && (
                      <button
                        onClick={() => handleCompleteTask(task.id)}
                        className="btn btn-success ml-4"
                      >
                        <Check size={20} />
                      </button>
                    )}
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
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {completedTasks.slice(0, 10).map(task => (
                <div key={task.id} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Check size={20} className="text-green-600" />
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{task.title}</h3>
                      <p className="text-sm text-gray-600">
                        Completed {task.completed_at && new Date(task.completed_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-green-600 font-semibold">+{task.points}</span>
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
          <div className="card max-w-lg w-full">
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
                  placeholder="Clean your room"
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
                  placeholder="Details about the task..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select name="category" required className="input">
                    <option value="chore">Chore</option>
                    <option value="homework">Homework</option>
                    <option value="activity">Activity</option>
                    <option value="habit">Habit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Difficulty *
                  </label>
                  <select name="difficulty" required className="input">
                    <option value="easy">Easy (10 pts)</option>
                    <option value="medium">Medium (20 pts)</option>
                    <option value="hard">Hard (30 pts)</option>
                  </select>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  Add Task
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddTask(false)}
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
