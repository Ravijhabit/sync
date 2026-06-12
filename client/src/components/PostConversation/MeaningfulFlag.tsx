import { useState } from 'react';
import { Button } from '@progress/kendo-react-buttons';
import { matchesApi } from '../../services/api';
import { useNotificationStore } from '../../stores/useNotificationStore';
import type { MeaningfulFlagProps } from './types';
import styles from './PostConversation.module.css';

export function MeaningfulFlag({ matchId }: MeaningfulFlagProps) {
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [selection, setSelection] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSelect = async (meaningful: boolean) => {
    setSaving(true);
    try {
      await matchesApi.markMeaningful(matchId, meaningful);
      setSelection(meaningful);
    } catch {
      addNotification({ type: 'error', message: 'Failed to save your response. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (selection !== null) {
    return (
      <p className={styles.savedNote} role="status">
        Marked as {selection ? 'Meaningful' : 'Casual'}
      </p>
    );
  }

  return (
    <div className={styles.meaningfulRow}>
      <span className={styles.meaningfulLabel}>How was this conversation?</span>
      <Button themeColor="primary" fillMode="outline" onClick={() => void handleSelect(true)} disabled={saving}>
        Meaningful
      </Button>
      <Button themeColor="base" fillMode="outline" onClick={() => void handleSelect(false)} disabled={saving}>
        Casual
      </Button>
    </div>
  );
}
