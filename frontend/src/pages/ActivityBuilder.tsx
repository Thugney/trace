import React, { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { activitiesAPI, rewardsAPI } from '../services/api';
import {
  Brain, Plus, Sparkles, Trash2,
  ChevronRight, ChevronLeft, ArrowLeft, Save,
  AlertCircle, CheckCircle, Loader2
} from 'lucide-react';
import type {
  LearningSession,
  ActivityType,
  AiGenerationRequest,
  AiGenerationJob
} from '../types/activities';

type ViewMode = 'list' | 'create' | 'ai-generate' | 'edit';
type CreateStep = 'details' | 'activities' | 'assign';

interface Profile {
  id: number;
  name: string;
  avatar_emoji?: string;
  avatar_url?: string;
  role: 'parent' | 'child';
}

const ActivityBuilder: React.FC = () => {
  const { currentProfile } = useProfile();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sessions, setSessions] = useState<LearningSession[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [children, setChildren] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create form state
  const [createStep, setCreateStep] = useState<CreateStep>('details');
  const [formData, setFormData] = useState({
    title: '',
    topic: '',
    pointsPerActivity: 20,
    bonusPoints: 50,
    passThreshold: 70,
    isCompetition: false,
    assignedTo: [] as number[]
  });

  // AI generation state
  const [aiForm, setAiForm] = useState({
    topic: '',
    targetAge: 8,
    activityCount: 5,
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    selectedTypes: [] as string[],
    customInstructions: '',
    assignedTo: [] as number[],
    textProvider: 'ollama' as 'ollama' | 'gemini' | 'grok' | 'openai',
    pointsPerActivity: 20
  });
  const [aiJob, setAiJob] = useState<AiGenerationJob | null>(null);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  // Load data
  useEffect(() => {
    if (currentProfile?.id) {
      loadData();
    }
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentProfile?.id]);

  const loadData = async () => {
    if (!currentProfile?.id) return;

    try {
      setLoading(true);
      setError(null);

      const [sessionsRes, typesRes, childrenRes] = await Promise.all([
        activitiesAPI.getCreatedSessions(currentProfile.id),
        activitiesAPI.getActivityTypes(),
        rewardsAPI.getParentChildren(currentProfile.id)
      ]);

      setSessions(sessionsRes.data);
      setActivityTypes(typesRes.data);

      // Get children from rewards API
      const childProfiles = (childrenRes.data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        avatar_emoji: c.avatar,
        role: 'child' as const
      }));
      setChildren(childProfiles);
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    if (!currentProfile?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Create session for each assigned child
      for (const childId of formData.assignedTo) {
        await activitiesAPI.createSession({
          title: formData.title,
          topic: formData.topic,
          createdBy: currentProfile.id,
          assignedTo: childId,
          pointsPerActivity: formData.pointsPerActivity,
          bonusPoints: formData.bonusPoints,
          passThreshold: formData.passThreshold,
          isCompetition: formData.isCompetition
        });
      }

      setSuccess('Learning session created successfully!');
      resetForm();
      loadData();
      setViewMode('list');
    } catch (err: any) {
      console.error('Failed to create session:', err);
      setError('Failed to create session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartAiGeneration = async () => {
    if (!currentProfile?.id || aiForm.assignedTo.length === 0) return;

    try {
      setLoading(true);
      setError(null);

      // Start AI generation for first child
      const request: AiGenerationRequest = {
        topic: aiForm.topic,
        targetAge: aiForm.targetAge,
        activityCount: aiForm.activityCount,
        difficulty: aiForm.difficulty,
        preferredTypes: aiForm.selectedTypes.length > 0 ? aiForm.selectedTypes : undefined,
        customInstructions: aiForm.customInstructions || undefined,
        createdBy: currentProfile.id,
        assignedTo: aiForm.assignedTo[0],
        textProvider: aiForm.textProvider,
        pointsPerActivity: aiForm.pointsPerActivity
      };

      const response = await activitiesAPI.startAiGeneration(request);
      setAiJob({ jobId: response.data.jobId, status: 'pending', progress: 0 });

      // Start polling
      const interval = setInterval(() => pollAiJob(response.data.jobId), 2000);
      setPollInterval(interval);
    } catch (err: any) {
      console.error('Failed to start AI generation:', err);
      setError(err.response?.data?.error || 'Failed to start AI generation.');
      setLoading(false);
    }
  };

  const pollAiJob = async (jobId: string) => {
    try {
      const response = await activitiesAPI.pollAiGeneration(jobId);
      setAiJob(response.data);

      if (response.data.status === 'completed') {
        if (pollInterval) clearInterval(pollInterval);
        setPollInterval(null);
        setLoading(false);
        setSuccess('Learning activities generated successfully!');

        // Create sessions for additional assigned children
        if (aiForm.assignedTo.length > 1 && response.data.sessionId) {
          // Duplicate for other children
          for (let i = 1; i < aiForm.assignedTo.length; i++) {
            try {
              await activitiesAPI.duplicateSession(response.data.sessionId, aiForm.assignedTo[i]);
            } catch (err) {
              console.error('Failed to duplicate for child:', err);
            }
          }
        }

        resetAiForm();
        loadData();
        setViewMode('list');
      } else if (response.data.status === 'failed') {
        if (pollInterval) clearInterval(pollInterval);
        setPollInterval(null);
        setLoading(false);
        setError(response.data.error || 'AI generation failed. Please try again.');
        setAiJob(null);
      }
    } catch (err: any) {
      console.error('Failed to poll AI job:', err);
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (!confirm('Are you sure you want to delete this learning session?')) return;

    try {
      await activitiesAPI.deleteSession(sessionId);
      setSuccess('Session deleted successfully!');
      loadData();
    } catch (err: any) {
      console.error('Failed to delete session:', err);
      setError('Failed to delete session. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      topic: '',
      pointsPerActivity: 20,
      bonusPoints: 50,
      passThreshold: 70,
      isCompetition: false,
      assignedTo: []
    });
    setCreateStep('details');
  };

  const resetAiForm = () => {
    setAiForm({
      topic: '',
      targetAge: 8,
      activityCount: 5,
      difficulty: 'medium',
      selectedTypes: [],
      customInstructions: '',
      assignedTo: [],
      textProvider: 'ollama',
      pointsPerActivity: 20
    });
    setAiJob(null);
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (loading && viewMode === 'list' && sessions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-fuchsia-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  // LIST VIEW
  if (viewMode === 'list') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-fuchsia-100 p-4 pb-24">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 p-6 rounded-3xl text-white shadow-xl mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="w-7 h-7" />
            <h1 className="text-2xl font-black">Learning Activities</h1>
          </div>
          <p className="text-white/80 text-sm">Create educational activities for your children</p>
        </div>

        {/* Messages */}
        {success && (
          <div className="bg-green-100 border border-green-300 text-green-700 px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {success}
          </div>
        )}
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setViewMode('ai-generate')}
            className="bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex flex-col items-center gap-2"
          >
            <Sparkles className="w-8 h-8" />
            <span className="font-bold">AI Generate</span>
            <span className="text-xs text-white/70">Let AI create activities</span>
          </button>
          <button
            onClick={() => setViewMode('create')}
            className="bg-white text-purple-600 p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex flex-col items-center gap-2 border-2 border-purple-200"
          >
            <Plus className="w-8 h-8" />
            <span className="font-bold">Create Manual</span>
            <span className="text-xs text-purple-400">Build your own</span>
          </button>
        </div>

        {/* Sessions List */}
        <h2 className="text-lg font-bold text-gray-800 mb-4">Your Created Sessions</h2>

        {sessions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-lg">
            <div className="text-6xl mb-4">📚</div>
            <p className="text-gray-600">No sessions created yet!</p>
            <p className="text-gray-400 text-sm mt-2">
              Use AI Generate to quickly create engaging activities.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map(session => (
              <div key={session.id} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-gray-800">{session.title}</h3>
                      <p className="text-sm text-gray-500">{session.topic}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                      {session.activity_count || 0} activities
                    </span>
                    {session.is_ai_generated === 1 && (
                      <span className="px-2 py-1 bg-fuchsia-100 text-fuchsia-700 text-xs rounded-full flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> AI Generated
                      </span>
                    )}
                    {session.is_competition === 1 && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                        Competition
                      </span>
                    )}
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                      {session.pass_threshold}% to pass
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      Assigned to: <strong>{session.assigned_to_name || 'Unknown'}</strong>
                    </span>
                    <span className="text-gray-400">
                      {new Date(session.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // AI GENERATE VIEW
  if (viewMode === 'ai-generate') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-fuchsia-100 p-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => {
              setViewMode('list');
              resetAiForm();
              if (pollInterval) clearInterval(pollInterval);
            }}
            className="p-2 bg-white rounded-xl shadow hover:shadow-md transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">AI Activity Generator</h1>
            <p className="text-sm text-gray-500">Let AI create engaging activities</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* AI Generation Progress */}
        {aiJob && aiJob.status !== 'completed' && aiJob.status !== 'failed' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
              <div>
                <p className="font-bold text-gray-800">Generating Activities...</p>
                <p className="text-sm text-gray-500">{aiJob.message || 'Please wait...'}</p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-full h-3 transition-all"
                style={{ width: `${aiJob.progress || 10}%` }}
              />
            </div>
          </div>
        )}

        {/* Form */}
        {!aiJob && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
            {/* Topic */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What topic should we teach?
              </label>
              <input
                type="text"
                value={aiForm.topic}
                onChange={(e) => setAiForm({ ...aiForm, topic: e.target.value })}
                placeholder="e.g., Dinosaurs, Solar System, Fractions..."
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
              />
            </div>

            {/* Target Age */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Age: {aiForm.targetAge} years
              </label>
              <input
                type="range"
                min="4"
                max="14"
                value={aiForm.targetAge}
                onChange={(e) => setAiForm({ ...aiForm, targetAge: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>4</span>
                <span>14</span>
              </div>
            </div>

            {/* Activity Count */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Activities: {aiForm.activityCount}
              </label>
              <input
                type="range"
                min="3"
                max="10"
                value={aiForm.activityCount}
                onChange={(e) => setAiForm({ ...aiForm, activityCount: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Difficulty Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['easy', 'medium', 'hard'] as const).map(level => (
                  <button
                    key={level}
                    onClick={() => setAiForm({ ...aiForm, difficulty: level })}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      aiForm.difficulty === level
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <span className="capitalize font-medium">{level}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Points Per Activity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Points Per Correct Answer: {aiForm.pointsPerActivity}
              </label>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={aiForm.pointsPerActivity}
                onChange={(e) => setAiForm({ ...aiForm, pointsPerActivity: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>5</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>

            {/* AI Provider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                AI Provider
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'ollama', name: 'Ollama', desc: 'Local (Free)', icon: '🏠' },
                  { id: 'gemini', name: 'Gemini', desc: 'Google AI', icon: '✨' },
                  { id: 'grok', name: 'Grok', desc: 'xAI', icon: '🚀' },
                  { id: 'openai', name: 'OpenAI', desc: 'GPT-4', icon: '🤖' }
                ] as const).map(provider => (
                  <button
                    key={provider.id}
                    onClick={() => setAiForm({ ...aiForm, textProvider: provider.id })}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      aiForm.textProvider === provider.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{provider.icon}</span>
                      <div>
                        <div className="font-medium text-gray-800">{provider.name}</div>
                        <div className="text-xs text-gray-500">{provider.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Activity Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Activity Types (optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {activityTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => {
                      const selected = aiForm.selectedTypes.includes(type.name)
                        ? aiForm.selectedTypes.filter(t => t !== type.name)
                        : [...aiForm.selectedTypes, type.name];
                      setAiForm({ ...aiForm, selectedTypes: selected });
                    }}
                    className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-all ${
                      aiForm.selectedTypes.includes(type.name)
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span>{type.icon}</span>
                    <span>{type.display_name}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to let AI choose the best types
              </p>
            </div>

            {/* Custom Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Instructions (optional)
              </label>
              <textarea
                value={aiForm.customInstructions}
                onChange={(e) => setAiForm({ ...aiForm, customInstructions: e.target.value })}
                placeholder="Any specific requirements? e.g., Focus on vocabulary, include images, make it fun..."
                rows={3}
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none resize-none"
              />
            </div>

            {/* Assign To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign To
              </label>
              {children.length === 0 ? (
                <p className="text-gray-500 text-sm">No children in your family yet.</p>
              ) : (
                <div className="space-y-2">
                  {children.map(child => (
                    <label
                      key={child.id}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        aiForm.assignedTo?.includes(child.id)
                          ? 'bg-purple-100 border-2 border-purple-400'
                          : 'bg-gray-50 border-2 border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={aiForm.assignedTo?.includes(child.id) || false}
                        onChange={(e) => {
                          const current = aiForm.assignedTo || [];
                          const updated = e.target.checked
                            ? [...current, child.id]
                            : current.filter((id: number) => id !== child.id);
                          setAiForm({ ...aiForm, assignedTo: updated } as any);
                        }}
                        className="sr-only"
                      />
                      <span className="text-2xl">
                        {child.avatar_emoji || '👤'}
                      </span>
                      <span className="font-medium">{child.name}</span>
                      {aiForm.assignedTo?.includes(child.id) && (
                        <CheckCircle className="w-5 h-5 text-purple-600 ml-auto" />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={handleStartAiGeneration}
              disabled={!aiForm.topic || !aiForm.assignedTo?.length || loading}
              className={`w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                aiForm.topic && aiForm.assignedTo?.length
                  ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg hover:shadow-xl'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-6 h-6" />
              Generate Activities
            </button>
          </div>
        )}
      </div>
    );
  }

  // MANUAL CREATE VIEW
  if (viewMode === 'create') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-fuchsia-100 p-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => {
              setViewMode('list');
              resetForm();
            }}
            className="p-2 bg-white rounded-xl shadow hover:shadow-md transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Create Session</h1>
            <p className="text-sm text-gray-500">Step {createStep === 'details' ? '1' : createStep === 'activities' ? '2' : '3'} of 3</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6 px-4">
          {['details', 'activities', 'assign'].map((step, i) => (
            <React.Fragment key={step}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  createStep === step
                    ? 'bg-purple-600 text-white'
                    : i < ['details', 'activities', 'assign'].indexOf(createStep)
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && (
                <div className={`flex-1 h-1 mx-2 ${
                  i < ['details', 'activities', 'assign'].indexOf(createStep)
                    ? 'bg-green-500'
                    : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          {/* Step 1: Details */}
          {createStep === 'details' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Session Details</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Space Adventure Quiz"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                <input
                  type="text"
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  placeholder="e.g., The Solar System"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Points/Activity</label>
                  <input
                    type="number"
                    value={formData.pointsPerActivity}
                    onChange={(e) => setFormData({ ...formData, pointsPerActivity: parseInt(e.target.value) })}
                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pass Threshold %</label>
                  <input
                    type="number"
                    value={formData.passThreshold}
                    onChange={(e) => setFormData({ ...formData, passThreshold: parseInt(e.target.value) })}
                    min={0}
                    max={100}
                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isCompetition}
                  onChange={(e) => setFormData({ ...formData, isCompetition: e.target.checked })}
                  className="w-5 h-5 rounded text-purple-600"
                />
                <div>
                  <span className="font-medium">Competition Mode</span>
                  <p className="text-sm text-gray-500">Enable leaderboard for all assigned children</p>
                </div>
              </label>

              <button
                onClick={() => setCreateStep('activities')}
                disabled={!formData.title || !formData.topic}
                className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                  formData.title && formData.topic
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Next <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Step 2: Activities (placeholder for manual creation) */}
          {createStep === 'activities' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Add Activities</h2>

              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-800">
                <p className="font-medium mb-2">Manual activity creation coming soon!</p>
                <p className="text-sm">
                  For now, use AI Generate for a better experience, or skip this step to create an empty session.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCreateStep('details')}
                  className="flex-1 py-3 rounded-xl font-bold bg-gray-100 text-gray-700 flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" /> Back
                </button>
                <button
                  onClick={() => setCreateStep('assign')}
                  className="flex-1 py-3 rounded-xl font-bold bg-purple-600 text-white flex items-center justify-center gap-2"
                >
                  Next <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Assign */}
          {createStep === 'assign' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Assign to Children</h2>

              {children.length === 0 ? (
                <p className="text-gray-500">No children in your family yet.</p>
              ) : (
                <div className="space-y-2">
                  {children.map(child => (
                    <label
                      key={child.id}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        formData.assignedTo.includes(child.id)
                          ? 'bg-purple-100 border-2 border-purple-400'
                          : 'bg-gray-50 border-2 border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.assignedTo.includes(child.id)}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...formData.assignedTo, child.id]
                            : formData.assignedTo.filter(id => id !== child.id);
                          setFormData({ ...formData, assignedTo: updated });
                        }}
                        className="sr-only"
                      />
                      <span className="text-2xl">{child.avatar_emoji || '👤'}</span>
                      <span className="font-medium">{child.name}</span>
                      {formData.assignedTo.includes(child.id) && (
                        <CheckCircle className="w-5 h-5 text-purple-600 ml-auto" />
                      )}
                    </label>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setCreateStep('activities')}
                  className="flex-1 py-3 rounded-xl font-bold bg-gray-100 text-gray-700 flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" /> Back
                </button>
                <button
                  onClick={handleCreateSession}
                  disabled={formData.assignedTo.length === 0 || loading}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                    formData.assignedTo.length > 0
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-5 h-5" /> Create Session
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default ActivityBuilder;
