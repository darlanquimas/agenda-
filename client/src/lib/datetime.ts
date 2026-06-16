const pad = (n: number) => String(n).padStart(2, '0');

const MONTHS_BR = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const DAYS_BR = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];

function utcParts(iso: string) {
  const d = new Date(iso);
  return {
    year:    d.getUTCFullYear(),
    month:   d.getUTCMonth(),        // 0-based
    day:     d.getUTCDate(),
    hours:   d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

/** Para input[type=datetime-local]: "YYYY-MM-DDTHH:mm" em UTC */
export function toDateTimeLocal(iso: string): string {
  if (!iso) return '';
  const { year, month, day, hours, minutes } = utcParts(iso);
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`;
}

/** "dd/MM/yyyy" em UTC */
export function fmtDate(iso: string): string {
  if (!iso) return '';
  const { year, month, day } = utcParts(iso);
  return `${pad(day)}/${pad(month + 1)}/${year}`;
}

/** "HH:mm" em UTC */
export function fmtTime(iso: string): string {
  if (!iso) return '';
  const { hours, minutes } = utcParts(iso);
  return `${pad(hours)}:${pad(minutes)}`;
}

/** "dd/MM/yy HH:mm" em UTC */
export function fmtDateTime(iso: string): string {
  if (!iso) return '';
  const { year, month, day, hours, minutes } = utcParts(iso);
  return `${pad(day)}/${pad(month + 1)}/${String(year).slice(2)} ${pad(hours)}:${pad(minutes)}`;
}

/** "dd/MM às HH:mm" em UTC */
export function fmtDateTimeShort(iso: string): string {
  if (!iso) return '';
  const { month, day, hours, minutes } = utcParts(iso);
  return `${pad(day)}/${pad(month + 1)} às ${pad(hours)}:${pad(minutes)}`;
}

/** "dd de MMMM de yyyy" em UTC */
export function fmtDateLong(iso: string): string {
  if (!iso) return '';
  const { year, month, day } = utcParts(iso);
  return `${day} de ${MONTHS_BR[month]} de ${year}`;
}

/** "EEEE, dd de MMMM de yyyy" em UTC */
export function fmtDateFull(iso: string): string {
  if (!iso) return '';
  const { year, month, day, weekday } = utcParts(iso);
  return `${DAYS_BR[weekday]}, ${day} de ${MONTHS_BR[month]} de ${year}`;
}

/**
 * Parseia string de data pura ("yyyy-MM-dd") como meia-noite LOCAL,
 * evitando o bug do parseISO do date-fns que trata como UTC e causa
 * o retorno do dia anterior em fusos UTC-.
 */
export function parseDateLocal(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00');
}
