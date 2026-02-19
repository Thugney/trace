import { useState } from 'react';
import { profilesAPI } from '../services/api';
import { Profile } from '../types';
import { UserCircle, Users } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<'welcome' | 'parent' | 'kids'>('welcome');
  const [parentProfile, setParentProfile] = useState<Profile | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleCreateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const name = formData.get('name') as string;
    const age = formData.get('age') as string;
    const gender = formData.get('gender') as string;
    const pin = formData.get('pin') as string;
    const confirmPin = formData.get('confirmPin') as string;
    const type = step === 'parent' ? 'parent' : 'child';

    // Validate PIN
    if (!pin || pin.length < 4) {
      alert('PIN must be at least 4 digits');
      return;
    }

    if (pin !== confirmPin) {
      alert('PINs do not match');
      return;
    }

    try {
      // Create profile with PIN
      const response = await profilesAPI.create({
        name,
        type,
        age: age ? parseInt(age, 10) : undefined,
        gender: gender as any,
        pin,
        avatar: type === 'parent' ? '👨‍👩‍👧‍👦' : getKidAvatar(gender)
      });

      if (step === 'parent') {
        setParentProfile(response.data);
        setStep('kids');
        setShowForm(false);
      } else {
        // Kid profile created, can add more or finish
        setShowForm(false);
      }
    } catch (error) {
      console.error('Failed to create profile:', error);
      alert('Failed to create profile. Please try again.');
    }
  };

  const getKidAvatar = (gender: string) => {
    if (gender === 'male') return '👦';
    if (gender === 'female') return '👧';
    return '🧒';
  };

  const handleFinish = () => {
    onComplete();
  };

  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center p-4">
        <div className="card max-w-lg w-full text-center">
          <div className="text-6xl mb-6">👨‍👩‍👧‍👦</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Family Tracker
          </h1>
          <p className="text-gray-600 mb-8">
            Let's set up your family profiles. Each family member will have their own secure account with a PIN.
          </p>
          <button
            onClick={() => setStep('parent')}
            className="btn btn-primary btn-lg w-full"
          >
            Get Started
          </button>
        </div>
      </div>
    );
  }

  if (step === 'parent') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center p-4">
        <div className="card max-w-lg w-full">
          <div className="flex items-center space-x-3 mb-6">
            <Users className="text-primary-600" size={32} />
            <h2 className="text-2xl font-bold text-gray-900">Create Parent Profile</h2>
          </div>
          <p className="text-gray-600 mb-6">
            First, let's create a parent profile. This account will have full access to manage the family.
          </p>

          <form onSubmit={handleCreateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                name="name"
                required
                className="input"
                placeholder="Mom / Dad / Parent Name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select name="gender" className="input">
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Create PIN *
              </label>
              <input
                type="password"
                name="pin"
                required
                minLength={4}
                maxLength={8}
                className="input"
                placeholder="Enter 4-8 digit PIN"
                pattern="[0-9]*"
                inputMode="numeric"
                autoComplete="new-password"
              />
              <p className="text-xs text-gray-500 mt-1">
                This PIN will protect your account
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm PIN *
              </label>
              <input
                type="password"
                name="confirmPin"
                required
                minLength={4}
                maxLength={8}
                className="input"
                placeholder="Re-enter PIN"
                pattern="[0-9]*"
                inputMode="numeric"
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="btn btn-primary w-full">
              Create Parent Profile
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Kids step
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center p-4">
      <div className="card max-w-lg w-full">
        <div className="flex items-center space-x-3 mb-6">
          <UserCircle className="text-primary-600" size={32} />
          <h2 className="text-2xl font-bold text-gray-900">Add Kid Profiles</h2>
        </div>
        <p className="text-gray-600 mb-6">
          {parentProfile && `Great, ${parentProfile.name}! `}
          Now let's add profiles for your kids. Each child will have their own secure PIN.
        </p>

        {!showForm ? (
          <div className="space-y-3">
            <button
              onClick={() => setShowForm(true)}
              className="btn btn-primary w-full"
            >
              Add a Kid Profile
            </button>
            <button
              onClick={handleFinish}
              className="btn btn-secondary w-full"
            >
              Finish Setup
            </button>
            <p className="text-xs text-gray-500 text-center mt-2">
              You can add more profiles later in Settings
            </p>
          </div>
        ) : (
          <form onSubmit={handleCreateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Child's Name *
              </label>
              <input
                type="text"
                name="name"
                required
                className="input"
                placeholder="Enter child's name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Age
              </label>
              <input
                type="number"
                name="age"
                min="1"
                max="18"
                className="input"
                placeholder="Enter age"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select name="gender" className="input">
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Create PIN *
              </label>
              <input
                type="password"
                name="pin"
                required
                minLength={4}
                maxLength={8}
                className="input"
                placeholder="Enter 4-8 digit PIN"
                pattern="[0-9]*"
                inputMode="numeric"
                autoComplete="new-password"
              />
              <p className="text-xs text-gray-500 mt-1">
                This PIN will protect the child's account
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm PIN *
              </label>
              <input
                type="password"
                name="confirmPin"
                required
                minLength={4}
                maxLength={8}
                className="input"
                placeholder="Re-enter PIN"
                pattern="[0-9]*"
                inputMode="numeric"
                autoComplete="new-password"
              />
            </div>

            <div className="flex space-x-3">
              <button type="submit" className="btn btn-primary flex-1">
                Add Child
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-secondary flex-1"
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
