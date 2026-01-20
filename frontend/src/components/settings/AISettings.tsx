import { useState, useEffect } from 'react';
import { Brain, Shield, MessageSquare, Filter, Sparkles, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import Avatar from '../Avatar';
import { Profile } from '../../types';
import { aiAPI } from '../../services/api';

interface AISettingsProps {
  profiles: Profile[];
  onSuccess: (message: string) => void;
}

export default function AISettings({ profiles, onSuccess }: AISettingsProps) {
  const [aiSettings, setAiSettings] = useState<Record<number, any>>({});
  const [expandedProfile, setExpandedProfile] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const childProfiles = profiles.filter(p => p.type === 'child');

  useEffect(() => {
    loadAllAISettings();
  }, [profiles]);

  const loadAllAISettings = async () => {
    setLoading(true);
    const settingsMap: Record<number, any> = {};

    for (const profile of childProfiles) {
      try {
        const response = await aiAPI.getSettings(profile.id);
        settingsMap[profile.id] = response.data;
      } catch (error) {
        console.error(`Failed to load AI settings for ${profile.name}:`, error);
      }
    }

    setAiSettings(settingsMap);
    setLoading(false);
  };

  const handleUpdateSettings = async (profileId: number, updates: any) => {
    try {
      const response = await aiAPI.updateSettings(profileId, updates);
      setAiSettings(prev => ({
        ...prev,
        [profileId]: response.data
      }));
      onSuccess('AI settings updated!');
    } catch (error) {
      console.error('Failed to update AI settings:', error);
      onSuccess('Failed to update settings');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900">AI Controls</h2>
        <p className="text-sm text-slate-500 mt-1">
          Configure AI behavior and safety settings for each child
        </p>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200">
        <div className="flex gap-3">
          <AlertTriangle className="text-purple-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-purple-800">
            <p className="font-medium">Admin-only: Control AI behavior for each child</p>
            <p className="mt-1 text-purple-600">
              Set strict mode, message limits, and content filtering to ensure safe and educational AI interactions.
            </p>
          </div>
        </div>
      </div>

      {/* Child Profiles */}
      {childProfiles.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Brain size={48} className="mx-auto mb-4 opacity-50" />
          <p className="font-medium">No child profiles yet</p>
          <p className="text-sm mt-1">Add a child profile to configure AI controls</p>
        </div>
      ) : (
        <div className="space-y-4">
          {childProfiles.map(profile => {
            const settings = aiSettings[profile.id];
            const isExpanded = expandedProfile === profile.id;

            return (
              <div
                key={profile.id}
                className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden transition-shadow hover:shadow-md"
              >
                {/* Profile Header */}
                <button
                  onClick={() => setExpandedProfile(isExpanded ? null : profile.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Avatar avatar={profile.avatar} size="md" alt={profile.name} />
                    <div className="text-left">
                      <p className="font-semibold text-slate-900">{profile.name}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                          settings?.strict_mode
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          <Shield size={12} />
                          {settings?.strict_mode ? 'Strict Mode ON' : 'Strict Mode OFF'}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare size={12} />
                          {settings?.max_messages_per_day || 20} msgs/day
                        </span>
                      </div>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="text-slate-400" size={20} />
                  ) : (
                    <ChevronDown className="text-slate-400" size={20} />
                  )}
                </button>

                {/* Expanded Settings */}
                {isExpanded && settings && (
                  <div className="p-6 bg-white border-t border-slate-200 space-y-6">
                    {/* Strict Mode Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Shield className="text-green-600" size={20} />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">Strict Mode</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {settings.strict_mode
                              ? 'Age-appropriate language, blocks inappropriate topics'
                              : 'Less restrictive but still age-appropriate'}
                          </p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.strict_mode}
                          onChange={(e) => handleUpdateSettings(profile.id, {
                            strict_mode: e.target.checked
                          })}
                          className="sr-only peer"
                        />
                        <div className="w-12 h-7 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500 shadow-inner"></div>
                      </label>
                    </div>

                    {/* Daily Message Limit */}
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <MessageSquare className="text-blue-600" size={20} />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">Daily Message Limit</p>
                          <p className="text-xs text-slate-500">Prevents excessive AI usage</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <input
                          type="range"
                          min="5"
                          max="100"
                          value={settings.max_messages_per_day}
                          onChange={(e) => handleUpdateSettings(profile.id, {
                            max_messages_per_day: parseInt(e.target.value)
                          })}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>5 messages</span>
                          <span className="font-semibold text-blue-600 text-sm">
                            {settings.max_messages_per_day} messages/day
                          </span>
                          <span>100 messages</span>
                        </div>
                      </div>
                    </div>

                    {/* Content Filter Level */}
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <Filter className="text-orange-600" size={20} />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">Content Filter Level</p>
                          <p className="text-xs text-slate-500">Controls how strictly the AI filters responses</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'strict', label: 'Strict', desc: 'Recommended for kids', icon: Shield },
                          { value: 'moderate', label: 'Moderate', desc: 'Balanced filtering', icon: Filter },
                          { value: 'relaxed', label: 'Relaxed', desc: 'Teens only', icon: Sparkles }
                        ].map(option => (
                          <button
                            key={option.value}
                            onClick={() => handleUpdateSettings(profile.id, {
                              content_filter_level: option.value
                            })}
                            className={`p-3 rounded-xl border-2 transition-all text-center ${
                              settings.content_filter_level === option.value
                                ? 'border-orange-500 bg-orange-50'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                          >
                            <option.icon
                              size={20}
                              className={`mx-auto mb-1 ${
                                settings.content_filter_level === option.value
                                  ? 'text-orange-600'
                                  : 'text-slate-400'
                              }`}
                            />
                            <p className={`text-sm font-medium ${
                              settings.content_filter_level === option.value
                                ? 'text-orange-700'
                                : 'text-slate-700'
                            }`}>
                              {option.label}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">{option.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Instructions */}
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-violet-100 rounded-lg">
                          <Sparkles className="text-violet-600" size={20} />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">Custom Instructions</p>
                          <p className="text-xs text-slate-500">Add your own instructions for the AI</p>
                        </div>
                      </div>
                      <textarea
                        value={settings.custom_instructions || ''}
                        onChange={(e) => handleUpdateSettings(profile.id, {
                          custom_instructions: e.target.value
                        })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-shadow bg-white resize-none"
                        rows={4}
                        placeholder="Examples:
- Always remind about bedtime at 8pm
- Encourage outdoor activities
- Help with Norwegian language homework
- Focus on math practice"
                      />
                    </div>

                    {/* System Prompt Preview */}
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-2">
                        <ChevronDown size={16} className="group-open:rotate-180 transition-transform" />
                        View AI System Prompt
                      </summary>
                      <div className="mt-3 p-4 bg-slate-900 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto">
                        <pre className="whitespace-pre-wrap">
{settings.strict_mode ? `You are a friendly, educational AI assistant for ${profile.name} (${profile.age} years).

STRICT GUIDELINES:
- Use age-appropriate language only
- Be positive, encouraging, and educational
- Never discuss inappropriate topics
- Focus on learning and positive habits
- Encourage task completion
- Redirect inappropriate questions

Context: Tasks, Points, Goals, Diet tracking` : `You are a friendly AI assistant for ${profile.name} (${profile.age} years).

Keep language age-appropriate and be helpful.

Context: Tasks, Points, Level, Progress`}
                        </pre>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
