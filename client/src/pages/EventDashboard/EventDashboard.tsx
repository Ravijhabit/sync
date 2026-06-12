import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { eventsApi } from '../../services/api';
import { useEventStore } from '../../stores/useEventStore';
import { useSocket } from '../../hooks/SocketContext';
import { Header } from '../../components/Header/Header';
import { RandomConnect } from '../../components/RandomConnect/RandomConnect';
import { PostConversation } from '../../components/PostConversation/PostConversation';
import { LeaderboardReveal } from '../../components/LeaderboardReveal/LeaderboardReveal';
import { ErrorBoundary } from '../../components/ErrorBoundary/ErrorBoundary';
import styles from './EventDashboard.module.css';

export function EventDashboard() {
  const { eventId } = useParams<{ eventId?: string }>();
  const { setEvent, eventStatus } = useEventStore();
  const { connected } = useSocket();
  const [attendeeCount, setAttendeeCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const resolvedEventId = eventId ?? sessionStorage.getItem('eventId') ?? '';

  useEffect(() => {
    if (!resolvedEventId) { setLoading(false); return; }
    Promise.all([
      eventsApi.get(resolvedEventId),
      eventsApi.attendees(resolvedEventId),
    ])
      .then(([eventRes, attendeesRes]) => {
        setEvent(eventRes.data);
        setAttendeeCount(attendeesRes.data.total);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [resolvedEventId, setEvent]);

  if (loading) return <div className={styles.loading}>Loading event...</div>;

  return (
    <ErrorBoundary component="EventDashboard">
      <div className={styles.page}>
        <Header />

        {!connected && (
          <div role="alert" aria-live="assertive" className={styles.offlineBanner}>
            Reconnecting…
          </div>
        )}

        {eventStatus === 'CLOSING' && <LeaderboardReveal />}

        <main className={styles.main}>
          {attendeeCount !== null && (
            <p className={styles.attendeeCount}>{attendeeCount} attendees at this event</p>
          )}

          {eventStatus === 'ONGOING' && (
            <section aria-label="Random Connect">
              <RandomConnect />
            </section>
          )}

          {eventStatus === 'CLOSING' && (
            <p className={styles.closingMessage}>
              No new matches — the event is ending. Finish your current conversation!
            </p>
          )}

          <section aria-label="Post Conversation" className={styles.postConversationSection}>
            <ErrorBoundary component="PostConversation">
              <PostConversation />
            </ErrorBoundary>
          </section>
        </main>
      </div>
    </ErrorBoundary>
  );
}
