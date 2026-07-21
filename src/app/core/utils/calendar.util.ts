// core/utils/calendar.util.ts
// ─────────────────────────────────────────────────────────────────────
// Export calendrier pour les workshops :
//   • buildWorkshopIcs()   → fichier .ics standard (Apple/Outlook/…)
//   • googleCalendarUrl()  → lien "Ajouter à Google Calendar"
//   • downloadIcs()        → déclenche le téléchargement côté navigateur
//
// Le .ics utilise des dates UTC (suffixe Z) : le calendrier du
// participant les convertit automatiquement dans son fuseau.
// ─────────────────────────────────────────────────────────────────────

import { Workshop } from '../model/models';

const SITE_URL = 'https://campus.clubtdsi.sn';

/** Date au format iCalendar UTC : 20260312T170000Z */
function toIcsDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Échappe les caractères réservés iCalendar (, ; \ retours ligne). */
function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function endOf(w: Workshop): Date {
  return (
    w.endDate ?? new Date(w.date.getTime() + (w.duration || 90) * 60000)
  );
}

function locationOf(w: Workshop): string {
  return w.location === 'en ligne'
    ? 'En ligne'
    : w.location === 'hybride'
      ? 'ESP – UCAD, Dakar (et en ligne)'
      : 'ESP – UCAD, Dakar';
}

function descriptionOf(w: Workshop, pageUrl: string): string {
  return (
    `Workshop du Club TDSI animé par ${w.presenter}.\n` +
    `Détails et inscription : ${pageUrl}`
  );
}

/** Construit le contenu du fichier .ics pour un workshop. */
export function buildWorkshopIcs(w: Workshop, pageUrl: string): string {
  const uid = `${w.id ?? 'workshop'}@campus.clubtdsi.sn`;

  // Lignes CRLF, conformément à la RFC 5545.
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Club TDSI Campus//Workshops//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(w.date)}`,
    `DTEND:${toIcsDate(endOf(w))}`,
    `SUMMARY:${escapeIcs(`Workshop — ${w.themeTitle}`)}`,
    `DESCRIPTION:${escapeIcs(descriptionOf(w, pageUrl))}`,
    `LOCATION:${escapeIcs(locationOf(w))}`,
    `URL:${pageUrl}`,
    `ORGANIZER;CN=Club TDSI:mailto:contact@clubtdsi.sn`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(`Workshop dans 1h — ${w.themeTitle}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Lien "Ajouter à Google Calendar" pré-rempli. */
export function googleCalendarUrl(w: Workshop, pageUrl: string): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Workshop — ${w.themeTitle}`,
    dates: `${toIcsDate(w.date)}/${toIcsDate(endOf(w))}`,
    details: descriptionOf(w, pageUrl),
    location: locationOf(w),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Déclenche le téléchargement du .ics dans le navigateur. */
export function downloadIcs(filename: string, icsContent: string): void {
  const blob = new Blob([icsContent], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export { SITE_URL as CALENDAR_SITE_URL };
