import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDoc, query, where, orderBy, Timestamp, getDocs,
  onSnapshot, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { Observable, shareReplay, finalize, EMPTY } from 'rxjs';
import { db } from '../../../firebase.config';
import { Theme, ThemeSubmission } from '../model/models';
import { AppSettingsService } from './app-settings.service';
import { NotificationService } from './notification.service';
import { EmailService } from './email.service';
import { UserService } from './user.service';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  // ✅ SSR-safe : les listeners Firestore (onSnapshot) utilisent le
  // bundle navigateur de Firebase (window) — jamais au prerender.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private settingsService = inject(AppSettingsService);
  private notificationService = inject(NotificationService);
  private emailService = inject(EmailService);
  private userService = inject(UserService);

  // ─────────────────────────────────────────────────────────────
  // Cache partagé — un seul listener Firestore actif pour themes
  // et submissions globales. getMySubmissions() est keyed par userId.
  // ─────────────────────────────────────────────────────────────
  private themes$: Observable<Theme[]> | null = null;
  private submissions$: Observable<ThemeSubmission[]> | null = null;
  private mySubmissions$ = new Map<string, Observable<ThemeSubmission[]>>();

  // ===== THEMES =====

  getThemes(): Observable<Theme[]> {
    if (!this.isBrowser) return EMPTY;

    if (!this.themes$) {
      this.themes$ = new Observable<Theme[]>((observer) => {
        const ref = collection(db, 'themes');
        const unsubscribe = onSnapshot(ref, (snapshot) => {
          const data = snapshot.docs.map((docSnap) => {
            const d: any = docSnap.data();
            return {
              ...d,
              id: docSnap.id,
              workshopDate: d.workshopDate?.toDate?.(),
              createdAt: d.createdAt?.toDate?.() ?? new Date(),
            } as Theme;
          });
          observer.next(data);
        }, (err) => observer.error(err));

        return () => unsubscribe();
      }).pipe(
        shareReplay({ bufferSize: 1, refCount: true }),
        finalize(() => { this.themes$ = null; }),
      );
    }
    return this.themes$;
  }

  async getThemeById(id: string): Promise<Theme | null> {
    const snap = await getDoc(doc(db, 'themes', id));
    if (!snap.exists()) return null;
    const d: any = snap.data();
    return {
      ...d,
      id: snap.id,
      workshopDate: d.workshopDate?.toDate?.(),
      createdAt: d.createdAt?.toDate?.() ?? new Date(),
    };
  }

  async createTheme(theme: Omit<Theme, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'themes'), {
      ...theme,
      createdAt: Timestamp.fromDate(theme.createdAt),
      workshopDate: theme.workshopDate
        ? Timestamp.fromDate(theme.workshopDate)
        : null,
    });

    // ✅ Annonce aux membres — best-effort, ne doit jamais faire échouer
    // la création de la thématique. Ne concerne que la création directe
    // par un admin : une thématique issue d'une soumission approuvée
    // (approveSubmission) écrit directement dans Firestore sans passer
    // par ici, pour éviter une double annonce.
    try {
      await this.notificationService.notifyAllStudents(
        'theme_created',
        'Nouvelle thématique disponible 📚',
        `« ${theme.title} » vient d'être publiée.`,
        '/themes',
      );
    } catch (e) {
      console.error('Erreur notification theme_created:', e);
    }

    try {
      const emails = await this.userService.getStudentEmails();
      await this.emailService.sendThemeCreated(emails, theme.title);
    } catch (e) {
      console.error('Erreur email theme_created:', e);
    }

    return ref.id;
  }

  async updateTheme(id: string, data: Partial<Theme>): Promise<void> {
    const payload: any = { ...data };
    if (data.workshopDate)
      payload.workshopDate = Timestamp.fromDate(data.workshopDate);
    await updateDoc(doc(db, 'themes', id), payload);
  }

  async deleteTheme(id: string): Promise<void> {
    await deleteDoc(doc(db, 'themes', id));
  }

  // ===== SUBMISSIONS =====

  getSubmissions(): Observable<ThemeSubmission[]> {
    if (!this.submissions$) {
      this.submissions$ = new Observable<ThemeSubmission[]>((observer) => {
        const ref = collection(db, 'submissions');
        const unsubscribe = onSnapshot(ref, (snapshot) => {
          const data = snapshot.docs.map((docSnap) => {
            const d: any = docSnap.data();
            return {
              ...d,
              id: docSnap.id,
              submittedAt: d.submittedAt?.toDate?.() ?? new Date(),
              updatedAt: d.updatedAt?.toDate?.(),
            } as ThemeSubmission;
          });
          observer.next(data);
        }, (err) => observer.error(err));

        return () => unsubscribe();
      }).pipe(
        shareReplay({ bufferSize: 1, refCount: true }),
        finalize(() => { this.submissions$ = null; }),
      );
    }
    return this.submissions$;
  }

  getMySubmissions(userId: string): Observable<ThemeSubmission[]> {
    if (!this.isBrowser) return EMPTY;

    if (!this.mySubmissions$.has(userId)) {
      const obs = new Observable<ThemeSubmission[]>((observer) => {
        const q = query(
          collection(db, 'submissions'),
          where('studentId', '==', userId),
          orderBy('submittedAt', 'desc'),
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map((docSnap) => {
            const d: any = docSnap.data();
            return {
              ...d,
              id: docSnap.id,
              submittedAt: d.submittedAt?.toDate?.() ?? new Date(),
              updatedAt: d.updatedAt?.toDate?.(),
            } as ThemeSubmission;
          });
          observer.next(data);
        }, (err) => observer.error(err));

        return () => unsubscribe();
      }).pipe(
        shareReplay({ bufferSize: 1, refCount: true }),
        finalize(() => { this.mySubmissions$.delete(userId); }),
      );

      this.mySubmissions$.set(userId, obs);
    }
    return this.mySubmissions$.get(userId)!;
  }

  async submitTheme(submission: Omit<ThemeSubmission, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'submissions'), {
      ...submission,
      submittedAt: Timestamp.fromDate(submission.submittedAt),
    });

    // ✅ Notification admins — best-effort : un échec ici ne doit
    // jamais faire échouer la soumission elle-même.
    try {
      await this.notificationService.notifyAllAdmins(
        'submission_received',
        'Nouvelle proposition de thématique',
        `${submission.studentName} a proposé : « ${submission.proposedTitle} »`,
        '/admin/soumissions',
      );
    } catch (e) {
      console.error('Erreur notification submission_received:', e);
    }

    // ✅ Emails — admins prévenus de la nouvelle demande, étudiant
    // rassuré que sa soumission a bien été enregistrée. Best-effort,
    // en parallèle, chacun indépendant de l'autre.
    try {
      const adminEmails = await this.userService.getAdminEmails();
      await this.emailService.sendSubmissionReceivedAdmin(
        adminEmails,
        submission.studentName,
        submission.proposedTitle,
      );
    } catch (e) {
      console.error('Erreur email submission_received_admin:', e);
    }

    try {
      await this.emailService.sendSubmissionReceivedStudent(
        submission.studentEmail,
        submission.proposedTitle,
      );
    } catch (e) {
      console.error('Erreur email submission_received_student:', e);
    }

    return ref.id;
  }

  async approveSubmission(
    sub: ThemeSubmission,
    comment?: string,
  ): Promise<void> {
    await updateDoc(doc(db, 'submissions', sub.id!), {
      status: 'approuvé',
      adminComment: comment ?? '',
      updatedAt: Timestamp.fromDate(new Date()),
    });

    const difficulty = sub.difficulty || 'intermédiaire';
    const settings = await this.settingsService.getSettingsOnce();

    await addDoc(collection(db, 'themes'), {
      title: sub.proposedTitle,
      description: sub.description,
      category: sub.category,
      tags: [],
      difficulty,
      maxParticipants: settings.defaultThemeMaxParticipants,
      currentParticipants: 0,
      status: 'ouvert',
      workshopDate: null,
      createdAt: Timestamp.fromDate(new Date()),
      createdBy: sub.studentId,
      fromSubmissionId: sub.id,
      fromStudentName: sub.studentName,
      fromStudentPromo: sub.promo,
      objectives: sub.objectives,
      prerequisites: sub.prerequisites,
      materialsNeeded: sub.materialsNeeded,
      estimatedDuration: sub.estimatedDuration,
    });

    // ✅ Notification étudiant — best-effort.
    try {
      await this.notificationService.notifyOne(
        sub.studentId,
        'submission_approved',
        'Proposition approuvée 🎉',
        `Votre proposition « ${sub.proposedTitle} » a été approuvée et est maintenant une thématique ouverte.`,
        '/espace-membre/mes-soumissions',
      );
    } catch (e) {
      console.error('Erreur notification submission_approved:', e);
    }

    try {
      await this.emailService.sendSubmissionApproved(sub.studentEmail, sub.proposedTitle);
    } catch (e) {
      console.error('Erreur email submission_approved:', e);
    }
  }

  async refuseSubmission(sub: ThemeSubmission, comment?: string): Promise<void> {
    await updateDoc(doc(db, 'submissions', sub.id!), {
      status: 'refusé',
      adminComment: comment ?? '',
      updatedAt: Timestamp.fromDate(new Date()),
    });

    // ✅ Notification étudiant — best-effort.
    try {
      await this.notificationService.notifyOne(
        sub.studentId,
        'submission_refused',
        'Proposition refusée',
        `Votre proposition « ${sub.proposedTitle} » n'a pas été retenue.${comment ? ' Motif : ' + comment : ''}`,
        '/espace-membre/mes-soumissions',
      );
    } catch (e) {
      console.error('Erreur notification submission_refused:', e);
    }

    try {
      await this.emailService.sendSubmissionRefused(sub.studentEmail, sub.proposedTitle, comment);
    } catch (e) {
      console.error('Erreur email submission_refused:', e);
    }
  }

  // ✅ Annulation d'une proposition. Utilisable par l'étudiant auteur
  // (tant qu'elle est encore 'en attente' — règle appliquée côté
  // Firestore rules) ou par un admin (à tout moment). On supprime
  // simplement le document : une soumission non traitée n'a pas de
  // trace à conserver ailleurs (contrairement à approve/refuse qui
  // laissent un historique + créent éventuellement une thématique).
  // ✅ Vide le tableau 'interested' d'une thématique — appelé quand un
  // workshop y est lié pour la première fois. L'intérêt exprimé avant
  // programmation n'a plus de sens une fois le workshop réel ouvert
  // aux inscriptions (qui a son propre compteur), et laisser les
  // anciennes données traîner referait surface bêtement si le
  // workshop est un jour annulé et le champ redevient visible.
  async clearInterest(themeId: string): Promise<void> {
    await updateDoc(doc(db, 'themes', themeId), { interested: [] });
  }

  // ✅ Bascule l'intérêt d'un membre pour une thématique qui n'a pas
  // encore de workshop programmé. Chacun ne peut ajouter/retirer que
  // son propre uid (borné côté Firestore rules).
  //
  // Notification admin best-effort quand le seuil configuré est
  // atteint : pas de verrou anti-doublon (pas de Cloud Function dans
  // cette architecture) — si des membres se désintéressent puis se
  // réintéressent en repassant plusieurs fois par le seuil exact, une
  // notification pourrait repartir à chaque franchissement. Risque
  // jugé acceptable vu la taille du club ; à surveiller si ça devient
  // gênant (solution propre : champ 'interestNotifiedAt' + Cloud
  // Function pour un vrai verrou serveur).
  async toggleInterest(theme: Theme, uid: string, currentlyInterested: boolean): Promise<void> {
    if (!theme.id) return;

    await updateDoc(doc(db, 'themes', theme.id), {
      interested: currentlyInterested ? arrayRemove(uid) : arrayUnion(uid),
    });

    if (currentlyInterested) return; // désintérêt : jamais de notification

    const newCount = (theme.interested?.length ?? 0) + 1;
    try {
      const settings = await this.settingsService.getSettingsOnce();
      if (newCount === settings.interestNotificationThreshold) {
        await this.notificationService.notifyAllAdmins(
          'theme_interest_threshold',
          'Thématique très demandée 🔥',
          `« ${theme.title} » a atteint ${newCount} membres intéressés — envisagez de programmer un workshop.`,
          '/admin/themes',
        );

        try {
          const adminEmails = await this.userService.getAdminEmails();
          await this.emailService.sendThemeInterestThreshold(adminEmails, theme.title, newCount);
        } catch (e) {
          console.error('Erreur email theme_interest_threshold:', e);
        }
      }
    } catch (e) {
      console.error('Erreur notification theme_interest_threshold:', e);
    }
  }

  async cancelSubmission(id: string): Promise<void> {
    await deleteDoc(doc(db, 'submissions', id));
  }

  async updateSubmissionStatus(
    id: string,
    status: ThemeSubmission['status'],
    comment?: string,
  ): Promise<void> {
    await updateDoc(doc(db, 'submissions', id), {
      status,
      adminComment: comment ?? '',
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  // ===== GESTION DES PARTICIPANTS =====

  async incrementParticipants(themeId: string): Promise<void> {
    const themeRef = doc(db, 'themes', themeId);
    const themeSnap = await getDoc(themeRef);

    if (themeSnap.exists()) {
      const currentParticipants = themeSnap.data()['currentParticipants'] || 0;
      const maxParticipants = themeSnap.data()['maxParticipants'] || 0;

      if (currentParticipants < maxParticipants) {
        await updateDoc(themeRef, {
          currentParticipants: currentParticipants + 1,
        });
      }
    }
  }

  async decrementParticipants(themeId: string): Promise<void> {
    const themeRef = doc(db, 'themes', themeId);
    const themeSnap = await getDoc(themeRef);

    if (themeSnap.exists()) {
      const currentParticipants = themeSnap.data()['currentParticipants'] || 0;

      if (currentParticipants > 0) {
        await updateDoc(themeRef, {
          currentParticipants: currentParticipants - 1,
        });
      }
    }
  }

  async updateThemeStatus(themeId: string): Promise<void> {
    const themeRef = doc(db, 'themes', themeId);
    const themeSnap = await getDoc(themeRef);

    if (themeSnap.exists()) {
      const data = themeSnap.data();
      const current = data['currentParticipants'] || 0;
      const max = data['maxParticipants'] || 0;
      const newStatus = current >= max ? 'complet' : 'ouvert';
      await updateDoc(themeRef, { status: newStatus });
    }
  }
}
