import { useState } from 'react';
import { Form, Field, FormElement } from '@progress/kendo-react-form';
import { Input } from '@progress/kendo-react-inputs';
import { Button } from '@progress/kendo-react-buttons';
import { authApi } from '../../services/api';
import { useUserStore } from '../../stores/useUserStore';
import { cn } from '../../utils/cn';
import type { LoginFormProps } from './types';
import styles from './LoginForm.module.css';

export function LoginForm({ onSuccess }: LoginFormProps) {
  const setUser = useUserStore((s) => s.setUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await authApi.login({ email: String(values['email'] ?? '') });
      setUser(data.user, data.sessionId);
      onSuccess();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setError('No account found with that email. Please join first.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form
      onSubmit={(values) => void handleSubmit(values as Record<string, unknown>)}
      render={(formRenderProps) => (
        <FormElement className={cn(styles.form)}>
          <h2 className={styles.title}>Welcome Back</h2>
          <Field name="email" label="Email" component={Input} type="email" required />

          {error && <p role="alert" className={styles.error}>{error}</p>}

          <Button
            themeColor="primary"
            type="submit"
            disabled={!formRenderProps.allowSubmit || loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </FormElement>
      )}
    />
  );
}
