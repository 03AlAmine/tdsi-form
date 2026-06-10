import { Injectable, inject } from '@angular/core';
import {
  collection, doc, getDoc, getDocs,
  updateDoc, query, orderBy, where,
  Timestamp, DocumentSnapshot
} from 'firebase/firestore';
import { db } from '../../../firebase.config';
import { User } from '../model/models';

// ─────────────────────────────────────────────────────────────
// UserService — source de vérité unique pour les profils utilisateurs.
// Centralise tout ce qui touchait à db('users') dans les composants.
// AuthService conserve uniquement auth Firebase (login/logout/token).
// ─────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class UserService {

  // ── Mapping Firestore → TypeScript ───────────────────────
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

  // ── Lecture d'un profil ───────────────────────────────────
  async getProfile(uid: string): Promise<User | null> {
    const snap = await getDoc(doc(db, 'users', uid));
    return this.fromFirestore(snap);
  }

  // ── Liste complète (admin) ────────────────────────────────
  async getAllUsers(): Promise<User[]> {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => this.fromFirestore(d))
      .filter((u): u is User => u !== null);
  }

  // ── Mise à jour du profil (membre) ───────────────────────
  async updateProfile(uid: string, data: { displayName: string; promo: string }): Promise<void> {
    await updateDoc(doc(db, 'users', uid), {
      displayName: data.displayName,
      promo:       data.promo,
    });
  }

  // ── Changement de rôle (admin) ───────────────────────────
  // Note de sécurité : cette opération devrait idéalement passer par une
  // Cloud Function avec vérification du token admin côté serveur.
  // Pour l'instant la protection repose sur les Firestore Security Rules.
  async updateRole(uid: string, role: 'student' | 'admin'): Promise<void> {
    await updateDoc(doc(db, 'users', uid), { role });
  }

  // ── Suspension (admin) ───────────────────────────────────
  // Implémentation réelle : champ `disabled` dans Firestore.
  // AuthService.login() vérifie ce champ après résolution du profil.
  async suspendUser(uid: string): Promise<void> {
    await updateDoc(doc(db, 'users', uid), { disabled: true });
  }

  async reinstateUser(uid: string): Promise<void> {
    await updateDoc(doc(db, 'users', uid), { disabled: false });
  }

  // ── Stats rapides ─────────────────────────────────────────
  async getUserCount(): Promise<number> {
    const snap = await getDocs(collection(db, 'users'));
    return snap.size;
  }
}
