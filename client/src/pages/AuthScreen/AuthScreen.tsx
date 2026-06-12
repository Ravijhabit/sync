import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@progress/kendo-react-buttons';
import { SSOButton } from '../../components/SSOButton/SSOButton';
import { JoinForm } from '../../components/JoinForm/JoinForm';
import { LoginForm } from '../../components/LoginForm/LoginForm';
import type { AuthMode } from './types';
import styles from './AuthScreen.module.css';

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('choose');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const eventId = searchParams.get('eventId') ?? '';

  const handleSuccess = () => {
    if (eventId) {
      sessionStorage.setItem('eventId', eventId);
      navigate(`/dashboard/${eventId}`);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {mode === 'choose' && (
          <>
            <h1 className={styles.title}>Join the Conversation</h1>
            <p className={styles.subtitle}>
              Connect with people at this event through meaningful conversations.
            </p>

            <SSOButton />

            <div className={styles.divider}>
              <hr className={styles.dividerLine} />
              <span className={styles.dividerText}>or continue with email</span>
              <hr className={styles.dividerLine} />
            </div>

            <div className={styles.authButtons}>
              <Button
                themeColor="primary"
                fillMode="outline"
                onClick={() => setMode('join')}
                className={styles.authButton}
              >
                New to Sync
              </Button>
              <Button
                themeColor="base"
                fillMode="outline"
                onClick={() => setMode('login')}
                className={styles.authButton}
              >
                Returning User
              </Button>
            </div>
          </>
        )}

        {mode === 'join' && (
          <>
            <JoinForm eventId={eventId} onSuccess={handleSuccess} />
            <Button fillMode="flat" onClick={() => setMode('choose')} className={styles.backButton}>
              Back
            </Button>
          </>
        )}

        {mode === 'login' && (
          <>
            <LoginForm onSuccess={handleSuccess} />
            <Button fillMode="flat" onClick={() => setMode('choose')} className={styles.backButton}>
              Back
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
