import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  Timestamp, arrayUnion, arrayRemove, onSnapshot,
  query, where, orderBy, getDoc, getDocs, writeBatch,
  increment, WithFieldValue, DocumentData
} from 'firebase/firestore';
import { Observable, EMPTY } from 'rxjs';
import { db } from '../../../firebase.config';
import { AuthService } from './auth.service';
import {
  Activity, ActivityRegistration, ActivityStatus
} from '../model/activity.model';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  // ✅ SSR-safe : les listeners Firestore (onSnapshot) utilisent le
  // bundle navigateur de Firebase (window) — jamais au prerender.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private authService = inject(AuthService);

  // ── Helpers de conversion Firestore ↔ TypeScript ──────────

  private fromFirestore(id: string, d: Record<string, any>): Activity {
    return {
      ...d,
      id,
      date:      d['date']?.toDate?.()      ?? new Date(),
      endDate:   d['endDate']?.toDate?.()   ?? undefined,
      createdAt: d['createdAt']?.toDate?.() ?? new Date(),
      updatedAt: d['updatedAt']?.toDate?.() ?? undefined,
    } as Activity;
  }

  private toFirestore(activity: Partial<Activity>): WithFieldValue<DocumentData> {
    const payload: Record<string, unknown> = { ...activity };

    // Convertir les Date en Timestamp Firestore
    if (activity.date)      payload['date']      = Timestamp.fromDate(activity.date);
    if (activity.endDate)   payload['endDate']   = Timestamp.fromDate(activity.endDate);
    if (activity.createdAt) payload['createdAt'] = Timestamp.fromDate(activity.createdAt);
    if (activity.updatedAt) payload['updatedAt'] = Timestamp.fromDate(activity.updatedAt);

    // Supprimer les champs undefined — Firestore les rejette
    Object.keys(payload).forEach(k => {
      if (payload[k] === undefined) delete payload[k];
    });

    delete payload['id'];
    return payload;
  }

  // ── Lecture ───────────────────────────────────────────────

  /** Toutes les activités publiées — pour les pages publiques */
  getPublishedActivities(): Observable<Activity[]> {
    if (!this.isBrowser) return EMPTY;

    return new Observable(observer => {
      // where seul — tri côté client pour éviter l'index composite
      const q = query(
        collection(db, 'activities'),
        where('status', 'in', ['published', 'ongoing'])
      );
      return onSnapshot(q, snap => {
        const list = snap.docs
          .map(d => this.fromFirestore(d.id, d.data() as Record<string, any>))
          .sort((a, b) => a.date.getTime() - b.date.getTime()); // tri client ASC
        observer.next(list);
      }, err => observer.error(err));
    });
  }

  /** Toutes les activités — pour l'admin */
  getAllActivities(): Observable<Activity[]> {
    if (!this.isBrowser) return EMPTY;

    return new Observable(observer => {
      // Pas de orderBy seul pour éviter l'exigence d'index composite
      // Le tri se fait côté client
      const q = query(collection(db, 'activities'));
      return onSnapshot(q, snap => {
        const list = snap.docs
          .map(d => this.fromFirestore(d.id, d.data() as Record<string, any>))
          .sort((a, b) => b.date.getTime() - a.date.getTime()); // tri client
        observer.next(list);
      }, err => observer.error(err));
    });
  }

  /** Une seule activité par ID */
  async getActivity(id: string): Promise<Activity | null> {
    const snap = await getDoc(doc(db, 'activities', id));
    if (!snap.exists()) return null;
    return this.fromFirestore(snap.id, snap.data() as Record<string, any>);
  }

  // ── Écriture admin ────────────────────────────────────────

  async createActivity(activity: Omit<Activity, 'id'>): Promise<string> {
    const ref = await addDoc(
      collection(db, 'activities'),
      this.toFirestore(activity)
    );
    return ref.id;
  }

  async updateActivity(id: string, data: Partial<Activity>): Promise<void> {
    const payload = this.toFirestore({ ...data, updatedAt: new Date() });
    await updateDoc(doc(db, 'activities', id), payload);
  }

  async deleteActivity(id: string): Promise<void> {
    await deleteDoc(doc(db, 'activities', id));
  }

  async publishActivity(id: string): Promise<void> {
    await this.updateActivity(id, { status: 'published' });
  }

  async enablePresence(id: string, enabled: boolean): Promise<void> {
    await this.updateActivity(id, { presenceEnabled: enabled });
  }

  // ── Inscriptions membres ──────────────────────────────────

  async registerMember(activityId: string, userId: string): Promise<void> {
    const actRef = doc(db, 'activities', activityId);
    const snap   = await getDoc(actRef);
    if (!snap.exists()) throw new Error('Activité introuvable');

    const activity = this.fromFirestore(snap.id, snap.data() as Record<string, any>);

    // Vérif capacité
    const total = (activity.registrations?.length ?? 0) + (activity.guestCount ?? 0);
    if (activity.maxParticipants && total >= activity.maxParticipants) {
      throw new Error('Plus de places disponibles');
    }
    if (activity.registrations?.includes(userId)) {
      throw new Error('Déjà inscrit');
    }

    await updateDoc(actRef, { registrations: arrayUnion(userId) });
  }

  async unregisterMember(activityId: string, userId: string): Promise<void> {
    await updateDoc(
      doc(db, 'activities', activityId),
      { registrations: arrayRemove(userId) }
    );
  }

  // ── Inscriptions invités (publique, sans compte) ──────────

  async registerGuest(
    activityId: string,
    data: {
      name: string;
      email: string;
      phone?: string;
      organization?: string;
    }
  ): Promise<string> {
    // Vérifier que l'email n'est pas déjà inscrit
    const existing = await getDocs(
      query(
        collection(db, 'activityRegistrations'),
        where('activityId', '==', activityId),
        where('email', '==', data.email)
      )
    );
    if (!existing.empty) throw new Error('Cet email est déjà inscrit');

    // Token simple — à remplacer par un vrai HMAC côté backend
    const token = `${activityId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const batch = writeBatch(db);

    // Créer l'enregistrement
    const regRef = doc(collection(db, 'activityRegistrations'));
    const registration: Omit<ActivityRegistration, 'id'> = {
      activityId,
      type: 'guest',
      name: data.name,
      email: data.email,
      phone: data.phone,
      organization: data.organization,
      registeredAt: new Date(),
      confirmationToken: token,
      checkedIn: false,
    };
    batch.set(regRef, {
      ...registration,
      registeredAt: Timestamp.fromDate(registration.registeredAt),
    });

    // Incrémenter le compteur d'invités sur l'activité
    batch.update(doc(db, 'activities', activityId), {
      guestCount: increment(1),
    });

    await batch.commit();
    return regRef.id;
  }

  // ── Check-in présence ─────────────────────────────────────

  async checkInMember(activityId: string, userId: string): Promise<void> {
    // Vérifier double check-in
    const existing = await getDocs(
      query(
        collection(db, 'activityRegistrations'),
        where('activityId', '==', activityId),
        where('userId', '==', userId),
        where('checkedIn', '==', true)
      )
    );
    if (!existing.empty) throw new Error('Présence déjà enregistrée');

    const user = this.authService.currentUser;
    const regRef = doc(collection(db, 'activityRegistrations'));
    await addDoc(collection(db, 'activityRegistrations'), {
      activityId,
      type: 'member',
      userId,
      name: user?.displayName ?? '',
      email: user?.email ?? '',
      registeredAt: Timestamp.fromDate(new Date()),
      confirmationToken: '',
      checkedIn: true,
      checkedInAt: Timestamp.fromDate(new Date()),
    });
  }

  async checkInGuest(registrationId: string): Promise<void> {
    const ref = doc(db, 'activityRegistrations', registrationId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Inscription introuvable');
    if (snap.data()['checkedIn']) throw new Error('Déjà checké');
    await updateDoc(ref, {
      checkedIn: true,
      checkedInAt: Timestamp.fromDate(new Date()),
    });
  }

  // ── Lecture inscriptions (admin) ──────────────────────────

  getRegistrations(activityId: string): Observable<ActivityRegistration[]> {
    return new Observable(observer => {
      const q = query(
        collection(db, 'activityRegistrations'),
        where('activityId', '==', activityId),
        orderBy('registeredAt', 'desc')
      );
      return onSnapshot(q, snap => {
        observer.next(snap.docs.map(d => ({
          ...d.data(),
          id: d.id,
          registeredAt: d.data()['registeredAt']?.toDate?.() ?? new Date(),
          checkedInAt:  d.data()['checkedInAt']?.toDate?.()  ?? undefined,
        }) as ActivityRegistration));
      }, err => observer.error(err));
    });
  }

  // ── Stats rapides ─────────────────────────────────────────

  async getStats(activityId: string): Promise<{
    total: number;
    members: number;
    guests: number;
    checkedIn: number;
  }> {
    const snap = await getDocs(
      query(
        collection(db, 'activityRegistrations'),
        where('activityId', '==', activityId)
      )
    );
    const regs = snap.docs.map(d => d.data());
    return {
      total:     regs.length,
      members:   regs.filter(r => r['type'] === 'member').length,
      guests:    regs.filter(r => r['type'] === 'guest').length,
      checkedIn: regs.filter(r => r['checkedIn']).length,
    };
  }
}
