import { useState } from 'react';
import { Form, Field, FormElement } from '@progress/kendo-react-form';
import { Input, TextArea } from '@progress/kendo-react-inputs';
import { DropDownList } from '@progress/kendo-react-dropdowns';
import { Button } from '@progress/kendo-react-buttons';
import { authApi } from '../../services/api';
import { useUserStore } from '../../stores/useUserStore';
import { cn } from '../../utils/cn';
import type { JoinBody } from '../../services/types';
import type { JoinFormProps } from './types';
import styles from './JoinForm.module.css';

const ROLES = [
  'Backend Engineer', 'Frontend Engineer', 'Full Stack Engineer',
  'Mobile Engineer', 'DevOps / Platform', 'Data Engineer',
  'ML Engineer', 'Product Manager', 'Designer',
  'Engineering Manager', 'Founder', 'Other',
];

const INTERESTS = [
  'AI', 'ML', 'DevOps', 'Startups', 'Web3', 'Open Source',
  'Product', 'Design', 'Cloud', 'Security', 'Data', 'Mobile',
  'Leadership', 'Career', 'TypeScript', 'Rust', 'Go', 'Python',
];

export function JoinForm({ eventId, onSuccess }: JoinFormProps) {
  const setUser = useUserStore((s) => s.setUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>(ROLES[0] ?? '');

  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    try {
      const body: JoinBody = {
        name: String(values['name'] ?? ''),
        email: String(values['email'] ?? ''),
        role: selectedRole,
        company: String(values['company'] ?? ''),
        bio: String(values['bio'] ?? ''),
        interests: selectedInterests,
        eventId,
      };
      const { data } = await authApi.join(body);
      setUser(data.user, data.sessionId);
      onSuccess();
    } catch {
      setError('Failed to join. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleInterest = (tag: string) => {
    setSelectedInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <Form
      onSubmit={(values) => void handleSubmit(values as Record<string, unknown>)}
      render={(formRenderProps) => (
        <FormElement className={cn(styles.form)}>
          <h2 className={styles.title}>Join the Event</h2>

          <Field name="name" label="Name" component={Input} required />
          <Field name="email" label="Email" component={Input} type="email" required />

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Role</label>
            <DropDownList
              data={ROLES}
              value={selectedRole}
              onChange={(e) => setSelectedRole(String(e.value))}
              aria-label="Role"
              className={cn(styles.dropDown)}
            />
          </div>

          <Field name="company" label="Company" component={Input} required />
          <Field name="bio" label="Bio" component={TextArea} rows={3} />

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Interests</label>
            <div className={styles.interestsList}>
              {INTERESTS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleInterest(tag)}
                  className={`${styles.interestTag} ${selectedInterests.includes(tag) ? styles.interestTagSelected : ''}`}
                  aria-pressed={selectedInterests.includes(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {error && <p role="alert" className={styles.error}>{error}</p>}

          <Button
            themeColor="primary"
            type="submit"
            disabled={!formRenderProps.allowSubmit || loading}
          >
            {loading ? 'Joining...' : 'Join Event'}
          </Button>
        </FormElement>
      )}
    />
  );
}
