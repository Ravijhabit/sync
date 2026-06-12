import { useState } from 'react';
import { Button } from '@progress/kendo-react-buttons';
import { Loader } from '@progress/kendo-react-indicators';
import { useSocket } from '../../hooks/SocketContext';
import { useUserStore } from '../../stores/useUserStore';
import styles from './StatusToggle.module.css';

export function StatusToggle() {
  const { socket } = useSocket();
  const user = useUserStore((s) => s.user);
  const [waiting, setWaiting] = useState(false);

  const handleSetIdle = () => {
    if (!socket || !user) return;
    setWaiting(true);
    socket.emit('user:set_idle', { userId: user.id });
  };

  if (waiting) {
    return (
      <div className={styles.waitingContainer} aria-live="polite" aria-label="Finding a match">
        <Loader size="large" type="infinite-spinner" />
        <p className={styles.waitingText}>Finding someone interesting to talk to...</p>
        <Button fillMode="flat" onClick={() => setWaiting(false)}>Cancel</Button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Ready to connect?</h3>
      <p className={styles.description}>
        Set yourself as available and get matched with someone at the event.
      </p>
      <Button themeColor="primary" size="large" onClick={handleSetIdle}>
        Set Myself as Available
      </Button>
    </div>
  );
}
