export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'student';
  promo?: string;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────
// Enrichissement IA persisté (généré une fois, servi à tous).
//   • aiEnrichmentHash : empreinte du contenu source (titre/description)
//     au moment de la génération → si le contenu change, l'enrichissement
//     est considéré périmé et régénéré au prochain affichage.
//   • aiEnrichmentAt : Timestamp Firestore (non utilisé côté UI).
// ─────────────────────────────────────────────────────────────
export interface AiEnrichmentData {
  objectives: string[];
  prerequisites: string[];
  skills: string[];
  outcomes?: string[]; // workshops uniquement
  materials?: string[]; // thématiques uniquement
}

export interface Theme {
  linkedWorkshop?: Workshop;
  id?: string;
  title: string;
  description: string;
  category: ThemeCategory;
  tags: string[];
  difficulty: 'débutant' | 'intermédiaire' | 'avancé';
  maxParticipants: number;
  currentParticipants: number;
  status: 'ouvert' | 'complet' | 'fermé';
  workshopDate?: Date;
  createdAt: Date;
  createdBy: string;
  imageUrl?: string;
  objectives?: string;
  prerequisites?: string;
  materialsNeeded?: string;
  estimatedDuration?: number;
  fromSubmissionId?: string;
  fromStudentName?: string;
  fromStudentPromo?: string;
  // ✅ Liste des uid des membres ayant manifesté un intérêt pour cette
  // thématique tant qu'aucun workshop n'y est encore lié. Sert de
  // signal de demande pour l'admin ("faut-il programmer ce workshop ?").
  // Une fois un workshop lié, ce champ n'est plus affiché côté public
  // (remplacé par le vrai compteur d'inscriptions du workshop).
  interested?: string[];
  // Enrichissement IA persisté (voir AiEnrichmentData)
  aiEnrichment?: AiEnrichmentData;
  aiEnrichmentHash?: string;
  aiEnrichmentAt?: unknown;
}

export type ThemeCategory =
  | 'Sécurité Réseau'
  | 'Cryptographie'
  | 'Transmission de Données'
  | 'Intelligence Artificielle'
  | 'Développement Web'
  | 'Cloud & DevOps'
  | 'Autre';

export interface ThemeSubmission {
  id?: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  promo: string;
  proposedTitle: string;
  description: string;
  category: ThemeCategory;
  objectives: string;
  prerequisites: string;
  estimatedDuration: number;
  materialsNeeded: string;
  difficulty?: 'débutant' | 'intermédiaire' | 'avancé';
  status: 'en attente' | 'approuvé' | 'refusé';
  adminComment?: string;
  submittedAt: Date;
  updatedAt?: Date;
  // ✅ true si l'étudiant a utilisé le bouton "Complétion IA" du
  // formulaire de proposition pour pré-remplir tout ou partie du
  // contenu. Purement informatif — affiché en badge côté admin.
  aiAssisted?: boolean;
}

export interface Workshop {
  id?: string;
  themeId: string;
  themeTitle: string;
  presenter: string;
  date: Date;
  duration: number;
  location: 'en ligne' | 'présentiel' | 'hybride';
  meetLink?: string;
  status: 'planifié' | 'en cours' | 'terminé' | 'annulé';
  presenceFormEnabled: boolean;
  presenceFormConfig?: PresenceFormConfig;
  registrations: string[];
  // ✅ File d'attente : uids en attente d'une place, dans l'ordre
  // d'arrivée (index 0 = prochain promu). Alimenté par
  // WorkshopService.joinWaitlist() / promu automatiquement dans
  // unregisterFromWorkshop() quand une place se libère.
  waitlist?: string[];
  maxParticipants: number;
  createdAt: Date;
  endDate?: Date;
  // Enrichissement IA persisté (voir AiEnrichmentData)
  aiEnrichment?: AiEnrichmentData;
  aiEnrichmentHash?: string;
  aiEnrichmentAt?: unknown;
}

export interface PresenceFormConfig {
  fields: PresenceField[];
  openAt?: Date;
  closeAt?: Date;
  requirePhoto: boolean;
  sendConfirmation: boolean;
}

export interface PresenceField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'select' | 'checkbox' | 'textarea' | 'number';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface PresenceRecord {
  id?: string;
  workshopId: string;
  userId: string;
  userName: string;
  userEmail: string;
  checkedInAt: Date;
  responses: Record<string, string | boolean | number>;
}

export interface Registration {
  id?: string;
  workshopId: string;
  userId: string;
  userName: string;
  userEmail: string;
  promo: string;
  registeredAt: Date;
  attended: boolean;
}

// ─────────────────────────────────────────────────────────────
// AppSettings — réglages globaux du club, configurables par un
// admin depuis /admin/configuration. Stocké dans un document
// unique Firestore : settings/app (voir AppSettingsService).
// Ces valeurs servent de défauts pré-remplis dans les formulaires
// de création de thématique/atelier — elles n'imposent rien aux
// documents déjà créés, qui gardent leurs propres valeurs.
// ─────────────────────────────────────────────────────────────
export interface AppSettings {
  // Défauts pour la création d'une thématique
  defaultThemeMaxParticipants: number;

  // Défauts pour la création d'un atelier (workshop)
  defaultWorkshopDuration: number; // en minutes
  defaultWorkshopMaxParticipants: number;
  defaultWorkshopLocation: 'en ligne' | 'présentiel' | 'hybride';
  defaultWorkshopTime: string; // format HH:mm

  // ✅ Nombre d'"intéressés" à partir duquel les admins reçoivent une
  // notification automatique les invitant à envisager de programmer
  // un workshop sur cette thématique.
  interestNotificationThreshold: number;

  updatedAt: Date;
  updatedBy: string; // uid de l'admin ayant fait la dernière modification
}

// ─────────────────────────────────────────────────────────────
// Notification — un document par destinataire (recipientUid),
// créé automatiquement par NotificationService.notify() en
// réaction aux événements métier (voir ce service pour la liste
// des déclencheurs). Lue en temps réel par la cloche de
// notification dans la navbar/sidebar.
// ─────────────────────────────────────────────────────────────
export type NotificationType =
  | 'submission_approved'
  | 'submission_refused'
  | 'submission_received'
  | 'theme_created'
  | 'workshop_created'
  | 'workshop_cancelled'
  | 'account_suspended'
  | 'theme_interest_threshold'
  | 'waitlist_promoted';

export interface AppNotification {
  id?: string;
  recipientUid: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string; // route Angular à ouvrir au clic (ex: '/espace-membre/mes-soumissions')
  read: boolean;
  createdAt: Date;
}
