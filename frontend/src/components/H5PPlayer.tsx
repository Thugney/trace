import React, { useEffect, useMemo, useRef, useState } from 'react';
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

type CompletionResult = {
  score: number;
  maxScore: number;
  passed: boolean;
  pointsAwarded: number;
};

const MIN_FRAME_HEIGHT = 320;
const DEFAULT_FRAME_HEIGHT = 520;

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function buildH5PSrcDoc(player: PlayerData['player']): string {
  const styles = (player.styles || [])
    .map((styleUrl) => `<link rel="stylesheet" href="${escapeHtmlAttribute(styleUrl)}" />`)
    .join('\n');
  const scripts = (player.scripts || [])
    .map((scriptUrl) => `<script src="${escapeHtmlAttribute(scriptUrl)}"></script>`)
    .join('\n');
  const integration = serializeForInlineScript(player.integration || {});

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${styles}
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #334155;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    #h5p-root {
      min-height: ${MIN_FRAME_HEIGHT}px;
      padding: 16px;
      box-sizing: border-box;
      background: #ffffff;
    }

    .h5p-content {
      background: #ffffff;
    }
  </style>
</head>
<body>
  <div id="h5p-root">
    <div class="h5p-content" data-content-id="${escapeHtmlAttribute(player.contentId)}"></div>
  </div>

  <script>
    (function () {
      function notifyParent(type, payload) {
        window.parent.postMessage(Object.assign({ source: 'trace-h5p', type: type }, payload || {}), '*');
      }

      function postHeight() {
        var root = document.getElementById('h5p-root');
        var height = Math.max(
          root ? root.scrollHeight : 0,
          document.body.scrollHeight,
          document.documentElement.scrollHeight
        );

        notifyParent('height', { height: height + 8 });
      }

      window.__traceH5P = {
        notifyParent: notifyParent,
        postHeight: postHeight
      };

      window.H5PIntegration = ${integration};
      window.H5P = window.H5P || {};
      window.H5P.preventInit = true;

      if ('ResizeObserver' in window) {
        var resizeObserver = new ResizeObserver(postHeight);
        resizeObserver.observe(document.body);
      }

      var mutationObserver = new MutationObserver(function () {
        window.requestAnimationFrame(postHeight);
      });
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
      });

      window.addEventListener('resize', postHeight);
      window.addEventListener('load', postHeight);
      window.addEventListener('error', function (event) {
        var target = event.target;
        var tagName = target && target.tagName;

        if (target && target !== window && (tagName === 'SCRIPT' || tagName === 'LINK')) {
          notifyParent('error', {
            fatal: true,
            message: 'Failed to load an H5P asset'
          });
        }
      }, true);

      window.setTimeout(postHeight, 0);
    }());
  </script>

  ${scripts}

  <script>
    (function () {
      function notifyParent(type, payload) {
        if (window.__traceH5P && window.__traceH5P.notifyParent) {
          window.__traceH5P.notifyParent(type, payload);
        }
      }

      function postHeight() {
        if (window.__traceH5P && window.__traceH5P.postHeight) {
          window.__traceH5P.postHeight();
        }
      }

      function attachXapiListener() {
        var attempts = window.__traceH5PAttachAttempts || 0;
        var dispatcher = window.H5P && window.H5P.externalDispatcher;
        if (!dispatcher) {
          if (attempts >= 40) {
            return;
          }
          window.__traceH5PAttachAttempts = attempts + 1;
          window.setTimeout(attachXapiListener, 250);
          return;
        }

        dispatcher.on('xAPI', function (event) {
          notifyParent('xapi', {
            statement: event && event.data ? event.data.statement || null : null
          });
          postHeight();
        });
      }

      window.setTimeout(function () {
        try {
          if (!window.H5P || typeof window.H5P.init !== 'function') {
            notifyParent('error', {
              fatal: true,
              message: 'H5P player failed to initialize'
            });
            return;
          }

          window.H5P.init(document.body);
          attachXapiListener();
          postHeight();
          notifyParent('ready');
        } catch (error) {
          notifyParent('error', {
            fatal: true,
            message: error && error.message ? error.message : 'Failed to start H5P activity'
          });
        }
      }, 100);
    }());
  </script>
</body>
</html>`;
}

export const H5PPlayer: React.FC<H5PPlayerProps> = ({
  contentId,
  onComplete,
  onError
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const completedAttemptRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [completed, setCompleted] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [result, setResult] = useState<CompletionResult | null>(null);
  const [frameHeight, setFrameHeight] = useState(DEFAULT_FRAME_HEIGHT);

  useEffect(() => {
    loadContent();
  }, [contentId]);

  useEffect(() => {
    completedAttemptRef.current = null;
  }, [playerData?.attemptId]);

  useEffect(() => {
    if (!playerData) {
      return;
    }

    const handleMessage = async (event: MessageEvent<any>) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const message = event.data;
      if (!message || message.source !== 'trace-h5p') {
        return;
      }

      if (message.type === 'height' && Number.isFinite(message.height)) {
        setFrameHeight(Math.max(MIN_FRAME_HEIGHT, Math.ceil(message.height)));
        return;
      }

      if (message.type === 'error') {
        if (!message.fatal) {
          return;
        }
        const errorMessage = message.message || 'Failed to load H5P activity';
        setError(errorMessage);
        onError?.(errorMessage);
        return;
      }

      if (message.type !== 'xapi') {
        return;
      }

      const statement = message.statement;
      const verb = statement?.verb?.id?.split('/').pop() || 'unknown';
      if (verb !== 'completed' || !playerData.attemptId) {
        return;
      }

      if (completedAttemptRef.current === playerData.attemptId) {
        return;
      }

      completedAttemptRef.current = playerData.attemptId;

      try {
        const score = statement.result?.score?.raw ?? 0;
        const maxScore = statement.result?.score?.max ?? 100;
        const xapiResult = await h5pAPI.submitXAPI({
          attemptId: playerData.attemptId,
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

        if (!xapiResult.data.completed) {
          completedAttemptRef.current = null;
          return;
        }

        setCompleted(true);
        const completionResult = {
          score: xapiResult.data.score || 0,
          maxScore: xapiResult.data.maxScore || 100,
          passed: xapiResult.data.passed || false,
          pointsAwarded: xapiResult.data.pointsAwarded || 0
        };
        setResult(completionResult);
        setShowPopup(true);
        onComplete?.(completionResult);
      } catch (submitError) {
        completedAttemptRef.current = null;
        console.error('[H5PPlayer] Failed to submit xAPI event:', submitError);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onComplete, onError, playerData]);

  const loadContent = async () => {
    try {
      setLoading(true);
      setError(null);
      setPlayerData(null);
      setCompleted(false);
      setShowPopup(false);
      setResult(null);
      setFrameHeight(DEFAULT_FRAME_HEIGHT);

      const response = await h5pAPI.getPlayerData(contentId);
      setPlayerData(response.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to load content';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const iframeSrcDoc = useMemo(() => {
    if (!playerData) {
      return '';
    }

    return buildH5PSrcDoc(playerData.player);
  }, [playerData]);

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

      {showPopup && result && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 transform animate-bounce-in ${
            result.passed ? 'ring-4 ring-green-400' : 'ring-4 ring-yellow-400'
          }`}>
            <button
              onClick={() => setShowPopup(false)}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>

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

            {result.passed && result.pointsAwarded === 0 && playerData?.assignment?.points && playerData.assignment.points > 0 && (
              <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl p-3 mb-4 text-center text-sm">
                You already earned points for this quiz!
              </div>
            )}

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

      {playerData && (
        <iframe
          ref={iframeRef}
          key={playerData.attemptId ?? contentId}
          title={playerData.content.title}
          srcDoc={iframeSrcDoc}
          className="w-full rounded-lg border-0 bg-white shadow-lg"
          style={{ height: `${frameHeight}px`, minHeight: `${MIN_FRAME_HEIGHT}px` }}
          allow="fullscreen"
        />
      )}
    </div>
  );
};

export default H5PPlayer;
