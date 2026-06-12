import { useEffect } from 'react';
import { useSocket } from '../../hooks/SocketContext';
import { useMatchStore } from '../../stores/useMatchStore';
import { StatusToggle } from './StatusToggle';
import { MatchCard } from './MatchCard';
import { PromptCard } from './PromptCard';
import type { MatchFoundPayload, MatchActivePayload } from '../../socket/types';
import styles from './RandomConnect.module.css';

export function RandomConnect() {
  const { socket } = useSocket();
  const { matchStatus, setMatch, setMatchStatus, setActivePrompt, prompt } = useMatchStore();

  useEffect(() => {
    if (!socket) return;

    const handleMatchFound = (payload: MatchFoundPayload) => {
      setMatch(payload.matchId, payload.partnerHints, payload.prompt);
    };

    const handleMatchActive = (payload: MatchActivePayload) => {
      setMatchStatus('ACTIVE');
      setActivePrompt(payload.prompt);
    };

    const handleMatchEnded = () => {
      setMatchStatus('COMPLETED');
    };

    const handleMatchCancelled = () => {
      setMatchStatus('CANCELLED');
      setTimeout(() => useMatchStore.getState().clearMatch(), 3000);
    };

    socket.on('match:found', handleMatchFound);
    socket.on('match:active', handleMatchActive);
    socket.on('match:ended', handleMatchEnded);
    socket.on('match:cancelled', handleMatchCancelled);

    return () => {
      socket.off('match:found', handleMatchFound);
      socket.off('match:active', handleMatchActive);
      socket.off('match:ended', handleMatchEnded);
      socket.off('match:cancelled', handleMatchCancelled);
    };
  }, [socket, setMatch, setMatchStatus, setActivePrompt]);

  if (matchStatus === 'CANCELLED') {
    return (
      <div className={styles.cancelledState} role="alert" aria-live="polite">
        <p>Your partner disconnected. Looking for a new match...</p>
      </div>
    );
  }

  if (matchStatus === 'COMPLETED') {
    return (
      <div className={styles.completedState} aria-live="polite">
        <p>Great conversation! Fill out the post-conversation form below.</p>
      </div>
    );
  }

  if (matchStatus === 'ACTIVE' && prompt) return <PromptCard />;
  if (matchStatus === 'PENDING') return <MatchCard />;

  return <StatusToggle />;
}
