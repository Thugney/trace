const fs = require('fs');
const path = require('path');

// Fix ChildDashboard.tsx
const dashboardPath = path.join(__dirname, 'frontend/src/pages/ChildDashboard.tsx');
let content = fs.readFileSync(dashboardPath, 'utf8');

// 1. Update AVATAR_CATEGORIES to include superhero and animal avatars the kid likes
const oldAvatarCategories = `// Avatar categories with emojis
const AVATAR_CATEGORIES = [
  {
    name: 'People',
    avatars: [
      { emoji: '👦', label: 'Boy', minLevel: 1 },
      { emoji: '👧', label: 'Girl', minLevel: 1 },
      { emoji: '🧒', label: 'Child', minLevel: 1 },
      { emoji: '👶', label: 'Baby', minLevel: 1 },
      { emoji: '🧑', label: 'Person', minLevel: 1 },
      { emoji: '👤', label: 'Silhouette', minLevel: 1 },
    ]
  },
  {
    name: 'Cool Characters',
    avatars: [
      { emoji: '🦸', label: 'Superhero', minLevel: 3 },
      { emoji: '🦹', label: 'Supervillain', minLevel: 5 },
      { emoji: '🧙', label: 'Wizard', minLevel: 4 },
      { emoji: '🧚', label: 'Fairy', minLevel: 3 },
      { emoji: '🧛', label: 'Vampire', minLevel: 6 },
      { emoji: '🧜', label: 'Merperson', minLevel: 5 },
      { emoji: '🧝', label: 'Elf', minLevel: 4 },
      { emoji: '🥷', label: 'Ninja', minLevel: 7 },
      { emoji: '🤴', label: 'Prince', minLevel: 8 },
      { emoji: '👸', label: 'Princess', minLevel: 8 },
      { emoji: '👑', label: 'Crown', minLevel: 10 },
    ]
  },
  {
    name: 'Animals',
    avatars: [
      { emoji: '🐱', label: 'Cat', minLevel: 1 },
      { emoji: '🐶', label: 'Dog', minLevel: 1 },
      { emoji: '🐰', label: 'Rabbit', minLevel: 1 },
      { emoji: '🐻', label: 'Bear', minLevel: 2 },
      { emoji: '🦊', label: 'Fox', minLevel: 2 },
      { emoji: '🐼', label: 'Panda', minLevel: 3 },
      { emoji: '🦁', label: 'Lion', minLevel: 4 },
      { emoji: '🐯', label: 'Tiger', minLevel: 4 },
      { emoji: '🦄', label: 'Unicorn', minLevel: 5 },
      { emoji: '🐉', label: 'Dragon', minLevel: 8 },
      { emoji: '🦅', label: 'Eagle', minLevel: 6 },
      { emoji: '🦋', label: 'Butterfly', minLevel: 2 },
    ]
  },
  {
    name: 'Fun & Sports',
    avatars: [
      { emoji: '⚽', label: 'Soccer', minLevel: 1 },
      { emoji: '🏀', label: 'Basketball', minLevel: 1 },
      { emoji: '🎮', label: 'Gaming', minLevel: 2 },
      { emoji: '🎸', label: 'Guitar', minLevel: 3 },
      { emoji: '🎨', label: 'Art', minLevel: 2 },
      { emoji: '🚀', label: 'Rocket', minLevel: 5 },
      { emoji: '🌟', label: 'Star', minLevel: 4 },
      { emoji: '🔥', label: 'Fire', minLevel: 6 },
      { emoji: '💎', label: 'Diamond', minLevel: 9 },
      { emoji: '🏆', label: 'Trophy', minLevel: 10 },
    ]
  }
];`;

const newAvatarCategories = `// Avatar categories with emojis - Superheroes and Animals for kids!
const AVATAR_CATEGORIES = [
  {
    name: 'Superheroes',
    avatars: [
      { emoji: '🦸', label: 'Superhero', minLevel: 1 },
      { emoji: '🦸‍♂️', label: 'Hero Boy', minLevel: 1 },
      { emoji: '🦹', label: 'Super Villain', minLevel: 1 },
      { emoji: '🕷️', label: 'Spider', minLevel: 1 },
      { emoji: '🦇', label: 'Bat', minLevel: 1 },
      { emoji: '🐆', label: 'Black Panther', minLevel: 1 },
      { emoji: '💚', label: 'Green Power', minLevel: 1 },
      { emoji: '🥷', label: 'Ninja', minLevel: 2 },
      { emoji: '⚡', label: 'Lightning', minLevel: 2 },
      { emoji: '🛡️', label: 'Shield', minLevel: 2 },
      { emoji: '🔨', label: 'Hammer', minLevel: 3 },
      { emoji: '🌟', label: 'Star Power', minLevel: 3 },
    ]
  },
  {
    name: 'Strong Animals',
    avatars: [
      { emoji: '🦍', label: 'Gorilla', minLevel: 1 },
      { emoji: '🦁', label: 'Lion', minLevel: 1 },
      { emoji: '🐻', label: 'Bear', minLevel: 1 },
      { emoji: '🐯', label: 'Tiger', minLevel: 1 },
      { emoji: '🐺', label: 'Wolf', minLevel: 1 },
      { emoji: '🦈', label: 'Shark', minLevel: 2 },
      { emoji: '🐊', label: 'Crocodile', minLevel: 2 },
      { emoji: '🦅', label: 'Eagle', minLevel: 2 },
      { emoji: '🐘', label: 'Elephant', minLevel: 2 },
      { emoji: '🦏', label: 'Rhino', minLevel: 3 },
      { emoji: '🐉', label: 'Dragon', minLevel: 4 },
      { emoji: '🦖', label: 'T-Rex', minLevel: 4 },
    ]
  },
  {
    name: 'Cool Characters',
    avatars: [
      { emoji: '👦', label: 'Boy', minLevel: 1 },
      { emoji: '👧', label: 'Girl', minLevel: 1 },
      { emoji: '🧒', label: 'Kid', minLevel: 1 },
      { emoji: '🧙', label: 'Wizard', minLevel: 2 },
      { emoji: '🧚', label: 'Fairy', minLevel: 2 },
      { emoji: '🧝', label: 'Elf', minLevel: 3 },
      { emoji: '🤴', label: 'Prince', minLevel: 3 },
      { emoji: '👸', label: 'Princess', minLevel: 3 },
      { emoji: '🧛', label: 'Vampire', minLevel: 4 },
      { emoji: '🧜', label: 'Mermaid', minLevel: 4 },
      { emoji: '👑', label: 'King', minLevel: 5 },
      { emoji: '🦄', label: 'Unicorn', minLevel: 5 },
    ]
  },
  {
    name: 'Fun Stuff',
    avatars: [
      { emoji: '⚽', label: 'Soccer', minLevel: 1 },
      { emoji: '🏀', label: 'Basketball', minLevel: 1 },
      { emoji: '🎮', label: 'Gaming', minLevel: 1 },
      { emoji: '🚀', label: 'Rocket', minLevel: 2 },
      { emoji: '🔥', label: 'Fire', minLevel: 2 },
      { emoji: '💎', label: 'Diamond', minLevel: 3 },
      { emoji: '🏆', label: 'Trophy', minLevel: 4 },
      { emoji: '👾', label: 'Alien', minLevel: 3 },
      { emoji: '🤖', label: 'Robot', minLevel: 3 },
      { emoji: '🎸', label: 'Guitar', minLevel: 2 },
      { emoji: '🎨', label: 'Art', minLevel: 1 },
      { emoji: '⭐', label: 'Gold Star', minLevel: 1 },
    ]
  }
];`;

content = content.replace(oldAvatarCategories, newAvatarCategories);
console.log('Updated avatar categories with superheroes and animals');

// 2. Add avatar picker click handler to young child view
const oldYoungChildAvatar = `        {/* Simple greeting with avatar */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-5xl shadow-lg">
            {currentProfile?.avatar || '😊'}
          </div>`;

const newYoungChildAvatar = `        {/* Simple greeting with avatar - tap to change! */}
        <div className="text-center mb-8">
          <button
            onClick={() => setShowAvatarPicker(true)}
            className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-5xl shadow-lg hover:scale-110 transition-transform ring-4 ring-yellow-300"
            title="Tap to change avatar!"
          >
            {currentProfile?.avatar || '😊'}
          </button>
          <p className="text-xs text-slate-500 mb-2">👆 Tap to change!</p>`;

content = content.replace(oldYoungChildAvatar, newYoungChildAvatar);
console.log('Added avatar picker button to young child view');

// 3. Add avatar picker modal to young child view (before the closing div of the return)
// Find the end of young child view and add the modal
const youngChildEndPattern = `        {/* Stats summary */}
        {completedTasks > 0 && (`;

const youngChildModalAndStats = `        {/* Avatar Picker Modal for Young Kids */}
        {showAvatarPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-center">
                <h3 className="text-2xl font-bold">Pick Your Avatar! 🎨</h3>
                <p className="text-purple-100">Tap one you like!</p>
              </div>

              {/* Category tabs */}
              <div className="flex overflow-x-auto p-2 bg-gray-100 gap-2">
                {AVATAR_CATEGORIES.map((cat, idx) => (
                  <button
                    key={cat.name}
                    onClick={() => setAvatarCategory(idx)}
                    className={\`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all \${
                      avatarCategory === idx
                        ? 'bg-purple-500 text-white'
                        : 'bg-white text-gray-600 hover:bg-purple-100'
                    }\`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Avatar Grid */}
              <div className="p-4 overflow-y-auto max-h-[40vh]">
                <div className="grid grid-cols-4 gap-3">
                  {AVATAR_CATEGORIES[avatarCategory].avatars.map((avatar) => {
                    const isUnlocked = level >= avatar.minLevel;
                    const isSelected = currentProfile?.avatar === avatar.emoji;
                    return (
                      <button
                        key={avatar.emoji}
                        onClick={() => isUnlocked && updateAvatar(avatar.emoji)}
                        disabled={!isUnlocked || savingAvatar}
                        className={\`relative p-3 rounded-xl transition-all \${
                          isSelected
                            ? 'bg-purple-100 ring-4 ring-purple-500 scale-110'
                            : isUnlocked
                            ? 'bg-gray-50 hover:bg-gray-100 hover:scale-110'
                            : 'bg-gray-100 opacity-50'
                        }\`}
                        title={isUnlocked ? avatar.label : \`Level \${avatar.minLevel} needed\`}
                      >
                        <span className="text-4xl block">{avatar.emoji}</span>
                        {!isUnlocked && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/40 rounded-xl">
                            <div className="text-center">
                              <Lock size={16} className="text-white mx-auto" />
                              <span className="text-xs text-white font-bold">Lv{avatar.minLevel}</span>
                            </div>
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <CheckCircle size={16} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Close button */}
              <div className="p-4 bg-gray-50 text-center">
                <button
                  onClick={() => setShowAvatarPicker(false)}
                  className="px-8 py-3 bg-purple-500 text-white rounded-full font-bold text-lg hover:bg-purple-600"
                >
                  Done! ✨
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats summary */}
        {completedTasks > 0 && (`;

content = content.replace(youngChildEndPattern, youngChildModalAndStats);
console.log('Added avatar picker modal to young child view');

// 4. Improve task completion with better error handling
const oldTaskComplete = `  // Handle task completion for young kids
  const handleSimpleTaskComplete = async (taskId: number) => {
    try {
      await tasksAPI.complete(taskId);
      // Reload tasks
      if (currentProfile) {
        const res = await tasksAPI.getByProfile(currentProfile.id);
        setSimpleTasks(res.data.filter((t) => !t.completed).slice(0, 4));
        // Reload stats
        const statsRes = await profilesAPI.getStats(currentProfile.id);
        setStats(statsRes.data);
      }
    } catch (e) {
      console.error('Failed to complete task:', e);
    }
  };`;

const newTaskComplete = `  // Handle task completion for young kids
  const handleSimpleTaskComplete = async (taskId: number) => {
    try {
      console.log('Completing task:', taskId);
      const result = await tasksAPI.complete(taskId);
      console.log('Task completed:', result.data);

      // Play success sound
      playSounds.taskComplete();

      // Reload tasks
      if (currentProfile) {
        const res = await tasksAPI.getByProfile(currentProfile.id);
        console.log('Reloaded tasks:', res.data.length);
        setSimpleTasks(res.data.filter((t: any) => !t.completed).slice(0, 4));
        // Reload stats
        const statsRes = await profilesAPI.getStats(currentProfile.id);
        setStats(statsRes.data);
      }
    } catch (e: any) {
      console.error('Failed to complete task:', e);
      // Show error feedback
      if (e.response?.data?.error === 'Task already completed') {
        // Task was already done, just refresh
        if (currentProfile) {
          const res = await tasksAPI.getByProfile(currentProfile.id);
          setSimpleTasks(res.data.filter((t: any) => !t.completed).slice(0, 4));
        }
      } else {
        playSounds.error();
      }
    }
  };`;

content = content.replace(oldTaskComplete, newTaskComplete);
console.log('Improved task completion error handling');

fs.writeFileSync(dashboardPath, content);
console.log('All fixes applied to ChildDashboard.tsx!');
