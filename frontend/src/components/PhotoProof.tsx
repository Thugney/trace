import { useState, useRef } from 'react';
import { Camera, Upload, X, Check, Loader2, Image as ImageIcon } from 'lucide-react';
import { photoProofAPI } from '../services/api';
import confetti from 'canvas-confetti';

interface PhotoProofProps {
  taskId: number;
  taskTitle: string;
  onProofUploaded: () => void;
  onCancel: () => void;
  existingProofUrl?: string | null;
}

export default function PhotoProof({
  taskId,
  taskTitle,
  onProofUploaded,
  onCancel,
  existingProofUrl
}: PhotoProofProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingProofUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Reserved for future camera mode toggle functionality
  const [useCamera, setUseCamera] = useState(false);
  void useCamera; void setUseCamera; // Suppress unused warnings - reserved for future use

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Photo is too large. Maximum size is 10MB.');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      await photoProofAPI.upload(taskId, selectedFile);

      // Success celebration
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#22c55e', '#10b981', '#34d399']
      });

      onProofUploaded();
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err.response?.data?.error || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(existingProofUrl || null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Photo Proof</h3>
            <p className="text-sm text-slate-500 truncate max-w-[250px]">{taskTitle}</p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Preview */}
          {previewUrl ? (
            <div className="relative">
              <img
                src={previewUrl}
                alt="Proof preview"
                className="w-full h-64 object-cover rounded-xl"
              />
              {selectedFile && (
                <button
                  onClick={clearSelection}
                  className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 text-slate-400" />
              <p className="text-slate-600 mb-1">Take a photo to prove you completed this task!</p>
              <p className="text-sm text-slate-400">Max file size: 10MB</p>
            </div>
          )}

          {/* Action Buttons */}
          {!selectedFile && (
            <div className="grid grid-cols-2 gap-3">
              {/* Camera button */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-cyan-600 transition-all"
              >
                <Camera size={20} />
                Take Photo
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-all"
              >
                <Upload size={20} />
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Submit/Cancel */}
          {selectedFile && (
            <div className="flex gap-3">
              <button
                onClick={clearSelection}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-all"
              >
                Choose Different
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Check size={20} />
                    Submit Proof
                  </>
                )}
              </button>
            </div>
          )}

          {existingProofUrl && !selectedFile && (
            <div className="text-center">
              <p className="text-sm text-green-600 flex items-center justify-center gap-2">
                <Check size={16} />
                Photo proof already submitted
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact button to trigger photo proof modal
export function PhotoProofButton({
  taskId,
  hasProof,
  onClick
}: {
  taskId: number;
  hasProof: boolean;
  onClick: () => void;
}) {
  void taskId; // Reserved for future use
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
        hasProof
          ? 'bg-green-100 text-green-700 hover:bg-green-200'
          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
      }`}
    >
      {hasProof ? (
        <>
          <Check size={14} />
          Proof Added
        </>
      ) : (
        <>
          <Camera size={14} />
          Add Proof
        </>
      )}
    </button>
  );
}
