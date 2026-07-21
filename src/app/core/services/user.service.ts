// user.service.ts
import { Injectable } from '@angular/core';
import {
  collection, doc, getDoc, getDocs,
  updateDoc, setDoc, deleteDoc, query, orderBy,
  Timestamp, DocumentSnapshot
} from 'firebase/firestore';
import { db } from '../../../firebase.config';
import { User } from '../model/models';

@Injectable({ providedIn: 'root' })
export class UserService {
  // ❌ Supprimé : private notificationService = inject(NotificationService);

  private fromFirestore(snap: DocumentSnapshot): User | null {
    if (!snap.exists()) return null;
    const d = snap.data() as Record<string, unknown>;
    return {
      uid:         snap.id,
      email:       (d['email']       as string) ?? '',
      displayName: (d['displayName'] as string) ?? 'Inconnu',
      role:        (d['role']        as 'admin' | 'student') ?? 'student',
      promo:       (d['promo']       as string) ?? undefined,
      disabled:    (d['disabled']    as boolean) ?? false,
      createdAt:   (d['createdAt'] as Timestamp)?.toDate?.() ?? new Date(),
    } as User & { disabled?: boolean };
  }

  async getProfile(uid: string): Promise<User | null> {
    const snap = await getDoc(doc(db, 'users', uid));
    return this.fromFirestore(snap);
  }

  async getAllUsers(): Promise<User[]> {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => this.fromFirestore(d))
      .filter((u): u is User => u !== null);
  }

  async updateProfile(uid: string, data: { displayName: string; promo: string }): Promise<void> {
    await updateDoc(doc(db, 'users', uid), {
      displayName: data.displayName,
      promo:       data.promo,
    });
  }

  // ✅ La collection `admins/{uid}` est un miroir léger (juste l'uid) de
  // tous les utilisateurs ayant role === 'admin'. Elle existe uniquement
  // pour que les clients non-admin puissent découvrir la liste des admins
  // (ex: NotificationService.notifyAllAdmins) sans avoir besoin de lire
  // toute la collection `users`, qui est verrouillée par les règles
  // Firestore. On la garde synchronisée ici, au seul endroit où le rôle
  // change côté client.
  async updateRole(uid: string, role: 'student' | 'admin'): Promise<void> {
    await updateDoc(doc(db, 'users', uid), { role });
    if (role === 'admin') {
      // ✅ On mire aussi l'email dans admins/{uid} : c'est ce qui permet
      // à EmailService de notifier tous les admins sans avoir besoin de
      // lire toute la collection `users` (verrouillée côté règles pour
      // les non-admins — voir commentaire au-dessus de cette méthode).
      const userSnap = await getDoc(doc(db, 'users', uid));
      const email = (userSnap.data()?.['email'] as string) ?? '';
      await setDoc(doc(db, 'admins', uid), {
        uid,
        email,
        createdAt: Timestamp.fromDate(new Date()),
      });
    } else {
      await deleteDoc(doc(db, 'admins', uid));
    }
  }

  // ✅ Emails de tous les admins, pour EmailService.sendSubmissionReceivedAdmin
  // etc. Lit le miroir `admins/{uid}` (voir updateRole) au lieu de `users` :
  // accessible à tout utilisateur authentifié, contrairement à `users`.
  // Les admins promus avant l'ajout du champ `email` (migration) n'ont pas
  // encore cette valeur — ils sont simplement ignorés, sans planter l'appel.
  async getAdminEmails(): Promise<string[]> {
    const snap = await getDocs(collection(db, 'admins'));
    return snap.docs
      .map((d) => d.data()['email'] as string | undefined)
      .filter((e): e is string => !!e);
  }

  // ✅ Emails de tous les étudiants — pour les annonces (nouveau thème,
  // nouveau workshop). Réutilise getAllUsers(), déjà réservé aux appels
  // faits depuis un contexte autorisé à lire toute la collection `users`.
  async getStudentEmails(): Promise<string[]> {
    const users = await this.getAllUsers();
    return users.filter((u) => u.role === 'student' && !!u.email).map((u) => u.email);
  }

  // ✅ Emails d'une liste précise d'uids (ex: inscrits à un workshop
  // annulé). Lectures individuelles — best-effort, on ignore les
  // uids introuvables plutôt que de faire échouer tout l'envoi.
  async getEmailsByUids(uids: string[]): Promise<string[]> {
    const results = await Promise.all(
      uids.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          return (snap.data()?.['email'] as string) ?? null;
        } catch {
          return null;
        }
      }),
    );
    return results.filter((e): e is string => !!e);
  }

  // ✅ suspendUser ne notifie plus — c'est à l'appelant de le faire
  async suspendUser(uid: string): Promise<void> {
    await updateDoc(doc(db, 'users', uid), { disabled: true });
  }

  async reinstateUser(uid: string): Promise<void> {
    await updateDoc(doc(db, 'users', uid), { disabled: false });
  }

  async getUserCount(): Promise<number> {
    const snap = await getDocs(collection(db, 'users'));
    return snap.size;
  }
}
