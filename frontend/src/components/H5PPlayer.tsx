import React, { useEffect, useRef, useState } from 'react';
import { h5pAPI } from '../services/api';
import { Loader2, AlertCircle, Award, RotateCcw, Star, Trophy, X } from 'lucide-react';

interface H5PPlayerProps {
  contentId: number;
  onComplete?: (result: {
    score: number;
    maxScore: number;
    passed: boolean;
    pointsAwarded: number;
  }) => void;
  onError?: (error: string) => void;
}

interface PlayerData {
  content: {
    id: number;
    title: string;
    contentType: string;
  };
  player: {
    integration: any;
    scripts: string[];
    styles: string[];
    contentId: string;
  };
  attemptId: number | null;
  assignment: {
    points: number;
    passPercentage: number;
  } | null;
}

export const H5PPlayer: React.FC<H5PPlayerProps> = ({
  contentId,
  onComplete,
  onError
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [completed, setCompleted] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    maxScore: number;
    passed: boolean;
    pointsAwarded: number;
  } | null>(null);

  useEffect(() => {
    console.log('[H5PPlayer] useEffect triggered, contentId:', contentId);
    loadContent();
  }, [contentId]);

  // Initialize H5P when playerData is loaded AND component is rendered (not loading)
  useEffect(() => {
    if (playerData && !loading && containerRef.current) {
      console.log('[H5PPlayer] Initializing H5P after render, playerData:', playerData);
      initializeH5P(playerData);
    }
  }, [playerData, loading]);

  const loadContent = async () => {
    try {
      console.log('[H5PPlayer] loadContent called for contentId:', contentId);
      setLoading(true);
      setError(null);
      setCompleted(false);
      setShowPopup(false);
      setResult(null);

      console.log('[H5PPlayer] Calling h5pAPI.getPlayerData...');
      const response = await h5pAPI.getPlayerData(contentId);
      console.log('[H5PPlayer] API response:', response.data);
      setPlayerData(response.data);
      // H5P initialization now happens in separate useEffect after loading is false
    } catch (err: any) {
      console.error('[H5PPlayer] Error loading content:', err);
      const errorMessage = err.response?.data?.error || 'Failed to load content';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const initializeH5P = (data: PlayerData) => {
    console.log('[H5PPlayer] initializeH5P called with:', data);
    if (!containerRef.current) {
      console.error('[H5PPlayer] Container ref is null!');
      return;
    }

    // Clear container by removing all child nodes
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }

    // Create H5P container element using DOM methods
    // H5P looks for elements with class 'h5p-content' and data-content-id attribute
    const h5pContainer = document.createElement('div');
    h5pContainer.className = 'h5p-content';
    h5pContainer.setAttribute('data-content-id', data.player.contentId);
    containerRef.current.appendChild(h5pContainer);

    console.log('[H5PPlayer] Created container with data-content-id:', data.player.contentId);

    // Setup H5P integration - use the integration object from the player model directly
    // The Lumi H5P library returns a properly formatted integration object
    const integration = data.player.integration || {};

    console.log('[H5PPlayer] Setting up H5PIntegration with contentId:', data.player.contentId);
    console.log('[H5PPlayer] Integration object:', JSON.stringify(integration, null, 2).substring(0, 500));

    // Set global H5P integration - use the integration as-is from the backend
    (window as any).H5PIntegration = integration;

    // CRITICAL: Prevent H5P from auto-initializing on document ready
    // H5P's core script (h5p.js) has this at the end:
    //   H5P.jQuery(document).ready(function () { if (!H5P.preventInit) H5P.init(document.body); });
    // This causes H5P to initialize before all library scripts are loaded.
    // We set preventInit to true and manually call H5P.init after all scripts load.
    (window as any).H5P = (window as any).H5P || {};
    (window as any).H5P.preventInit = true;

    // Load styles
    data.player.styles?.forEach((styleUrl: string) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = styleUrl;
      document.head.appendChild(link);
    });

    // Load scripts
    console.log('[H5PPlayer] Loading scripts:', data.player.scripts);
    console.log('[H5PPlayer] Loading styles:', data.player.styles);
    const loadScripts = async () => {
      for (const scriptUrl of (data.player.scripts || [])) {
        console.log('[H5PPlayer] Loading script:', scriptUrl);
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = scriptUrl;
          script.onload = () => {
            console.log('[H5PPlayer] Script loaded:', scriptUrl);
            resolve();
          };
          script.onerror = () => reject(new Error(`Failed to load script: ${scriptUrl}`));
          document.body.appendChild(script);
        });
      }

      // Initialize H5P content after scripts are loaded
      console.log('[H5PPlayer] All scripts loaded, H5P object exists:', !!(window as any).H5P);
      if ((window as any).H5P) {
        // Small delay to ensure all scripts are fully initialized
        // (some H5P libraries register themselves asynchronously)
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log('[H5PPlayer] Calling H5P.init on document.body');
        console.log('[H5PPlayer] H5P.preventInit is:', (window as any).H5P.preventInit);
        console.log('[H5PPlayer] Available H5P constructors:', Object.keys((window as any).H5P).filter(k => typeof (window as any).H5P[k] === 'function'));

        // H5P.init scans for elements with class 'h5p-content' and data-content-id attribute
        (window as any).H5P.init(document.body);

        // Setup xAPI listener
        setupXAPIListener(data);
      } else {
        console.error('[H5PPlayer] H5P global not found after loading scripts!');
      }
    };

    loadScripts().catch(err => {
      console.error('[H5PPlayer] Failed to load H5P scripts:', err);
      setError('Failed to load H5P player scripts');
    });
  };

  const setupXAPIListener = (data: PlayerData) => {
    const H5P = (window as any).H5P;
    if (!H5P) {
      console.warn('[H5PPlayer] H5P global not available for xAPI listener');
      return;
    }

    console.log('[H5PPlayer] Setting up xAPI listener for attemptId:', data.attemptId);

    // Listen for xAPI events
    const handleXAPI = async (event: any) => {
      const statement = event.data?.statement;
      if (!statement) {
        console.warn('[H5PPlayer] xAPI event without statement:', event);
        return;
      }

      const verb = statement.verb?.id?.split('/').pop() || 'unknown';
      console.log('[H5PPlayer] xAPI event received:', {
        verb,
        score: statement.result?.score,
        completion: statement.result?.completion,
        success: statement.result?.success
      });

      // Check for completion - H5P QuestionSet uses 'completed' verb for the full quiz
      // Individual questions use 'answered' verb with completion: true for just that question
      // We ONLY want to trigger our completion flow when the ENTIRE quiz is completed
      // The 'completed' verb is sent when the user finishes the whole QuestionSet
      // Ignore individual question 'answered' events to prevent premature completion
      if (verb === 'completed') {
        const score = statement.result?.score?.raw ?? 0;
        const maxScore = statement.result?.score?.max ?? 100;

        console.log('[H5PPlayer] FULL Quiz completion detected (verb=completed):', { score, maxScore, attemptId: data.attemptId });

        if (data.attemptId) {
          try {
            const xapiResult = await h5pAPI.submitXAPI({
              attemptId: data.attemptId,
              verb,
              objectId: statement.object?.id,
              objectType: statement.object?.objectType,
              result: {
                score: { raw: score, max: maxScore },
                success: statement.result?.success,
                completion: statement.result?.completion,
                duration: statement.result?.duration
              }
            });

            console.log('[H5PPlayer] xAPI submission result:', xapiResult.data);

            if (xapiResult.data.completed) {
              setCompleted(true);
              const completionResult = {
                score: xapiResult.data.score || 0,
                maxScore: xapiResult.data.maxScore || 100,
                passed: xapiResult.data.passed || false,
                pointsAwarded: xapiResult.data.pointsAwarded || 0
              };
              setResult(completionResult);
              setShowPopup(true); // Show the completion popup
              onComplete?.(completionResult);
            }
          } catch (err) {
            console.error('[H5PPlayer] Failed to submit xAPI event:', err);
          }
        } else {
          console.warn('[H5PPlayer] No attemptId available - cannot submit xAPI');
        }
      }
    };

    // Attach listener
    if (H5P.externalDispatcher) {
      H5P.externalDispatcher.on('xAPI', handleXAPI);
      console.log('[H5PPlayer] xAPI listener attached successfully');
    } else {
      console.warn('[H5PPlayer] H5P.externalDispatcher not available');
      // Try again after a short delay (sometimes H5P.externalDispatcher loads async)
      setTimeout(() => {
        if ((window as any).H5P?.externalDispatcher) {
          (window as any).H5P.externalDispatcher.on('xAPI', handleXAPI);
          console.log('[H5PPlayer] xAPI listener attached (delayed)');
        }
      }, 1000);
    }
  };

  const handleRetry = () => {
    loadContent();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-gray-600 dark:text-gray-400">Loading activity...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-red-600 dark:text-red-400 text-center">{error}</p>
        <button
          onClick={handleRetry}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="h5p-player-wrapper">
      {/* Title */}
      {playerData && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            {playerData.content.title}
          </h2>
          {playerData.assignment && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Pass: {playerData.assignment.passPercentage}% | Points: {playerData.assignment.points}
            </span>
          )}
        </div>
      )}

      {/* Completion Popup Modal */}
      {showPopup && result && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 transform animate-bounce-in ${
            result.passed ? 'ring-4 ring-green-400' : 'ring-4 ring-yellow-400'
          }`}>
            {/* Close button */}
            <button
              onClick={() => setShowPopup(false)}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>

            {/* Celebration header */}
            <div className="text-center mb-6">
              {result.passed ? (
                <>
                  <div className="text-6xl mb-2">🎉</div>
                  <div className="flex justify-center gap-1 mb-2">
                    <Star className="w-8 h-8 text-yellow-400 fill-yellow-400 animate-pulse" />
                    <Trophy className="w-10 h-10 text-yellow-500" />
                    <Star className="w-8 h-8 text-yellow-400 fill-yellow-400 animate-pulse" />
                  </div>
                  <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">
                    Amazing Job!
                  </h2>
                  <p className="text-lg text-gray-600 dark:text-gray-300">You passed the quiz!</p>
                </>
              ) : (
                <>
                  <div className="text-6xl mb-2">💪</div>
                  <h2 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    Good Try!
                  </h2>
                  <p className="text-lg text-gray-600 dark:text-gray-300">Keep practicing!</p>
                </>
              )}
            </div>

            {/* Score display */}
            <div className={`text-center p-4 rounded-xl mb-4 ${
              result.passed
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-yellow-100 dark:bg-yellow-900/30'
            }`}>
              <div className="text-4xl font-bold text-gray-800 dark:text-gray-200 mb-1">
                {result.score} / {result.maxScore}
              </div>
              <div className="text-xl text-gray-600 dark:text-gray-400">
                {Math.round((result.score / result.maxScore) * 100)}% Correct
              </div>
            </div>

            {/* Points earned */}
            {result.pointsAwarded > 0 && (
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl p-4 mb-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="text-2xl">⭐</span>
                  <span className="text-3xl font-bold">+{result.pointsAwarded}</span>
                  <span className="text-2xl">⭐</span>
                </div>
                <div className="text-lg">Points Earned!</div>
              </div>
            )}

            {/* Already earned message */}
            {result.passed && result.pointsAwarded === 0 && playerData?.assignment?.points && playerData.assignment.points > 0 && (
              <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl p-3 mb-4 text-center text-sm">
                You already earned points for this quiz!
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPopup(false);
                  handleRetry();
                }}
                className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 flex items-center justify-center gap-2 font-semibold"
              >
                <RotateCcw className="w-5 h-5" />
                Try Again
              </button>
              <button
                onClick={() => setShowPopup(false)}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Small completion banner (shows after popup is closed) */}
      {completed && result && !showPopup && (
        <div className={`mb-4 p-3 rounded-lg flex items-center justify-between ${
          result.passed
            ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
            : 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700'
        }`}>
          <div className="flex items-center gap-2">
            <Award className={`w-6 h-6 ${result.passed ? 'text-green-500' : 'text-yellow-500'}`} />
            <span className={`font-medium ${result.passed ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
              {result.passed ? 'Passed!' : 'Keep trying!'} Score: {result.score}/{result.maxScore}
              {result.pointsAwarded > 0 && ` (+${result.pointsAwarded} pts)`}
            </span>
          </div>
          <button
            onClick={handleRetry}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 flex items-center gap-1"
          >
            <RotateCcw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* H5P Content Container - Always use light background for H5P content */}
      <div
        ref={containerRef}
        className="h5p-container bg-white rounded-lg shadow-lg p-4 min-h-[300px]"
        style={{
          // Force light mode styling for H5P content
          // H5P libraries assume light background with dark text
          colorScheme: 'light',
        }}
      />

      {/* H5P-specific style overrides to ensure visibility */}
      <style>{`
        .h5p-container,
        .h5p-container * {
          color-scheme: light;
        }
        .h5p-content {
          background: white !important;
          color: #333 !important;
        }
        .h5p-content * {
          color: inherit;
        }
        .h5p-content .h5p-question-content,
        .h5p-content .h5p-question-introduction,
        .h5p-content .h5p-question-feedback,
        .h5p-content .h5p-joubelui-score-bar,
        .h5p-content .h5p-question,
        .h5p-content .h5p-alternative-inner,
        .h5p-content .h5p-multichoice,
        .h5p-content .h5p-true-false,
        .h5p-content .h5p-blanks,
        .h5p-content .h5p-question-set {
          color: #333 !important;
          background-color: transparent;
        }
        .h5p-content h1, .h5p-content h2, .h5p-content h3,
        .h5p-content h4, .h5p-content h5, .h5p-content h6,
        .h5p-content p, .h5p-content span, .h5p-content div,
        .h5p-content label, .h5p-content li {
          color: #333 !important;
        }
        .h5p-content input[type="text"],
        .h5p-content input[type="number"],
        .h5p-content textarea {
          background: white !important;
          color: #333 !important;
          border: 1px solid #ccc !important;
        }
        .h5p-content button {
          color: inherit;
        }
        /* Ensure score and feedback text is visible */
        .h5p-content .h5p-joubelui-score-numeric {
          color: #333 !important;
        }
      `}</style>
    </div>
  );
};

export default H5PPlayer;
