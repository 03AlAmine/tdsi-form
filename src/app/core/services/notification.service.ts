// core/services/notification.service.ts
import { Injectable, inject } from '@angular/core';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { Observable, shareReplay, finalize } from 'rxjs';
import { db } from '../../../firebase.config';
import { AppNotification, NotificationType } from '../model/models';
import { UserService } from './user.service';

// ─────────────────────────────────────────────────────────────
// NotificationService — centralise la création et la lecture des
// notifications persistantes (collection `notifications`, un
// document par destinataire). Distinct de ToastService : un toast
// est un feedback éphémère pour l'auteur de l'action en cours ;
// une notification est adressée à une AUTRE personne et reste
// visible jusqu'à ce qu'elle soit marquée comme lue, même si le
// destinataire était hors-ligne au moment de l'événement.
//
// Déclencheurs actuellement branchés (voir chaque service appelant) :
//   - submission_received   : ThemeService.submitTheme()      → tous les admins
//   - submission_approved   : ThemeService.approveSubmission() → l'étudiant
//   - submission_refused    : ThemeService.refuseSubmission()  → l'étudiant
//   - workshop_created      : WorkshopService.createWorkshop() → tous les membres
//   - workshop_cancelled    : WorkshopService.updateWorkshop() → les inscrits
//   - account_suspended     : AuthService (suspension admin)   → l'utilisateur
// ─────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private userService = inject(UserService);

  // Cache par uid : un seul listener Firestore actif par utilisateur connecté.
  private notifications$ = new Map<string, Observable<AppNotification[]>>();

  // Limite raisonnable : on ne charge que les 50 plus récentes dans la
  // cloche. L'historique complet n'a pas d'usage identifié pour l'instant.
  private readonly MAX_NOTIFICATIONS = 50;

  getNotifications(uid: string): Observable<AppNotification[]> {
    if (!this.notifications$.has(uid)) {
      const obs = new Observable<AppNotification[]>((observer) => {
        const q = query(
          collection(db, 'notifications'),
          where('recipientUid', '==', uid),
          orderBy('createdAt', 'desc'),
          limit(this.MAX_NOTIFICATIONS),
        );
        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const data = snapshot.docs.map((d) => {
              const raw: any = d.data();
              return {
                ...raw,
                id: d.id,
                createdAt: raw.createdAt?.toDate?.() ?? new Date(),
              } as AppNotification;
            });
            observer.next(data);
          },
          (err) => observer.error(err),
        );
        return () => unsubscribe();
      }).pipe(
        shareReplay({ bufferSize: 1, refCount: true }),
        finalize(() => this.notifications$.delete(uid)),
      );
      this.notifications$.set(uid, obs);
    }
    return this.notifications$.get(uid)!;
  }

  async markAsRead(notificationId: string): Promise<void> {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  }

  async markAllAsRead(notifications: AppNotification[]): Promise<void> {
    const unread = notifications.filter((n) => !n.read && n.id);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, 'notifications', n.id!), { read: true });
    });
    await batch.commit();
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await deleteDoc(doc(db, 'notifications', notificationId));
  }

  // ── Création ───────────────────────────────────────────────
  // Toutes les méthodes ci-dessous sont fire-and-forget côté
  // appelant : un échec de notification ne doit jamais faire
  // échouer l'action métier principale (approuver une soumission
  // doit réussir même si, pour une raison quelconque, l'écriture
  // de la notification échoue). Chaque appelant doit donc envelopper
  // ces appels dans un try/catch séparé ou les laisser en best-effort.

  private async notify(
    recipientUid: string,
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
  ): Promise<void> {
    await addDoc(collection(db, 'notifications'), {
      recipientUid,
      type,
      title,
      message,
      link: link ?? null,
      read: false,
      createdAt: Timestamp.fromDate(new Date()),
    });
  }

  async notifyOne(
    recipientUid: string,
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
  ): Promise<void> {
    await this.notify(recipientUid, type, title, message, link);
  }

  // Notifie une liste explicite d'uids (ex: les inscrits à un atelier annulé)
  async notifyMany(
    recipientUids: string[],
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
  ): Promise<void> {
    await Promise.all(
      recipientUids.map((uid) => this.notify(uid, type, title, message, link)),
    );
  }

  // Notifie tous les admins (ex: nouvelle soumission reçue)
  //
  // ⚠️ On ne passe PAS par userService.getAllUsers() ici : cette méthode
  // fait une requête sans filtre sur toute la collection `users`, dont la
  // lecture est réservée au propriétaire du document ou à un admin
  // (règles Firestore). Un étudiant qui déclenche cette notification
  // (ex: en soumettant une thématique) se voit donc refuser la requête
  // avec "Missing or insufficient permissions".
  //
  // On lit à la place la collection `admins/{uid}` — un miroir léger,
  // ne contenant que les uids des admins, lisible par tout utilisateur
  // authentifié (voir règles) et maintenu à jour par
  // UserService.updateRole().
  async notifyAllAdmins(
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
  ): Promise<void> {
    const snap = await getDocs(collection(db, 'admins'));
    const adminUids = snap.docs.map((d) => d.id);
    await this.notifyMany(adminUids, type, title, message, link);
  }

  // Notifie tous les membres (étudiants + admins exclus ou inclus selon le cas)
  // Utilisé pour l'annonce de création d'un nouvel atelier.
  async notifyAllStudents(
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
  ): Promise<void> {
    const users = await this.userService.getAllUsers();
    const studentUids = users.filter((u) => u.role === 'student').map((u) => u.uid);
    await this.notifyMany(studentUids, type, title, message, link);
  }
}
