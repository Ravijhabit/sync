import { useState } from 'react';
import { Button } from '@progress/kendo-react-buttons';
import { TextArea, NumericTextBox } from '@progress/kendo-react-inputs';
import { learningsApi } from '../../services/api';
import { useNotificationStore } from '../../stores/useNotificationStore';
import type { LearningReviewProps } from './types';
import styles from './PostConversation.module.css';

export function LearningReview({ learningId, onReviewed }: LearningReviewProps) {
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [rating, setRating] = useState<number>(7);
  const [feedback, setFeedback] = useState('');
  const [isCorrect, setIsCorrect] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [learning, setLearning] = useState<{ content: string; justification: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadLearning = async () => {
    try {
      const { data } = await learningsApi.get(learningId);
      setLearning({ content: data.content, justification: data.justification });
      setLoaded(true);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load learning for review.' });
    }
  };

  if (!loaded) {
    return (
      <Button themeColor="info" onClick={() => void loadLearning()}>
        View Partner's Learning
      </Button>
    );
  }

  const handleSubmitReview = async () => {
    setSubmitting(true);
    try {
      await learningsApi.review(learningId, { rating, feedback, isCorrect });
      onReviewed();
    } catch {
      addNotification({ type: 'error', message: 'Failed to submit review. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.submitSection}>
      <h4 className={styles.title}>Review Your Partner's Learning</h4>

      {learning && (
        <div className={styles.learningQuote}>
          <p className={styles.learningText}>"{learning.content}"</p>
          <p className={styles.learningJustification}>{learning.justification}</p>
        </div>
      )}

      <div className={styles.ratingRow}>
        <label htmlFor="review-rating" className={styles.fieldLabel}>Rating (1–10)</label>
        <NumericTextBox
          id="review-rating"
          value={rating}
          onChange={(e) => setRating(e.value ?? 7)}
          min={1}
          max={10}
          step={1}
        />
      </div>

      <div>
        <label htmlFor="review-feedback" className={styles.fieldLabel}>Feedback</label>
        <TextArea
          id="review-feedback"
          value={feedback}
          onChange={(e) => setFeedback(String(e.value ?? ''))}
          rows={2}
          placeholder="Share your thoughts on their observation..."
          className={styles['textArea'] ?? ''}
        />
      </div>

      <div className={styles.correctRow}>
        <span className={styles.meaningfulLabel}>Did they get it right?</span>
        <Button
          themeColor={isCorrect ? 'success' : 'base'}
          fillMode={isCorrect ? 'solid' : 'outline'}
          onClick={() => setIsCorrect(true)}
        >
          Correct
        </Button>
        <Button
          themeColor={!isCorrect ? 'error' : 'base'}
          fillMode={!isCorrect ? 'solid' : 'outline'}
          onClick={() => setIsCorrect(false)}
        >
          Not Quite
        </Button>
      </div>

      <Button
        themeColor="primary"
        onClick={() => void handleSubmitReview()}
        disabled={submitting}
      >
        {submitting ? 'Submitting...' : 'Submit Review'}
      </Button>
    </div>
  );
}
