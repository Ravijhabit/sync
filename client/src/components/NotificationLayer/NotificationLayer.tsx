import { useEffect } from 'react';
import { Notification, NotificationGroup } from '@progress/kendo-react-notification';
import { Fade } from '@progress/kendo-react-animation';
import { useNotificationStore } from '../../stores/useNotificationStore';
import { useSocket } from '../../hooks/SocketContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import styles from './NotificationLayer.module.css';

export function NotificationLayer() {
  const { notifications, addNotification, removeNotification } = useNotificationStore();
  const { socket } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket) return;

    const handleMatchFound = () => {
      addNotification({ type: 'success', message: "You've been matched! Check your match card." });
    };

    const handleMatchCancelled = () => {
      addNotification({ type: 'warning', message: 'Your partner disconnected. Looking for a new match.' });
    };

    const handleLearningReviewReady = (payload: { learningId: string }) => {
      addNotification({
        type: 'info',
        message: 'Your partner submitted a learning — review it',
        learningId: payload.learningId,
      });
    };

    const handleUserOffline = () => {
      addNotification({ type: 'warning', message: 'You were marked offline due to inactivity.' });
    };

    const handleEventCompleted = () => {
      addNotification({ type: 'info', message: 'The event has ended. Redirecting to summary...' });
      setTimeout(() => navigate('/summary'), 2000);
    };

    socket.on('match:found', handleMatchFound);
    socket.on('match:cancelled', handleMatchCancelled);
    socket.on('learning:review_ready', handleLearningReviewReady);
    socket.on('user:offline', handleUserOffline);
    socket.on('event:completed', handleEventCompleted);

    return () => {
      socket.off('match:found', handleMatchFound);
      socket.off('match:cancelled', handleMatchCancelled);
      socket.off('learning:review_ready', handleLearningReviewReady);
      socket.off('user:offline', handleUserOffline);
      socket.off('event:completed', handleEventCompleted);
    };
  }, [socket, addNotification, navigate]);

  useEffect(() => {
    notifications.forEach((n) => {
      const timer = setTimeout(() => removeNotification(n.id), 5000);
      return () => clearTimeout(timer);
    });
  }, [notifications, removeNotification]);

  return (
    <NotificationGroup className={cn(styles.group)}>
      {notifications.map((n) => (
        <Fade key={n.id} appear={true}>
          <Notification
            type={{ style: n.type, icon: true }}
            closable={true}
            onClose={() => removeNotification(n.id)}
          >
            <span>{n.message}</span>
          </Notification>
        </Fade>
      ))}
    </NotificationGroup>
  );
}
