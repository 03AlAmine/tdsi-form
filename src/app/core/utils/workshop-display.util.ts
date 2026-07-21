// core/utils/workshop-display.util.ts
// ─────────────────────────────────────────────────────────────────────
// Petits formatters/mappers réutilisés à l'identique entre
// ThematiquesComponent et WorkshopsComponent (statut, lieu, durée...).
// Fonctions pures, sans état ni dépendance : un utilitaire suffit, pas
// besoin d'un service injectable pour de la simple mise en forme —
// même logique que slug.util.ts.
//
// Les deux composants gardent leurs propres méthodes publiques (mêmes
// noms/signatures qu'avant, donc zéro changement dans les templates) :
// elles délèguent juste le corps à ces fonctions au lieu de dupliquer
// la table de correspondance.
// ─────────────────────────────────────────────────────────────────────

const WORKSHOP_STATUS_CLASS: Record<string, string> = {
  planifié: 'info',
  'en cours': 'success',
  terminé: 'neutral',
  annulé: 'danger',
};

const WORKSHOP_STATUS_ICON: Record<string, string> = {
  planifié: 'fa-clock',
  'en cours': 'fa-play-circle',
  terminé: 'fa-check-circle',
  annulé: 'fa-ban',
};

const LOCATION_ICON: Record<string, string> = {
  'en ligne': 'fa-laptop',
  présentiel: 'fa-building-columns',
  hybride: 'fa-arrows-rotate',
};

const LOCATION_TEXT: Record<string, string> = {
  'en ligne': 'En ligne',
  présentiel: 'Présentiel',
  hybride: 'Hybride',
};

// ⚠️ Volontairement distinct de LOCATION_ICON ci-dessus : les pages
// admin (admin-workshops, workshops-detail) utilisent un jeu d'icônes
// différent (fa-wifi/fa-building/fa-sync-alt) du côté public
// (fa-laptop/fa-building-columns/fa-arrows-rotate), de façon cohérente
// entre elles deux. Contrairement à l'icône de statut qui divergeait
// par accident, celle-ci diverge de façon stable des deux côtés — donc
// on centralise chaque variante séparément plutôt que d'en imposer une
// aux deux univers sans validation.
const ADMIN_LOCATION_ICON: Record<string, string> = {
  'en ligne': 'fa-wifi',
  présentiel: 'fa-building',
  hybride: 'fa-sync-alt',
};

export function getWorkshopStatusClass(status: string): string {
  return WORKSHOP_STATUS_CLASS[status] || 'neutral';
}

export function getWorkshopStatusIcon(status: string): string {
  return WORKSHOP_STATUS_ICON[status] || 'fa-circle';
}

export function getLocationIcon(location: string): string {
  return LOCATION_ICON[location] || 'fa-location-dot';
}

export function getLocationText(location: string): string {
  return LOCATION_TEXT[location] || location;
}

/** Variante admin (icônes différentes du côté public — voir commentaire plus haut). */
export function getAdminLocationIcon(location: string): string {
  return ADMIN_LOCATION_ICON[location] || 'fa-map-marker-alt';
}

/** Formate une durée en minutes → "1h 30min" / "45min". */
export function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  return `${minutes}min`;
}

/** Heure de fin (HH:mm) à partir d'une heure de début + une durée en minutes. */
export function getEndTime(
  date: Date | string | null | undefined,
  duration: number | null | undefined,
): string {
  if (!date || !duration) return '';
  const startDate = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(startDate.getTime())) return '';
  const endDate = new Date(startDate.getTime() + duration * 60000);
  return endDate.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
