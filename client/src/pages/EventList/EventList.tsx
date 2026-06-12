import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsApi } from '../../services/api';
import { EventCard } from '../../components/EventCard/EventCard';
import type { Event } from '../../services/types';
import styles from './EventList.module.css';

export function EventList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    eventsApi
      .list()
      .then(({ data }) => setEvents(data))
      .catch(() => setError('Failed to load events. Please refresh.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSelectEvent = (event: Event) => {
    navigate(`/auth?eventId=${event.id}`);
  };

  if (loading) return <div className={styles.loading}><span>Loading events...</span></div>;
  if (error) return <div role="alert" className={styles.error}>{error}</div>;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Upcoming Events</h1>
      {events.length === 0 ? (
        <p className={styles.empty}>No events available at this time.</p>
      ) : (
        <div className={styles.grid}>
          {events.map((event) => (
            <EventCard key={event.id} event={event} onSelect={handleSelectEvent} />
          ))}
        </div>
      )}
    </div>
  );
}
