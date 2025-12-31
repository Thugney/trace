import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { notesAPI } from '../services/api';
import { Note } from '../types';
import { StickyNote, Plus, X, Edit2, Trash2, Save } from 'lucide-react';

const NOTE_COLORS = [
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Purple', value: '#e9d5ff' },
  { name: 'Orange', value: '#fed7aa' }
];

export default function Notes() {
  const { currentProfile } = useProfile();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddNote, setShowAddNote] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

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

      await loadNotes();
      setShowAddNote(false);
      e.currentTarget.reset();
    } catch (error) {
      console.error('Failed to create note:', error);
      alert('Failed to create note');
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
      {notes.length === 0 ? (
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
          {notes.map(note => (
            <div
              key={note.id}
              className="p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow relative group"
              style={{ backgroundColor: note.color }}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-gray-900 flex-1 pr-2 line-clamp-2">
                  {note.title}
                </h3>
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditingNote(note)}
                    className="p-1 hover:bg-white/50 rounded"
                    title="Edit"
                  >
                    <Edit2 size={16} className="text-gray-700" />
                  </button>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="p-1 hover:bg-white/50 rounded"
                    title="Delete"
                  >
                    <Trash2 size={16} className="text-red-600" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-6">
                {note.content}
              </p>
              <p className="text-xs text-gray-500 mt-3">
                {new Date(note.updated_at).toLocaleDateString()}
              </p>
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
                <textarea
                  name="content"
                  className="input min-h-[200px]"
                  placeholder="Write your note here..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="grid grid-cols-6 gap-2">
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
                        className="w-full h-10 rounded-lg border-2 border-transparent peer-checked:border-gray-900 peer-checked:scale-110 transition-transform"
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
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
                <textarea
                  name="content"
                  defaultValue={editingNote.content}
                  className="input min-h-[200px]"
                  placeholder="Write your note here..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="grid grid-cols-6 gap-2">
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
                        className="w-full h-10 rounded-lg border-2 border-transparent peer-checked:border-gray-900 peer-checked:scale-110 transition-transform"
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
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
