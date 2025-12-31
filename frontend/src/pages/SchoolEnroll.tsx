import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { schoolAPI } from '../services/api';
import { GraduationCap, CheckCircle, UserPlus } from 'lucide-react';
import type { SchoolClass } from '../types/school';

export default function SchoolEnroll() {
  const { currentProfile } = useProfile();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [myChildren, setMyChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadData();
  }, [currentProfile]);

  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setErrorMessage('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  const loadData = async () => {
    if (!currentProfile) return;
    setLoading(true);
    try {
      // Load all classes
      const classesResponse = await schoolAPI.getClasses();
      setClasses(classesResponse.data);

      // Load parent's own children
      if (currentProfile.type === 'parent') {
        const childrenResponse = await schoolAPI.getParentChildren(currentProfile.id);
        setMyChildren(childrenResponse.data);
      }
    } catch (error) {
      console.error('Failed to load enrollment data:', error);
      setErrorMessage('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (childId: number, classId: number) => {
    if (!currentProfile) return;

    try {
      await schoolAPI.enrollStudent(childId, classId, currentProfile.id);
      setSuccessMessage('Child enrolled successfully!');
      loadData(); // Reload to update enrollment counts
    } catch (error: any) {
      if (error.response?.status === 409) {
        setErrorMessage('Already enrolled in this class');
      } else if (error.response?.status === 403) {
        setErrorMessage('You can only enroll your own children');
      } else {
        setErrorMessage('Failed to enroll. Please try again.');
      }
    }
  };

  const getRecommendedClass = (age: number | undefined) => {
    if (!age) return null;
    return classes.find(c => age >= (c.age_min || 0) && age <= (c.age_max || 100));
  };

  if (!currentProfile || currentProfile.type !== 'parent') {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="card p-8 text-center">
          <GraduationCap size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Only parents can enroll children in classes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Enroll Children in Church School</h1>
        <p className="text-gray-600 mt-1">Tigrinya Church School - Saturday Classes</p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
          <CheckCircle size={20} className="text-green-600 mr-3" />
          <span className="text-green-800">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
          <span className="text-red-800">{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : myChildren.length === 0 ? (
        <div className="card p-8 text-center">
          <GraduationCap size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No children found in your family profile.</p>
          <p className="text-sm text-gray-500 mt-2">Please add children to your profile first.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Available Classes Info */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Classes</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {classes.map((cls) => (
                <div key={cls.id} className="card p-4 bg-gradient-to-br from-primary-50 to-purple-50">
                  <h3 className="font-semibold text-gray-900">{cls.name}</h3>
                  <p className="text-sm text-gray-700 mt-1">{cls.description}</p>
                  <p className="text-xs text-gray-600 mt-2">
                    Ages {cls.age_min} - {cls.age_max}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Enroll Children */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Children</h2>
            <div className="space-y-4">
              {myChildren.map((child) => {
                const recommendedClass = getRecommendedClass(child.age);
                const alreadyEnrolled = child.enrollment_count > 0;

                return (
                  <div key={child.id} className="card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="text-3xl">{child.avatar || '👤'}</div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{child.name}</h3>
                          <p className="text-sm text-gray-600">
                            {child.age} years old
                            {recommendedClass && (
                              <span className="ml-2 text-primary-600 font-medium">
                                → Recommended: {recommendedClass.name}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      {alreadyEnrolled && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle size={12} className="mr-1" />
                          Enrolled
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {classes.map((cls) => {
                        const isRecommended =
                          recommendedClass && cls.id === recommendedClass.id;
                        const ageMatch =
                          child.age >= (cls.age_min || 0) && child.age <= (cls.age_max || 100);

                        return (
                          <button
                            key={cls.id}
                            onClick={() => handleEnroll(child.id, cls.id)}
                            disabled={alreadyEnrolled}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              isRecommended
                                ? 'border-primary-500 bg-primary-50'
                                : ageMatch
                                ? 'border-gray-300 hover:border-primary-300 bg-white'
                                : 'border-gray-200 bg-gray-50 opacity-60'
                            } ${
                              alreadyEnrolled
                                ? 'cursor-not-allowed opacity-50'
                                : 'hover:shadow-md cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-gray-900 text-sm">{cls.name}</h4>
                              {isRecommended && (
                                <span className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded">
                                  Best Fit
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600">
                              Ages {cls.age_min}-{cls.age_max}
                            </p>
                            {!alreadyEnrolled && (
                              <div className="mt-3 flex items-center justify-center text-primary-600 text-sm font-medium">
                                <UserPlus size={14} className="mr-1" />
                                Enroll
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
