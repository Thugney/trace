import { useState, useEffect, useRef } from 'react';
import { useProfile } from '../context/ProfileContext';
import { aiAPI } from '../services/api';
import { AIConversation } from '../types';
import { Send, Sparkles, Trash2, Lightbulb, Info } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

interface MessageCount {
  messagesUsed: number;
  messagesLimit: number;
  messagesRemaining: number;
  limitType: 'limited' | 'extended' | 'unlimited';
  aiEnabled: boolean;
}

export default function AIAssistant() {
  const { currentProfile, isParent } = useProfile();
  const [message, setMessage] = useState('');
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [context, setContext] = useState<'diet' | 'tasks' | 'general'>('general');
  const [apiStatus, setApiStatus] = useState<{ apiConfigured: boolean; fallbackMode: boolean } | null>(null);
  const [messageCount, setMessageCount] = useState<MessageCount | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAPIStatus();
  }, []);

  useEffect(() => {
    if (currentProfile) {
      loadMessageCount();
    }
  }, [currentProfile]);

  useEffect(() => {
    if (currentProfile) {
      loadConversations();
    }
  }, [currentProfile, context]);

  useEffect(() => {
    scrollToBottom();
  }, [conversations, streamingMessage]);

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

  const loadMessageCount = async () => {
    if (!currentProfile) return;
    try {
      const response = await aiAPI.getMessageCount(currentProfile.id);
      setMessageCount(response.data);
    } catch (error) {
      console.error('Failed to load message count:', error);
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

    const userMessage = message.trim();

    // Prevent sending duplicate messages
    const lastConv = conversations[conversations.length - 1];
    if (lastConv && lastConv.user_message === userMessage && Date.now() - new Date(lastConv.created_at).getTime() < 5000) {
      console.log('[AI Chat] Blocked duplicate message within 5 seconds');
      return;
    }

    setMessage('');
    setLoading(true);
    setStreamingMessage('');

    // Add user message to UI immediately
    const tempConversation: AIConversation = {
      id: Date.now(),
      profile_id: currentProfile.id,
      context: context,
      user_message: userMessage,
      ai_response: '',
      created_at: new Date().toISOString()
    };

    setConversations(prev => [...prev, tempConversation]);

    try {
      // Use EventSource for streaming
      const eventSource = new EventSource(
        `${API_URL || ''}/api/ai/chat?profile_id=${currentProfile.id}&message=${encodeURIComponent(userMessage)}&context=${context}`
      );

      let fullResponse = '';

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.done) {
            // Stream complete
            eventSource.close();
            setLoading(false);
            setStreamingMessage('');

            // Reload conversations to get the saved one
            loadConversations();
            // Reload message count to update remaining
            loadMessageCount();
          } else if (data.content) {
            // Append new token
            fullResponse += data.content;
            setStreamingMessage(fullResponse);
          } else if (data.error) {
            // Error occurred
            console.error('[AI Chat Streaming] Error:', data.error);
            eventSource.close();
            setLoading(false);
            setStreamingMessage('');

            // Show error
            setConversations(prev => [...prev.slice(0, -1), {
              ...tempConversation,
              ai_response: `❌ Error: ${data.error}`
            }]);
          }
        } catch (error) {
          console.error('[AI Chat Streaming] Parse error:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[AI Chat Streaming] Connection error:', error);
        eventSource.close();
        setLoading(false);
        setStreamingMessage('');

        // Show error message
        setConversations(prev => [...prev.slice(0, -1), {
          ...tempConversation,
          ai_response: '❌ Error: Failed to connect to AI service'
        }]);
      };

    } catch (error: any) {
      console.error('[AI Chat Frontend] Error:', error);
      setLoading(false);
      setStreamingMessage('');

      const errorMsg = error.response?.data?.details ||
                      error.response?.data?.error ||
                      'Failed to get AI response. Please try again.';

      setConversations(prev => [...prev.slice(0, -1), {
        ...tempConversation,
        ai_response: `❌ Error: ${errorMsg}`
      }]);
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

  if (!currentProfile) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Please select a profile to use the AI Assistant.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="text-purple-600" size={24} />
            <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
          </div>
          <div className="flex items-center space-x-2">
            {/* Message count indicator */}
            {messageCount && messageCount.limitType !== 'unlimited' && (
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                messageCount.messagesRemaining > 3
                  ? 'bg-blue-100 text-blue-800'
                  : messageCount.messagesRemaining > 0
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-red-100 text-red-800'
              }`}>
                {messageCount.messagesRemaining > 0
                  ? `${messageCount.messagesRemaining} messages left today`
                  : 'No messages left today'}
              </div>
            )}
            {apiStatus && (
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                apiStatus.apiConfigured ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {apiStatus.apiConfigured ? '✓ AI Powered' : '⚡ Limited Mode'}
              </div>
            )}
          </div>
        </div>

        {/* Context Selector */}
        <div className="flex space-x-2">
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
          <button
            onClick={handleClearHistory}
            className="ml-auto btn btn-secondary flex items-center space-x-2"
            title="Clear chat history"
          >
            <Trash2 size={16} />
            <span className="hidden sm:inline">Clear History</span>
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {conversations.map((conv) => (
          <div key={conv.id} className="space-y-2">
            {/* User Message */}
            <div className="flex justify-end">
              <div className="bg-primary-600 text-white rounded-lg px-4 py-2 max-w-[80%]">
                <p className="text-sm">{conv.user_message}</p>
              </div>
            </div>

            {/* AI Response */}
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 max-w-[80%]">
                <div className="flex items-start space-x-2">
                  <Sparkles className="text-purple-600 mt-1 flex-shrink-0" size={16} />
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{conv.ai_response}</p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Streaming Message */}
        {streamingMessage && (
          <div className="space-y-2">
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 max-w-[80%]">
                <div className="flex items-start space-x-2">
                  <Sparkles className="text-purple-600 mt-1 flex-shrink-0 animate-pulse" size={16} />
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{streamingMessage}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && !streamingMessage && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <div className="flex items-center space-x-2">
                <div className="spinner"></div>
                <span className="text-sm text-gray-600">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      {conversations.length === 0 && (
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Lightbulb size={18} className="text-primary-600" />
            <h3 className="font-medium text-gray-900">Quick Prompts</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {quickPrompts.map((prompt, index) => (
              <button
                key={index}
                onClick={() => setMessage(prompt)}
                className="text-left text-sm px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        {/* Limit reached warning */}
        {messageCount && messageCount.messagesRemaining <= 0 && messageCount.limitType !== 'unlimited' && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <Info size={16} className="text-red-600 mt-0.5" />
              <p className="text-sm text-red-800">
                <strong>Daily limit reached!</strong> You've used all {messageCount.messagesLimit} messages for today.
                Your limit will reset tomorrow.
              </p>
            </div>
          </div>
        )}
        <div className="flex space-x-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder={messageCount && messageCount.messagesRemaining <= 0 && messageCount.limitType !== 'unlimited'
              ? "Daily message limit reached..."
              : "Type your message..."}
            className="input flex-1"
            disabled={loading || (messageCount?.messagesRemaining === 0 && messageCount?.limitType !== 'unlimited')}
          />
          <button
            onClick={handleSendMessage}
            disabled={loading || !message.trim() || (messageCount?.messagesRemaining === 0 && messageCount?.limitType !== 'unlimited')}
            className="btn btn-primary"
          >
            <Send size={20} />
          </button>
        </div>

        {apiStatus && !apiStatus.apiConfigured && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <Info size={16} className="text-blue-600 mt-0.5" />
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> AI responses are powered by Grok. Make sure your API key is configured in the settings. The AI provides suggestions but always use your own judgment.
              </p>
            </div>
          </div>
        )}

        {/* Cost indicator */}
        <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
          💰 ~$0.001-$0.01 per message (text generation only)
        </div>
      </div>
    </div>
  );
}
