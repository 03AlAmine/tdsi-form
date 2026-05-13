// ═══════════════════════════════════════════════════════════
// Types de base
// ═══════════════════════════════════════════════════════════

export type ActivityType =
  | 'conference'   // 1 conférencier, amphi, ouvert au public
  | 'journee'      // full-day, multi-sessions, programme heure/heure
  | 'hackathon'    // compétition en équipes
  | 'atelier'      // petit groupe pratique, pas de thème parent
  | 'autre';       // extensible

export type ActivityStatus =
  | 'draft'        // brouillon — invisible publiquement
  | 'published'    // visible sur /activites
  | 'ongoing'      // en cours aujourd'hui
  | 'done'         // terminé
  | 'cancelled';   // annulé

// ═══════════════════════════════════════════════════════════
// Sous-objets
// ═══════════════════════════════════════════════════════════

export interface Speaker {
  id: string;
  name: string;
  title: string;          // "Ingénieur Sécurité, Orange Sénégal"
  bio?: string;
  photoUrl?: string;
  linkedinUrl?: string;
  organization?: string;
}

export interface Session {
  id: string;
  time: string;           // "09:30"
  title: string;
  speakerId?: string;     // référence un Speaker.id
  duration: number;       // en minutes
  type: 'talk' | 'atelier' | 'panel' | 'pause' | 'autre';
  location?: string;      // salle spécifique si multi-salles
  description?: string;
}

// ═══════════════════════════════════════════════════════════
// Modèle principal Activity
// ═══════════════════════════════════════════════════════════

export interface Activity {
  id?: string;

  // Identité
  type: ActivityType;
  title: string;
  description: string;
  coverImageUrl?: string;
  tags: string[];

  // Dates
  date: Date;
  endDate?: Date;         // pour journées multi-jours

  // Lieu
  location: string;       // texte libre : "Amphi A, TDSI Dakar"
  isOnline: boolean;
  meetLink?: string;

  // Capacité
  maxParticipants?: number;   // undefined = illimité

  // Participants
  registrations: string[];    // UIDs membres inscrits
  guestCount: number;         // compteur invités (pas les UIDs pour la perf)

  // Workflow
  status: ActivityStatus;
  presenceEnabled: boolean;   // active le QR check-in le jour J

  // Contenu enrichi
  speakers?: Speaker[];
  sessions?: Session[];       // programme (journée / hackathon)

  // Méta
  createdAt: Date;
  createdBy: string;          // UID admin
  updatedAt?: Date;
}

// ═══════════════════════════════════════════════════════════
// Inscription (collection /activityRegistrations)
// ═══════════════════════════════════════════════════════════

export interface ActivityRegistration {
  id?: string;
  activityId: string;

  // Qui
  type: 'member' | 'guest';
  userId?: string;            // UID si membre connecté
  name: string;
  email: string;
  phone?: string;
  organization?: string;      // établissement / entreprise

  // Confirmation
  registeredAt: Date;
  confirmationToken: string;  // token unique signé côté backend
  confirmationSentAt?: Date;

  // Présence
  checkedIn: boolean;
  checkedInAt?: Date;
}

// ═══════════════════════════════════════════════════════════
// Helpers et constantes
// ═══════════════════════════════════════════════════════════

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  conference: 'Conférence',
  journee:    'Journée',
  hackathon:  'Hackathon',
  atelier:    'Atelier',
  autre:      'Autre',
};

export const ACTIVITY_TYPE_ICONS: Record<ActivityType, string> = {
  conference: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
  journee:    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  hackathon:  'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  atelier:    'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  autre:      'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
};

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  draft:      'Brouillon',
  published:  'Publié',
  ongoing:    'En cours',
  done:       'Terminé',
  cancelled:  'Annulé',
};
