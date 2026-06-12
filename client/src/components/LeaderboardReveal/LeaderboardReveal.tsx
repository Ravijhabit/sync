import { useEffect, useState } from 'react';
import { useSocket } from '../../hooks/SocketContext';
import { useEventStore } from '../../stores/useEventStore';
import { CountdownBanner } from '../CountdownBanner/CountdownBanner';
import { Leaderboard } from '../Leaderboard/Leaderboard';
import type { EventClosingPayload } from '../../socket/types';
import styles from './LeaderboardReveal.module.css';

export function LeaderboardReveal() {
  const { socket } = useSocket();
  const event = useEventStore((s) => s.event);
  const eventStatus = useEventStore((s) => s.eventStatus);
  const setEventStatus = useEventStore((s) => s.setEventStatus);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!socket) return;
    const handleClosing = (payload: EventClosingPayload) => {
      setEventStatus('CLOSING');
      setSecondsRemaining(payload.secondsRemaining);
    };
    socket.on('event:closing', handleClosing);
    return () => { socket.off('event:closing', handleClosing); };
  }, [socket, setEventStatus]);

  if (eventStatus !== 'CLOSING' || !event) return null;

  return (
    <div className={styles.container}>
      {secondsRemaining !== null && <CountdownBanner initialSeconds={secondsRemaining} />}
      <h2 className={styles.title}>Leaderboard</h2>
      <Leaderboard eventId={event.id} />
    </div>
  );
}
