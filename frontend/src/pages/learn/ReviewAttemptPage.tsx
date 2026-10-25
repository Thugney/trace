import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, Send } from 'lucide-react';
import { learnAPI } from '../../services/api';
import { useProfile } from '../../context/ProfileContext';
import type { ReviewAttemptResult } from '../../types/learn';
import { learnCopy, learnSurface } from '../../components/learn/learnCopy';
import ReviewResult from '../../components/learn/ReviewResult';

// A submitted review paper: the learner sees feedback; a guardian can add their own
export default function ReviewAttemptPage() {
  const { attemptId } = useParams();
  const id = Number(attemptId);
  const { currentProfile } = useProfile();
  const [result, setResult] = useState<ReviewAttemptResult | null>(null);
  const [summary, setSummary] = useState('');
  const [itemFeedback, setItemFeedback] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const response = await learnAPI.getReviewAttempt(id);
      setResult(response.data);
      setSummary(response.data.guardian_feedback?.summary || '');
      setItemFeedback(response.data.guardian_feedback?.items || {});
    } catch (err: any) {
      setError(err?.response?.data?.error || learnCopy('nb').error);
    }
  };

  useEffect(() => { load(); }, [id]);

  const locale = result?.paper?.locale || 'nb';
  const copy = learnCopy(locale);
  const isGuardian = Boolean(result && currentProfile && currentProfile.id !== result.profile_id && ['parent', 'admin'].includes(currentProfile.type));

  const sendFeedback = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    try {
      await learnAPI.giveReviewFeedback(id, { summary: summary.trim() || undefined, items: itemFeedback });
      setMessage({ tone: 'ok', text: learnCopy('nb').feedbackSent });
      await load();
    } catch (err: any) {
      setMessage({ tone: 'error', text: err?.response?.data?.error || copy.error });
    }
  };

  if (error) {
    return <div className={learnSurface.page}><p role="alert" className="text-red-700 dark:text-red-300">{error}</p></div>;
  }
  if (!result) {
    return <div className={learnSurface.page}><p className={learnSurface.muted} role="status">{copy.loading}</p></div>;
  }

  const openItems = (result.feedback?.items || []).filter((item) => item.kind === 'open_response' && item.answered);

  return (
    <div className={learnSurface.page} lang={locale === 'en' ? 'en' : 'nb'}>
      <Link to={isGuardian ? '/learn' : `/learn/papers/${result.paper_id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {copy.backToLearn}
      </Link>
      <header className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">
          {copy.reviewPaper}{result.paper && <> · {copy.gradeLabel(result.paper.grade)}</>}
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">{result.paper?.title}</h1>
        <p className={clsx('mt-1 text-sm', learnSurface.muted)}>{new Date(result.submitted_at).toLocaleString('nb-NO')}</p>
      </header>

      <ReviewResult
        result={result}
        locale={locale}
        prompts={result.prompts || {}}
        options={result.options || {}}
        sourceLessons={result.source_lessons || {}}
      />

      {isGuardian && (
        <form onSubmit={sendFeedback} className={clsx(learnSurface.card, 'mt-4 space-y-3')} lang="nb">
          <h2 className="text-lg font-semibold">{learnCopy('nb').giveFeedback}</h2>
          {openItems.map((item) => (
            <label key={item.key} className="block text-sm">
              <span className="font-medium">{result.prompts?.[item.key]}</span>
              <span className={clsx('mt-1 block', learnSurface.muted)}>“{item.response}”</span>
              <textarea
                className={clsx(learnSurface.input, 'mt-1')}
                rows={2}
                maxLength={1000}
                placeholder={learnCopy('nb').feedbackPlaceholder}
                value={itemFeedback[item.key] || ''}
                onChange={(event) => setItemFeedback({ ...itemFeedback, [item.key]: event.target.value })}
              />
            </label>
          ))}
          <label className="block text-sm font-medium">
            {learnCopy('nb').guardianFeedback}
            <textarea className={clsx(learnSurface.input, 'mt-1')} rows={3} maxLength={1000} value={summary} onChange={(event) => setSummary(event.target.value)} />
          </label>
          <button type="submit" className={learnSurface.primaryButton} disabled={!summary.trim() && !Object.values(itemFeedback).some((value) => value.trim())}>
            <Send className="h-4 w-4" aria-hidden="true" /> {learnCopy('nb').sendFeedback}
          </button>
          {message && (
            <p role={message.tone === 'error' ? 'alert' : 'status'} className={clsx('text-sm', message.tone === 'error' ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300')}>
              {message.text}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
