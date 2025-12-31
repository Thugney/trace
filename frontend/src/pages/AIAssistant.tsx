import { useState, useEffect, useRef } from 'react';
import { useProfile } from '../context/ProfileContext';
import { aiAPI } from '../services/api';
import { AIConversation } from '../types';
import { Send, Sparkles, Trash2, Lightbulb, AlertCircle, Info } from 'lucide-react';

export default function AIAssistant() {
  const { currentProfile, isParent } = useProfile();
  const [message, setMessage] = useState('');
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<'diet' | 'tasks' | 'general'>('general');
  const [apiStatus, setApiStatus] = useState<{ apiConfigured: boolean; fallbackMode: boolean } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAPIStatus();
  }, []);

  useEffect(() => {
    if (currentProfile) {
      loadConversations();
    }
  }, [currentProfile, context]);

  useEffect(() => {
    scrollToBottom();
  }, [conversations]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const checkAPIStatus = async () => {
    try {
      const response = await aiAPI.getStatus();
      setApiStatus(response.data);
    } catch (error) {
      console.error('Failed to check API status:', error);
    }
  };

  const loadConversations = async () => {
    if (!currentProfile) return;

    try {
      const response = await aiAPI.getConversations(currentProfile.id, context, 20);
      setConversations(response.data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !currentProfile || loading) return;

    const userMessage = message;
    setMessage('');
    setLoading(true);

    try {
      await aiAPI.chat(currentProfile.id, userMessage, context);

      // Add new conversation
      await loadConversations();
    } catch (error: any) {
      console.error('AI chat failed:', error);
      const errorMsg = error.response?.data?.error || 'Failed to get AI response. Please check your API configuration.';
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!currentProfile) return;
    if (!confirm('Are you sure you want to clear chat history?')) return;

    try {
      await aiAPI.clearConversations(currentProfile.id, context);
      setConversations([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const quickPrompts = isParent
    ? [
        'Suggest healthy Norwegian breakfast ideas',
        'Create a weekly meal plan for a family of 4',
        'What chores are appropriate for a 7-year-old?',
        'How can I motivate my kids to do homework?'
      ]
    : [
        'Help me with my homework',
        'What healthy snacks can I have?',
        'Tell me something fun to learn today',
        'How can I earn more points?'
      ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Sparkles className="mr-3 text-primary-600" />
          AI Assistant
        </h1>
        <p className="text-gray-600 mt-1">
          {isParent
            ? 'Get personalized suggestions for meals, nutrition, and family management'
            : 'Ask me anything! I\'m here to help you learn and grow'}
        </p>
      </div>

      {/* API Status Banner */}
      {apiStatus?.fallbackMode && (
        <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
          <div className="flex items-start">
            <Info className="text-yellow-600 mr-3 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-yellow-800">Limited Mode Active</h3>
              <p className="text-sm text-yellow-700 mt-1">
                The AI is currently in limited mode with basic responses.
                {isParent && ' To enable full AI capabilities, please configure your Grok API key in Settings.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Context Selector */}
      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Chat Context
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setContext('general')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              context === 'general'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            General
          </button>
          {isParent && (
            <button
              onClick={() => setContext('diet')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                context === 'diet'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Diet & Nutrition
            </button>
          )}
          <button
            onClick={() => setContext('tasks')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              context === 'tasks'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Tasks & Activities
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Chat</h2>
          {conversations.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-sm text-red-600 hover:text-red-700 flex items-center"
            >
              <Trash2 size={16} className="mr-1" />
              Clear History
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="h-96 overflow-y-auto mb-4 space-y-4 p-4 bg-gray-50 rounded-lg">
          {conversations.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <Sparkles size={48} className="mx-auto mb-4 text-primary-300" />
              <p className="mb-2">No messages yet</p>
              <p className="text-sm">Start a conversation or try a quick prompt below</p>
            </div>
          ) : (
            <>
              {conversations.slice().reverse().map((conv, index) => (
                <div key={index}>
                  {/* User Message */}
                  <div className="flex justify-end mb-2">
                    <div className="bg-primary-600 text-white rounded-lg px-4 py-2 max-w-[80%]">
                      <p className="text-sm">{conv.user_message}</p>
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="flex justify-start">
                    <div className="bg-white border rounded-lg px-4 py-2 max-w-[80%]">
                      <div className="flex items-start space-x-2">
                        <Sparkles size={16} className="text-primary-600 mt-1 flex-shrink-0" />
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">
                          {conv.ai_response}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border rounded-lg px-4 py-2">
                    <div className="flex items-center space-x-2">
                      <div className="spinner"></div>
                      <span className="text-sm text-gray-600">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="flex space-x-2">
          <input
            type="text"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder="Type your message..."
            className="input flex-1"
            disabled={loading}
          />
          <button
            onClick={handleSendMessage}
            disabled={loading || !message.trim()}
            className="btn btn-primary"
          >
            <Send size={20} />
          </button>
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="card">
        <div className="flex items-center mb-3">
          <Lightbulb size={20} className="text-primary-600 mr-2" />
          <h3 className="font-semibold">Quick Prompts</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {quickPrompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => {
                setMessage(prompt);
              }}
              className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> AI responses are powered by Grok. Make sure your API key is
          configured in the settings. The AI provides suggestions but always use your own judgment.
        </p>
      </div>
    </div>
  );
}
