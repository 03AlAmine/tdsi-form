import { Injectable } from '@angular/core';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, filter, take } from 'rxjs';
import { auth, db } from '../../../firebase.config';
import { User } from '../model/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  private authReadySubject = new BehaviorSubject<boolean>(false);
  authReady$ = this.authReadySubject.asObservable();

  private manualAuth = false;
  private isInitialCheck = true;

  // ✅ Listener temps réel sur le doc users/{uid} de l'utilisateur courant.
  // Permet de détecter une suspension (disabled: true) décidée par un
  // admin pendant que l'utilisateur est déjà connecté, sans Cloud Function
  // ni rechargement de page : on coupe la session côté client dès que le
  // document Firestore change.
  private profileUnsubscribe: (() => void) | null = null;

  private readonly AUTH_REDIRECT_PATHS = [
    '/',
    '/connexion',
    '/inscription',
    '/mot-de-passe-oublie',
  ];

  constructor(private router: Router) {
    onAuthStateChanged(auth, async (firebaseUser) => {
      this.stopProfileWatch();

      if (firebaseUser) {
        const user = await this.getUserProfile(firebaseUser.uid);
        this.currentUserSubject.next(user);
        this.authReadySubject.next(true);
        this.watchProfile(firebaseUser.uid);

        if (this.isInitialCheck) {
          const currentPath = window.location.pathname;
          if (this.AUTH_REDIRECT_PATHS.includes(currentPath)) {
            if (user?.role === 'admin') {
              this.router.navigate(['/admin/dashboard']);
            } else {
              this.router.navigate(['/espace-membre']);
            }
          }
          this.isInitialCheck = false;
        }
      } else {
        this.currentUserSubject.next(null);
        this.authReadySubject.next(true);
        this.isInitialCheck = false;
      }
    });
  }

  // ── Surveillance temps réel de la suspension ──────────────────────
  // Tant que l'utilisateur est connecté, on écoute son document Firestore.
  // Si un admin passe `disabled` à true pendant la session, on déconnecte
  // immédiatement côté client (quelques centaines de ms en pratique,
  // selon la latence du listener Firestore).
  private watchProfile(uid: string): void {
    this.profileUnsubscribe = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        const data = snap.data() as Record<string, any> | undefined;
        if (data?.['disabled']) {
          this.forceLogoutDisabled();
          return;
        }
        // On garde le profil en mémoire synchronisé (rôle, displayName...)
        // sans déclencher de navigation : seule la suspension force un logout.
        if (snap.exists()) {
          const user: User = {
            ...data,
            uid,
            createdAt: data?.['createdAt']?.toDate?.() ?? new Date(),
          } as User;
          this.currentUserSubject.next(user);
        }
      },
      (err) => console.error('Erreur surveillance profil utilisateur:', err),
    );
  }

  private stopProfileWatch(): void {
    if (this.profileUnsubscribe) {
      this.profileUnsubscribe();
      this.profileUnsubscribe = null;
    }
  }

  private async forceLogoutDisabled(): Promise<void> {
    this.stopProfileWatch();
    await signOut(auth);
    this.currentUserSubject.next(null);
    this.isInitialCheck = true;
    this.router.navigate(['/connexion'], {
      queryParams: { suspendu: '1' },
    });
  }

  waitForAuthReady(): Observable<boolean> {
    return this.authReady$.pipe(
      filter((ready) => ready === true),
      take(1),
    );
  }

  async login(email: string, password: string): Promise<void> {
    this.manualAuth = true;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // ✅ Vérification suspension AVANT de mettre l'utilisateur en session
      // getUserProfile() lit Firestore directement — pas de récursion
      const user = await this.getUserProfile(cred.user.uid);

      if ((user as any)?.disabled) {
        // Déconnecter immédiatement Firebase Auth côté client
        await signOut(auth);
        throw { code: 'auth/account-disabled', message: 'Compte suspendu. Contactez un administrateur.' };
      }

      this.currentUserSubject.next(user);

      if (user?.role === 'admin') {
        await this.router.navigate(['/admin/dashboard']);
      } else {
        await this.router.navigate(['/espace-membre']);
      }
    } finally {
      this.manualAuth = false;
    }
  }

  async register(data: {
    email: string;
    password: string;
    displayName: string;
    promo: string;
  }): Promise<void> {
    this.manualAuth = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
      await updateProfile(cred.user, { displayName: data.displayName });

      const user: User = {
        uid: cred.user.uid,
        email: data.email,
        displayName: data.displayName,
        role: 'student',
        promo: data.promo,
        createdAt: new Date(),
      };

      await setDoc(doc(db, 'users', cred.user.uid), user);
      this.currentUserSubject.next(user);
      await this.router.navigate(['/espace-membre']);
    } finally {
      this.manualAuth = false;
    }
  }

  async logout(): Promise<void> {
    this.stopProfileWatch();
    await signOut(auth);
    this.currentUserSubject.next(null);
    this.isInitialCheck = true;
    this.router.navigate(['/']);
  }

  // ✅ getUserProfile() lit Firestore et retourne le profil — sans aucune
  // vérification de suspension ici, car cette méthode est appelée dans
  // onAuthStateChanged() aussi (où cred n'existe pas). La vérification
  // disabled se fait uniquement dans login(), après récupération du profil.
  async getUserProfile(uid: string): Promise<User | null> {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, any>;
    return {
      ...data,
      uid,
      createdAt: data['createdAt']?.toDate?.() ?? new Date(),
    } as User;
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  async refreshCurrentUser(): Promise<void> {
    const uid = this.currentUserSubject.value?.uid;
    if (!uid) return;
    const user = await this.getUserProfile(uid);
    this.currentUserSubject.next(user);
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  get isLoggedIn(): boolean {
    return !!this.currentUser;
  }
}