import type { Event } from '../../services/types';

export interface EventCardProps {
  event: Event;
  onSelect: (event: Event) => void;
}
