import { useState } from 'react';
import { Card, CardHeader, CardBody, CardActions } from '@progress/kendo-react-layout';
import { Button } from '@progress/kendo-react-buttons';
import { useSocket } from '../../hooks/SocketContext';
import { useMatchStore } from '../../stores/useMatchStore';
import styles from './PromptCard.module.css';

export function PromptCard() {
  const { socket } = useSocket();
  const { matchId, prompt, clearMatch } = useMatchStore();
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [ending, setEnding] = useState(false);

  const handleEndConversation = () => {
    if (!socket || !matchId) return;
    setEnding(true);
    socket.emit('user:end_conversation', { matchId });
    clearMatch();
  };

  if (!prompt) return null;

  return (
    <Card className={styles.card}>
      <CardHeader>
        <h3>Your Conversation Starter</h3>
        <span className={styles.meta}>{prompt.category} · {prompt.depth}</span>
      </CardHeader>
      <CardBody>
        <p className={styles.promptText}>{prompt.text}</p>
        {showFollowUp ? (
          <div className={styles.followUp} aria-live="polite">
            <strong className={styles.followUpLabel}>Follow-up nudge</strong>
            <p className={styles.followUpText}>{prompt.followUp}</p>
          </div>
        ) : (
          <Button fillMode="flat" onClick={() => setShowFollowUp(true)}>
            Show follow-up nudge
          </Button>
        )}
      </CardBody>
      <CardActions>
        <Button themeColor="error" fillMode="outline" onClick={handleEndConversation} disabled={ending}>
          {ending ? 'Ending...' : 'End Conversation'}
        </Button>
      </CardActions>
    </Card>
  );
}
