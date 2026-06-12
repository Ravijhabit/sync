import { useEffect, useState } from 'react';
import { Card, CardHeader, CardBody } from '@progress/kendo-react-layout';
import { eventsApi } from '../../services/api';
import { useEventStore } from '../../stores/useEventStore';
import { useUserStore } from '../../stores/useUserStore';
import { Header } from '../../components/Header/Header';
import { Leaderboard } from '../../components/Leaderboard/Leaderboard';
import { ErrorBoundary } from '../../components/ErrorBoundary/ErrorBoundary';
import type { ReceivedRating } from '../../services/types';
import styles from './EventSummary.module.css';

export function EventSummary() {
  const event = useEventStore((s) => s.event);
  const user = useUserStore((s) => s.user);
  const [ratings, setRatings] = useState<ReceivedRating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!event || !user) return;
    eventsApi
      .receivedRatings(event.id, user.id)
      .then(({ data }) => setRatings(data))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [event, user]);

  if (!event || !user) return <div className={styles.loading}>Loading summary...</div>;

  return (
    <ErrorBoundary component="EventSummary">
      <div className={styles.page}>
        <Header />

        <main className={styles.main}>
          <div className={styles.hero}>
            <h1 className={styles.heroTitle}>{event.name}</h1>
            <p className={styles.heroSubtitle}>Event has ended</p>
          </div>

          <section className={styles.section} aria-label="Received Ratings">
            <h2 className={styles.sectionTitle}>What Others Learned About You</h2>

            {loading && <p>Loading ratings...</p>}

            {!loading && ratings.length === 0 && (
              <p className={styles.empty}>No ratings received yet. Check back soon!</p>
            )}

            {!loading && ratings.length > 0 && (
              <div className={styles.ratingsList}>
                {ratings.map((r) => (
                  <Card key={r.learningId}>
                    <CardHeader>
                      <div className={styles.ratingCardHeader}>
                        <div>
                          <span className={styles.reviewerName}>{r.reviewerName}</span>
                          <span className={styles.reviewerMeta}>
                            {r.reviewerRole} · {r.reviewerCompany}
                          </span>
                        </div>
                        <div className={styles.scoreGroup}>
                          <span className={styles.score}>{r.rating}/10</span>
                          {r.isCorrect !== undefined && (
                            <span className={`${styles.correctBadge} ${r.isCorrect ? styles.correctBadgeTrue : styles.correctBadgeFalse}`}>
                              {r.isCorrect ? 'Correct' : 'Not quite'}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardBody>
                      <p className={styles.learningText}>"{r.content}"</p>
                      <p className={styles.justificationText}>{r.justification}</p>
                      {r.feedback && (
                        <p className={styles.feedbackText}><strong>Feedback:</strong> {r.feedback}</p>
                      )}
                      <p className={styles.matchDate}>{new Date(r.matchDate).toLocaleDateString()}</p>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section className={styles.section} aria-label="Final Leaderboard">
            <h2 className={styles.sectionTitle}>Final Rankings</h2>
            <Leaderboard eventId={event.id} />
          </section>
        </main>
      </div>
    </ErrorBoundary>
  );
}
