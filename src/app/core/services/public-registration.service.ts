import { Injectable, inject } from '@angular/core';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDoc, getDocs, query, where,
  Timestamp, orderBy, limit
} from 'firebase/firestore';
import { db } from '../../../firebase.config';
import { GuestRegistration } from '../model/guest-registration.model';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class PublicRegistrationService {
  private toast = inject(ToastService);

  private readonly COLLECTION = 'public_registrations';

  /**
   * Inscription d'un invité à un workshop
   */
  async registerGuest(registration: Omit<GuestRegistration, 'id' | 'token' | 'registeredAt' | 'checkedIn' | 'confirmationSent' | 'reminderSent'>): Promise<string> {
    const token = this.generateToken();

    const newRegistration: Omit<GuestRegistration, 'id'> = {
      ...registration,
      token,
      registeredAt: new Date(),
      checkedIn: false,
      confirmationSent: false,
      reminderSent: false,
      status: 'pending'
    };

    const docRef = await addDoc(collection(db, this.COLLECTION), {
      ...newRegistration,
      registeredAt: Timestamp.fromDate(newRegistration.registeredAt),
      checkedInAt: null
    });

    // Envoyer email de confirmation (à implémenter)
    await this.sendConfirmationEmail(newRegistration, docRef.id);

    return docRef.id;
  }

  /**
   * Vérifier si un email est déjà inscrit à un workshop
   */
  async isAlreadyRegistered(workshopId: string, email: string): Promise<boolean> {
    const q = query(
      collection(db, this.COLLECTION),
      where('workshopId', '==', workshopId),
      where('email', '==', email),
      where('status', 'in', ['pending', 'confirmed'])
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  /**
   * Récupérer toutes les inscriptions d'un workshop (pour admin)
   */
  async getRegistrationsByWorkshop(workshopId: string): Promise<GuestRegistration[]> {
    const q = query(
      collection(db, this.COLLECTION),
      where('workshopId', '==', workshopId),
      orderBy('registeredAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      registeredAt: doc.data()['registeredAt']?.toDate() || new Date(),
      checkedInAt: doc.data()['checkedInAt']?.toDate()
    } as GuestRegistration));
  }

  /**
   * Confirmer la présence (check-in)
   */
  async checkIn(registrationId: string): Promise<void> {
    const ref = doc(db, this.COLLECTION, registrationId);
    await updateDoc(ref, {
      checkedIn: true,
      checkedInAt: Timestamp.fromDate(new Date())
    });
  }

  /**
   * Annuler une inscription
   */
  async cancelRegistration(registrationId: string, token: string): Promise<boolean> {
    const ref = doc(db, this.COLLECTION, registrationId);
    const snap = await getDoc(ref);

    if (!snap.exists() || snap.data()['token'] !== token) {
      return false;
    }

    await updateDoc(ref, { status: 'cancelled' });
    return true;
  }

  /**
   * Générer un token unique
   */
  private generateToken(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Envoyer email de confirmation (simulé pour l'instant)
   */
  private async sendConfirmationEmail(registration: Omit<GuestRegistration, 'id'>, registrationId: string): Promise<void> {
    // TODO: Intégrer un service d'email (SendGrid, Brevo, etc.)
    console.log('Email de confirmation envoyé à:', registration.email);
    console.log('Lien d\'annulation:', `/public/cancel/${registrationId}?token=${registration.token}`);

    // Marquer comme envoyé
    const ref = doc(db, this.COLLECTION, registrationId);
    await updateDoc(ref, { confirmationSent: true });
  }
}
