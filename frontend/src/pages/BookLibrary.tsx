import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useToast } from '../components/Toast';
import { booksAPI, Book, BookCategory, profilesAPI } from '../services/api';
import type { Profile } from '../types';
import {
  BookOpen, Trash2, Sparkles, Clock, CheckCircle,
  BookMarked, Filter, Search, ChevronRight, Users, Star, MessageCircle, X as CloseIcon
} from 'lucide-react';

export default function BookLibrary() {
  const navigate = useNavigate();
  const { currentProfile } = useProfile();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<BookCategory[]>([]);
  const [children, setChildren] = useState<Profile[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Feedback state
  const [bookFeedback, setBookFeedback] = useState<Record<number, { totalReviews: number; averageRating: number; likesCount: number }>>({});
  const [showFeedbackModal, setShowFeedbackModal] = useState<{ bookId: number; title: string } | null>(null);
  const [feedbackDetails, setFeedbackDetails] = useState<any[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // AI Generation state
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{
    current: number;
    total: number;
    message: string;
  } | null>(null);
  const [bookPrompt, setBookPrompt] = useState('');
  const [pageCount, setPageCount] = useState(8);
  const [ageRange, setAgeRange] = useState('4-8');
  const [selectedGenre, setSelectedGenre] = useState('adventure');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [includeImages, setIncludeImages] = useState(true);
  const [assignedTo, setAssignedTo] = useState<number | null>(null);

  // Genre options for filtering and creating books (must match what's stored in book.genre)
  const genreOptions = [
    { value: 'adventure', label: '🗺️ Adventure' },
    { value: 'animals', label: '🐾 Animals' },
    { value: 'fantasy', label: '🧙 Fantasy' },
    { value: 'educational', label: '📚 Educational' },
    { value: 'bedtime', label: '🌙 Bedtime' },
    { value: 'friendship', label: '🤝 Friendship' },
    { value: 'family', label: '👨‍👩‍👧‍👦 Family' },
    { value: 'science', label: '🔬 Science' },
    { value: 'history', label: '📜 History' },
  ];

  const isParentOrTeacher = currentProfile?.type === 'parent' || currentProfile?.type === 'teacher' || currentProfile?.type === 'admin';

  useEffect(() => {
    if (currentProfile?.id) {
      loadData();
    }
  }, [currentProfile?.id]);

  const loadData = async () => {
    try {
      const [booksRes, categoriesRes, profilesRes] = await Promise.all([
        booksAPI.getProfileBooks(currentProfile!.id),
        booksAPI.getCategories(),
        profilesAPI.getAll()
      ]);
      setBooks(booksRes.data);
      setCategories(categoriesRes.data);

      // Filter to get children (profiles where parent_id matches current user or type is 'child')
      const childProfiles = profilesRes.data.filter(
        (p: Profile) => p.type === 'child' && (p.parent_id === currentProfile!.id || !p.parent_id)
      );
      setChildren(childProfiles);

      // Load feedback stats for each book (for parent/teacher view)
      if (currentProfile?.type === 'parent' || currentProfile?.type === 'teacher' || currentProfile?.type === 'admin') {
        const feedbackPromises = booksRes.data.map(async (book: Book) => {
          try {
            const res = await booksAPI.getBookFeedback(book.id);
            return { bookId: book.id, stats: res.data.stats };
          } catch {
            return { bookId: book.id, stats: { totalReviews: 0, averageRating: 0, likesCount: 0 } };
          }
        });
        const feedbackResults = await Promise.all(feedbackPromises);
        const feedbackMap: Record<number, any> = {};
        feedbackResults.forEach(r => { feedbackMap[r.bookId] = r.stats; });
        setBookFeedback(feedbackMap);
      }
    } catch (error) {
      showToast('Failed to load books', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openFeedbackModal = async (bookId: number, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowFeedbackModal({ bookId, title });
    setLoadingFeedback(true);
    try {
      const res = await booksAPI.getBookFeedback(bookId);
      setFeedbackDetails(res.data.feedback || []);
    } catch {
      setFeedbackDetails([]);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleGenerateBook = async () => {
    if (!bookPrompt.trim()) {
      showToast('Please enter a story idea', 'error');
      return;
    }

    setGenerating(true);
    setGenerationProgress({ current: 0, total: 3, message: 'Starting...' });

    try {
      const { data } = await booksAPI.generateAIBook({
        prompt: bookPrompt,
        pageCount,
        createdBy: currentProfile!.id,
        assignedTo: assignedTo || currentProfile!.id,
        ageRange,
        genre: selectedGenre,
        categoryIds: selectedCategoryIds,
        includeImages
      });

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await booksAPI.getAIBookJobStatus(data.jobId);

          if (statusRes.data.progress) {
            setGenerationProgress(statusRes.data.progress);
          }

          if (statusRes.data.status === 'completed') {
            clearInterval(pollInterval);
            setGenerating(false);
            setGenerationProgress(null);
            setShowCreateModal(false);
            setBookPrompt('');
            setAssignedTo(null);
            setSelectedCategoryIds([]);
            showToast('Book created successfully!', 'success');
            loadData();

            // Navigate to the new book
            if (statusRes.data.result?.book?.id) {
              navigate(`/books/read/${statusRes.data.result.book.id}`);
            }
          } else if (statusRes.data.status === 'failed') {
            clearInterval(pollInterval);
            setGenerating(false);
            setGenerationProgress(null);
            showToast(statusRes.data.error || 'Failed to generate book', 'error');
          }
        } catch (err) {
          clearInterval(pollInterval);
          setGenerating(false);
          setGenerationProgress(null);
          showToast('Failed to check generation status', 'error');
        }
      }, 2000);

    } catch (error: any) {
      setGenerating(false);
      setGenerationProgress(null);
      showToast(error?.response?.data?.error || 'Failed to start book generation', 'error');
    }
  };

  const handleDeleteBook = async (bookId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this book?')) return;

    try {
      await booksAPI.deleteBook(bookId);
      showToast('Book deleted', 'success');
      setBooks(books.filter(b => b.id !== bookId));
    } catch (error) {
      showToast('Failed to delete book', 'error');
    }
  };

  const filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         book.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || book.genre === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BookOpen className="text-primary-600" size={32} />
            {isParentOrTeacher ? 'Book Library' : 'My Books'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isParentOrTeacher
              ? 'Create and manage AI-generated books for your children'
              : 'Read amazing stories created just for you!'}
          </p>
        </div>

        {isParentOrTeacher && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 md:mt-0 btn btn-primary flex items-center gap-2"
          >
            <Sparkles size={20} />
            Create AI Book
          </button>
        )}
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search books..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={20} className="text-gray-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="all">All Genres</option>
            {genreOptions.map(genre => (
              <option key={genre.value} value={genre.value}>{genre.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Books Grid */}
      {filteredBooks.length === 0 ? (
        <div className="text-center py-16">
          <BookMarked className="mx-auto text-gray-300 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No books yet</h3>
          <p className="text-gray-500 mb-6">
            {isParentOrTeacher
              ? 'Create your first AI-generated book!'
              : 'Ask your parent to create a book for you!'}
          </p>
          {isParentOrTeacher && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              <Sparkles size={20} className="mr-2" />
              Create First Book
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredBooks.map(book => (
            <div
              key={book.id}
              onClick={() => navigate(`/books/read/${book.id}`)}
              className="group cursor-pointer"
            >
              {/* Book Cover */}
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-lg transform transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl">
                {book.cover_image ? (
                  <img
                    src={book.cover_image}
                    alt={book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
                    <BookOpen className="text-white/80" size={48} />
                  </div>
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <span className="text-white text-sm flex items-center gap-1">
                      <BookOpen size={14} />
                      {book.total_pages} pages
                    </span>
                    <ChevronRight className="text-white" size={20} />
                  </div>
                </div>

                {/* Reading Progress Badge */}
                {book.current_page && book.current_page > 1 && (
                  <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <Clock size={12} />
                    Page {book.current_page}
                  </div>
                )}

                {/* Completed Badge */}
                {book.is_read === 1 && (
                  <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle size={12} />
                    Read
                  </div>
                )}

                {/* AI Generated Badge */}
                {book.is_ai_generated === 1 && (
                  <div className="absolute top-2 left-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <Sparkles size={12} />
                    AI
                  </div>
                )}

                {/* Delete button (parent only) */}
                {isParentOrTeacher && (
                  <button
                    onClick={(e) => handleDeleteBook(book.id, e)}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Book Info */}
              <div className="mt-3">
                <h3 className="font-semibold text-gray-900 truncate group-hover:text-primary-600 transition-colors">
                  {book.title}
                </h3>
                <p className="text-sm text-gray-500 truncate">{book.description}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                  <span>{book.age_range} years</span>
                  <span>•</span>
                  <span className="capitalize">{book.genre}</span>
                </div>
                {/* Rating display for parents */}
                {isParentOrTeacher && bookFeedback[book.id] && bookFeedback[book.id].totalReviews > 0 && (
                  <button
                    onClick={(e) => openFeedbackModal(book.id, book.title, e)}
                    className="flex items-center gap-1 mt-2 px-2 py-1 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          size={12}
                          className={star <= Math.round(bookFeedback[book.id].averageRating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-amber-700 font-medium">
                      {bookFeedback[book.id].averageRating.toFixed(1)} ({bookFeedback[book.id].totalReviews})
                    </span>
                    <MessageCircle size={12} className="text-amber-600" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <MessageCircle className="text-amber-500" size={20} />
                  Book Feedback
                </h3>
                <p className="text-sm text-gray-500 truncate">{showFeedbackModal.title}</p>
              </div>
              <button
                onClick={() => setShowFeedbackModal(null)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <CloseIcon size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingFeedback ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : feedbackDetails.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Star className="mx-auto mb-2 text-gray-300" size={32} />
                  <p>No feedback yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {feedbackDetails.map((fb: any, idx: number) => (
                    <div key={idx} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-lg">
                          {fb.profile_avatar || '👤'}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{fb.profile_name}</p>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(star => (
                              <Star
                                key={star}
                                size={14}
                                className={star <= fb.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
                              />
                            ))}
                            {fb.liked === 1 && (
                              <span className="ml-2 text-pink-500 text-xs">❤️ Loved it!</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {fb.comment && (
                        <p className="text-sm text-gray-600 mt-2 italic">"{fb.comment}"</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(fb.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Book Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles className="text-purple-600" />
                  Create AI Book
                </h2>
                <button
                  onClick={() => !generating && setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={generating}
                >
                  ✕
                </button>
              </div>

              {generating ? (
                <div className="text-center py-8">
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute inset-0 rounded-full border-4 border-purple-200"></div>
                    <div
                      className="absolute inset-0 rounded-full border-4 border-purple-600 border-t-transparent animate-spin"
                    ></div>
                    <Sparkles className="absolute inset-0 m-auto text-purple-600" size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Creating Your Book...
                  </h3>
                  {generationProgress && (
                    <>
                      <p className="text-gray-600 mb-4">{generationProgress.message}</p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        Step {generationProgress.current} of {generationProgress.total}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Story Idea *
                    </label>
                    <textarea
                      value={bookPrompt}
                      onChange={(e) => setBookPrompt(e.target.value)}
                      placeholder="e.g., A brave little rabbit who learns to share with friends..."
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Age Range
                      </label>
                      <select
                        value={ageRange}
                        onChange={(e) => setAgeRange(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      >
                        <option value="2-4">2-4 years</option>
                        <option value="4-6">4-6 years</option>
                        <option value="4-8">4-8 years</option>
                        <option value="6-10">6-10 years</option>
                        <option value="8-12">8-12 years</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Number of Pages
                      </label>
                      <select
                        value={pageCount}
                        onChange={(e) => setPageCount(Number(e.target.value))}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      >
                        <option value={5}>5 pages</option>
                        <option value={8}>8 pages</option>
                        <option value={10}>10 pages</option>
                        <option value={12}>12 pages</option>
                        <option value={15}>15 pages</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Genre
                      </label>
                      <select
                        value={selectedGenre}
                        onChange={(e) => setSelectedGenre(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      >
                        {genreOptions.map(genre => (
                          <option key={genre.value} value={genre.value}>{genre.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <Users size={14} />
                        Assign To
                      </label>
                      <select
                        value={assignedTo || ''}
                        onChange={(e) => setAssignedTo(e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      >
                        <option value="">Myself</option>
                        {children.map(child => (
                          <option key={child.id} value={child.id}>
                            {child.name} {child.avatar || ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Additional Categories (optional) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Additional Categories (optional)
                    </label>
                    <div className="flex flex-wrap gap-2 p-3 border border-slate-200 rounded-xl bg-gray-50 max-h-32 overflow-y-auto">
                      {categories.map(cat => (
                        <label
                          key={cat.id}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors ${
                            selectedCategoryIds.includes(cat.id)
                              ? 'bg-primary-100 text-primary-700 border-2 border-primary-300'
                              : 'bg-white border border-gray-200 hover:border-primary-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategoryIds.includes(cat.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCategoryIds([...selectedCategoryIds, cat.id]);
                              } else {
                                setSelectedCategoryIds(selectedCategoryIds.filter(id => id !== cat.id));
                              }
                            }}
                            className="sr-only"
                          />
                          <span>{cat.icon}</span>
                          <span>{cat.display_name}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Select additional categories for easier organization</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="includeImages"
                      checked={includeImages}
                      onChange={(e) => setIncludeImages(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="includeImages" className="text-sm text-gray-700">
                      Generate AI illustrations for each page
                    </label>
                  </div>

                  {/* Cost Estimate */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                      💰 Estimated Cost
                    </h4>
                    <div className="space-y-1 text-sm">
                      {includeImages ? (
                        <>
                          <div className="flex justify-between text-amber-700">
                            <span>Cover image (DALL-E 3)</span>
                            <span>$0.04</span>
                          </div>
                          <div className="flex justify-between text-amber-700">
                            <span>{pageCount} page images × $0.04</span>
                            <span>${(pageCount * 0.04).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-amber-700">
                            <span>Text generation (AI)</span>
                            <span>~$0.01</span>
                          </div>
                          <div className="border-t border-amber-300 pt-1 mt-2 flex justify-between font-bold text-amber-900">
                            <span>Total</span>
                            <span>${((pageCount + 1) * 0.04 + 0.01).toFixed(2)}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between text-amber-700">
                            <span>Text generation only (AI)</span>
                            <span>~$0.01</span>
                          </div>
                          <div className="border-t border-amber-300 pt-1 mt-2 flex justify-between font-bold text-amber-900">
                            <span>Total</span>
                            <span>~$0.01</span>
                          </div>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-amber-600 mt-2">
                      * Costs are estimates based on OpenAI DALL-E 3 pricing. Actual costs may vary if using Grok fallback.
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerateBook}
                      disabled={!bookPrompt.trim()}
                      className="flex-1 btn btn-primary flex items-center justify-center gap-2"
                    >
                      <Sparkles size={20} />
                      Generate Book
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
