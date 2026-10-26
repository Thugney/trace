import { useCallback, useEffect, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check, Clock } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { useAge } from '../context/AgeContext';
import { tasksAPI } from '../services/api';
import clsx from 'clsx';

interface Task {
  id: number;
  title: string;
  category: string;
  points: number;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
}

export default function CalendarView() {
  const { currentProfile } = useProfile();
  const profileId = currentProfile?.id;
  const { settings, isYoungChild } = useAge();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    if (!profileId) return;
    try {
      setLoading(true);
      const response = await tasksAPI.getByProfile(profileId);
      // Cast to local Task type (API returns undefined for null dates)
      setTasks(response.data.map(t => ({
        ...t,
        due_date: t.due_date ?? null,
        completed_at: t.completed_at ?? null
      })) as Task[]);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (currentProfile?.id) {
      loadTasks();
    }
  }, [currentProfile?.id, loadTasks]);

  // Get days in month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay(); // 0 = Sunday

    const days: (number | null)[] = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const formatDateKey = (day: number) => {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${month}-${dayStr}`;
  };

  // Group tasks by date
  const tasksByDate = tasks.reduce((acc, task) => {
    if (task.due_date) {
      const dateKey = task.due_date.split('T')[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(task);
    }
    return acc;
  }, {} as Record<string, Task[]>);

  const getDateStatus = (dateKey: string) => {
    const dateTasks = tasksByDate[dateKey] || [];
    if (dateTasks.length === 0) return null;

    const allCompleted = dateTasks.every(t => t.completed);
    const someCompleted = dateTasks.some(t => t.completed);
    const today = new Date().toISOString().split('T')[0];
    const isOverdue = dateKey < today && !allCompleted;

    if (allCompleted) return 'completed';
    if (isOverdue) return 'overdue';
    if (someCompleted) return 'partial';
    return 'pending';
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const days = getDaysInMonth(currentDate);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = isYoungChild
    ? ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().toISOString().split('T')[0];

  const selectedTasks = selectedDate ? (tasksByDate[selectedDate] || []) : [];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${settings.themeClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className={`font-bold text-slate-800 flex items-center gap-3 ${isYoungChild ? 'text-3xl' : 'text-2xl'}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-white" />
          </div>
          Calendar
        </h1>
        <button
          onClick={goToToday}
          className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"
        >
          Today
        </button>
      </div>

      {/* Calendar Card */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Month Navigation */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className={`font-semibold text-slate-800 ${isYoungChild ? 'text-xl' : 'text-lg'}`}>
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {dayNames.map(day => (
            <div key={day} className="py-2 text-center text-xs font-medium text-slate-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="aspect-square border-b border-r border-slate-50" />;
            }

            const dateKey = formatDateKey(day);
            const status = getDateStatus(dateKey);
            const isToday = dateKey === today;
            const isSelected = dateKey === selectedDate;
            const taskCount = (tasksByDate[dateKey] || []).length;

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(dateKey === selectedDate ? null : dateKey)}
                className={clsx(
                  'aspect-square border-b border-r border-slate-50 p-1 transition-all relative',
                  isSelected && 'bg-indigo-50 ring-2 ring-inset ring-indigo-500',
                  isToday && !isSelected && 'bg-blue-50',
                  !isSelected && !isToday && 'hover:bg-slate-50'
                )}
              >
                <span className={clsx(
                  'flex items-center justify-center w-7 h-7 rounded-full text-sm mx-auto',
                  isToday && 'bg-blue-500 text-white font-bold',
                  !isToday && 'text-slate-700'
                )}>
                  {day}
                </span>

                {/* Task indicators */}
                {taskCount > 0 && (
                  <div className="flex justify-center gap-0.5 mt-1">
                    <span className={clsx(
                      'w-2 h-2 rounded-full',
                      status === 'completed' && 'bg-green-500',
                      status === 'overdue' && 'bg-red-500',
                      status === 'partial' && 'bg-yellow-500',
                      status === 'pending' && 'bg-blue-500'
                    )} />
                    {taskCount > 1 && (
                      <span className="text-[10px] text-slate-400 ml-0.5">+{taskCount - 1}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 p-3 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" /> Done
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Upcoming
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Overdue
          </div>
        </div>
      </div>

      {/* Selected Date Tasks */}
      {selectedDate && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h3 className="font-semibold text-slate-700">
              Tasks for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
              })}
            </h3>
          </div>

          {selectedTasks.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {selectedTasks.map(task => (
                <div key={task.id} className="p-4 flex items-center gap-3">
                  <div className={clsx(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    task.completed ? 'bg-green-100' : 'bg-slate-100'
                  )}>
                    {task.completed ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={clsx(
                      'font-medium',
                      task.completed ? 'text-slate-500 line-through' : 'text-slate-800'
                    )}>
                      {task.title}
                    </p>
                    <p className="text-sm text-slate-500">{task.points} points</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              <CalendarIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p>No tasks scheduled for this day</p>
            </div>
          )}
        </div>
      )}

      {/* No tasks at all */}
      {Object.keys(tasksByDate).length === 0 && !selectedDate && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="font-semibold text-slate-700 mb-2">No scheduled tasks yet</h3>
          <p className="text-slate-500">Tasks with due dates will appear on the calendar</p>
        </div>
      )}
    </div>
  );
}
