import { useState, useEffect } from 'react';
import { Server, RefreshCw, Check, Loader2, Play, Wifi, WifiOff, Cpu } from 'lucide-react';
import { settingsAPI, OllamaStatus } from '../../services/api';

interface OllamaSettingsProps {
  onSuccess: (message: string) => void;
}

export default function OllamaSettings({ onSuccess }: OllamaSettingsProps) {
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');

  useEffect(() => {
    loadOllamaStatus();
  }, []);

  const loadOllamaStatus = async () => {
    setLoading(true);
    try {
      const response = await settingsAPI.getOllamaStatus();
      setOllamaStatus(response.data);
      if (response.data.currentModel) {
        setSelectedModel(response.data.currentModel);
      }
    } catch (error) {
      console.error('Failed to load Ollama status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestOllama = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await settingsAPI.testOllama(selectedModel);
      if (response.data.success) {
        setTestResult(`${response.data.model}: "${response.data.response}"`);
      } else {
        setTestResult('Test failed');
      }
    } catch (error: any) {
      setTestResult(error.response?.data?.error || error.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveModel = async () => {
    try {
      await settingsAPI.configureOllama({ model: selectedModel });
      onSuccess('Ollama model updated!');
      loadOllamaStatus();
    } catch (error) {
      console.error('Failed to save Ollama model:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Local AI (Ollama)</h2>
          <p className="text-sm text-slate-500 mt-1">
            Configure local AI for free text generation
          </p>
        </div>
        <button
          onClick={loadOllamaStatus}
          disabled={loading}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          title="Refresh status"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200">
        <div className="flex gap-3">
          <Server className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-green-800">
            <p className="font-medium">Free, Local AI Text Generation</p>
            <p className="mt-1 text-green-600">
              Ollama runs on your network and generates book/quiz text for free. Images still use cloud providers.
            </p>
          </div>
        </div>
      </div>

      {ollamaStatus ? (
        <div className="space-y-6">
          {/* Connection Status Card */}
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${
                  ollamaStatus.connected
                    ? 'bg-green-100'
                    : ollamaStatus.configured
                      ? 'bg-amber-100'
                      : 'bg-slate-200'
                }`}>
                  {ollamaStatus.connected ? (
                    <Wifi className="text-green-600" size={24} />
                  ) : (
                    <WifiOff className={ollamaStatus.configured ? 'text-amber-600' : 'text-slate-400'} size={24} />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Connection Status</p>
                  <p className="text-sm text-slate-500">{ollamaStatus.message}</p>
                </div>
              </div>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                ollamaStatus.connected
                  ? 'bg-green-100 text-green-700'
                  : ollamaStatus.configured
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-200 text-slate-600'
              }`}>
                {ollamaStatus.connected ? 'Connected' : ollamaStatus.configured ? 'Offline' : 'Not Configured'}
              </span>
            </div>
          </div>

          {/* Model Selection */}
          {ollamaStatus.connected && ollamaStatus.models.length > 0 && (
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-violet-100 rounded-lg">
                  <Cpu className="text-violet-600" size={20} />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Active Model</p>
                  <p className="text-xs text-slate-500">Larger models (12B+) give better results but are slower</p>
                </div>
              </div>

              <div className="flex gap-3">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-shadow bg-white"
                >
                  {ollamaStatus.models.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name} ({model.parameterSize || 'unknown size'})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleSaveModel}
                  disabled={selectedModel === ollamaStatus.currentModel}
                  className="px-5 py-3 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700 focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Available Models */}
          {ollamaStatus.connected && ollamaStatus.models.length > 0 && (
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
              <details className="group">
                <summary className="cursor-pointer font-semibold text-slate-900 flex items-center justify-between">
                  <span>Available Models ({ollamaStatus.models.length})</span>
                  <span className="text-sm text-slate-400 group-open:hidden">Click to expand</span>
                </summary>
                <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                  {ollamaStatus.models.map((model) => (
                    <div
                      key={model.name}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                        model.name === ollamaStatus.currentModel
                          ? 'bg-green-50 border-green-200'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Cpu className={`${
                          model.name === ollamaStatus.currentModel
                            ? 'text-green-600'
                            : 'text-slate-400'
                        }`} size={18} />
                        <div>
                          <p className="font-medium text-slate-900">{model.name}</p>
                          <p className="text-xs text-slate-500">
                            {model.parameterSize} • {model.family || 'unknown family'}
                          </p>
                        </div>
                      </div>
                      {model.name === ollamaStatus.currentModel && (
                        <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          <Check size={14} />
                          Active
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}

          {/* Test Button */}
          {ollamaStatus.connected && (
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Play className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Test Model</p>
                  <p className="text-xs text-slate-500">Send a test prompt to verify the model works</p>
                </div>
              </div>

              <button
                onClick={handleTestOllama}
                disabled={testing}
                className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {testing ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    Run Test
                  </>
                )}
              </button>

              {testResult && (
                <div className={`mt-4 p-4 rounded-xl text-sm ${
                  testResult.includes('"')
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {testResult.includes('"') ? (
                    <div>
                      <p className="font-medium text-green-700 mb-1">Test Successful</p>
                      <p className="text-green-600">{testResult}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium text-red-700 mb-1">Test Failed</p>
                      <p className="text-red-600">{testResult}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* No Models Warning */}
          {ollamaStatus.connected && ollamaStatus.models.length === 0 && (
            <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200">
              <div className="flex gap-3">
                <Server className="text-amber-600 flex-shrink-0" size={24} />
                <div>
                  <p className="font-semibold text-amber-800">No models found!</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Pull a model on your Ollama server:
                  </p>
                  <code className="block mt-3 px-4 py-2 bg-amber-100 rounded-lg text-sm font-mono text-amber-900">
                    ollama pull llama3.2
                  </code>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <WifiOff size={48} className="mx-auto mb-4 text-slate-300" />
          <p className="font-medium text-slate-600">Could not load Ollama status</p>
          <button
            onClick={loadOllamaStatus}
            className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
