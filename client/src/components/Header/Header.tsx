import { useUserStore } from '../../stores/useUserStore';
import { useEventStore } from '../../stores/useEventStore';
import styles from './Header.module.css';

const STATUS_LABELS: Record<string, string> = {
  UPCOMING: 'Upcoming',
  ONGOING: 'Live',
  CLOSING: 'Ending Soon',
  COMPLETED: 'Ended',
};

const STATUS_CLASS: Record<string, string> = {
  UPCOMING: styles.statusUpcoming ?? '',
  ONGOING: styles.statusOngoing ?? '',
  CLOSING: styles.statusClosing ?? '',
  COMPLETED: styles.statusCompleted ?? '',
};

export function Header() {
  const user = useUserStore((s) => s.user);
  const event = useEventStore((s) => s.event);
  const eventStatus = useEventStore((s) => s.eventStatus);

  const statusLabel = eventStatus ? (STATUS_LABELS[eventStatus] ?? eventStatus) : '';
  const statusClass = eventStatus ? (STATUS_CLASS[eventStatus] ?? '') : '';

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <span className={styles.logo}>Sync</span>
        {event && (
          <>
            <span className={styles.separator}>·</span>
            <span className={styles.eventName}>{event.name}</span>
          </>
        )}
        {eventStatus && (
          <span
            className={`${styles.statusBadge} ${statusClass}`}
            aria-label={`Event status: ${statusLabel}`}
          >
            {statusLabel}
          </span>
        )}
      </div>

      {user && (
        <div className={styles.userSection}>
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className={styles.avatarImg} />
          ) : (
            <div className={styles.avatarInitial} aria-label={user.name}>
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className={styles.userName}>{user.name}</span>
        </div>
      )}
    </header>
  );
}
