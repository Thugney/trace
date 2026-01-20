import { Heart, Code, Sparkles, Rocket, CheckCircle } from 'lucide-react';

const features = [
  { emoji: '📋', title: 'Task Management', desc: 'Track and complete family tasks', color: 'from-blue-500 to-indigo-500' },
  { emoji: '🥗', title: 'Diet Tracking', desc: 'Monitor healthy eating habits', color: 'from-emerald-500 to-teal-500' },
  { emoji: '🤖', title: 'AI Assistant', desc: 'Smart help powered by Grok & Ollama', color: 'from-purple-500 to-pink-500' },
  { emoji: '🎮', title: 'Gamification', desc: 'Points, rewards, and achievements', color: 'from-amber-500 to-orange-500' },
  { emoji: '📚', title: 'Book Library', desc: 'AI-generated stories for kids', color: 'from-rose-500 to-red-500' },
  { emoji: '🧠', title: 'Family Quizzes', desc: 'Learn together with fun quizzes', color: 'from-cyan-500 to-blue-500' }
];

export default function AboutSection() {
  return (
    <div className="space-y-8">
      {/* Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-8 text-center">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-gradient-to-br from-primary-500/20 to-violet-500/20 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-violet-600 rounded-2xl shadow-2xl shadow-primary-500/30 mb-6">
            <Sparkles className="text-white" size={36} />
          </div>

          <h3 className="text-3xl font-bold text-white mb-2">
            Family Learning Hub
          </h3>

          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="px-3 py-1 bg-white/10 backdrop-blur rounded-full text-sm text-white/80 font-medium">
              Version 1.0.0
            </span>
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium flex items-center gap-1">
              <CheckCircle size={14} />
              Stable
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 text-white/60">
            <Code size={16} />
            <span>Built with React, TypeScript, and AI</span>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div>
        <h4 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Rocket className="text-primary-500" size={20} />
          Features
        </h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group relative overflow-hidden p-4 bg-white rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-lg transition-all"
            >
              <div className={`absolute inset-0 bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
              <div className="relative flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{feature.emoji}</span>
                <div>
                  <p className="font-semibold text-slate-900">{feature.title}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{feature.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { name: 'React', icon: '⚛️' },
          { name: 'TypeScript', icon: '🔷' },
          { name: 'Node.js', icon: '🟢' },
          { name: 'SQLite', icon: '🗃️' }
        ].map((tech, i) => (
          <div key={i} className="p-3 bg-slate-50 rounded-xl text-center">
            <span className="text-2xl">{tech.icon}</span>
            <p className="text-sm font-medium text-slate-600 mt-1">{tech.name}</p>
          </div>
        ))}
      </div>

      {/* Credits */}
      <div className="relative overflow-hidden p-6 bg-gradient-to-r from-rose-50 to-pink-50 rounded-2xl border border-rose-100 text-center">
        <div className="flex items-center justify-center gap-2 text-slate-700">
          <span className="font-medium">Made with</span>
          <Heart className="text-rose-500 animate-pulse" size={20} fill="currentColor" />
          <span className="font-medium">for families everywhere</span>
        </div>
        <p className="text-sm text-slate-500 mt-2">
          A comprehensive family management solution for modern households
        </p>
      </div>
    </div>
  );
}
