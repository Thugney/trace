import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { playSounds } from './utils/sounds';

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  registerSW({
    onNeedRefresh() {
      console.log('[PWA] New content available, please refresh');
    },
    onOfflineReady() {
      console.log('[PWA] App ready to work offline');
    },
    immediate: true
  });

  // Listen for push notification messages from service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'PUSH_RECEIVED') {
      const { notificationType } = event.data.payload;
      console.log('[Push] Received notification:', notificationType);

      // Play appropriate sound based on notification type
      switch (notificationType) {
        case 'new_book':
          playSounds.newBook();
          break;
        case 'new_quiz':
        case 'quiz_assigned':
          playSounds.newQuiz();
          break;
        case 'task_assigned':
        case 'new_task':
        case 'new_assignment':
          playSounds.newAssignment();
          break;
        case 'task_completed':
        case 'quiz_completed':
        case 'book_completed':
        case 'child_completed':
          playSounds.childCompleted();
          break;
        case 'reminder':
          playSounds.reminder();
          break;
        case 'message':
        case 'chat':
          playSounds.messageReceived();
          break;
        case 'achievement':
        case 'reward':
          playSounds.achievement();
          break;
        case 'level_up':
          playSounds.levelUp();
          break;
        default:
          playSounds.notification();
      }
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
