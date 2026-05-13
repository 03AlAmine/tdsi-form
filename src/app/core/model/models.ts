export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'student';
  promo?: string;
  createdAt: Date;
}

export interface Theme {
  linkedWorkshop?: any;
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
  maxParticipants: number;
  createdAt: Date;
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
