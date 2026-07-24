// features/shared/components/glow-timeline/timeline-item.model.ts
// ─────────────────────────────────────────────────────────────────────
// Modèle générique consommé par <app-glow-timeline>. Volontairement
// découplé du modèle Workshop : le composant ne connaît rien du métier,
// juste une liste de "points" à afficher sur le fil. Ça permet de le
// réutiliser tel quel pour une roadmap membre, un historique, etc.
// ─────────────────────────────────────────────────────────────────────

export interface TimelineItemMeta {
  icon: string; // classe FontAwesome, ex: 'fa-user'
  text: string;
}

export type TimelineStatus = 'info' | 'success' | 'neutral' | 'danger' | 'default';

export interface TimelineItem {
  id: string;
  icon: string; // classe FontAwesome affichée dans le point
  title: string;
  dateLabel?: string;
  status?: TimelineStatus;
  statusLabel?: string;
  /** Anime le point en pulsation continue (ex: workshop "en cours"). */
  pulse?: boolean;
  meta?: TimelineItemMeta[];
  description?: string;
  ctaLabel?: string;
  /** Désactive le clic/hover interactif (ex: étape future non atteinte). */
  disabled?: boolean;
  /** Passthrough libre pour l'objet métier d'origine (ex: Workshop). */
  data?: unknown;
}
