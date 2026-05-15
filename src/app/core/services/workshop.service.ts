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
  runTransaction,
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
            // ✅ FIX #5 — registrations toujours un tableau, jamais undefined
            registrations: d.registrations ?? [],
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
      // ✅ S'assurer que registrations est initialisé
      registrations: workshop.registrations ?? [],
    });
    return ref.id;
  }

  async updateWorkshop(id: string, data: Partial<Workshop>): Promise<void> {
    const payload: Record<string, any> = {};

    if (data.status !== undefined) payload['status'] = data.status;
    if (data.presenceFormEnabled !== undefined)
      payload['presenceFormEnabled'] = data.presenceFormEnabled;
    if (data.meetLink !== undefined) payload['meetLink'] = data.meetLink;
    if (data.presenter !== undefined) payload['presenter'] = data.presenter;
    if (data.duration !== undefined) payload['duration'] = data.duration;
    if (data.location !== undefined) payload['location'] = data.location;
    if (data.date !== undefined)
      payload['date'] = Timestamp.fromDate(data.date);

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
        if (f.type === 'select' && f.options?.length) {
          field['options'] = f.options;
        }
        return field;
      });

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

  generateJitsiLink(workshopId: string, workshopTitle: string): string {
    const cleanTitle = workshopTitle
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
    return `https://meet.jit.si/tdsi-${cleanTitle}-${workshopId.substring(0, 8)}`;
  }

  // ✅ FIX #3 — Transaction atomique pour éviter la race condition
  // Sans transaction, deux inscriptions simultanées peuvent dépasser maxParticipants
  async registerToWorkshop(workshopId: string, userId: string): Promise<void> {
    const workshopRef = doc(db, 'workshops', workshopId);

    await runTransaction(db, async (transaction) => {
      const workshopSnap = await transaction.get(workshopRef);

      if (!workshopSnap.exists()) {
        throw new Error('Workshop non trouvé');
      }

      const workshop = workshopSnap.data();
      const registrations: string[] = workshop['registrations'] ?? [];
      const maxParticipants: number = workshop['maxParticipants'] ?? 30;

      // Vérifier les places disponibles de façon atomique
      if (registrations.length >= maxParticipants) {
        throw new Error('Plus de places disponibles');
      }

      // Vérifier que l'utilisateur n'est pas déjà inscrit
      if (registrations.includes(userId)) {
        throw new Error('Déjà inscrit');
      }

      transaction.update(workshopRef, {
        registrations: arrayUnion(userId),
      });
    });

    // Mise à jour du thème après la transaction (non critique — pas atomique avec le workshop)
    const workshopSnap = await getDoc(workshopRef);
    const themeId = workshopSnap.data()?.['themeId'];
    if (themeId) {
      await this.themeService.incrementParticipants(themeId);
      await this.themeService.updateThemeStatus(themeId);
    }
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
      // ✅ FIX #5 — registrations toujours un tableau
      registrations: data['registrations'] ?? [],
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
