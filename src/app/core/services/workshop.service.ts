import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
import { Observable, shareReplay, finalize, EMPTY } from 'rxjs';
import { db } from '../../../firebase.config';
import { Workshop, PresenceRecord } from '../model/models';
import { ThemeService } from './theme.service';
import { NotificationService } from './notification.service';
import { EmailService } from './email.service';
import { UserService } from './user.service';

@Injectable({ providedIn: 'root' })
export class WorkshopService {
  // ✅ SSR-safe : les listeners Firestore (onSnapshot) utilisent le
  // bundle navigateur de Firebase (window) — jamais au prerender.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private themeService = inject(ThemeService);
  private notificationService = inject(NotificationService);
  private emailService = inject(EmailService);
  private userService = inject(UserService);

  // ─────────────────────────────────────────────────────────────
  // Cache partagé : un seul listener Firestore actif à la fois.
  // shareReplay(1) réémet immédiatement la dernière valeur à tout
  // nouvel abonné, et ferme le listener quand plus personne n'écoute
  // (refCount: true = comportement par défaut de shareReplay).
  // ─────────────────────────────────────────────────────────────
  private workshops$: Observable<Workshop[]> | null = null;

  getWorkshops(): Observable<Workshop[]> {
    if (!this.isBrowser) return EMPTY;

    if (!this.workshops$) {
      this.workshops$ = new Observable<Workshop[]>((observer) => {
        const ref = collection(db, 'workshops');
        const unsubscribe = onSnapshot(ref, (snapshot) => {
          const data = snapshot.docs.map((docSnap) => {
            const d: any = docSnap.data();
            return {
              ...d,
              id: docSnap.id,
              date: d.date?.toDate?.() ?? new Date(),
              createdAt: d.createdAt?.toDate?.() ?? new Date(),
              registrations: d.registrations ?? [],
              waitlist: d.waitlist ?? [],
            } as Workshop;
          });
          observer.next(data);
        }, (err) => observer.error(err));

        return () => unsubscribe();
      }).pipe(
        // bufferSize: 1 → réémet la dernière valeur connue aux nouveaux abonnés
        // refCount: true → ferme le listener Firestore quand zéro abonnés actifs
        shareReplay({ bufferSize: 1, refCount: true }),
        // Remet le cache à null si tout le monde se désabonne,
        // pour permettre une reconnexion propre si nécessaire.
        finalize(() => { this.workshops$ = null; }),
      );
    }
    return this.workshops$;
  }

  async createWorkshop(workshop: Omit<Workshop, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'workshops'), {
      ...workshop,
      date: Timestamp.fromDate(workshop.date),
      createdAt: Timestamp.fromDate(workshop.createdAt),
      registrations: workshop.registrations ?? [],
    });

    // ✅ Le badge "intéressé" n'a plus lieu d'être une fois un workshop
    // réellement programmé — best-effort, ne doit pas bloquer la
    // création du workshop si ça échoue.
    try {
      await this.themeService.clearInterest(workshop.themeId);
    } catch (e) {
      console.error('Erreur nettoyage interested:', e);
    }

    // ✅ Notification annonce — tous les membres, best-effort.
    try {
      await this.notificationService.notifyAllStudents(
        'workshop_created',
        'Nouvel atelier programmé 📅',
        `« ${workshop.themeTitle} » avec ${workshop.presenter}, le ${workshop.date.toLocaleDateString('fr-FR')}.`,
        '/workshops',
      );
    } catch (e) {
      console.error('Erreur notification workshop_created:', e);
    }

    try {
      const emails = await this.userService.getStudentEmails();
      await this.emailService.sendWorkshopCreated(
        emails,
        workshop.themeTitle,
        workshop.presenter,
        workshop.date,
      );
    } catch (e) {
      console.error('Erreur email workshop_created:', e);
    }

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

    // ✅ Notification annulation — on lit l'état avant écriture pour
    // savoir qui est inscrit et éviter de notifier si le workshop
    // était déjà annulé (évite les doublons en cas de double-clic).
    let shouldNotifyCancellation = false;
    let registrationsSnapshot: string[] = [];
    let themeTitleSnapshot = '';

    if (data.status === 'annulé') {
      const before = await getDoc(doc(db, 'workshops', id));
      const beforeData: any = before.data();
      if (beforeData && beforeData.status !== 'annulé') {
        shouldNotifyCancellation = true;
        registrationsSnapshot = beforeData.registrations ?? [];
        themeTitleSnapshot = beforeData.themeTitle ?? 'l\'atelier';
      }
    }

    await updateDoc(doc(db, 'workshops', id), payload);

    if (shouldNotifyCancellation && registrationsSnapshot.length > 0) {
      try {
        await this.notificationService.notifyMany(
          registrationsSnapshot,
          'workshop_cancelled',
          'Atelier annulé',
          `L'atelier « ${themeTitleSnapshot} » a été annulé.`,
          '/workshops',
        );
      } catch (e) {
        console.error('Erreur notification workshop_cancelled:', e);
      }

      try {
        const emails = await this.userService.getEmailsByUids(registrationsSnapshot);
        await this.emailService.sendWorkshopCancelled(emails, themeTitleSnapshot);
      } catch (e) {
        console.error('Erreur email workshop_cancelled:', e);
      }
    }
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
    return `https://meet.jit.si/campusclubtdsi-${cleanTitle}-${workshopId.substring(0, 8)}`;
  }

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

      if (registrations.length >= maxParticipants) {
        throw new Error('Plus de places disponibles');
      }

      if (registrations.includes(userId)) {
        throw new Error('Déjà inscrit');
      }

      transaction.update(workshopRef, {
        registrations: arrayUnion(userId),
      });
    });

    const workshopSnap = await getDoc(workshopRef);
    const themeId = workshopSnap.data()?.['themeId'];
    if (themeId) {
      try {
        await this.themeService.incrementParticipants(themeId);
        await this.themeService.updateThemeStatus(themeId);
      } catch (err) {
        console.error(
          'Inscription réussie, mais mise à jour de la thématique échouée:',
          err,
        );
      }
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
      registrations: data['registrations'] ?? [],
      waitlist: data['waitlist'] ?? [],
    } as Workshop;
  }

  async unregisterFromWorkshop(
    workshopId: string,
    userId: string,
  ): Promise<void> {
    const workshopRef = doc(db, 'workshops', workshopId);
    let themeId: string | undefined;
    let promotedUid: string | null = null;

    // ✅ Transaction : la désinscription et la promotion éventuelle de la
    // première personne en file d'attente doivent être atomiques, sinon
    // deux désinscriptions concurrentes pourraient promouvoir deux fois
    // la même personne (double lecture du même waitlist[0]).
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(workshopRef);
      if (!snap.exists()) throw new Error('Workshop non trouvé');

      const data = snap.data();
      themeId = data['themeId'];

      const registrations: string[] = (data['registrations'] ?? []).filter(
        (id: string) => id !== userId,
      );
      const waitlist: string[] = data['waitlist'] ?? [];
      const maxParticipants: number = data['maxParticipants'] ?? 30;

      if (waitlist.length > 0 && registrations.length < maxParticipants) {
        // Une place se libère ET quelqu'un attend : on recompose le
        // tableau à la main (impossible de combiner arrayRemove +
        // arrayUnion sur le même champ en une seule écriture).
        promotedUid = waitlist[0];
        transaction.update(workshopRef, {
          registrations: [...registrations, promotedUid],
          waitlist: waitlist.slice(1),
        });
      } else {
        transaction.update(workshopRef, { registrations: arrayRemove(userId) });
      }
    });

    // ✅ La désinscription elle-même est l'opération critique : elle doit
    // réussir/échouer indépendamment de la mise à jour du compteur de
    // participants sur la thématique liée. Si themeId est obsolète
    // (thème supprimé) ou si la mise à jour du thème échoue pour une
    // autre raison, l'utilisateur ne doit pas voir une erreur alors que
    // sa désinscription a bien été enregistrée.
    if (themeId) {
      try {
        await this.themeService.decrementParticipants(themeId);
        // La place libérée est immédiatement reprise par la personne
        // promue : le compteur de participants de la thématique doit
        // refléter qu'elle reste occupée.
        if (promotedUid) await this.themeService.incrementParticipants(themeId);
        await this.themeService.updateThemeStatus(themeId);
      } catch (err) {
        console.error(
          'Désinscription réussie, mais mise à jour de la thématique échouée:',
          err,
        );
      }
    }

    // Notification best-effort à la personne promue — un échec ici ne
    // doit jamais faire échouer la désinscription déjà actée.
    if (promotedUid) {
      let title = 'un workshop';
      try {
        const freshSnap = await getDoc(workshopRef);
        title = freshSnap.data()?.['themeTitle'] ?? 'un workshop';
        await this.notificationService.notifyOne(
          promotedUid,
          'waitlist_promoted',
          "Une place s'est libérée 🎉",
          `Vous étiez en file d'attente pour « ${title} » — une place vient de se libérer et vous êtes maintenant inscrit·e !`,
          '/workshops',
        );
      } catch (e) {
        console.error('Erreur notification waitlist_promoted:', e);
      }

      try {
        const promotedUser = await this.userService.getProfile(promotedUid);
        if (promotedUser?.email) {
          await this.emailService.sendWaitlistPromoted(promotedUser.email, title);
        }
      } catch (e) {
        console.error('Erreur email waitlist_promoted:', e);
      }
    }
  }

  // ✅ Rejoindre la file d'attente d'un workshop complet. Refuse
  // explicitement si des places sont encore libres (il faut s'inscrire
  // directement dans ce cas) ou en cas de doublon.
  async joinWaitlist(workshopId: string, userId: string): Promise<void> {
    const workshopRef = doc(db, 'workshops', workshopId);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(workshopRef);
      if (!snap.exists()) throw new Error('Workshop non trouvé');

      const data = snap.data();
      const registrations: string[] = data['registrations'] ?? [];
      const waitlist: string[] = data['waitlist'] ?? [];
      const maxParticipants: number = data['maxParticipants'] ?? 30;

      if (registrations.length < maxParticipants) {
        throw new Error(
          'Des places sont encore disponibles, inscrivez-vous directement',
        );
      }
      if (registrations.includes(userId)) throw new Error('Déjà inscrit');
      if (waitlist.includes(userId)) throw new Error("Déjà en file d'attente");

      transaction.update(workshopRef, { waitlist: arrayUnion(userId) });
    });
  }

  async leaveWaitlist(workshopId: string, userId: string): Promise<void> {
    await updateDoc(doc(db, 'workshops', workshopId), {
      waitlist: arrayRemove(userId),
    });
  }

  /** Position (1-based) de l'utilisateur dans la file d'attente, ou null. */
  getWaitlistPosition(workshop: Workshop, userId: string): number | null {
    const idx = (workshop.waitlist ?? []).indexOf(userId);
    return idx === -1 ? null : idx + 1;
  }

  async submitPresence(record: Omit<PresenceRecord, 'id'>): Promise<string> {
    // ✅ Nettoyage défensif : on retire toute valeur undefined/NaN des
    // réponses du formulaire dynamique avant l'envoi à Firestore, pour
    // éviter une exception côté addDoc si un champ optionnel n'a jamais
    // été initialisé correctement par le formulaire.
    const cleanResponses: Record<string, string | boolean | number> = {};
    for (const [key, value] of Object.entries(record.responses ?? {})) {
      if (value === undefined) continue;
      if (typeof value === 'number' && Number.isNaN(value)) continue;
      cleanResponses[key] = value;
    }

    const ref = await addDoc(collection(db, 'presences'), {
      ...record,
      responses: cleanResponses,
      checkedInAt: Timestamp.fromDate(record.checkedInAt),
    });
    return ref.id;
  }

  // ─────────────────────────────────────────────────────────────
  // getPresences() : même pattern shareReplay mais par workshopId
  // (clé de cache = workshopId pour isoler chaque salle)
  // ─────────────────────────────────────────────────────────────
  private presences$ = new Map<string, Observable<PresenceRecord[]>>();

  getPresences(workshopId: string): Observable<PresenceRecord[]> {
    if (!this.presences$.has(workshopId)) {
      const obs = new Observable<PresenceRecord[]>((observer) => {
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
        }, (err) => observer.error(err));

        return () => unsubscribe();
      }).pipe(
        shareReplay({ bufferSize: 1, refCount: true }),
        finalize(() => { this.presences$.delete(workshopId); }),
      );

      this.presences$.set(workshopId, obs);
    }
    return this.presences$.get(workshopId)!;
  }
}
