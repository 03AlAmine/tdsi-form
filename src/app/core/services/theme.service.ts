import { Injectable } from '@angular/core';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDoc, query, where, orderBy, Timestamp, getDocs,
  onSnapshot
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { db } from '../../../firebase.config';
import { Theme, ThemeSubmission } from '../model/models';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  // ===== THEMES =====
  getThemes(): Observable<Theme[]> {
    return new Observable((observer) => {
      const ref = collection(db, 'themes');
      return onSnapshot(ref, (snapshot) => {
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
      });
    });
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
    return new Observable((observer) => {
      const ref = collection(db, 'submissions');
      return onSnapshot(ref, (snapshot) => {
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
      });
    });
  }

  getMySubmissions(userId: string): Observable<ThemeSubmission[]> {
    return new Observable((observer) => {
      const ref = collection(db, 'submissions');
      const q = query(
        ref,
        where('studentId', '==', userId),
        orderBy('submittedAt', 'desc'),
      );
      return onSnapshot(q, (snapshot) => {
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
      });
    });
  }

  async submitTheme(submission: Omit<ThemeSubmission, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'submissions'), {
      ...submission,
      submittedAt: Timestamp.fromDate(submission.submittedAt),
    });
    return ref.id;
  }


/**
 * ✅ APPROUVER — met à jour le statut ET crée la thématique dans /themes
 */
async approveSubmission(
  sub: ThemeSubmission,
  comment?: string,
): Promise<void> {
  // 1. Mettre à jour le statut de la soumission
  await updateDoc(doc(db, 'submissions', sub.id!), {
    status: 'approuvé',
    adminComment: comment ?? '',
    updatedAt: Timestamp.fromDate(new Date()),
  });

  // 2. Créer la thématique dans la collection themes
  // Utiliser la difficulté choisie par l'étudiant, ou 'intermédiaire' par défaut
  const difficulty = sub.difficulty || 'intermédiaire';

  await addDoc(collection(db, 'themes'), {
    title: sub.proposedTitle,
    description: sub.description,
    category: sub.category,
    tags: [],
    difficulty: difficulty, // ← Utiliser la difficulté choisie
    maxParticipants: 30,
    currentParticipants: 0,
    status: 'ouvert',
    workshopDate: null,
    createdAt: Timestamp.fromDate(new Date()),
    createdBy: sub.studentId,
    // Référence à la soumission d'origine
    fromSubmissionId: sub.id,
    fromStudentName: sub.studentName,
    fromStudentPromo: sub.promo,
    objectives: sub.objectives,
    prerequisites: sub.prerequisites,
    materialsNeeded: sub.materialsNeeded,
    estimatedDuration: sub.estimatedDuration,
  });
}

  /**
   * Refuser — met juste le statut à refusé
   */
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

  // ===== GESTION DES PARTICIPANTS DANS UNE THÉMATIQUE =====

  /**
   * Incrémente le nombre de participants pour une thématique
   */
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

  /**
   * Décrémente le nombre de participants pour une thématique
   */
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

  /**
   * Met à jour le statut de la thématique en fonction du nombre de participants
   */
  async updateThemeStatus(themeId: string): Promise<void> {
    const themeRef = doc(db, 'themes', themeId);
    const themeSnap = await getDoc(themeRef);

    if (themeSnap.exists()) {
      const data = themeSnap.data();
      const current = data['currentParticipants'] || 0;
      const max = data['maxParticipants'] || 0;
      let newStatus = 'ouvert';

      if (current >= max) {
        newStatus = 'complet';
      } else if (current === 0) {
        newStatus = 'ouvert';
      }

      await updateDoc(themeRef, { status: newStatus });
    }
  }
}
