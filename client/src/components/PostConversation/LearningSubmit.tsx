import { useState } from 'react';
import { Button } from '@progress/kendo-react-buttons';
import { TextArea } from '@progress/kendo-react-inputs';
import { learningsApi } from '../../services/api';
import { useNotificationStore } from '../../stores/useNotificationStore';
import type { LearningSubmitProps } from './types';
import styles from './PostConversation.module.css';

export function LearningSubmit({ matchId, targetId, onSubmitted }: LearningSubmitProps) {
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [content, setContent] = useState('');
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || !justification.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await learningsApi.submit({ matchId, targetId, content, justification });
      void data;
      setSubmitted(true);
      onSubmitted();
    } catch {
      addNotification({ type: 'error', message: 'Failed to submit learning. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={styles.success} role="status">
        Learning submitted! Waiting for your partner's review.
      </div>
    );
  }

  return (
    <div className={styles.submitSection}>
      <h4 className={styles.title}>What did you learn?</h4>
      <div>
        <label htmlFor="learning-content" className={styles.fieldLabel}>
          What I learned about my partner
        </label>
        <TextArea
          id="learning-content"
          value={content}
          onChange={(e) => setContent(String(e.value ?? ''))}
          rows={3}
          placeholder="Share something specific and genuine you learned..."
          className={styles['textArea'] ?? ''}
        />
      </div>
      <div>
        <label htmlFor="learning-justification" className={styles.fieldLabel}>
          Why it stood out to me
        </label>
        <TextArea
          id="learning-justification"
          value={justification}
          onChange={(e) => setJustification(String(e.value ?? ''))}
          rows={2}
          placeholder="What made this observation meaningful?"
          className={styles['textArea'] ?? ''}
        />
      </div>
      <Button
        themeColor="primary"
        onClick={() => void handleSubmit()}
        disabled={submitting || !content.trim() || !justification.trim()}
      >
        {submitting ? 'Submitting...' : 'Submit Learning'}
      </Button>
    </div>
  );
}
