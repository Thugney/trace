import { Heart, Code, Sparkles } from 'lucide-react';

export default function AboutSection() {
  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900">About</h2>
        <p className="text-sm text-slate-500 mt-1">
          Application information and credits
        </p>
      </div>

      {/* App Info Card */}
      <div className="p-8 bg-gradient-to-br from-primary-50 via-violet-50 to-blue-50 rounded-2xl border border-primary-100 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
          <Sparkles className="text-primary-600" size={32} />
        </div>

        <h3 className="text-2xl font-bold text-primary-900 mb-2">
          Family Learning Hub
        </h3>

        <p className="text-primary-700 mb-4">Version 1.0.0</p>

        <div className="flex items-center justify-center gap-2 text-sm text-primary-600">
          <Code size={16} />
          <span>Built with React, TypeScript, and AI</span>
        </div>
      </div>

      {/* Features */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { emoji: '', title: 'Task Management', desc: 'Track and complete family tasks' },
          { emoji: '', title: 'Diet Tracking', desc: 'Monitor healthy eating habits' },
          { emoji: '', title: 'AI Assistant', desc: 'Smart help powered by Grok & Ollama' },
          { emoji: '', title: 'Gamification', desc: 'Points, rewards, and achievements' },
          { emoji: '', title: 'Book Library', desc: 'AI-generated stories for kids' },
          { emoji: '', title: 'Family Quizzes', desc: 'Learn together with fun quizzes' }
        ].map((feature, i) => (
          <div
            key={i}
            className="p-4 bg-white rounded-xl border border-slate-200 flex items-start gap-3"
          >
            <span className="text-2xl">{feature.emoji}</span>
            <div>
              <p className="font-medium text-slate-900">{feature.title}</p>
              <p className="text-sm text-slate-500">{feature.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Credits */}
      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center">
        <div className="flex items-center justify-center gap-2 text-slate-600">
          <span>Made with</span>
          <Heart className="text-red-500" size={18} fill="currentColor" />
          <span>for families everywhere</span>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          A comprehensive family management solution
        </p>
      </div>
    </div>
  );
}
