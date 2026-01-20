import { useState } from 'react';
import {
  Brain,
  Bot,
  MessageSquare,
  Loader2,
  RefreshCcw,
  CheckCircle,
  XCircle,
  Zap,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Profile } from '../../types';
import Avatar from '../Avatar';
import clsx from 'clsx';

interface AIControlsTabProps {
  profiles: Profile[];
  loading: boolean;
  onToggleAI: (profile: Profile) => void;
  onToggleDiet: (profile: Profile) => void;
  onUpdateMessageLimit: (profile: Profile, limitType: 'limited' | 'extended' | 'unlimited') => void;
  onRefresh: () => void;
}

export default function AIControlsTab({
  profiles,
  loading,
  onToggleAI,
  onToggleDiet,
  onUpdateMessageLimit,
  onRefresh
}: AIControlsTabProps) {
  const [expandedProfile, setExpandedProfile] = useState<number | null>(null);

  // Only show children for AI controls
  const children = profiles.filter(p => p.type === 'child');
  const parents = profiles.filter(p => p.type === 'parent');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading AI controls...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-600">
            Configure AI access and message limits for each child. Parents can also have AI access toggled.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all"
        >
          <RefreshCcw size={18} />
          Refresh
        </button>
      </div>

      {/* Children Section */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Brain className="text-purple-500" size={22} />
          Children AI Settings
        </h3>

        {children.length === 0 ? (
          <div className="text-center py-12 bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl border border-purple-200">
            <Bot size={40} className="mx-auto mb-3 text-purple-400" />
            <p className="font-semibold text-slate-700">No children profiles</p>
            <p className="text-sm text-slate-500 mt-1">Create child profiles to configure AI access</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {children.map(child => {
              const parent = profiles.find(p => p.id === child.parent_id);
              const isExpanded = expandedProfile === child.id;
              const aiEnabled = child.ai_enabled === 1;
              const dietEnabled = (child as any).diet_enabled === 1;

              return (
                <div
                  key={child.id}
                  className={clsx(
                    'rounded-2xl border-2 overflow-hidden transition-all',
                    aiEnabled
                      ? 'border-purple-200 bg-white shadow-lg'
                      : 'border-slate-200 bg-slate-50'
                  )}
                >
                  {/* Profile Header */}
                  <div className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar avatar={child.avatar} size="lg" alt={child.name} />
                        {aiEnabled && (
                          <div className="absolute -bottom-1 -right-1 p-1 bg-purple-500 rounded-full">
                            <Bot size={12} className="text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{child.name}</h4>
                        <p className="text-sm text-slate-500">
                          {child.age && `${child.age} years`}
                          {parent && ` • Parent: ${parent.name}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* AI Toggle */}
                      <button
                        onClick={() => onToggleAI(child)}
                        className={clsx(
                          'flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all',
                          aiEnabled
                            ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        )}
                      >
                        <Bot size={18} />
                        {aiEnabled ? 'AI On' : 'AI Off'}
                      </button>

                      {/* Expand for more options */}
                      <button
                        onClick={() => setExpandedProfile(isExpanded ? null : child.id)}
                        className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Controls */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
                      <div className="grid sm:grid-cols-2 gap-4">
                        {/* Message Limit */}
                        {aiEnabled && (
                          <div className="p-4 bg-white rounded-xl border border-purple-200">
                            <div className="flex items-center gap-2 mb-3">
                              <MessageSquare size={18} className="text-purple-500" />
                              <span className="font-semibold text-slate-800">Daily Message Limit</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => onUpdateMessageLimit(child, 'limited')}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                              >
                                5/day
                              </button>
                              <button
                                onClick={() => onUpdateMessageLimit(child, 'extended')}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                              >
                                20/day
                              </button>
                              <button
                                onClick={() => onUpdateMessageLimit(child, 'unlimited')}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                              >
                                Unlimited
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Diet Toggle */}
                        <div className="p-4 bg-white rounded-xl border border-emerald-200">
                          <div className="flex items-center gap-2 mb-3">
                            <Zap size={18} className="text-emerald-500" />
                            <span className="font-semibold text-slate-800">Diet Tracking</span>
                          </div>
                          <button
                            onClick={() => onToggleDiet(child)}
                            className={clsx(
                              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                              dietEnabled
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            )}
                          >
                            {dietEnabled ? (
                              <>
                                <CheckCircle size={16} />
                                Enabled
                              </>
                            ) : (
                              <>
                                <XCircle size={16} />
                                Disabled
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Parents Section */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Bot className="text-blue-500" size={22} />
          Parents AI Settings
        </h3>

        {parents.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-200">
            <p className="text-slate-500">No parent profiles</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {parents.map(parent => {
              const aiEnabled = parent.ai_enabled === 1;
              const dietEnabled = (parent as any).diet_enabled === 1;

              return (
                <div
                  key={parent.id}
                  className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <Avatar avatar={parent.avatar} size="md" alt={parent.name} />
                    <div>
                      <p className="font-semibold text-slate-800">{parent.name}</p>
                      <p className="text-xs text-slate-500">Parent</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleDiet(parent)}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        dietEnabled
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      )}
                    >
                      Diet {dietEnabled ? 'On' : 'Off'}
                    </button>
                    <button
                      onClick={() => onToggleAI(parent)}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        aiEnabled
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      )}
                    >
                      <Bot size={16} />
                      AI {aiEnabled ? 'On' : 'Off'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
