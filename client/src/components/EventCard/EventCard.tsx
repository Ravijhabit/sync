import { Card, CardHeader, CardBody, CardActions } from '@progress/kendo-react-layout';
import { Button } from '@progress/kendo-react-buttons';
import type { EventCardProps } from './types';
import styles from './EventCard.module.css';

const STATUS_CLASS: Record<string, string> = {
  UPCOMING: styles.statusUpcoming ?? '',
  ONGOING: styles.statusOngoing ?? '',
  CLOSING: styles.statusClosing ?? '',
  COMPLETED: styles.statusCompleted ?? '',
};

export function EventCard({ event, onSelect }: EventCardProps) {
  const startDate = new Date(event.startTime).toLocaleString();

  return (
    <Card className={styles.card}>
      <CardHeader>
        <h3>{event.name}</h3>
        <span
          className={`${styles.statusBadge} ${STATUS_CLASS[event.status] ?? ''}`}
          aria-label={`Event status: ${event.status}`}
        >
          {event.status}
        </span>
      </CardHeader>
      <CardBody>
        <p className={styles.meta}><strong>Venue:</strong> {event.venue}</p>
        <p className={styles.meta}><strong>Starts:</strong> {startDate}</p>
        <p className={styles.description}>{event.description}</p>
      </CardBody>
      <CardActions>
        <Button
          themeColor="primary"
          onClick={() => onSelect(event)}
          disabled={event.status === 'COMPLETED'}
        >
          {event.status === 'COMPLETED' ? 'Event Ended' : 'Join Event'}
        </Button>
      </CardActions>
    </Card>
  );
}
