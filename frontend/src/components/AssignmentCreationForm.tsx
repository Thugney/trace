import React, { useState } from 'react';
import { schoolAPI } from '../services/api';
import type { AssignmentType, QuizQuestion } from '../types/school';
import {
  FileText,
  Youtube,
  BookOpen,
  Languages,
  HelpCircle,
  ClipboardList,
  Plus,
  X,
  Upload,
  Check,
  ArrowLeft
} from 'lucide-react';

interface AssignmentCreationFormProps {
  classId: number;
  teacherId: number;
  onSuccess: () => void;
  onCancel: () => void;
}

interface AssignmentTypeOption {
  type: AssignmentType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const assignmentTypes: AssignmentTypeOption[] = [
  {
    type: 'quiz',
    label: 'Quiz',
    description: 'Create multiple choice questions for students to answer',
    icon: <ClipboardList size={32} />,
    color: 'bg-purple-100 text-purple-600 border-purple-300 hover:bg-purple-200'
  },
  {
    type: 'video',
    label: 'Video Lesson',
    description: 'Share a YouTube video for students to watch',
    icon: <Youtube size={32} />,
    color: 'bg-red-100 text-red-600 border-red-300 hover:bg-red-200'
  },
  {
    type: 'homework',
    label: 'Homework',
    description: 'Assign reading or writing tasks with downloadable materials',
    icon: <FileText size={32} />,
    color: 'bg-blue-100 text-blue-600 border-blue-300 hover:bg-blue-200'
  },
  {
    type: 'psalm',
    label: 'Psalm',
    description: 'Assign a psalm to memorize or practice',
    icon: <BookOpen size={32} />,
    color: 'bg-green-100 text-green-600 border-green-300 hover:bg-green-200'
  },
  {
    type: 'alphabet',
    label: 'Alphabet Practice',
    description: 'Tigrinya alphabet learning exercises',
    icon: <Languages size={32} />,
    color: 'bg-orange-100 text-orange-600 border-orange-300 hover:bg-orange-200'
  },
  {
    type: 'other',
    label: 'Other',
    description: 'General assignment with custom content',
    icon: <HelpCircle size={32} />,
    color: 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
  }
];

export default function AssignmentCreationForm({
  classId,
  teacherId,
  onSuccess,
  onCancel
}: AssignmentCreationFormProps) {
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [selectedType, setSelectedType] = useState<AssignmentType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

  // Form data
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [youtubeLink, setYoutubeLink] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  // Quiz questions
  const [questions, setQuestions] = useState<Omit<QuizQuestion, 'id' | 'assignment_id' | 'created_at'>[]>([
    { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'a' }
  ]);

  const handleTypeSelect = (type: AssignmentType) => {
    setSelectedType(type);
    setStep('details');
    setError('');
  };

  const handleBack = () => {
    setStep('type');
    setSelectedType(null);
    setError('');
  };

  const validateYoutubeUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/).+/;
    return youtubeRegex.test(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];
    if (!allowedTypes.includes(file.type)) {
      setError('Only PDF, Word documents, and images are allowed');
      return;
    }

    setUploadingFile(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/school/upload', {
        method: 'POST',
        headers: {
          'x-profile-id': teacherId.toString()
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setAttachmentUrl(data.url);
      setAttachmentName(file.name);
    } catch (err) {
      setError('Failed to upload file. Please try again.');
    } finally {
      setUploadingFile(false);
    }
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'a' }
    ]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (
    index: number,
    field: keyof Omit<QuizQuestion, 'id' | 'assignment_id' | 'created_at'>,
    value: string
  ) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuestions(newQuestions);
  };

  const validateForm = (): string => {
    if (!title.trim()) {
      return 'Title is required';
    }

    if (selectedType === 'video') {
      if (!youtubeLink.trim()) {
        return 'YouTube link is required for video assignments';
      }
      if (!validateYoutubeUrl(youtubeLink)) {
        return 'Please enter a valid YouTube URL';
      }
    }

    if (selectedType === 'quiz') {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.question_text.trim()) {
          return `Question ${i + 1} text is required`;
        }
        if (!q.option_a.trim() || !q.option_b.trim()) {
          return `Question ${i + 1} needs at least options A and B`;
        }
      }
    }

    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create the assignment
      const response = await schoolAPI.createAssignment({
        class_id: classId,
        teacher_id: teacherId,
        title: title.trim(),
        description: description.trim() || undefined,
        type: selectedType!,
        youtube_link: selectedType === 'video' ? youtubeLink.trim() : undefined,
        attachment_url: attachmentUrl || undefined,
        due_date: dueDate || undefined
      });

      // If it's a quiz, create the questions
      if (selectedType === 'quiz') {
        await schoolAPI.createQuiz(response.data.id, questions);
      }

      onSuccess();
    } catch (err) {
      setError('Failed to create assignment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedTypeInfo = assignmentTypes.find((t) => t.type === selectedType);

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {step === 'details' && (
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h2 className="text-2xl font-bold text-gray-900">
            {step === 'type' ? 'Create New Assignment' : `New ${selectedTypeInfo?.label}`}
          </h2>
        </div>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 p-2">
          <X size={24} />
        </button>
      </div>

      <div className="p-6">
        {/* Step 1: Type Selection */}
        {step === 'type' && (
          <div>
            <p className="text-gray-600 mb-6">What type of assignment would you like to create?</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignmentTypes.map((type) => (
                <button
                  key={type.type}
                  onClick={() => handleTypeSelect(type.type)}
                  className={`p-6 rounded-xl border-2 text-left transition-all ${type.color}`}
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">{type.icon}</div>
                    <div>
                      <h3 className="font-semibold text-lg">{type.label}</h3>
                      <p className="text-sm opacity-80 mt-1">{type.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Type-specific form */}
        {step === 'details' && selectedType && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Common fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder={`Enter ${selectedTypeInfo?.label.toLowerCase()} title...`}
                required
              />
            </div>

            {/* Video-specific: YouTube Link */}
            {selectedType === 'video' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  YouTube Link <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Youtube className="absolute left-4 top-1/2 transform -translate-y-1/2 text-red-500" size={20} />
                  <input
                    type="url"
                    value={youtubeLink}
                    onChange={(e) => setYoutubeLink(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="https://youtube.com/watch?v=..."
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Paste the full YouTube video URL
                </p>
              </div>
            )}

            {/* Quiz-specific: Questions */}
            {selectedType === 'quiz' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Questions</h3>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="flex items-center space-x-2 text-purple-600 hover:text-purple-800 font-medium"
                  >
                    <Plus size={20} />
                    <span>Add Question</span>
                  </button>
                </div>

                {questions.map((question, index) => (
                  <div key={index} className="border border-gray-200 rounded-xl p-5 space-y-4 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-800">Question {index + 1}</h4>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(index)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>

                    <textarea
                      value={question.question_text}
                      onChange={(e) => updateQuestion(index, 'question_text', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter your question..."
                      rows={2}
                      required
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(['option_a', 'option_b', 'option_c', 'option_d'] as const).map((opt) => (
                        <div key={opt} className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name={`correct-${index}`}
                            checked={question.correct_answer === opt.split('_')[1]}
                            onChange={() =>
                              updateQuestion(index, 'correct_answer', opt.split('_')[1] as 'a' | 'b' | 'c' | 'd')
                            }
                            className="w-4 h-4 text-purple-600"
                          />
                          <input
                            type="text"
                            value={question[opt] || ''}
                            onChange={(e) => updateQuestion(index, opt, e.target.value)}
                            className={`flex-1 px-3 py-2 border rounded-lg ${
                              question.correct_answer === opt.split('_')[1]
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-300'
                            }`}
                            placeholder={`Option ${opt.split('_')[1].toUpperCase()}${
                              opt === 'option_a' || opt === 'option_b' ? ' *' : ' (optional)'
                            }`}
                            required={opt === 'option_a' || opt === 'option_b'}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      Select the radio button next to the correct answer
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Homework/Psalm/Alphabet/Other: File Upload */}
            {['homework', 'psalm', 'alphabet', 'other'].includes(selectedType) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attachment (optional)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {attachmentUrl ? (
                    <div className="flex items-center justify-center space-x-3">
                      <Check className="text-green-500" size={24} />
                      <span className="text-gray-700">{attachmentName}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachmentUrl('');
                          setAttachmentName('');
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : uploadingFile ? (
                    <div className="text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
                      Uploading...
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Upload className="mx-auto text-gray-400 mb-2" size={32} />
                      <span className="text-primary-600 font-medium">Click to upload</span>
                      <span className="text-gray-500"> or drag and drop</span>
                      <p className="text-xs text-gray-400 mt-1">PDF, Word, or images up to 10MB</p>
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* Description - for all types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description {selectedType === 'quiz' ? '(optional)' : ''}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder={
                  selectedType === 'video'
                    ? 'Add any notes or questions for students to answer after watching...'
                    : selectedType === 'quiz'
                    ? 'Add instructions for the quiz...'
                    : 'Describe the assignment and what students should do...'
                }
                rows={3}
              />
            </div>

            {/* Due Date - for all types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Due Date (optional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Submit buttons */}
            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creating...' : `Create ${selectedTypeInfo?.label}`}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
