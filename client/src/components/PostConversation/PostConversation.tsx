import { useEffect, useState } from 'react';
import { Card, CardHeader, CardBody } from '@progress/kendo-react-layout';
import { useSocket } from '../../hooks/SocketContext';
import { useMatchStore } from '../../stores/useMatchStore';
import { useUserStore } from '../../stores/useUserStore';
import { LearningSubmit } from './LearningSubmit';
import { LearningReview } from './LearningReview';
import { MeaningfulFlag } from './MeaningfulFlag';
import { ErrorBoundary } from '../ErrorBoundary/ErrorBoundary';
import styles from './PostConversation.module.css';

export function PostConversation() {
  const { socket } = useSocket();
  const user = useUserStore((s) => s.user);
  const { matchId, partnerId, matchStatus } = useMatchStore();
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null);
  const [learningSubmitted, setLearningSubmitted] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  useEffect(() => {
    if (!socket) return;
    const handleReviewReady = (payload: { learningId: string }) => {
      setPendingReviewId(payload.learningId);
    };
    socket.on('learning:review_ready', handleReviewReady);
    return () => { socket.off('learning:review_ready', handleReviewReady); };
  }, [socket]);

  if (matchStatus !== 'COMPLETED' || !matchId || !user || !partnerId) return null;

  return (
    <ErrorBoundary component="PostConversation">
      <Card className={styles.card}>
        <CardHeader>
          <h3 className={styles.title}>Post-Conversation</h3>
        </CardHeader>
        <CardBody>
          <div className={styles.body}>
            {!learningSubmitted && (
              <LearningSubmit
                matchId={matchId}
                targetId={partnerId}
                onSubmitted={() => setLearningSubmitted(true)}
              />
            )}

            {pendingReviewId !== null && !reviewDone && (
              <div className={styles.section}>
                <LearningReview learningId={pendingReviewId} onReviewed={() => setReviewDone(true)} />
              </div>
            )}

            <div className={styles.section}>
              <MeaningfulFlag matchId={matchId} />
            </div>
          </div>
        </CardBody>
      </Card>
    </ErrorBoundary>
  );
}
