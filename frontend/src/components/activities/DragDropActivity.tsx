import React, { useState, useEffect, useMemo } from 'react';
import { GripVertical, X } from 'lucide-react';
import type { LearningActivity, DragDropContent, DragDropCorrect, ActivitySubmissionResult } from '../../types/activities';

interface Props {
  activity: LearningActivity;
  onResponse: (response: any) => void;
  currentResponse: any;
  disabled: boolean;
  showFeedback: boolean;
  feedbackResult: ActivitySubmissionResult | null;
  theme: any;
}

// Simple drag-and-drop using tap-to-select pattern (works better on mobile)
const DragDropActivity: React.FC<Props> = ({
  activity,
  onResponse,
  currentResponse,
  disabled,
  showFeedback,
  feedbackResult,
  theme: _theme
}) => {
  const content = activity.content_data as DragDropContent;
  const correctData = (feedbackResult?.correctData ?? activity.correct_data ?? {}) as DragDropCorrect;
  const zones = content.dropZones || [];
  const items = useMemo(() => content.draggableItems || [], [content.draggableItems]);
  const responsePlacements: Record<string, string[]> | undefined = currentResponse?.placements;

  const [placements, setPlacements] = useState<Record<string, string[]>>({});
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [availableItems, setAvailableItems] = useState<string[]>([]);

  // Initialize. This also re-runs when this component reports its own
  // placements; keep the tray order then, since the available set is unchanged.
  useEffect(() => {
    if (responsePlacements) {
      setPlacements(responsePlacements);
      // Calculate available items
      const placedItems = Object.values(responsePlacements).flat();
      const nextAvailable = items.map(i => i.id).filter(id => !placedItems.includes(id));
      setAvailableItems(prev =>
        prev.length === nextAvailable.length && nextAvailable.every(id => prev.includes(id))
          ? prev
          : nextAvailable
      );
    } else {
      // Initialize with all items available. A selection from a previous
      // activity would otherwise be placed as an unknown item id.
      setSelectedItem(null);
      setPlacements({});
      setAvailableItems(items.map(i => i.id));
    }
  }, [items, responsePlacements]);

  const handleItemClick = (itemId: string) => {
    if (disabled) return;
    setSelectedItem(selectedItem === itemId ? null : itemId);
  };

  const handleZoneClick = (zoneId: string) => {
    if (disabled || !selectedItem) return;

    const zoneItems = placements[zoneId] || [];

    // Check if zone has capacity (default to unlimited)
    const zone = zones.find(z => z.id === zoneId);
    const maxItems = zone?.maxItems || 999;

    if (zoneItems.length >= maxItems) {
      return; // Zone is full
    }

    // Copy the zone list: the current one is shared with the reported response
    const newPlacements = { ...placements, [zoneId]: [...zoneItems, selectedItem] };
    setPlacements(newPlacements);
    setAvailableItems(availableItems.filter(id => id !== selectedItem));
    setSelectedItem(null);

    onResponse({ placements: newPlacements });
  };

  const removeFromZone = (zoneId: string, itemId: string) => {
    if (disabled) return;

    const newPlacements = { ...placements };
    newPlacements[zoneId] = newPlacements[zoneId].filter(id => id !== itemId);
    if (newPlacements[zoneId].length === 0) {
      delete newPlacements[zoneId];
    }
    setPlacements(newPlacements);
    setAvailableItems([...availableItems, itemId]);

    onResponse({ placements: newPlacements });
  };

  const getItem = (itemId: string) => items.find(i => i.id === itemId);

  const isZoneCorrect = (zoneId: string): boolean | null => {
    if (!showFeedback) return null;
    const correct = correctData.correctPlacements?.[zoneId] || [];
    const placed = placements[zoneId] || [];

    // Check if all placed items are correct and all correct items are placed
    const placedSet = new Set(placed);
    const correctSet = new Set(correct);

    if (placedSet.size !== correctSet.size) return false;
    for (const item of placedSet) {
      if (!correctSet.has(item)) return false;
    }
    return true;
  };

  return (
    <div className="space-y-6">
      <p className="text-center text-gray-600 text-sm mb-4">
        {content.instruction || 'Tap an item, then tap a zone to place it'}
      </p>

      {/* Available items */}
      <div className="bg-gray-100 rounded-xl p-4">
        <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">
          Items to place
        </p>
        <div className="flex flex-wrap gap-2">
          {availableItems.length === 0 ? (
            <p className="text-sm text-gray-400 italic">All items placed</p>
          ) : (
            availableItems.map(itemId => {
              const item = getItem(itemId);
              if (!item) return null;

              return (
                <button
                  key={itemId}
                  onClick={() => handleItemClick(itemId)}
                  disabled={disabled}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                    selectedItem === itemId
                      ? 'bg-purple-500 text-white ring-2 ring-purple-300'
                      : 'bg-white border-2 border-gray-200 hover:border-purple-300'
                  } ${disabled ? 'opacity-50' : ''}`}
                >
                  <GripVertical className="w-4 h-4" />
                  {item.image && (
                    <img
                      src={item.image}
                      alt=""
                      className="w-6 h-6 rounded object-cover"
                    />
                  )}
                  <span className="font-medium">{item.text}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {selectedItem && (
        <p className="text-center text-purple-600 text-sm animate-pulse">
          Now tap a zone below to place the item
        </p>
      )}

      {/* Drop zones */}
      <div className="grid gap-4" style={{
        gridTemplateColumns: zones.length <= 2 ? '1fr' : 'repeat(2, 1fr)'
      }}>
        {zones.map(zone => {
          const zoneItems = placements[zone.id] || [];
          const correct = isZoneCorrect(zone.id);

          return (
            <div
              key={zone.id}
              onClick={() => handleZoneClick(zone.id)}
              className={`min-h-[120px] rounded-xl border-2 border-dashed p-4 transition-all ${
                showFeedback
                  ? correct
                    ? 'bg-green-50 border-green-400'
                    : 'bg-red-50 border-red-400'
                  : selectedItem
                  ? 'bg-purple-50 border-purple-400 cursor-pointer hover:bg-purple-100'
                  : 'bg-gray-50 border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-gray-700">{zone.label}</span>
                {showFeedback && (
                  <span className={`text-lg ${correct ? 'text-green-500' : 'text-red-500'}`}>
                    {correct ? '✓' : '✗'}
                  </span>
                )}
              </div>

              {zone.image && (
                <img
                  src={zone.image}
                  alt=""
                  className="w-full h-20 rounded-lg object-cover mb-3"
                />
              )}

              {/* Items in zone */}
              <div className="flex flex-wrap gap-2">
                {zoneItems.map(itemId => {
                  const item = getItem(itemId);
                  if (!item) return null;

                  return (
                    <div
                      key={itemId}
                      className="px-3 py-1 bg-white rounded-lg border shadow-sm flex items-center gap-2"
                    >
                      {item.image && (
                        <img
                          src={item.image}
                          alt=""
                          className="w-5 h-5 rounded object-cover"
                        />
                      )}
                      <span className="text-sm font-medium">{item.text}</span>
                      {!disabled && !showFeedback && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromZone(zone.id, itemId);
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {zoneItems.length === 0 && (
                  <p className="text-sm text-gray-400 italic">
                    {selectedItem ? 'Tap to place here' : 'Drop items here'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showFeedback && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-medium mb-2">Correct placements:</p>
          <ul className="space-y-2">
            {zones.map(zone => {
              const correctItems = correctData.correctPlacements?.[zone.id] || [];
              return (
                <li key={zone.id}>
                  <strong>{zone.label}:</strong>{' '}
                  {correctItems.map(id => getItem(id)?.text).filter(Boolean).join(', ') || 'None'}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DragDropActivity;
