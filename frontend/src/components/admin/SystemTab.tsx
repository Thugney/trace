import { useState } from 'react';
import {
  Key,
  Server,
  Save,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  RefreshCcw,
  ExternalLink,
  Wifi,
  WifiOff,
  Download
} from 'lucide-react';
import clsx from 'clsx';

interface OllamaModel {
  name: string;
  size: number;
  parameterSize?: string;
  family?: string;
}

interface OllamaStatus {
  configured: boolean;
  connected: boolean;
  url: string | null;
  models: OllamaModel[];
  currentModel: string | null;
  message: string;
}

interface SystemTabProps {
  settings: Record<string, any>;
  ollamaStatus: OllamaStatus | null;
  ollamaLoading: boolean;
  onSaveGrokKey: (key: string) => Promise<void>;
  onConfigureOllama: (url: string, model: string) => Promise<void>;
  onTestOllama: (model: string) => Promise<void>;
  onPullOllamaModel: (model: string) => Promise<void>;
  onRefreshOllama: () => void;
}

export default function SystemTab({
  settings,
  ollamaStatus,
  ollamaLoading,
  onSaveGrokKey,
  onConfigureOllama,
  onTestOllama,
  onPullOllamaModel,
  onRefreshOllama
}: SystemTabProps) {
  const [grokApiKey, setGrokApiKey] = useState('');
  const [showGrokKey, setShowGrokKey] = useState(false);
  const [savingGrok, setSavingGrok] = useState(false);

  const [ollamaUrl, setOllamaUrl] = useState(ollamaStatus?.url || '');
  const [ollamaModel, setOllamaModel] = useState(ollamaStatus?.currentModel || '');
  const [newModel, setNewModel] = useState('');
  const [savingOllama, setSavingOllama] = useState(false);
  const [pullingModel, setPullingModel] = useState(false);
  const [testingModel, setTestingModel] = useState<string | null>(null);

  const handleSaveGrok = async () => {
    if (!grokApiKey.trim()) return;
    setSavingGrok(true);
    try {
      await onSaveGrokKey(grokApiKey);
      setGrokApiKey('');
    } finally {
      setSavingGrok(false);
    }
  };

  const handleSaveOllama = async () => {
    if (!ollamaUrl.trim()) return;
    setSavingOllama(true);
    try {
      await onConfigureOllama(ollamaUrl, ollamaModel);
    } finally {
      setSavingOllama(false);
    }
  };

  const handleTestModel = async (model: string) => {
    setTestingModel(model);
    try {
      await onTestOllama(model);
    } finally {
      setTestingModel(null);
    }
  };

  const handlePullModel = async () => {
    if (!newModel.trim()) return;
    setPullingModel(true);
    try {
      await onPullOllamaModel(newModel);
      setNewModel('');
    } finally {
      setPullingModel(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Grok API Key */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-[2px]">
        <div className="bg-white rounded-[14px] p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <Key className="text-white" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900">Grok AI Configuration</h3>
              <p className="text-sm text-slate-500">API key for cloud AI-powered features</p>
            </div>
            <span className={clsx(
              'px-3 py-1.5 text-xs font-semibold rounded-full flex items-center gap-1',
              settings.grok_api_enabled === 'true'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            )}>
              {settings.grok_api_enabled === 'true' ? (
                <>
                  <CheckCircle size={14} />
                  Configured
                </>
              ) : (
                <>
                  <AlertCircle size={14} />
                  Not Configured
                </>
              )}
            </span>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Grok API Key
            </label>
            <div className="relative">
              <input
                type={showGrokKey ? 'text' : 'password'}
                value={grokApiKey}
                onChange={(e) => setGrokApiKey(e.target.value)}
                className="w-full px-4 py-3.5 pr-12 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50"
                placeholder="Enter your Grok API key"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowGrokKey(!showGrokKey)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showGrokKey ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <p className="text-sm text-slate-500 mt-2 flex items-center gap-1">
              Get your API key from{' '}
              <a
                href="https://x.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 font-medium hover:underline inline-flex items-center gap-1"
              >
                x.ai
                <ExternalLink size={12} />
              </a>
            </p>
          </div>

          <button
            onClick={handleSaveGrok}
            disabled={savingGrok || !grokApiKey.trim()}
            className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-700 focus:ring-4 focus:ring-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {savingGrok ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save API Key
          </button>
        </div>
      </div>

      {/* Ollama Configuration */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-[2px]">
        <div className="bg-white rounded-[14px] p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
              <Server className="text-white" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900">Local AI (Ollama)</h3>
              <p className="text-sm text-slate-500">Free, private AI running on your local network</p>
            </div>
            <div className="flex items-center gap-2">
              {ollamaLoading ? (
                <Loader2 size={18} className="animate-spin text-slate-400" />
              ) : ollamaStatus?.connected ? (
                <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                  <Wifi size={14} />
                  Connected
                </span>
              ) : (
                <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                  <WifiOff size={14} />
                  Not Connected
                </span>
              )}
              <button
                onClick={onRefreshOllama}
                className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                title="Refresh status"
              >
                <RefreshCcw size={16} />
              </button>
            </div>
          </div>

          {/* URL & Model Configuration */}
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Ollama Server URL
              </label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50"
                placeholder="http://192.168.1.x:11434/api/chat"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Default Model
              </label>
              <input
                type="text"
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50"
                placeholder="llama3.2"
              />
            </div>
          </div>

          <button
            onClick={handleSaveOllama}
            disabled={savingOllama || !ollamaUrl.trim()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-700 focus:ring-4 focus:ring-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {savingOllama ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save Configuration
          </button>

          {/* Available Models */}
          {ollamaStatus?.connected && ollamaStatus.models.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h4 className="font-semibold text-slate-800 mb-3">Available Models</h4>
              <div className="flex flex-wrap gap-2">
                {ollamaStatus.models.map(model => (
                  <div
                    key={model.name}
                    className={clsx(
                      'inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border',
                      model.name === ollamaStatus.currentModel
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    )}
                  >
                    {model.name}
                    <button
                      onClick={() => handleTestModel(model.name)}
                      disabled={testingModel === model.name}
                      className="p-1 rounded hover:bg-white/50 transition-colors"
                      title="Test model"
                    >
                      {testingModel === model.name ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle size={14} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pull New Model */}
          {ollamaStatus?.connected && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <h4 className="font-semibold text-slate-800 mb-3">Pull New Model</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="e.g., mistral-nemo:latest"
                />
                <button
                  onClick={handlePullModel}
                  disabled={pullingModel || !newModel.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white font-medium rounded-xl hover:bg-slate-900 transition-all disabled:opacity-50"
                >
                  {pullingModel ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Pull
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Recommended: gemma3:12b, mistral-nemo:latest, llama3.1:latest
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
          <h4 className="font-bold text-slate-800 mb-2">Cloud AI (Grok)</h4>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>• Best for image generation</li>
            <li>• Requires internet connection</li>
            <li>• Usage-based pricing</li>
            <li>• Fastest response times</li>
          </ul>
        </div>
        <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200">
          <h4 className="font-bold text-slate-800 mb-2">Local AI (Ollama)</h4>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>• Completely free & private</li>
            <li>• Works offline on your network</li>
            <li>• Great for text generation</li>
            <li>• Requires local Ollama server</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
