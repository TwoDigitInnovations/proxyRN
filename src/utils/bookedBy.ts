import type { TFunction } from 'i18next';
import type { Appointment } from '../types/models';

export function describeBookedBy(appointment: Appointment, t: TFunction): string {
  const role = appointment.bookedByRole;
  const name = typeof appointment.bookedBy === 'object' ? appointment.bookedBy?.name : undefined;
  if (role === 'admin') return t('Admin');
  if (role === 'provider') return name ? t('Provider - {{name}}', { name }) : t('Provider');
  if (role === 'staff') return name ? t('Staff - {{name}}', { name }) : t('Staff');
  return t('Visitor');
}
