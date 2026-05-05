export interface GuestRegistration {
  id?: string;
  workshopId: string;
  workshopTitle: string;
  fullName: string;
  email: string;
  establishment: string;
  level: string;
  phone?: string;
  registeredAt: Date;
  status: 'pending' | 'confirmed' | 'cancelled';
  token: string;
  checkedIn: boolean;
  checkedInAt?: Date;
  confirmationSent: boolean;
  reminderSent: boolean;
}

export interface Establishment {
  id: string;
  name: string;
  city: string;
  country: string;
}

export const ESTABLISHMENTS = [
  'ESP - Ecole Supérieure Polytechnique',
  'UCAD - Université Cheikh Anta Diop',
  'UVS - Université Virtuelle du Sénégal',
  'UNCHK - Université Nazi Boni',
  'UAM - Université Amadou Mahtar Mbow',
  'UGB - Université Gaston Berger',
  'Autre université',
  'École privée',
  'Autre établissement'
];

export const STUDY_LEVELS = [
  'Licence 1',
  'Licence 2',
  'Licence 3',
  'Master 1',
  'Master 2',
  'Doctorat',
  'Professionnel',
  'Autre'
];
