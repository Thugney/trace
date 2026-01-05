// Sound utility using Web Audio API for lightweight, satisfying feedback sounds

// AudioContext singleton
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

// Resume audio context if suspended (required by browsers for autoplay policy)
async function ensureAudioContext() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  return ctx;
}

// Helper to create oscillator tones
function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  ensureAudioContext().then(ctx => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  });
}

// Play a sequence of tones
function playMelody(notes: { freq: number; duration: number; delay: number }[], type: OscillatorType = 'sine') {
  notes.forEach(note => {
    setTimeout(() => playTone(note.freq, note.duration, type), note.delay * 1000);
  });
}

// Haptic feedback for mobile
function vibrate(pattern: number | number[]) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

// ==================== SOUND EFFECTS ====================

export const sounds = {
  // Task completed - satisfying "ding"
  taskComplete: () => {
    playMelody([
      { freq: 523, duration: 0.1, delay: 0 },    // C5
      { freq: 659, duration: 0.1, delay: 0.08 }, // E5
      { freq: 784, duration: 0.2, delay: 0.16 }  // G5
    ], 'sine');
    vibrate(50);
  },

  // Points earned - coin sound
  pointsEarned: () => {
    playMelody([
      { freq: 1047, duration: 0.05, delay: 0 },   // C6
      { freq: 1319, duration: 0.08, delay: 0.05 } // E6
    ], 'square');
    vibrate([30, 20, 30]);
  },

  // Level up - triumphant fanfare
  levelUp: () => {
    playMelody([
      { freq: 392, duration: 0.15, delay: 0 },    // G4
      { freq: 523, duration: 0.15, delay: 0.15 }, // C5
      { freq: 659, duration: 0.15, delay: 0.30 }, // E5
      { freq: 784, duration: 0.25, delay: 0.45 }, // G5
      { freq: 1047, duration: 0.4, delay: 0.60 }  // C6
    ], 'sine');
    vibrate([50, 30, 50, 30, 100]);
  },

  // Achievement unlocked
  achievement: () => {
    playMelody([
      { freq: 784, duration: 0.1, delay: 0 },     // G5
      { freq: 988, duration: 0.1, delay: 0.1 },   // B5
      { freq: 1175, duration: 0.15, delay: 0.2 }, // D6
      { freq: 1568, duration: 0.3, delay: 0.35 }  // G6
    ], 'sine');
    vibrate([50, 50, 100]);
  },

  // Daily bonus claimed
  bonusClaimed: () => {
    playMelody([
      { freq: 523, duration: 0.08, delay: 0 },    // C5
      { freq: 659, duration: 0.08, delay: 0.08 }, // E5
      { freq: 784, duration: 0.08, delay: 0.16 }, // G5
      { freq: 1047, duration: 0.08, delay: 0.24 },// C6
      { freq: 1319, duration: 0.15, delay: 0.32 },// E6
      { freq: 1568, duration: 0.3, delay: 0.45 }  // G6
    ], 'sine');
    vibrate([30, 20, 30, 20, 50, 100]);
  },

  // Mystery reward - magical sparkle
  mysteryReward: () => {
    playMelody([
      { freq: 1047, duration: 0.1, delay: 0 },    // C6
      { freq: 1319, duration: 0.1, delay: 0.1 },  // E6
      { freq: 1568, duration: 0.1, delay: 0.2 },  // G6
      { freq: 2093, duration: 0.2, delay: 0.3 },  // C7
      { freq: 1568, duration: 0.1, delay: 0.45 }, // G6
      { freq: 2093, duration: 0.25, delay: 0.55 } // C7
    ], 'triangle');
    vibrate([20, 30, 20, 30, 20, 100]);
  },

  // Water logged
  waterLogged: () => {
    playTone(880, 0.1, 'sine', 0.2); // A5
    setTimeout(() => playTone(1100, 0.15, 'sine', 0.15), 100);
    vibrate(30);
  },

  // Button click - subtle feedback
  click: () => {
    playTone(800, 0.05, 'sine', 0.1);
    vibrate(10);
  },

  // Error/warning
  error: () => {
    playMelody([
      { freq: 300, duration: 0.15, delay: 0 },
      { freq: 250, duration: 0.2, delay: 0.15 }
    ], 'sawtooth');
    vibrate([100, 50, 100]);
  },

  // Streak freeze used
  streakFreeze: () => {
    playMelody([
      { freq: 1047, duration: 0.1, delay: 0 },    // C6
      { freq: 880, duration: 0.1, delay: 0.1 },   // A5
      { freq: 784, duration: 0.15, delay: 0.2 },  // G5
      { freq: 659, duration: 0.2, delay: 0.35 }   // E5
    ], 'triangle');
    vibrate([50, 50, 100]);
  },

  // Challenge complete
  challengeComplete: () => {
    playMelody([
      { freq: 659, duration: 0.1, delay: 0 },     // E5
      { freq: 784, duration: 0.1, delay: 0.08 },  // G5
      { freq: 988, duration: 0.15, delay: 0.16 }, // B5
      { freq: 1319, duration: 0.25, delay: 0.28 } // E6
    ], 'sine');
    vibrate([40, 30, 80]);
  }
};

// Check if sounds are enabled (can be toggled by user preference)
export function areSoundsEnabled(): boolean {
  const stored = localStorage.getItem('soundsEnabled');
  return stored === null ? true : stored === 'true';
}

export function setSoundsEnabled(enabled: boolean) {
  localStorage.setItem('soundsEnabled', String(enabled));
}

// Wrapped sound functions that respect user preference
export const playSounds = {
  taskComplete: () => areSoundsEnabled() && sounds.taskComplete(),
  pointsEarned: () => areSoundsEnabled() && sounds.pointsEarned(),
  levelUp: () => areSoundsEnabled() && sounds.levelUp(),
  achievement: () => areSoundsEnabled() && sounds.achievement(),
  bonusClaimed: () => areSoundsEnabled() && sounds.bonusClaimed(),
  mysteryReward: () => areSoundsEnabled() && sounds.mysteryReward(),
  waterLogged: () => areSoundsEnabled() && sounds.waterLogged(),
  click: () => areSoundsEnabled() && sounds.click(),
  error: () => areSoundsEnabled() && sounds.error(),
  streakFreeze: () => areSoundsEnabled() && sounds.streakFreeze(),
  challengeComplete: () => areSoundsEnabled() && sounds.challengeComplete()
};

export default playSounds;
