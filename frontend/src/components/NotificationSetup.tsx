import { useState, useEffect } from 'react';
import { Bell, BellRing, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface NotificationSetupProps {
  profileName: string;
  onComplete: () => void;
  onSkip?: () => void;
  required?: boolean;
}

/**
 * Mandatory notification setup component for child profiles.
 * Shows a full-screen overlay prompting the user to enable push notifications.
 * This ensures kids receive task reminders on their devices.
 */
export default function NotificationSetup({
  profileName,
  onComplete,
  onSkip,
  required = true
}: NotificationSetupProps) {
  const [step, setStep] = useState<'intro' | 'requesting' | 'success' | 'denied' | 'unsupported'>('intro');
  const [error, setError] = useState<string | null>(null);

  const {
    isSupported,
    isSubscribed,
    permission,
    loading,
    subscribe
  } = usePushNotifications();

  // Check if already subscribed
  useEffect(() => {
    if (!loading && isSubscribed) {
      setStep('success');
      // Auto-complete after showing success briefly
      setTimeout(onComplete, 1500);
    }
  }, [isSubscribed, loading, onComplete]);

  // Check if not supported
  useEffect(() => {
    if (!loading && !isSupported) {
      setStep('unsupported');
    }
  }, [isSupported, loading]);

  // Check if permission was denied previously
  useEffect(() => {
    if (!loading && permission === 'denied') {
      setStep('denied');
    }
  }, [permission, loading]);

  const handleEnableNotifications = async () => {
    setStep('requesting');
    setError(null);

    try {
      const success = await subscribe();

      if (success) {
        setStep('success');
        // Store that this profile has completed notification setup
        localStorage.setItem(`notification_setup_${profileName}`, 'completed');
        setTimeout(onComplete, 1500);
      } else {
        // Check what went wrong
        if (Notification.permission === 'denied') {
          setStep('denied');
        } else {
          setError('Could not enable notifications. Please try again.');
          setStep('intro');
        }
      }
    } catch (err: any) {
      console.error('Notification setup error:', err);
      setError(err.message || 'Failed to enable notifications');
      setStep('intro');
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      localStorage.setItem(`notification_setup_${profileName}`, 'skipped');
      onSkip();
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center z-50">
        <div className="text-white text-center">
          <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4" />
          <p>Checking notification status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-100 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-100 rounded-full translate-y-1/2 -translate-x-1/2 opacity-50" />

        {/* Content */}
        <div className="relative z-10">
          {step === 'intro' && (
            <>
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <BellRing className="w-10 h-10 text-indigo-600 animate-bounce" />
              </div>

              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Hey {profileName}! 👋
              </h2>

              <p className="text-gray-600 mb-6">
                Enable notifications so you never miss a task reminder!
                We'll let you know when it's time to do your tasks.
              </p>

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleEnableNotifications}
                className="w-full bg-indigo-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                <Bell className="w-5 h-5" />
                Enable Notifications
              </button>

              {!required && onSkip && (
                <button
                  onClick={handleSkip}
                  className="mt-4 text-gray-500 hover:text-gray-700 text-sm"
                >
                  Skip for now
                </button>
              )}

              <p className="text-xs text-gray-400 mt-6">
                You can change this later in Settings
              </p>
            </>
          )}

          {step === 'requesting' && (
            <>
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Bell className="w-10 h-10 text-yellow-600 animate-pulse" />
              </div>

              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Almost there!
              </h2>

              <p className="text-gray-600 mb-6">
                Please click <strong>"Allow"</strong> when your browser asks for permission.
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                <AlertTriangle className="w-5 h-5 inline mr-2" />
                Look for the popup at the top of your screen!
              </div>
            </>
          )}

          {step === 'success' && (
            <>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>

              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                You're all set! 🎉
              </h2>

              <p className="text-gray-600">
                You'll now receive reminders for your tasks!
              </p>
            </>
          )}

          {step === 'denied' && (
            <>
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <X className="w-10 h-10 text-red-600" />
              </div>

              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Notifications Blocked
              </h2>

              <p className="text-gray-600 mb-6">
                Notifications are blocked in your browser settings.
                To receive task reminders, you'll need to enable them manually.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 text-left mb-6">
                <p className="font-semibold mb-2">How to enable:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click the lock/info icon in your browser's address bar</li>
                  <li>Find "Notifications" in the permissions</li>
                  <li>Change it to "Allow"</li>
                  <li>Refresh this page</li>
                </ol>
              </div>

              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-gray-700 transition-colors"
              >
                Refresh Page
              </button>

              {!required && onSkip && (
                <button
                  onClick={handleSkip}
                  className="mt-4 text-gray-500 hover:text-gray-700 text-sm"
                >
                  Continue without notifications
                </button>
              )}
            </>
          )}

          {step === 'unsupported' && (
            <>
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-orange-600" />
              </div>

              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Notifications Not Supported
              </h2>

              <p className="text-gray-600 mb-6">
                Your browser or device doesn't support push notifications.
                For the best experience, try using Chrome or installing the app.
              </p>

              <button
                onClick={onComplete}
                className="w-full bg-gray-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-gray-700 transition-colors"
              >
                Continue Anyway
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
