import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useToast } from '../components/Toast';
import { booksAPI, BookWithPages, BookPage } from '../services/api';
import {
  ChevronLeft, ChevronRight, Home, BookOpen,
  Maximize2, Minimize2, X, Menu, CheckCircle, Star, Heart, Send
} from 'lucide-react';

export default function BookReader() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { currentProfile } = useProfile();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [book, setBook] = useState<BookWithPages | null>(null);
  const [currentPage, setCurrentPage] = useState(0); // 0 = cover
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<'left' | 'right'>('right');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Rating state
  const [myRating, setMyRating] = useState<number>(0);
  const [liked, setLiked] = useState<boolean>(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);

  const bookContainerRef = useRef<HTMLDivElement>(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    if (bookId && currentProfile?.id) {
      loadBook();
    }
  }, [bookId, currentProfile?.id]);

  const loadBook = async () => {
    try {
      const { data } = await booksAPI.getBook(Number(bookId));
      setBook(data);

      // Resume from last read page and load existing feedback
      if (data.pages && currentProfile?.id) {
        try {
          const progressRes = await booksAPI.getProfileProgress(currentProfile.id);
          const bookProgress = progressRes.data.find(p => p.book_id === Number(bookId));
          if (bookProgress?.current_page) {
            setCurrentPage(bookProgress.current_page);
          }
        } catch (e) {
          // Ignore progress errors
        }

        // Load existing feedback
        try {
          const feedbackRes = await booksAPI.getMyFeedback(Number(bookId), currentProfile.id);
          if (feedbackRes.data) {
            setMyRating(feedbackRes.data.rating);
            setLiked(feedbackRes.data.liked === 1);
            setFeedbackSubmitted(true);
          }
        } catch (e) {
          // Ignore feedback errors
        }
      }
    } catch (error) {
      showToast('Failed to load book', 'error');
      navigate('/books');
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async () => {
    if (!currentProfile?.id || !bookId || myRating === 0) return;

    try {
      await booksAPI.submitFeedback(Number(bookId), {
        profileId: currentProfile.id,
        rating: myRating,
        liked
      });
      setFeedbackSubmitted(true);
      showToast('Thanks for your feedback!', 'success');
    } catch (e) {
      showToast('Could not save feedback', 'error');
    }
  };

  const saveProgress = useCallback(async (page: number, completed: boolean = false) => {
    if (!currentProfile?.id || !bookId) return;

    try {
      await booksAPI.updateProgress(Number(bookId), {
        profileId: currentProfile.id,
        currentPage: page,
        completed
      });
    } catch (e) {
      // Silently fail progress save
    }
  }, [currentProfile?.id, bookId]);

  const totalPages = book ? book.pages.length + 1 : 1; // +1 for cover

  const goToPage = useCallback((page: number) => {
    if (isFlipping || page < 0 || page >= totalPages) return;

    const direction = page > currentPage ? 'right' : 'left';
    setFlipDirection(direction);
    setIsFlipping(true);

    setTimeout(() => {
      setCurrentPage(page);
      setIsFlipping(false);

      // Save progress
      const isLastPage = page === totalPages - 1;
      saveProgress(page, isLastPage);

      if (isLastPage) {
        showToast('Congratulations! You finished the book!', 'success');
      }
    }, 400);
  }, [currentPage, isFlipping, totalPages, saveProgress, showToast]);

  const nextPage = useCallback(() => {
    if (currentPage < totalPages - 1) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, totalPages, goToPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 0) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextPage();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevPage();
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          toggleFullscreen();
        } else {
          navigate('/books');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, prevPage, isFullscreen, navigate]);

  // Touch/Swipe handling
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      nextPage();
    } else if (isRightSwipe) {
      prevPage();
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  // Mouse drag for desktop
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);

  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart(e.clientX);
  };

  const onMouseMove = (_e: React.MouseEvent) => {
    if (!isDragging) return;
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const distance = dragStart - e.clientX;
    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0) {
        nextPage();
      } else {
        prevPage();
      }
    }

    setIsDragging(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      bookContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const getCurrentPageContent = (): BookPage | null => {
    if (!book || currentPage === 0) return null;
    return book.pages[currentPage - 1] || null;
  };

  const pageContent = getCurrentPageContent();

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="mx-auto text-amber-600 animate-pulse mb-4" size={64} />
          <p className="text-amber-800 text-lg">Opening book...</p>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Book not found</p>
      </div>
    );
  }

  return (
    <div
      ref={bookContainerRef}
      className={`fixed inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex flex-col ${isFullscreen ? 'z-[9999]' : ''}`}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-sm border-b border-amber-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/books')}
            className="flex items-center gap-1 px-3 py-2 rounded-full bg-red-100 hover:bg-red-200 text-red-700 font-medium transition-colors"
            title="Exit to Library"
          >
            <X size={20} />
            <span className="hidden sm:inline">Exit</span>
          </button>
          <div>
            <h1 className="font-semibold text-gray-900 truncate max-w-[200px] md:max-w-none">
              {book.title}
            </h1>
            <p className="text-sm text-gray-500">
              Page {currentPage} of {totalPages - 1}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowToc(!showToc)}
            className="p-2 rounded-full hover:bg-amber-100 text-amber-700 transition-colors"
          >
            <Menu size={20} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full hover:bg-amber-100 text-amber-700 transition-colors"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-amber-200">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
          style={{ width: `${(currentPage / (totalPages - 1)) * 100}%` }}
        />
      </div>

      {/* Book Container */}
      <div
        className="flex-1 flex items-center justify-center p-4 md:p-8 select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => setIsDragging(false)}
      >
        {/* Book */}
        <div className="relative w-full max-w-4xl h-full max-h-[75vh] md:max-h-none md:aspect-[16/10] perspective-1000">
          {/* Book Shadow */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/30 rounded-2xl transform translate-y-4 blur-xl" />

          {/* Book Spine */}
          <div className="absolute left-1/2 top-0 bottom-0 w-4 -ml-2 bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 rounded-sm z-10 shadow-inner hidden md:block" />

          {/* Left Page (Previous) */}
          <div className="absolute left-0 top-0 w-1/2 h-full bg-gradient-to-r from-amber-50 to-white rounded-l-2xl shadow-lg overflow-hidden hidden md:block">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-100/50 to-transparent" />
            {currentPage > 0 && (
              <div className="p-8 h-full flex flex-col">
                {currentPage === 1 ? (
                  // First page shows cover summary
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    {book.cover_image && (
                      <img
                        src={book.cover_image}
                        alt={book.title}
                        className="w-32 h-40 object-cover rounded-lg shadow-md mb-4"
                      />
                    )}
                    <h2 className="text-xl font-bold text-amber-900 mb-2">{book.title}</h2>
                    <p className="text-sm text-gray-600">{book.description}</p>
                  </div>
                ) : (
                  // Previous page content
                  <div className="flex-1">
                    {book.pages[currentPage - 2]?.image_url && (
                      <img
                        src={book.pages[currentPage - 2].image_url}
                        alt=""
                        className="w-full h-48 object-cover rounded-lg mb-4"
                      />
                    )}
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {book.pages[currentPage - 2]?.content}
                    </p>
                  </div>
                )}
                <div className="text-center text-xs text-gray-400 pt-4 border-t border-amber-200">
                  {currentPage - 1}
                </div>
              </div>
            )}
          </div>

          {/* Right Page (Current) - Animated */}
          <div
            className={`absolute right-0 md:right-0 left-0 md:left-1/2 top-0 h-full bg-white rounded-2xl md:rounded-l-none md:rounded-r-2xl shadow-2xl overflow-hidden transform-gpu origin-left transition-transform duration-400 ${
              isFlipping
                ? flipDirection === 'right'
                  ? 'animate-page-flip-right'
                  : 'animate-page-flip-left'
                : ''
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-l from-amber-100/30 to-transparent" />

            {currentPage === 0 ? (
              // Cover Page
              <div className="h-full flex flex-col items-center justify-center p-4 md:p-8 text-center bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 text-white overflow-y-auto">
                {book.cover_image ? (
                  <img
                    src={book.cover_image}
                    alt={book.title}
                    className="w-full h-full object-cover absolute inset-0"
                  />
                ) : null}
                <div className="relative z-10 bg-black/40 backdrop-blur-sm p-4 md:p-8 rounded-2xl max-w-full">
                  <BookOpen className="mx-auto mb-3 md:mb-4 opacity-80" size={40} />
                  <h1 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4">{book.title}</h1>
                  <p className="text-sm md:text-lg opacity-90 mb-4 md:mb-6 line-clamp-3 md:line-clamp-none">{book.description}</p>
                  <div className="flex items-center justify-center gap-2 md:gap-4 text-xs md:text-sm opacity-75">
                    <span>{book.total_pages} pages</span>
                    <span>•</span>
                    <span>Ages {book.age_range}</span>
                  </div>
                  <button
                    onClick={nextPage}
                    className="mt-6 md:mt-8 px-6 md:px-8 py-2 md:py-3 bg-white text-primary-600 rounded-full font-semibold hover:bg-amber-50 transition-colors flex items-center gap-2 mx-auto text-sm md:text-base"
                  >
                    Start Reading
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            ) : pageContent ? (
              // Content Page
              <div className="h-full flex flex-col p-4 md:p-8 overflow-y-auto">
                {pageContent.title && (
                  <h2 className="text-lg md:text-2xl font-bold text-amber-900 mb-3 md:mb-4 flex-shrink-0">
                    {pageContent.title}
                  </h2>
                )}

                {pageContent.image_url && (
                  <div className="relative mb-3 md:mb-4 flex-shrink-0">
                    <img
                      src={pageContent.image_url}
                      alt=""
                      className="w-full h-32 sm:h-40 md:h-64 object-cover rounded-xl shadow-lg"
                    />
                  </div>
                )}

                <div className="flex-1 min-h-0">
                  <p className="text-gray-800 text-base md:text-xl leading-relaxed whitespace-pre-wrap">
                    {pageContent.content}
                  </p>
                </div>

                <div className="text-center text-sm text-gray-400 pt-3 md:pt-4 border-t border-amber-200 flex-shrink-0 mt-3">
                  {currentPage}
                </div>
              </div>
            ) : (
              // End Page with Rating
              <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-green-500 to-emerald-600 text-white overflow-y-auto">
                <CheckCircle className="mb-4" size={56} />
                <h2 className="text-2xl md:text-3xl font-bold mb-2">The End!</h2>
                <p className="text-base md:text-lg opacity-90 mb-6">
                  You finished reading "{book.title}"
                </p>

                {/* Rating Section */}
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 md:p-6 mb-6 w-full max-w-sm">
                  <p className="text-sm md:text-base font-medium mb-3">
                    {feedbackSubmitted ? 'Your Rating:' : 'Did you like this book?'}
                  </p>

                  {/* Star Rating */}
                  <div className="flex justify-center gap-1 md:gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => !feedbackSubmitted && setMyRating(star)}
                        disabled={feedbackSubmitted}
                        className={`transition-transform ${feedbackSubmitted ? 'cursor-default' : 'hover:scale-110 active:scale-95'}`}
                      >
                        <Star
                          size={32}
                          className={`${
                            star <= myRating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-white/50'
                          } transition-colors`}
                        />
                      </button>
                    ))}
                  </div>

                  {/* Like Button */}
                  <button
                    onClick={() => !feedbackSubmitted && setLiked(!liked)}
                    disabled={feedbackSubmitted}
                    className={`flex items-center justify-center gap-2 w-full py-2 rounded-full mb-4 transition-all ${
                      liked
                        ? 'bg-pink-500 text-white'
                        : 'bg-white/30 text-white hover:bg-white/40'
                    } ${feedbackSubmitted ? 'cursor-default' : ''}`}
                  >
                    <Heart size={20} className={liked ? 'fill-white' : ''} />
                    <span className="text-sm font-medium">{liked ? 'I loved it!' : 'I loved it!'}</span>
                  </button>

                  {/* Submit Button */}
                  {!feedbackSubmitted && myRating > 0 && (
                    <button
                      onClick={submitFeedback}
                      className="flex items-center justify-center gap-2 w-full py-2 bg-white text-emerald-600 rounded-full font-semibold hover:bg-emerald-50 transition-colors"
                    >
                      <Send size={18} />
                      <span>Submit</span>
                    </button>
                  )}

                  {feedbackSubmitted && (
                    <p className="text-sm text-white/80">Thanks for your feedback!</p>
                  )}
                </div>

                <button
                  onClick={() => navigate('/books')}
                  className="px-6 py-3 bg-white text-emerald-600 rounded-full font-semibold hover:bg-emerald-50 transition-colors flex items-center gap-2"
                >
                  <Home size={20} />
                  Back to Library
                </button>
              </div>
            )}
          </div>

          {/* Page Turn Hint Overlay */}
          {currentPage < totalPages - 1 && !isFlipping && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-400/50 animate-pulse hidden md:block">
              <ChevronRight size={48} />
            </div>
          )}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between px-4 py-4 bg-white/80 backdrop-blur-sm border-t border-amber-200">
        <button
          onClick={prevPage}
          disabled={currentPage === 0 || isFlipping}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
            currentPage === 0 || isFlipping
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-amber-700 hover:bg-amber-100 active:scale-95'
          }`}
        >
          <ChevronLeft size={24} />
          <span className="hidden md:inline">Previous</span>
        </button>

        {/* Page Dots (mobile) */}
        <div className="flex items-center gap-1 md:hidden">
          {Array.from({ length: Math.min(totalPages, 10) }).map((_, i) => {
            const pageIndex = totalPages > 10 ? Math.floor((i / 9) * (totalPages - 1)) : i;
            return (
              <button
                key={i}
                onClick={() => goToPage(pageIndex)}
                className={`w-2 h-2 rounded-full transition-all ${
                  Math.abs(currentPage - pageIndex) < (totalPages > 10 ? totalPages / 10 : 1)
                    ? 'bg-amber-500 w-4'
                    : 'bg-amber-200'
                }`}
              />
            );
          })}
        </div>

        {/* Page Numbers (desktop) */}
        <div className="hidden md:flex items-center gap-2">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => goToPage(i)}
              className={`w-8 h-8 rounded-full text-sm font-medium transition-all ${
                currentPage === i
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              }`}
            >
              {i === 0 ? '📖' : i}
            </button>
          ))}
        </div>

        <button
          onClick={nextPage}
          disabled={currentPage >= totalPages - 1 || isFlipping}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
            currentPage >= totalPages - 1 || isFlipping
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-amber-700 hover:bg-amber-100 active:scale-95'
          }`}
        >
          <span className="hidden md:inline">Next</span>
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Table of Contents Sidebar */}
      {showToc && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowToc(false)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-72 bg-white shadow-2xl z-50 overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Contents</h3>
              <button
                onClick={() => setShowToc(false)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-2">
              <button
                onClick={() => { goToPage(0); setShowToc(false); }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
                  currentPage === 0 ? 'bg-amber-100 text-amber-700' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <BookOpen size={18} />
                  <span>Cover</span>
                </div>
              </button>
              {book.pages.map((page, i) => (
                <button
                  key={page.id}
                  onClick={() => { goToPage(i + 1); setShowToc(false); }}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
                    currentPage === i + 1 ? 'bg-amber-100 text-amber-700' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400 w-6">{i + 1}</span>
                    <span className="truncate">{page.title || `Page ${i + 1}`}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* CSS for page flip animation */}
      <style>{`
        .perspective-1000 {
          perspective: 1000px;
        }

        @keyframes pageFlipRight {
          0% {
            transform: rotateY(0deg);
          }
          100% {
            transform: rotateY(-15deg);
          }
        }

        @keyframes pageFlipLeft {
          0% {
            transform: rotateY(0deg);
          }
          100% {
            transform: rotateY(15deg);
          }
        }

        .animate-page-flip-right {
          animation: pageFlipRight 0.2s ease-out forwards, pageFlipRight 0.2s ease-in 0.2s reverse forwards;
        }

        .animate-page-flip-left {
          animation: pageFlipLeft 0.2s ease-out forwards, pageFlipLeft 0.2s ease-in 0.2s reverse forwards;
        }
      `}</style>
    </div>
  );
}
