import { Injectable, inject } from '@angular/core';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  query,
  where,
  getDoc,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { db } from '../../../firebase.config';
import { Workshop, PresenceRecord } from '../model/models';
import { ThemeService } from './theme.service';

@Injectable({ providedIn: 'root' })
export class WorkshopService {
  private themeService = inject(ThemeService);

  getWorkshops(): Observable<Workshop[]> {
    return new Observable((observer) => {
      const ref = collection(db, 'workshops');
      const unsubscribe = onSnapshot(ref, (snapshot) => {
        const data = snapshot.docs.map((docSnap) => {
          const d: any = docSnap.data();
          return {
            ...d,
            id: docSnap.id,
            date: d.date?.toDate?.() ?? new Date(),
            createdAt: d.createdAt?.toDate?.() ?? new Date(),
          } as Workshop;
        });
        observer.next(data);
      });
      return () => unsubscribe();
    });
  }

  async createWorkshop(workshop: Omit<Workshop, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'workshops'), {
      ...workshop,
      date: Timestamp.fromDate(workshop.date),
      createdAt: Timestamp.fromDate(workshop.createdAt),
    });
    return ref.id;
  }

  async updateWorkshop(id: string, data: Partial<Workshop>): Promise<void> {
    // ✅ On construit le payload avec la notation pointée Firestore
    // pour les objets imbriqués — évite d'écraser des sous-champs
    const payload: Record<string, any> = {};

    // Champs simples
    if (data.status !== undefined) payload['status'] = data.status;
    if (data.presenceFormEnabled !== undefined)
      payload['presenceFormEnabled'] = data.presenceFormEnabled;
    if (data.meetLink !== undefined) payload['meetLink'] = data.meetLink;
    if (data.presenter !== undefined) payload['presenter'] = data.presenter;
    if (data.duration !== undefined) payload['duration'] = data.duration;
    if (data.location !== undefined) payload['location'] = data.location;
    if (data.date !== undefined)
      payload['date'] = Timestamp.fromDate(data.date);

    // ✅ presenceFormConfig — sérialisation explicite des fields
    // Firestore ne supporte pas les champs "undefined" dans les tableaux
    if (data.presenceFormConfig !== undefined) {
      const config = data.presenceFormConfig;
      const cleanFields = (config.fields ?? []).map((f) => {
        const field: Record<string, any> = {
          id: f.id,
          label: f.label,
          type: f.type,
          required: f.required ?? false,
          placeholder: f.placeholder ?? '',
        };
        // Options uniquement pour les selects, jamais undefined
        if (f.type === 'select' && f.options?.length) {
          field['options'] = f.options;
        }
        return field;
      });

      // Notation pointée = on écrit chaque sous-champ séparément
      payload['presenceFormConfig.fields'] = cleanFields;
      payload['presenceFormConfig.requirePhoto'] = config.requirePhoto ?? false;
      payload['presenceFormConfig.sendConfirmation'] =
        config.sendConfirmation ?? false;
    }

    await updateDoc(doc(db, 'workshops', id), payload);
  }

  async deleteWorkshop(id: string): Promise<void> {
    await deleteDoc(doc(db, 'workshops', id));
  }
  /**
   * Génère un lien Jitsi unique pour un workshop
   */
  generateJitsiLink(workshopId: string, workshopTitle: string): string {
    // Nettoyer le titre pour l'URL
    const cleanTitle = workshopTitle
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);

    // Générer un ID unique basé sur l'ID du workshop et le titre
    return `https://meet.jit.si/tdsi-${cleanTitle}-${workshopId.substring(0, 8)}`;
  }
  async registerToWorkshop(workshopId: string, userId: string): Promise<void> {
    const workshopRef = doc(db, 'workshops', workshopId);
    const workshopSnap = await getDoc(workshopRef);
    if (!workshopSnap.exists()) throw new Error('Workshop non trouvé');

    const workshop = workshopSnap.data();
    const themeId = workshop['themeId'];

    const themeRef = doc(db, 'themes', themeId);
    const themeSnap = await getDoc(themeRef);
    const theme = themeSnap.data();
    const currentParticipants = theme?.['currentParticipants'] || 0;
    const maxParticipants = theme?.['maxParticipants'] || 30;

    if (currentParticipants >= maxParticipants) {
      throw new Error('Plus de places disponibles');
    }

    await updateDoc(workshopRef, { registrations: arrayUnion(userId) });
    await this.themeService.incrementParticipants(themeId);
    await this.themeService.updateThemeStatus(themeId);
  }


  async getWorkshopById(id: string): Promise<Workshop | null> {
    const snap = await getDoc(doc(db, 'workshops', id));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      ...data,
      id: snap.id,
      date: data['date']?.toDate?.() ?? new Date(),
      createdAt: data['createdAt']?.toDate?.() ?? new Date(),
    } as Workshop;
  }
  async unregisterFromWorkshop(
    workshopId: string,
    userId: string,
  ): Promise<void> {
    const workshopRef = doc(db, 'workshops', workshopId);
    const workshopSnap = await getDoc(workshopRef);
    if (!workshopSnap.exists()) throw new Error('Workshop non trouvé');

    const workshop = workshopSnap.data();
    const themeId = workshop['themeId'];

    await updateDoc(workshopRef, { registrations: arrayRemove(userId) });

    // ✅ Guard : ne touche au thème que si themeId existe
    if (themeId) {
      await this.themeService.decrementParticipants(themeId);
      await this.themeService.updateThemeStatus(themeId);
    }
  }

  async submitPresence(record: Omit<PresenceRecord, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'presences'), {
      ...record,
      checkedInAt: Timestamp.fromDate(record.checkedInAt),
    });
    return ref.id;
  }

  getPresences(workshopId: string): Observable<PresenceRecord[]> {
    return new Observable((observer) => {
      const q = query(
        collection(db, 'presences'),
        where('workshopId', '==', workshopId),
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map((docSnap) => {
          const d: any = docSnap.data();
          return {
            ...d,
            id: docSnap.id,
            checkedInAt: d.checkedInAt?.toDate?.() ?? new Date(),
          } as PresenceRecord;
        });
        observer.next(data);
      });
      return () => unsubscribe();
    });
  }
}
