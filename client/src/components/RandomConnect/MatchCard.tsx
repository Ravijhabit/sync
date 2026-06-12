import { useState } from 'react';
import { Card, CardHeader, CardBody, CardActions } from '@progress/kendo-react-layout';
import { Button } from '@progress/kendo-react-buttons';
import { useSocket } from '../../hooks/SocketContext';
import { useMatchStore } from '../../stores/useMatchStore';
import styles from './MatchCard.module.css';

export function MatchCard() {
  const { socket } = useSocket();
  const { matchId, partnerHints, setMatchStatus } = useMatchStore();
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = () => {
    if (!socket || !matchId) return;
    setConfirming(true);
    socket.emit('user:found_partner', { matchId });
    setMatchStatus('ACTIVE');
  };

  if (!partnerHints || !matchId) return null;

  return (
    <Card className={styles.card}>
      <CardHeader>
        <h3>You've been matched!</h3>
      </CardHeader>
      <CardBody>
        <p className={styles.detail}><strong>Role:</strong> {partnerHints.role}</p>
        <p className={styles.detail}><strong>Company:</strong> {partnerHints.company}</p>
        {partnerHints.interests.length > 0 && (
          <div className={styles.detail}>
            <strong>Interests:</strong>
            <div className={styles.interestsList}>
              {partnerHints.interests.map((tag) => (
                <span key={tag} className={styles.interestTag}>{tag}</span>
              ))}
            </div>
          </div>
        )}
      </CardBody>
      <CardActions>
        <Button themeColor="primary" onClick={handleConfirm} disabled={confirming}>
          {confirming ? 'Connecting...' : 'We Found Each Other'}
        </Button>
      </CardActions>
    </Card>
  );
}
