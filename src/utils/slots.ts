import moment from 'moment';


export const SLOT_CONFIG = {
  openTime: '10:00',
  lastSlotTime: '17:45',
  intervalMinutes: 15,
  bookingDays: 5,
};

export const SLOT_TIME_FORMAT = 'HH:mm';
export const SLOT_DATE_FORMAT = 'YYYY-MM-DD';

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
  isPast: boolean;
  isAvailable: boolean;
}

/** ['10:00', '10:15', ... , '17:45'] */
export function buildSlotTimes(config = SLOT_CONFIG): string[] {
  const cursor = moment(config.openTime, SLOT_TIME_FORMAT);
  const end = moment(config.lastSlotTime, SLOT_TIME_FORMAT);
  const step = Math.max(1, config.intervalMinutes);

  const times: string[] = [];
  while (cursor.isSameOrBefore(end)) {
    times.push(cursor.format(SLOT_TIME_FORMAT));
    cursor.add(step, 'minutes');
  }
  return times;
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

/** The offline grid: every slot, with today's expired ones already flagged. */
export function buildDaySlots(date: string, config = SLOT_CONFIG): TimeSlot[] {
  return buildSlotTimes(config).map(time => {
    const past = isSlotPast(date, time);
    return {
      time,
      label: moment(time, SLOT_TIME_FORMAT).format('h:mm A'),
      booked: 0,
      isPast: past,
      isAvailable: !past,
    };
  });
}

/** '10:00' -> '10:00 AM' */
export function formatSlotLabel(time: string): string {
  return moment(time, SLOT_TIME_FORMAT).format('h:mm A');
}
