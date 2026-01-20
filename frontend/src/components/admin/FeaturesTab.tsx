import { useState } from 'react';
import {
  Zap,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  RefreshCcw,
  CheckCircle,
  XCircle
} from 'lucide-react';
import Avatar from '../Avatar';
import clsx from 'clsx';

interface FamilyData {
  parent: { id: number; name: string; avatar: string; created_at: string };
  children: Array<{ id: number; name: string; avatar: string; age: number }>;
  features: Record<string, boolean>;
  childCount: number;
}

interface FeatureOption {
  key: string;
  label: string;
  description: string;
}

interface FeaturesTabProps {
  families: FamilyData[];
  loading: boolean;
  featureOptions: FeatureOption[];
  onSaveFamilyFeatures: (parentId: number, features: Record<string, boolean>) => Promise<void>;
  onRefresh: () => void;
}

export default function FeaturesTab({
  families,
  loading,
  featureOptions,
  onSaveFamilyFeatures,
  onRefresh
}: FeaturesTabProps) {
  const [expandedFamilyId, setExpandedFamilyId] = useState<number | null>(null);
  const [familyFeatures, setFamilyFeatures] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const toggleExpand = (parentId: number, currentFeatures: Record<string, boolean>) => {
    if (expandedFamilyId === parentId) {
      setExpandedFamilyId(null);
      setFamilyFeatures({});
    } else {
      // Initialize with all features enabled by default, then override with stored values
      const features: Record<string, boolean> = {};
      featureOptions.forEach(option => {
        features[option.key] = true;
      });
      Object.entries(currentFeatures).forEach(([key, enabled]) => {
        features[key] = enabled;
      });
      setFamilyFeatures(features);
      setExpandedFamilyId(parentId);
    }
  };

  const handleSave = async (parentId: number) => {
    setSaving(true);
    try {
      await onSaveFamilyFeatures(parentId, familyFeatures);
      setExpandedFamilyId(null);
      setFamilyFeatures({});
    } finally {
      setSaving(false);
    }
  };

  const toggleFeature = (key: string) => {
    setFamilyFeatures(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const enableAll = () => {
    const all: Record<string, boolean> = {};
    featureOptions.forEach(opt => { all[opt.key] = true; });
    setFamilyFeatures(all);
  };

  const disableAll = () => {
    const all: Record<string, boolean> = {};
    featureOptions.forEach(opt => { all[opt.key] = false; });
    setFamilyFeatures(all);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading feature settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-600">
            Control which features each family can access. Disabled features will be hidden for all family members.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all"
        >
          <RefreshCcw size={18} />
          Refresh
        </button>
      </div>

      {/* Families List */}
      {families.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200">
          <div className="w-20 h-20 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
            <Zap size={32} className="text-amber-500" />
          </div>
          <p className="font-bold text-slate-700 text-lg">No families found</p>
          <p className="text-sm text-slate-500 mt-1">Create parent profiles to see families here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {families.map(family => {
            const enabledCount = Object.values(family.features).filter(Boolean).length;
            const totalFeatures = featureOptions.length;

            return (
              <div
                key={family.parent.id}
                className="rounded-2xl bg-white border-2 border-slate-200 shadow-lg overflow-hidden"
              >
                {/* Family Header */}
                <button
                  onClick={() => toggleExpand(family.parent.id, family.features)}
                  className={clsx(
                    'w-full p-5 flex items-center justify-between transition-colors',
                    expandedFamilyId === family.parent.id
                      ? 'bg-gradient-to-r from-amber-50 to-orange-50'
                      : 'hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <Avatar avatar={family.parent.avatar} size="lg" alt={family.parent.name} />
                    <div className="text-left">
                      <h3 className="font-bold text-lg text-slate-900">{family.parent.name}'s Family</h3>
                      <p className="text-sm text-slate-500">
                        {family.childCount} {family.childCount === 1 ? 'child' : 'children'}
                        {family.children.length > 0 && ': '}
                        {family.children.map(c => c.name).join(', ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex gap-2">
                      <span className={clsx(
                        'px-3 py-1.5 text-sm font-semibold rounded-full',
                        enabledCount === totalFeatures
                          ? 'bg-emerald-100 text-emerald-700'
                          : enabledCount === 0
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                      )}>
                        {enabledCount}/{totalFeatures} features
                      </span>
                    </div>
                    {expandedFamilyId === family.parent.id ? (
                      <ChevronUp className="text-slate-400" size={24} />
                    ) : (
                      <ChevronDown className="text-slate-400" size={24} />
                    )}
                  </div>
                </button>

                {/* Expanded Features Grid */}
                {expandedFamilyId === family.parent.id && (
                  <div className="border-t border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
                    {/* Quick Actions */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <button
                        onClick={enableAll}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
                      >
                        <CheckCircle size={16} />
                        Enable All
                      </button>
                      <button
                        onClick={disableAll}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors"
                      >
                        <XCircle size={16} />
                        Disable All
                      </button>
                    </div>

                    {/* Features Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {featureOptions.map(option => (
                        <label
                          key={option.key}
                          className={clsx(
                            'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                            familyFeatures[option.key]
                              ? 'border-emerald-300 bg-emerald-50/50 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          )}
                        >
                          <div className="mt-0.5">
                            <input
                              type="checkbox"
                              className="w-5 h-5 rounded-md border-2 border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              checked={Boolean(familyFeatures[option.key])}
                              onChange={() => toggleFeature(option.key)}
                            />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-800">{option.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{option.description}</p>
                          </div>
                          {familyFeatures[option.key] ? (
                            <CheckCircle size={18} className="text-emerald-500 flex-shrink-0" />
                          ) : (
                            <XCircle size={18} className="text-slate-300 flex-shrink-0" />
                          )}
                        </label>
                      ))}
                    </div>

                    {/* Save/Cancel */}
                    <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
                      <button
                        onClick={() => handleSave(family.parent.id)}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                      >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Save Features
                      </button>
                      <button
                        onClick={() => {
                          setExpandedFamilyId(null);
                          setFamilyFeatures({});
                        }}
                        className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
