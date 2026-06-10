import { Injectable } from '@angular/core';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDoc, query, where, orderBy, Timestamp, getDocs,
  onSnapshot
} from 'firebase/firestore';
import { Observable, shareReplay, finalize } from 'rxjs';
import { db } from '../../../firebase.config';
import { Theme, ThemeSubmission } from '../model/models';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  // ─────────────────────────────────────────────────────────────
  // Cache partagé — un seul listener Firestore actif pour themes
  // et submissions globales. getMySubmissions() est keyed par userId.
  // ─────────────────────────────────────────────────────────────
  private themes$: Observable<Theme[]> | null = null;
  private submissions$: Observable<ThemeSubmission[]> | null = null;
  private mySubmissions$ = new Map<string, Observable<ThemeSubmission[]>>();

  // ===== THEMES =====

  getThemes(): Observable<Theme[]> {
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

    await addDoc(collection(db, 'themes'), {
      title: sub.proposedTitle,
      description: sub.description,
      category: sub.category,
      tags: [],
      difficulty,
      maxParticipants: 30,
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
  }

  async refuseSubmission(id: string, comment?: string): Promise<void> {
    await updateDoc(doc(db, 'submissions', id), {
      status: 'refusé',
      adminComment: comment ?? '',
      updatedAt: Timestamp.fromDate(new Date()),
    });
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
