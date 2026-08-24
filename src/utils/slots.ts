import moment from 'moment';


// Slot start times come from the provider's own service record, so the only
// thing fixed here is how far ahead a visitor may book.
export const SLOT_CONFIG = {
  bookingDays: 5,
};

export const SLOT_TIME_FORMAT = 'HH:mm';
export const SLOT_DATE_FORMAT = 'YYYY-MM-DD';

// Providers save 'HH:mm', older records may carry a 12h string.
const SLOT_INPUT_FORMATS = [SLOT_TIME_FORMAT, 'H:mm', 'h:mm A', 'h:mmA', 'hh:mm A'];

export interface BookingDate {
  date: string;      // YYYY-MM-DD
  label: string;     // '24 Aug'
  weekday: string;   // 'Mon'
  isToday: boolean;
}

export interface TimeSlot {
  time: string;      // '10:00'
  label: string;     // '10:00 AM'
  booked: number;
  isBooked: boolean; // someone else already has this slot
  isPast: boolean;
  isAvailable: boolean;
}

/** The provider's own slot times, normalised to 'HH:mm', de-duped and sorted. */
export function normalizeSlotTimes(serviceSlot?: string[] | null): string[] {
  if (!Array.isArray(serviceSlot)) return [];

  const times = new Set<string>();
  serviceSlot.forEach(value => {
    const parsed = moment(String(value ?? '').trim(), SLOT_INPUT_FORMATS, true);
    if (parsed.isValid()) times.add(parsed.format(SLOT_TIME_FORMAT));
  });
  return Array.from(times).sort();
}

/** The next `bookingDays` selectable dates, starting today. */
export function buildBookingDates(config = SLOT_CONFIG): BookingDate[] {
  const today = moment().startOf('day');
  return Array.from({ length: config.bookingDays }, (_, i) => {
    const day = moment(today).add(i, 'days');
    return {
      date: day.format(SLOT_DATE_FORMAT),
      label: day.format('DD MMM'),
      weekday: day.format('ddd'),
      isToday: i === 0,
    };
  });
}

/** True when that slot on that day has already started. */
export function isSlotPast(date: string, time: string): boolean {
  return moment(`${date} ${time}`, `${SLOT_DATE_FORMAT} ${SLOT_TIME_FORMAT}`).isBefore(moment());
}

/** Offline mirror of the server grid: the provider's slots, minus the past ones. */
export function buildDaySlots(date: string, serviceSlot?: string[] | null): TimeSlot[] {
  return normalizeSlotTimes(serviceSlot).map(time => {
    const past = isSlotPast(date, time);
    return {
      time,
      label: moment(time, SLOT_TIME_FORMAT).format('h:mm A'),
      booked: 0,
      isBooked: false,
      isPast: past,
      isAvailable: !past,
    };
  });
}

/** '10:00' -> '10:00 AM' */
export function formatSlotLabel(time: string): string {
  return moment(time, SLOT_TIME_FORMAT).format('h:mm A');
}
