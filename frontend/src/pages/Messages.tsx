import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { messagesAPI } from '../services/api';
import type { Message, Profile } from '../types';
import { Mail, MailOpen, Send, X, Inbox, SendHorizontal, Trash2 } from 'lucide-react';

export default function Messages() {
  const { currentProfile } = useProfile();
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [parents, setParents] = useState<Profile[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (currentProfile) {
      loadMessages();
      loadUnreadCount();
      if (currentProfile.type === 'teacher') {
        loadParents();
      }
    }
  }, [currentProfile, activeTab]);

  const loadMessages = async () => {
    if (!currentProfile) return;
    setLoading(true);
    try {
      const response = activeTab === 'inbox'
        ? await messagesAPI.getInbox(currentProfile.id)
        : await messagesAPI.getSent(currentProfile.id);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    if (!currentProfile) return;
    try {
      const response = await messagesAPI.getUnreadCount(currentProfile.id);
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const loadParents = async () => {
    try {
      const response = await messagesAPI.getParents();
      setParents(response.data);
    } catch (error) {
      console.error('Failed to load parents:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || !selectedRecipient || !messageText.trim()) return;

    try {
      await messagesAPI.sendMessage(
        currentProfile.id,
        selectedRecipient,
        messageText,
        subject || undefined
      );
      setShowCompose(false);
      setSelectedRecipient(null);
      setSubject('');
      setMessageText('');
      loadMessages();
    } catch (error: any) {
      console.error('Failed to send message:', error);
      alert(error.response?.data?.error || 'Failed to send message. Please try again.');
    }
  };

  const handleMarkAsRead = async (messageId: number) => {
    try {
      await messagesAPI.markAsRead(messageId);
      loadMessages();
      loadUnreadCount();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      await messagesAPI.deleteMessage(messageId);
      loadMessages();
      loadUnreadCount();
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  if (!currentProfile) {
    return <div className="p-8 text-center">Please log in to view messages.</div>;
  }

  if (currentProfile.type !== 'teacher' && currentProfile.type !== 'parent') {
    return <div className="p-8 text-center">Messages are only available for teachers and parents.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600 mt-1">
            {currentProfile.type === 'teacher' ? 'Communicate with parents' : 'Messages from teachers'}
          </p>
        </div>
        {currentProfile.type === 'teacher' && (
          <button
            onClick={() => setShowCompose(true)}
            className="btn btn-primary flex items-center"
          >
            <Send size={20} className="mr-2" />
            New Message
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`flex-1 flex items-center justify-center py-2 px-4 rounded-md transition-colors ${
            activeTab === 'inbox'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Inbox size={18} className="mr-2" />
          Inbox
          {unreadCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`flex-1 flex items-center justify-center py-2 px-4 rounded-md transition-colors ${
            activeTab === 'sent'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <SendHorizontal size={18} className="mr-2" />
          Sent
        </button>
      </div>

      {/* Messages List */}
      {loading ? (
        <div className="text-center py-8">Loading messages...</div>
      ) : messages.length === 0 ? (
        <div className="card p-8 text-center">
          <Mail size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">
            {activeTab === 'inbox' ? 'No messages in your inbox' : 'No sent messages'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`card p-4 ${!message.is_read && activeTab === 'inbox' ? 'border-l-4 border-blue-500 bg-blue-50' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {activeTab === 'inbox' && !message.is_read ? (
                      <Mail size={18} className="text-blue-600" />
                    ) : (
                      <MailOpen size={18} className="text-gray-400" />
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">
                        {activeTab === 'inbox' ? message.sender_name : message.recipient_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {activeTab === 'inbox' ? message.sender_type : message.recipient_type}
                      </p>
                    </div>
                  </div>

                  {message.subject && (
                    <h3 className="font-semibold text-gray-900 mb-1">{message.subject}</h3>
                  )}

                  <p className="text-gray-700 mb-2">{message.message}</p>

                  <p className="text-xs text-gray-500">
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {activeTab === 'inbox' && !message.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(message.id)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Mark as Read
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteMessage(message.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compose Message Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">New Message</h2>
              <button
                onClick={() => {
                  setShowCompose(false);
                  setSelectedRecipient(null);
                  setSubject('');
                  setMessageText('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedRecipient || ''}
                  onChange={(e) => setSelectedRecipient(Number(e.target.value))}
                  className="input"
                  required
                >
                  <option value="">Select a parent...</option>
                  {parents.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject (optional)
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input"
                  placeholder="Enter subject..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="input"
                  rows={6}
                  placeholder="Type your message here..."
                  required
                />
              </div>

              <div className="flex space-x-3">
                <button type="submit" className="btn btn-primary flex-1">
                  <Send size={16} className="mr-2" />
                  Send Message
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCompose(false);
                    setSelectedRecipient(null);
                    setSubject('');
                    setMessageText('');
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
    </div>
  );
}
