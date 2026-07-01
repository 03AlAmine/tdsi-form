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
      await setDoc(doc(db, 'admins', uid), {
        uid,
        createdAt: Timestamp.fromDate(new Date()),
      });
    } else {
      await deleteDoc(doc(db, 'admins', uid));
    }
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
