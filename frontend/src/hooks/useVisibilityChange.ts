import { useEffect } from 'react';

interface UseVisibilityChangeOptions {
  onVisible?: () => void;
  onHidden?: () => void;
  onBeforeUnload?: () => void;
}

export function useVisibilityChange(options: UseVisibilityChangeOptions = {}) {
  const { onVisible, onHidden, onBeforeUnload } = options;

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (onVisible) onVisible();
      } else if (document.visibilityState === 'hidden') {
        if (onHidden) onHidden();
      }
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (onBeforeUnload) {
        onBeforeUnload();
        // For modern browsers, we don't need to show the default dialog
        // but we should still save state
        event.preventDefault();
        event.returnValue = '';
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [onVisible, onHidden, onBeforeUnload]);
}