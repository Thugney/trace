import { useState, useRef } from 'react';
import { Upload, X, Loader2, ImageIcon, Music } from 'lucide-react';
import { familyQuizzesAPI } from '../services/api';
import { useToast } from './Toast';

interface QuizMediaUploaderProps {
  quizId: number;
  onUploadComplete: (url: string) => void;
  allowedTypes?: 'image' | 'audio' | 'both';
  label?: string;
  existingUrl?: string | null;
}

export default function QuizMediaUploader({
  quizId,
  onUploadComplete,
  allowedTypes = 'both',
  label = 'Upload media',
  existingUrl
}: QuizMediaUploaderProps) {
  const { showToast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');
    if (allowedTypes === 'image' && !isImage) {
      setError('Please select an image file');
      return;
    }
    if (allowedTypes === 'audio' && !isAudio) {
      setError('Please select an audio file');
      return;
    }
    if (allowedTypes === 'both' && !isImage && !isAudio) {
      setError('Please select an image or audio file');
      return;
    }

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size is 10MB.');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile || !quizId) return;

    setUploading(true);
    setError(null);

    try {
      const response = await familyQuizzesAPI.uploadMedia(quizId, selectedFile);
      const fullUrl = familyQuizzesAPI.getMediaUrl(response.data.filename);
      onUploadComplete(fullUrl);
      showToast('Media uploaded successfully!', 'success');
      // Keep preview URL as the new uploaded file
      setPreviewUrl(fullUrl);
      setSelectedFile(null);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err.response?.data?.error || 'Failed to upload media');
      showToast('Failed to upload media', 'error');
    } finally {
      setUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(existingUrl || null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setError(null);
  };

  const acceptTypes = allowedTypes === 'image'
    ? 'image/*'
    : allowedTypes === 'audio'
      ? 'audio/*'
      : 'image/*,audio/*';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {existingUrl && !selectedFile && (
          <span className="text-xs text-green-600">Already uploaded</span>
        )}
      </div>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Preview */}
      {previewUrl ? (
        <div className="relative">
          {previewUrl.match(/\.(mp3|wav|ogg|m4a)$/i) ? (
            <div className="w-full p-4 bg-gray-100 rounded-lg flex items-center gap-3">
              <Music className="w-8 h-8 text-purple-600" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Audio file</p>
                <p className="text-sm text-gray-500">Click to play</p>
              </div>
              <audio controls className="h-8">
                <source src={previewUrl} type="audio/mpeg" />
                Your browser does not support audio.
              </audio>
            </div>
          ) : (
            <img
              src={previewUrl}
              alt="Media preview"
              className="w-full h-48 object-cover rounded-lg"
            />
          )}
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
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <div className="flex flex-col items-center gap-2">
            {allowedTypes === 'image' ? (
              <ImageIcon className="w-10 h-10 text-gray-400" />
            ) : allowedTypes === 'audio' ? (
              <Music className="w-10 h-10 text-gray-400" />
            ) : (
              <>
                <ImageIcon className="w-8 h-8 text-gray-400" />
                <Music className="w-8 h-8 text-gray-400" />
              </>
            )}
            <p className="text-gray-600 text-sm">Drag & drop or click to upload</p>
            <p className="text-xs text-gray-400">Max file size: 10MB</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {!selectedFile ? (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 transition-all"
            >
              <Upload size={18} />
              Choose File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptTypes}
              onChange={handleFileSelect}
              className="hidden"
            />
          </>
        ) : (
          <>
            <button
              onClick={clearSelection}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Upload
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}