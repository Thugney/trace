import { useState, useEffect, useRef } from 'react';
import { useProfile } from '../context/ProfileContext';
import { notesAPI } from '../services/api';
import { Note } from '../types';
import { StickyNote, Plus, X, Edit2, Trash2, Save, Pin, Bold, Italic, List, ListOrdered, Heading } from 'lucide-react';
import DOMPurify from 'dompurify';

const NOTE_COLORS = [
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Purple', value: '#e9d5ff' },
  { name: 'Orange', value: '#fed7aa' }
];

// Simple markdown-to-HTML rendering with sanitization
const renderMarkdown = (text: string): string => {
  if (!text) return '';
  const html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h4 class="font-bold text-base mt-2 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-bold text-lg mt-2 mb-1">$1</h3>')
    .replace(/^- (.+)$/gm, '<li class="ml-4">• $1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/\n/g, '<br/>');
  // Sanitize HTML to prevent XSS attacks
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['strong', 'em', 'h3', 'h4', 'li', 'br'], ALLOWED_ATTR: ['class'] });
};

// Formatting toolbar component
const FormatToolbar = ({ textareaRef }: { textareaRef: React.RefObject<HTMLTextAreaElement | null> }) => {
  const insertFormat = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const newText = text.substring(0, start) + before + selectedText + after + text.substring(end);

    textarea.value = newText;
    textarea.focus();
    textarea.setSelectionRange(start + before.length, end + before.length);

    // Trigger change event
    const event = new Event('input', { bubbles: true });
    textarea.dispatchEvent(event);
  };

  return (
    <div className="flex gap-1 mb-2 flex-wrap">
      <button
        type="button"
        onClick={() => insertFormat('**', '**')}
        className="p-2 rounded hover:bg-gray-100 border"
        title="Bold"
      >
        <Bold size={16} />
      </button>
      <button
        type="button"
        onClick={() => insertFormat('*', '*')}
        className="p-2 rounded hover:bg-gray-100 border"
        title="Italic"
      >
        <Italic size={16} />
      </button>
      <button
        type="button"
        onClick={() => insertFormat('## ')}
        className="p-2 rounded hover:bg-gray-100 border"
        title="Heading"
      >
        <Heading size={16} />
      </button>
      <button
        type="button"
        onClick={() => insertFormat('- ')}
        className="p-2 rounded hover:bg-gray-100 border"
        title="Bullet list"
      >
        <List size={16} />
      </button>
      <button
        type="button"
        onClick={() => insertFormat('1. ')}
        className="p-2 rounded hover:bg-gray-100 border"
        title="Numbered list"
      >
        <ListOrdered size={16} />
      </button>
    </div>
  );
};

export default function Notes() {
  const { currentProfile } = useProfile();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddNote, setShowAddNote] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const addTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (currentProfile) {
      loadNotes();
    }
  }, [currentProfile]);

  const loadNotes = async () => {
    if (!currentProfile) return;

    try {
      setLoading(true);
      const response = await notesAPI.getByProfile(currentProfile.id);
      setNotes(response.data);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentProfile) return;

    const formData = new FormData(e.currentTarget);

    try {
      await notesAPI.create({
        profile_id: currentProfile.id,
        title: formData.get('title') as string,
        content: formData.get('content') as string,
        color: formData.get('color') as string
      });

      setShowAddNote(false);
      await loadNotes();
    } catch (error) {
      console.error('Failed to create note:', error);
      alert('Failed to create note. Please try again.');
    }
  };

  const handleUpdateNote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingNote) return;

    const formData = new FormData(e.currentTarget);

    try {
      await notesAPI.update(editingNote.id, {
        title: formData.get('title') as string,
        content: formData.get('content') as string,
        color: formData.get('color') as string
      });

      await loadNotes();
      setEditingNote(null);
    } catch (error) {
      console.error('Failed to update note:', error);
      alert('Failed to update note');
    }
  };

  const handleDeleteNote = async (id: number) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      await notesAPI.delete(id);
      await loadNotes();
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert('Failed to delete note');
    }
  };

  const handleTogglePin = async (note: Note) => {
    try {
      await notesAPI.update(note.id, {
        is_pinned: note.is_pinned ? 0 : 1
      });
      await loadNotes();
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  // Sort notes: pinned first, then by updated_at
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  if (!currentProfile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please select a profile first</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <StickyNote className="mr-3 text-primary-600" />
            My Notes
          </h1>
          <p className="text-gray-600 mt-1">
            {currentProfile.name}'s personal notes
          </p>
        </div>
        <button
          onClick={() => setShowAddNote(true)}
          className="btn btn-primary"
        >
          <Plus size={20} className="mr-2" />
          New Note
        </button>
      </div>

      {/* Notes Grid */}
      {sortedNotes.length === 0 ? (
        <div className="card text-center p-12">
          <StickyNote size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Notes Yet</h3>
          <p className="text-gray-600 mb-4">
            Create your first note to get started!
          </p>
          <button
            onClick={() => setShowAddNote(true)}
            className="btn btn-primary"
          >
            <Plus size={20} className="mr-2" />
            Create Note
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedNotes.map(note => (
            <div
              key={note.id}
              className={`p-4 rounded-xl shadow-md hover:shadow-lg transition-all relative group ${note.is_pinned ? 'ring-2 ring-yellow-500' : ''}`}
              style={{ backgroundColor: note.color }}
            >
              {note.is_pinned && (
                <div className="absolute -top-2 -right-2 bg-yellow-500 rounded-full p-1 shadow">
                  <Pin size={14} className="text-white" />
                </div>
              )}
              <h3 className="font-bold text-gray-900 pr-2 line-clamp-2 text-lg mb-2">
                {note.title}
              </h3>
              <div
                className="text-sm text-gray-700 line-clamp-6 prose prose-sm"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content) }}
              />
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-black/10">
                <p className="text-xs text-gray-600">
                  {new Date(note.updated_at).toLocaleDateString()}
                </p>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleTogglePin(note)}
                    className={`p-2 hover:bg-white/50 rounded-lg transition-colors ${note.is_pinned ? 'bg-yellow-200' : ''}`}
                    title={note.is_pinned ? 'Unpin note' : 'Pin note'}
                    aria-label={note.is_pinned ? 'Unpin note' : 'Pin note'}
                  >
                    <Pin size={18} className={note.is_pinned ? 'text-yellow-600' : 'text-gray-500'} />
                  </button>
                  <button
                    onClick={() => setEditingNote(note)}
                    className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                    title="Edit note"
                    aria-label="Edit note"
                  >
                    <Edit2 size={18} className="text-gray-700" />
                  </button>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                    title="Delete note"
                    aria-label="Delete note"
                  >
                    <Trash2 size={18} className="text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Note Modal */}
      {showAddNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-2xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">New Note</h2>
              <button
                onClick={() => setShowAddNote(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddNote} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  className="input"
                  placeholder="Note title..."
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                <FormatToolbar textareaRef={addTextareaRef} />
                <textarea
                  ref={addTextareaRef}
                  name="content"
                  className="input min-h-[200px] font-mono"
                  placeholder="Write your note here... Use **bold**, *italic*, ## Heading, - list"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supports: **bold**, *italic*, ## Heading, - bullet list, 1. numbered list
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pick a Color
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {NOTE_COLORS.map(color => (
                    <label
                      key={color.value}
                      className="relative cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="color"
                        value={color.value}
                        defaultChecked={color.value === '#fef08a'}
                        className="sr-only peer"
                      />
                      <div
                        className="w-full h-12 sm:h-10 rounded-xl border-3 border-transparent peer-checked:border-gray-900 peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-gray-400 transition-all flex items-center justify-center"
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      >
                        <span className="text-xs font-medium text-gray-700 sm:hidden">{color.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  <Save size={20} className="mr-2" />
                  Create Note
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddNote(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Note Modal */}
      {editingNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-2xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Edit Note</h2>
              <button
                onClick={() => setEditingNote(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdateNote} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  defaultValue={editingNote.title}
                  className="input"
                  placeholder="Note title..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                <FormatToolbar textareaRef={editTextareaRef} />
                <textarea
                  ref={editTextareaRef}
                  name="content"
                  defaultValue={editingNote.content}
                  className="input min-h-[200px] font-mono"
                  placeholder="Write your note here... Use **bold**, *italic*, ## Heading, - list"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supports: **bold**, *italic*, ## Heading, - bullet list, 1. numbered list
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pick a Color
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {NOTE_COLORS.map(color => (
                    <label
                      key={color.value}
                      className="relative cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="color"
                        value={color.value}
                        defaultChecked={color.value === editingNote.color}
                        className="sr-only peer"
                      />
                      <div
                        className="w-full h-12 sm:h-10 rounded-xl border-3 border-transparent peer-checked:border-gray-900 peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-gray-400 transition-all flex items-center justify-center"
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      >
                        <span className="text-xs font-medium text-gray-700 sm:hidden">{color.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  <Save size={20} className="mr-2" />
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
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
