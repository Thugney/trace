import React, { useState, useEffect } from 'react';
import { MapPin, Info, X } from 'lucide-react';
import type { LearningActivity, ImageHotspotsContent, ActivitySubmissionResult } from '../../types/activities';

interface Props {
  activity: LearningActivity;
  onResponse: (response: any) => void;
  currentResponse: any;
  disabled: boolean;
  showFeedback: boolean;
  feedbackResult: ActivitySubmissionResult | null;
  theme: any;
}

const ImageHotspotsActivity: React.FC<Props> = ({
  activity,
  onResponse,
  currentResponse,
  disabled,
  showFeedback,
  feedbackResult: _feedbackResult,
  theme: _theme
}) => {
  const content = activity.content_data as ImageHotspotsContent;
  const hotspots = content.hotspots || [];
  const imageUrl = content.image;

  const [visitedHotspots, setVisitedHotspots] = useState<string[]>([]);
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  const [showAllLabels, setShowAllLabels] = useState(false);

  // Restore from response
  useEffect(() => {
    if (currentResponse?.visitedHotspots) {
      setVisitedHotspots(currentResponse.visitedHotspots);
    }
  }, [currentResponse]);

  const handleHotspotClick = (hotspotId: string) => {
    if (disabled) return;

    // Toggle active hotspot
    if (activeHotspot === hotspotId) {
      setActiveHotspot(null);
    } else {
      setActiveHotspot(hotspotId);

      // Mark as visited
      if (!visitedHotspots.includes(hotspotId)) {
        const newVisited = [...visitedHotspots, hotspotId];
        setVisitedHotspots(newVisited);
        onResponse({ visitedHotspots: newVisited });
      }
    }
  };

  const getActiveHotspot = () => {
    return hotspots.find(h => h.id === activeHotspot);
  };

  const allVisited = visitedHotspots.length === hotspots.length;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          Explored: <strong>{visitedHotspots.length}</strong> / {hotspots.length}
        </span>
        <button
          onClick={() => setShowAllLabels(!showAllLabels)}
          className={`px-3 py-1 rounded-lg text-xs transition-all ${
            showAllLabels
              ? 'bg-purple-500 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {showAllLabels ? 'Hide Labels' : 'Show Labels'}
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-purple-500 rounded-full h-2 transition-all"
          style={{ width: `${(visitedHotspots.length / hotspots.length) * 100}%` }}
        />
      </div>

      {allVisited && (
        <div className="bg-green-50 border-2 border-green-400 rounded-xl p-3 text-center">
          <p className="font-bold text-green-800">🎉 All hotspots explored!</p>
        </div>
      )}

      {/* Image with hotspots */}
      <div className="relative rounded-xl overflow-hidden bg-gray-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Interactive image"
            className="w-full h-auto"
          />
        ) : (
          <div className="w-full h-64 bg-gradient-to-br from-purple-100 to-fuchsia-100 flex items-center justify-center">
            <p className="text-gray-500">Image placeholder</p>
          </div>
        )}

        {/* Hotspot markers */}
        {hotspots.map((hotspot) => {
          const isVisited = visitedHotspots.includes(hotspot.id);
          const isActive = activeHotspot === hotspot.id;

          return (
            <button
              key={hotspot.id}
              onClick={() => handleHotspotClick(hotspot.id)}
              disabled={disabled}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${
                disabled ? 'opacity-50' : ''
              }`}
              style={{
                left: `${hotspot.x}%`,
                top: `${hotspot.y}%`
              }}
            >
              {/* Pulse animation for unvisited */}
              {!isVisited && (
                <span className="absolute inset-0 animate-ping rounded-full bg-purple-400 opacity-75" />
              )}

              {/* Marker */}
              <span
                className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                  isActive
                    ? 'bg-purple-600 text-white scale-125 ring-4 ring-purple-300'
                    : isVisited
                    ? 'bg-green-500 text-white'
                    : 'bg-purple-500 text-white hover:scale-110'
                }`}
              >
                {isVisited ? (
                  <span className="text-sm">✓</span>
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
              </span>

              {/* Label (always show if showAllLabels, or if active) */}
              {(showAllLabels || isActive) && (
                <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-white px-2 py-1 rounded-lg shadow-lg text-sm font-medium whitespace-nowrap z-10">
                  {hotspot.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active hotspot info panel */}
      {activeHotspot && (
        <div className="bg-white border-2 border-purple-200 rounded-xl p-4 shadow-lg relative">
          <button
            onClick={() => setActiveHotspot(null)}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Info className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h4 className="font-bold text-gray-800">
                {getActiveHotspot()?.label}
              </h4>
              <p className="text-gray-600 text-sm mt-1">
                {getActiveHotspot()?.description || 'No description available'}
              </p>
              {getActiveHotspot()?.additionalInfo && (
                <p className="text-gray-500 text-xs mt-2 italic">
                  {getActiveHotspot()?.additionalInfo}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hotspot list for accessibility */}
      <div className="bg-gray-50 rounded-xl p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          <MapPin className="w-4 h-4 inline mr-1" />
          Points of Interest
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {hotspots.map((hotspot) => {
            const isVisited = visitedHotspots.includes(hotspot.id);

            return (
              <button
                key={hotspot.id}
                onClick={() => handleHotspotClick(hotspot.id)}
                disabled={disabled}
                className={`text-left p-2 rounded-lg text-sm transition-all ${
                  activeHotspot === hotspot.id
                    ? 'bg-purple-100 border-2 border-purple-400'
                    : isVisited
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-white border border-gray-200 hover:border-purple-300'
                }`}
              >
                <span className={`inline-block w-4 h-4 rounded-full mr-2 text-center text-xs leading-4 ${
                  isVisited ? 'bg-green-500 text-white' : 'bg-gray-300'
                }`}>
                  {isVisited ? '✓' : ''}
                </span>
                {hotspot.label}
              </button>
            );
          })}
        </div>
      </div>

      {showFeedback && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-medium mb-2">All hotspots:</p>
          <ul className="space-y-2">
            {hotspots.map((hotspot) => (
              <li key={hotspot.id}>
                <strong>{hotspot.label}:</strong>{' '}
                {hotspot.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ImageHotspotsActivity;
