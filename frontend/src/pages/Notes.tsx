import { useCallback, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { learnAPI, notesAPI } from '../services/api';
import { Note } from '../types';
import type { ParentAssignmentNote } from '../types/learn';
import { StickyNote, Plus, X, Edit2, Trash2, Save, Pin, Bold, Italic, List, ListOrdered, Heading, Filter, Bell, Clock, Tag, Users } from 'lucide-react';
import DOMPurify from 'dompurify';

const NOTE_CATEGORIES = [
  { name: 'School', icon: '📚', color: 'bg-blue-100 text-blue-700' },
  { name: 'Personal', icon: '📝', color: 'bg-green-100 text-green-700' },
  { name: 'Ideas', icon: '💡', color: 'bg-yellow-100 text-yellow-700' },
  { name: 'Homework', icon: '✏️', color: 'bg-purple-100 text-purple-700' },
  { name: 'Journal', icon: '📖', color: 'bg-pink-100 text-pink-700' },
  { name: 'Lists', icon: '📋', color: 'bg-orange-100 text-orange-700' }
];

const NOTE_COLORS = [
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Purple', value: '#e9d5ff' },
  { name: 'Orange', value: '#fed7aa' }
];

const NOTE_TEMPLATES = [
  {
    name: 'Blank',
    icon: '📄',
    title: '',
    content: '',
    category: ''
  },
  {
    name: 'Homework',
    icon: '✏️',
    title: 'Homework - [Subject]',
    content: `## Assignment
-

## Due Date

## Notes

`,
    category: 'Homework'
  },
  {
    name: 'Journal',
    icon: '📖',
    title: 'Journal Entry',
    content: `## Today's Date

## How I'm Feeling

## What Happened Today

## What I'm Grateful For
-
-
-

## Goals for Tomorrow

`,
    category: 'Journal'
  },
  {
    name: 'To-Do List',
    icon: '📋',
    title: 'My To-Do List',
    content: `## Priority Tasks
-
-
-

## Other Tasks
-
-

## Notes

`,
    category: 'Lists'
  },
  {
    name: 'Study Notes',
    icon: '📚',
    title: 'Study Notes - [Topic]',
    content: `## Key Concepts

## Important Terms
- **Term 1**: Definition
- **Term 2**: Definition

## Summary

## Questions to Review

`,
    category: 'School'
  }
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
  const profileId = currentProfile?.id;
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddNote, setShowAddNote] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [newNoteTags, setNewNoteTags] = useState<string[]>([]);
  const [editNoteTags, setEditNoteTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [editTagInput, setEditTagInput] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(NOTE_TEMPLATES[0]);
  const addTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const loadNotes = useCallback(async () => {
    if (!profileId) return;

    try {
      setLoading(true);
      const response = await notesAPI.getByProfile(
        profileId,
        selectedCategory !== 'all' ? selectedCategory : undefined,
        selectedTag !== 'all' ? selectedTag : undefined
      );
      setNotes(response.data);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedTag, profileId]);

  const loadTags = useCallback(async () => {
    if (!profileId) return;
    try {
      const response = await notesAPI.getTags(profileId);
      setAvailableTags(response.data);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  }, [profileId]);

  useEffect(() => {
    if (currentProfile) {
      loadNotes();
      loadTags();
    }
  }, [currentProfile, selectedCategory, selectedTag, loadNotes, loadTags]);

  // A child's parent notes on Learn assignments; absent when Learn is off
  const [assignmentNotes, setAssignmentNotes] = useState<ParentAssignmentNote[]>([]);
  const isChild = currentProfile?.type === 'child';
  useEffect(() => {
    if (!isChild) return;
    learnAPI.getAssignmentNotes()
      .then(response => setAssignmentNotes(response.data.notes))
      .catch(() => setAssignmentNotes([]));
  }, [isChild, profileId]);

  const addTag = (tag: string, isEdit: boolean = false) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (!trimmedTag) return;

    if (isEdit) {
      if (!editNoteTags.includes(trimmedTag)) {
        setEditNoteTags([...editNoteTags, trimmedTag]);
      }
      setEditTagInput('');
    } else {
      if (!newNoteTags.includes(trimmedTag)) {
        setNewNoteTags([...newNoteTags, trimmedTag]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string, isEdit: boolean = false) => {
    if (isEdit) {
      setEditNoteTags(editNoteTags.filter(t => t !== tag));
    } else {
      setNewNoteTags(newNoteTags.filter(t => t !== tag));
    }
  };

  const handleAddNote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentProfile) return;

    const formData = new FormData(e.currentTarget);
    const category = formData.get('category') as string;
    const reminder_at = formData.get('reminder_at') as string;

    try {
      await notesAPI.create({
        profile_id: currentProfile.id,
        title: formData.get('title') as string,
        content: formData.get('content') as string,
        color: formData.get('color') as string,
        category: category || undefined,
        reminder_at: reminder_at || undefined,
        tags: newNoteTags.length > 0 ? newNoteTags : undefined
      });

      setShowAddNote(false);
      setNewNoteTags([]);
      setTagInput('');
      await loadNotes();
      await loadTags();
    } catch (error) {
      console.error('Failed to create note:', error);
      alert('Failed to create note. Please try again.');
    }
  };

  const handleUpdateNote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingNote) return;

    const formData = new FormData(e.currentTarget);
    const category = formData.get('category') as string;
    const reminder_at = formData.get('reminder_at') as string;

    try {
      await notesAPI.update(editingNote.id, {
        title: formData.get('title') as string,
        content: formData.get('content') as string,
        color: formData.get('color') as string,
        category: category || undefined,
        reminder_at: reminder_at || undefined,
        tags: editNoteTags
      });

      await loadNotes();
      await loadTags();
      setEditingNote(null);
      setEditNoteTags([]);
      setEditTagInput('');
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

      {/* Category Filter */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Filter size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filter by category:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Notes
          </button>
          {NOTE_CATEGORIES.map(cat => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
                selectedCategory === cat.name
                  ? 'bg-gray-800 text-white'
                  : `${cat.color} hover:opacity-80`
              }`}
            >
              <span>{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tag Filter */}
      {availableTags.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Tag size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filter by tag:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedTag('all')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedTag === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
            >
              All Tags
            </button>
            {availableTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedTag === tag
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Parent notes on Learn assignments, read-only */}
      {assignmentNotes.length > 0 && (
        <section className="mb-4 rounded-2xl border border-primary-200 bg-primary-50 p-4" aria-labelledby="from-parents">
          <h2 id="from-parents" className="flex items-center gap-2 text-sm font-semibold text-primary-900">
            <Users size={16} aria-hidden="true" /> Fra forelder
          </h2>
          <ul className="mt-2 flex gap-3 overflow-x-auto pb-1">
            {assignmentNotes.map(note => (
              <li key={note.assignment_id} className="w-64 flex-none rounded-xl bg-white p-3 text-sm shadow-sm">
                <p className="text-xs font-semibold text-primary-800">{note.from_name} · {note.title}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-gray-900">{note.note}</p>
                {note.lesson_id && (
                  <Link to={`/learn/lessons/${note.lesson_id}`} className="mt-1 inline-block text-xs font-medium text-primary-700 underline">
                    Åpne leksjonen →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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
              <div className="mb-2 flex flex-wrap gap-1">
                {note.learn_lesson_id && note.learn_lesson_title && (() => {
                  const label = `📘 ${note.learn_subject_title ? `${note.learn_subject_title} · ` : ''}${note.learn_lesson_title}`;
                  const chipClass = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-white/70 text-primary-800';
                  // Link only to a lesson the viewer can still open
                  return note.learn_lesson_visible
                    ? <Link to={`/learn/lessons/${note.learn_lesson_id}`} className={`${chipClass} hover:underline`}>{label}</Link>
                    : <span className={chipClass}>{label}</span>;
                })()}
                {note.category && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    NOTE_CATEGORIES.find(c => c.name === note.category)?.color || 'bg-gray-100 text-gray-600'
                  }`}>
                    {NOTE_CATEGORIES.find(c => c.name === note.category)?.icon}
                    {note.category}
                  </span>
                )}
                {note.reminder_at && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    new Date(note.reminder_at) <= new Date() ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    <Bell size={12} />
                    {new Date(note.reminder_at).toLocaleDateString()}
                  </span>
                )}
                {/* Display tags */}
                {note.tags && (() => {
                  try {
                    const tags = JSON.parse(note.tags);
                    if (Array.isArray(tags) && tags.length > 0) {
                      return tags.slice(0, 3).map((tag: string) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
                        >
                          #{tag}
                        </span>
                      ));
                    }
                  } catch {
                    return null;
                  }
                  return null;
                })()}
              </div>
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
                    onClick={() => {
                      setEditingNote(note);
                      // Parse and set existing tags
                      try {
                        const tags = note.tags ? JSON.parse(note.tags) : [];
                        setEditNoteTags(Array.isArray(tags) ? tags : []);
                      } catch {
                        setEditNoteTags([]);
                      }
                    }}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="card max-w-2xl w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2 -mt-2 pt-2 z-10 border-b">
              <h2 className="text-2xl font-bold">New Note</h2>
              <button
                onClick={() => {
                  setShowAddNote(false);
                  setSelectedTemplate(NOTE_TEMPLATES[0]);
                  setNewNoteTags([]);
                  setTagInput('');
                }}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddNote} className="space-y-4 pb-2">
              {/* Template Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start with a Template
                </label>
                <div className="flex flex-wrap gap-2">
                  {NOTE_TEMPLATES.map((template) => (
                    <button
                      key={template.name}
                      type="button"
                      onClick={() => setSelectedTemplate(template)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                        selectedTemplate.name === template.name
                          ? 'bg-primary-600 text-white ring-2 ring-primary-300'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>{template.icon}</span>
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>

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
                  defaultValue={selectedTemplate.title}
                  key={selectedTemplate.name + '-title'}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <div className="flex flex-wrap gap-2" key={selectedTemplate.name + '-category'}>
                  <label className="cursor-pointer">
                    <input type="radio" name="category" value="" defaultChecked={!selectedTemplate.category} className="sr-only peer" />
                    <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 peer-checked:bg-gray-800 peer-checked:text-white transition-colors inline-block">
                      None
                    </span>
                  </label>
                  {NOTE_CATEGORIES.map(cat => (
                    <label key={cat.name} className="cursor-pointer">
                      <input type="radio" name="category" value={cat.name} defaultChecked={selectedTemplate.category === cat.name} className="sr-only peer" />
                      <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${cat.color} peer-checked:bg-gray-800 peer-checked:text-white transition-colors inline-flex items-center gap-1`}>
                        {cat.icon} {cat.name}
                      </span>
                    </label>
                  ))}
                </div>
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
                  defaultValue={selectedTemplate.content}
                  key={selectedTemplate.name + '-content'}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supports: **bold**, *italic*, ## Heading, - bullet list, 1. numbered list
                </p>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Tag size={16} className="inline mr-1" />
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {newNoteTags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-sm flex items-center gap-1"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-purple-900"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(tagInput);
                      }
                    }}
                    className="input flex-1"
                    placeholder="Add a tag and press Enter..."
                  />
                  <button
                    type="button"
                    onClick={() => addTag(tagInput)}
                    className="btn btn-secondary"
                  >
                    Add
                  </button>
                </div>
                {availableTags.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-gray-500">Existing tags: </span>
                    {availableTags.filter(t => !newNoteTags.includes(t)).slice(0, 5).map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addTag(tag)}
                        className="text-xs text-purple-600 hover:text-purple-800 mr-2"
                      >
                        +{tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reminder
                </label>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-gray-500" />
                  <input
                    type="date"
                    name="reminder_at"
                    min={new Date().toISOString().split('T')[0]}
                    className="input flex-1"
                    placeholder="Set a reminder date"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Get reminded about this note on a specific date
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
                  onClick={() => {
                    setShowAddNote(false);
                    setSelectedTemplate(NOTE_TEMPLATES[0]);
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

      {/* Edit Note Modal */}
      {editingNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="card max-w-2xl w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2 -mt-2 pt-2 z-10 border-b">
              <h2 className="text-2xl font-bold">Edit Note</h2>
              <button
                onClick={() => setEditingNote(null)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdateNote} className="space-y-4 pb-2">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer">
                    <input type="radio" name="category" value="" defaultChecked={!editingNote.category} className="sr-only peer" />
                    <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 peer-checked:bg-gray-800 peer-checked:text-white transition-colors inline-block">
                      None
                    </span>
                  </label>
                  {NOTE_CATEGORIES.map(cat => (
                    <label key={cat.name} className="cursor-pointer">
                      <input type="radio" name="category" value={cat.name} defaultChecked={editingNote.category === cat.name} className="sr-only peer" />
                      <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${cat.color} peer-checked:bg-gray-800 peer-checked:text-white transition-colors inline-flex items-center gap-1`}>
                        {cat.icon} {cat.name}
                      </span>
                    </label>
                  ))}
                </div>
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

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Tag size={16} className="inline mr-1" />
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editNoteTags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-sm flex items-center gap-1"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag, true)}
                        className="hover:text-purple-900"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editTagInput}
                    onChange={(e) => setEditTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(editTagInput, true);
                      }
                    }}
                    className="input flex-1"
                    placeholder="Add a tag and press Enter..."
                  />
                  <button
                    type="button"
                    onClick={() => addTag(editTagInput, true)}
                    className="btn btn-secondary"
                  >
                    Add
                  </button>
                </div>
                {availableTags.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-gray-500">Existing tags: </span>
                    {availableTags.filter(t => !editNoteTags.includes(t)).slice(0, 5).map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addTag(tag, true)}
                        className="text-xs text-purple-600 hover:text-purple-800 mr-2"
                      >
                        +{tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reminder
                </label>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-gray-500" />
                  <input
                    type="date"
                    name="reminder_at"
                    min={new Date().toISOString().split('T')[0]}
                    defaultValue={editingNote.reminder_at?.split('T')[0] || ''}
                    className="input flex-1"
                    placeholder="Set a reminder date"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Get reminded about this note on a specific date
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
