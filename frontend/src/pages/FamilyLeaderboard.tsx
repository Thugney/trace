import { useEffect, useState } from 'react';
import { Trophy, Flame, Star, Medal, Crown, TrendingUp, Award, Users, Bug } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import Avatar from '../components/Avatar';
import { gamificationAPI } from '../services/api';

interface LeaderboardEntry {
  id: number;
  name: string;
  avatar: string;
  type: string;
  points: number;
  stars: number;
  level: number;
  tasksCompleted: number;
  currentStreak: number;
  longestStreak: number;
  achievementCount: number;
  recentAchievements: { name: string; icon: string }[];
  rank: number;
}

type Period = 'week' | 'month' | 'all';

export default function FamilyLeaderboard() {
  const { currentProfile } = useProfile();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('all');
  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  useEffect(() => {
    loadLeaderboard();
  }, [period]);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await gamificationAPI.getFamilyLeaderboard(period);
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostic = async () => {
    try {
      const response = await gamificationAPI.getLeaderboardDiagnostic();
      setDiagnosticData(response.data);
      setShowDiagnostic(true);
      console.log('Diagnostic Data:', response.data);
    } catch (error) {
      console.error('Failed to run diagnostic:', error);
    }
  };

  const getRankDisplay = (rank: number) => {
    switch (rank) {
      case 1:
        return { icon: Crown, color: 'text-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-200', label: '1st' };
      case 2:
        return { icon: Medal, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200', label: '2nd' };
      case 3:
        return { icon: Medal, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: '3rd' };
      default:
        return { icon: Trophy, color: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-100', label: `${rank}th` };
    }
  };

  const periodLabels: Record<Period, string> = {
    week: 'This Week',
    month: 'This Month',
    all: 'All Time'
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            Family Leaderboard
          </h1>
          <p className="text-slate-500 mt-1">See how everyone's doing!</p>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          {(['week', 'month', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === p
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {/* Diagnostic Button - Parents only */}
        {currentProfile?.type === 'parent' && (
          <button
            onClick={runDiagnostic}
            className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
          >
            <Bug className="w-4 h-4" />
            Run Diagnostic
          </button>
        )}
      </div>

      {/* Diagnostic Panel */}
      {showDiagnostic && diagnosticData && (
        <div className="bg-slate-900 text-green-400 p-4 rounded-xl font-mono text-xs overflow-auto max-h-96">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-bold">Leaderboard Diagnostic</h3>
            <button
              onClick={() => setShowDiagnostic(false)}
              className="text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="mb-4 text-yellow-400">
            Server Time: {diagnosticData.serverTime}<br />
            Week Start: {diagnosticData.weekStartDate}<br />
            Month Start: {diagnosticData.monthStartDate}
          </div>

          <div className="mb-4 text-cyan-400">
            Summary: {diagnosticData.summary?.profilesWithIssues} of {diagnosticData.summary?.totalProfiles} profiles have issues
          </div>

          {diagnosticData.profiles?.map((p: any) => (
            <div key={p.id} className="mb-6 border-t border-slate-700 pt-4">
              <div className="text-white font-bold mb-2">{p.name} ({p.type})</div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>All Time (latest record): <span className="text-white">{p.calculations?.allTime_fromLatestRecord}</span></div>
                <div>All Time (sum): <span className="text-white">{p.calculations?.allTime_fromSumPointsEarned}</span></div>
                <div>This Week: <span className="text-white">{p.calculations?.thisWeek_sumPointsEarned}</span> ({p.calculations?.thisWeek_recordCount} records)</div>
                <div>This Month: <span className="text-white">{p.calculations?.thisMonth_sumPointsEarned}</span> ({p.calculations?.thisMonth_recordCount} records)</div>
              </div>

              {/* Issues */}
              <div className="mt-2">
                {p.issues?.hasTotalMismatch && <div className="text-red-400">Total Mismatch! Discrepancy: {p.calculations?.discrepancy}</div>}
                {p.issues?.monthHigherThanAllTime && <div className="text-red-400">BUG: Month ({p.calculations?.thisMonth_sumPointsEarned}) &gt; All Time ({p.calculations?.allTime_fromLatestRecord})</div>}
                {p.issues?.suspiciousRecordCount > 0 && <div className="text-orange-400">Suspicious records: {p.issues?.suspiciousRecordCount}</div>}
                {p.issues?.inconsistentRecordCount > 0 && <div className="text-orange-400">Inconsistent records: {p.issues?.inconsistentRecordCount}</div>}
                {!p.issues?.hasTotalMismatch && !p.issues?.monthHigherThanAllTime && p.issues?.suspiciousRecordCount === 0 && (
                  <div className="text-green-400">No issues detected</div>
                )}
              </div>

              {/* Suspicious Records */}
              {p.suspiciousRecords?.length > 0 && (
                <div className="mt-2">
                  <div className="text-orange-400 font-bold">Suspicious Records:</div>
                  {p.suspiciousRecords.map((r: any) => (
                    <div key={r.id} className="text-orange-300 ml-2">
                      ID:{r.id} | points_earned:{r.points_earned} | total:{r.total_points} | {r.logged_at}
                    </div>
                  ))}
                </div>
              )}

              {/* Recent Records */}
              <details className="mt-2">
                <summary className="cursor-pointer text-slate-400">Recent Records ({p.recentRecords?.length})</summary>
                <div className="ml-2 mt-1">
                  {p.recentRecords?.slice(0, 10).map((r: any) => (
                    <div key={r.id} className="text-slate-300">
                      +{r.points_earned} → {r.total_points} | task:{r.task_id || 'n/a'} | {r.logged_at}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ))}
        </div>
      )}

      {/* Podium for Top 3 (only if we have at least 3 members) */}
      {leaderboard.length >= 3 && (
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {/* 2nd Place */}
          <div className="order-1 pt-6">
            <div className="bg-gradient-to-b from-slate-50 to-white rounded-2xl p-4 border border-slate-200 text-center relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center text-slate-600 font-bold text-sm">
                  2
                </div>
              </div>
              <div className="flex justify-center mb-2 mt-2"><Avatar avatar={leaderboard[1]?.avatar} size="xl" alt={leaderboard[1]?.name} /></div>
              <h3 className="font-semibold text-slate-800 truncate">{leaderboard[1]?.name}</h3>
              <p className="text-slate-500 text-sm capitalize">{leaderboard[1]?.type}</p>
              <div className="mt-3 text-lg font-bold text-slate-700">
                {leaderboard[1]?.points.toLocaleString()} pts
              </div>
            </div>
          </div>

          {/* 1st Place */}
          <div className="order-2 sm:-mt-2">
            <div className="bg-gradient-to-b from-yellow-50 to-amber-50 rounded-2xl p-4 border-2 border-yellow-200 text-center relative shadow-lg">
              <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                <Crown className="w-10 h-10 text-yellow-500 drop-shadow-md" />
              </div>
              <div className="flex justify-center mb-2 mt-3"><Avatar avatar={leaderboard[0]?.avatar} size="2xl" alt={leaderboard[0]?.name} /></div>
              <h3 className="font-bold text-slate-800 truncate">{leaderboard[0]?.name}</h3>
              <p className="text-amber-600 text-sm capitalize font-medium">{leaderboard[0]?.type}</p>
              <div className="mt-3 text-xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
                {leaderboard[0]?.points.toLocaleString()} pts
              </div>
            </div>
          </div>

          {/* 3rd Place */}
          <div className="order-3 pt-8">
            <div className="bg-gradient-to-b from-amber-50 to-white rounded-2xl p-4 border border-amber-200 text-center relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="w-8 h-8 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-amber-700 font-bold text-sm">
                  3
                </div>
              </div>
              <div className="flex justify-center mb-2 mt-2"><Avatar avatar={leaderboard[2]?.avatar} size="xl" alt={leaderboard[2]?.name} /></div>
              <h3 className="font-semibold text-slate-800 truncate">{leaderboard[2]?.name}</h3>
              <p className="text-slate-500 text-sm capitalize">{leaderboard[2]?.type}</p>
              <div className="mt-3 text-lg font-bold text-amber-700">
                {leaderboard[2]?.points.toLocaleString()} pts
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Rankings List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Full Rankings
          </h2>
        </div>

        <div className="divide-y divide-slate-100">
          {leaderboard.map((entry) => {
            const rankDisplay = getRankDisplay(entry.rank);
            const isCurrentUser = currentProfile?.id === entry.id;
            const RankIcon = rankDisplay.icon;

            return (
              <div
                key={entry.id}
                className={`p-4 flex items-center gap-4 transition-colors ${
                  isCurrentUser ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                }`}
              >
                {/* Rank */}
                <div className={`w-10 h-10 rounded-xl ${rankDisplay.bg} border ${rankDisplay.border} flex items-center justify-center shrink-0`}>
                  {entry.rank <= 3 ? (
                    <RankIcon className={`w-5 h-5 ${rankDisplay.color}`} />
                  ) : (
                    <span className="font-bold text-slate-600">{entry.rank}</span>
                  )}
                </div>

                {/* Avatar & Name */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar avatar={entry.avatar} size="lg" alt={entry.name} className="shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-semibold truncate ${isCurrentUser ? 'text-indigo-700' : 'text-slate-800'}`}>
                        {entry.name}
                        {isCurrentUser && <span className="text-indigo-500 ml-1">(You)</span>}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <span className="capitalize">{entry.type}</span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Lvl {entry.level}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-4 shrink-0">
                  {/* Streak */}
                  {entry.currentStreak > 0 && (
                    <div className="flex items-center gap-1 text-orange-500" title={`${entry.currentStreak} day streak`}>
                      <Flame className="w-4 h-4" />
                      <span className="text-sm font-medium">{entry.currentStreak}</span>
                    </div>
                  )}

                  {/* Stars */}
                  {entry.stars > 0 && (
                    <div className="flex items-center gap-1 text-yellow-500" title={`${entry.stars} stars`}>
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-sm font-medium">{entry.stars}</span>
                    </div>
                  )}

                  {/* Achievements */}
                  {entry.achievementCount > 0 && (
                    <div className="flex items-center gap-1 text-purple-500" title={`${entry.achievementCount} achievements`}>
                      <Award className="w-4 h-4" />
                      <span className="text-sm font-medium">{entry.achievementCount}</span>
                    </div>
                  )}
                </div>

                {/* Points */}
                <div className="text-right shrink-0">
                  <div className="font-bold text-slate-800">{entry.points.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">points</div>
                </div>
              </div>
            );
          })}
        </div>

        {leaderboard.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            <Trophy className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No rankings yet. Complete tasks to earn points!</p>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      {leaderboard.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-bold text-slate-800">
              {leaderboard.reduce((sum, e) => sum + e.points, 0).toLocaleString()}
            </div>
            <div className="text-sm text-slate-500">Total Family Points</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-bold text-slate-800">
              {leaderboard.reduce((sum, e) => sum + e.tasksCompleted, 0)}
            </div>
            <div className="text-sm text-slate-500">Tasks Completed</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-bold text-slate-800">
              {Math.max(...leaderboard.map(e => e.currentStreak))}
            </div>
            <div className="text-sm text-slate-500">Longest Streak</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-bold text-slate-800">
              {leaderboard.reduce((sum, e) => sum + e.achievementCount, 0)}
            </div>
            <div className="text-sm text-slate-500">Total Achievements</div>
          </div>
        </div>
      )}
    </div>
  );
}
