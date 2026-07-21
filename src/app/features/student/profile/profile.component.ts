import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoggerService } from '../../../core/services/logger.service';
import { ThemeService } from '../../../core/services/theme.service';
import { WorkshopService } from '../../../core/services/workshop.service';
import { auth } from '../../../../firebase.config';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit, OnDestroy {
  private fb           = inject(FormBuilder);
  private authService  = inject(AuthService);
  private userSvc      = inject(UserService);
  private router       = inject(Router);
  private toastService = inject(ToastService);
  private logger       = inject(LoggerService);
  private themeService    = inject(ThemeService);
  private workshopService = inject(WorkshopService);

  user = this.authService.currentUser;
  private sub: Subscription | null = null;

  // ── Stats & badges ────────────────────────────────────────
  stats = signal({ mySubmissions: 0, myRegistrations: 0 });

  engagementPoints = computed(
    () => this.stats().myRegistrations * 10 + this.stats().mySubmissions * 25,
  );

  certificatesCount = computed(() => Math.floor(this.stats().myRegistrations / 2));

  memberSince = computed(() => {
    const createdAt = this.user?.createdAt;
    if (!createdAt) return 0;
    const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
  });

  badges = computed(() => [
    {
      icon: 'fa-lightbulb',
      label: 'Premier pas',
      description: 'Proposer une thématique',
      unlocked: this.stats().mySubmissions >= 1,
    },
    {
      icon: 'fa-calendar-check',
      label: 'Habitué',
      description: 'S’inscrire à 3 workshops',
      unlocked: this.stats().myRegistrations >= 3,
    },
    {
      icon: 'fa-pen-nib',
      label: 'Contributeur actif',
      description: 'Proposer 3 thématiques',
      unlocked: this.stats().mySubmissions >= 3,
    },
    {
      icon: 'fa-hourglass-half',
      label: 'Membre fidèle',
      description: 'Membre depuis plus de 90 jours',
      unlocked: this.memberSince() >= 90,
    },
  ]);

  savingProfile       = signal(false);
  changingPassword    = signal(false);
  showCurrentPassword = signal(false);
  showNewPassword     = signal(false);
  showConfirmPassword = signal(false);
  successMessage      = signal('');
  errorMessage        = signal('');

  profileForm = this.fb.group({
    displayName: [this.user?.displayName ?? '', [Validators.required, Validators.minLength(3)]],
    promo:       [this.user?.promo       ?? '',  Validators.required],
  });

  passwordForm: FormGroup = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword:     ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
  }, { validators: this.passwordMatchValidator });

  promos = ['L1', 'L2', 'L3', 'M1', 'M2', 'Doctorat', 'Professionnel'];

  get newPassword(): AbstractControl     { return this.passwordForm.get('newPassword')!; }
  get confirmPassword(): AbstractControl { return this.passwordForm.get('confirmPassword')!; }

  private statsSubs: Subscription[] = [];

  // ── Lifecycle ─────────────────────────────────────────────
  ngOnInit(): void {
    this.sub = this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.user = user;
        this.profileForm.patchValue(
          { displayName: user.displayName, promo: user.promo },
          { emitEvent: false }
        );
      }
    });
    this.loadStats();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.statsSubs.forEach((s) => s.unsubscribe());
  }

  private loadStats(): void {
    const uid = this.user?.uid;
    if (!uid) return;
    this.statsSubs.push(
      this.themeService.getMySubmissions(uid).subscribe((subs) => {
        this.stats.update((s) => ({ ...s, mySubmissions: subs.length }));
      }),
    );
    this.statsSubs.push(
      this.workshopService.getWorkshops().subscribe((workshops) => {
        const registrations = workshops.filter((w) => w.registrations?.includes(uid));
        this.stats.update((s) => ({ ...s, myRegistrations: registrations.length }));
      }),
    );
  }

  // ── Validation ────────────────────────────────────────────
  passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const np = group.get('newPassword')?.value;
    const cp = group.get('confirmPassword')?.value;
    return np === cp ? null : { mismatch: true };
  }

  isProfileInvalid(field: string): boolean {
    const c = this.profileForm.get(field);
    return c ? c.invalid && c.touched : false;
  }

  isPasswordInvalid(field: string): boolean {
    const c = this.passwordForm.get(field);
    return c ? c.invalid && c.touched : false;
  }

  // ── Profil ────────────────────────────────────────────────
  async updateProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.toastService.error('Veuillez corriger les erreurs dans le formulaire');
      return;
    }

    this.savingProfile.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const uid = this.user!.uid;
      const displayName = this.profileForm.value.displayName!;
      const promo       = this.profileForm.value.promo!;

      // ✅ Via UserService — plus de updateDoc direct
      await this.userSvc.updateProfile(uid, { displayName, promo });
      await this.authService.refreshCurrentUser();

      this.successMessage.set('Profil mis à jour avec succès !');
      this.toastService.success('Profil mis à jour avec succès');

      // ✅ Timeout stocké pour être annulable si le composant est détruit
      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (err) {
      this.logger.error('[Profile] updateProfile:', err);
      this.errorMessage.set('Erreur lors de la mise à jour du profil');
      this.toastService.error('Erreur lors de la mise à jour du profil');
    } finally {
      this.savingProfile.set(false);
    }
  }

  // ── Mot de passe ──────────────────────────────────────────
  async changePassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.toastService.error('Veuillez corriger les erreurs dans le formulaire');
      return;
    }

    this.changingPassword.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const firebaseUser = auth.currentUser;
    if (!firebaseUser?.email) {
      this.errorMessage.set('Utilisateur non connecté');
      this.toastService.error('Utilisateur non connecté');
      this.changingPassword.set(false);
      return;
    }

    try {
      await reauthenticateWithCredential(
        firebaseUser,
        EmailAuthProvider.credential(
          firebaseUser.email,
          this.passwordForm.value.currentPassword!
        )
      );
      await updatePassword(firebaseUser, this.passwordForm.value.newPassword!);

      this.successMessage.set('Mot de passe modifié avec succès !');
      this.toastService.success('Mot de passe modifié avec succès');
      this.passwordForm.reset();
      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (err: any) {
      this.logger.error('[Profile] changePassword:', err);
      const messages: Record<string, string> = {
        'auth/wrong-password':    'Mot de passe actuel incorrect',
        'auth/weak-password':     'Le nouveau mot de passe est trop faible',
        'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard',
      };
      const msg = messages[err?.code] ?? 'Erreur lors du changement de mot de passe';
      this.errorMessage.set(msg);
      this.toastService.error(msg);
    } finally {
      this.changingPassword.set(false);
    }
  }

  // ── Password strength ────────────────────────────────────
  getStrengthClass(password: string): string {
    if (!password) return '';
    const s = this.checkPasswordStrength(password);
    return s < 2 ? 'weak' : s < 4 ? 'medium' : 'strong';
  }

  getStrengthText(password: string): string {
    if (!password) return '';
    const s = this.checkPasswordStrength(password);
    return s < 2 ? 'Faible' : s < 4 ? 'Moyen' : 'Fort';
  }

  private checkPasswordStrength(p: string): number {
    return [p.length >= 8, /[a-z]/.test(p), /[A-Z]/.test(p), /[0-9]/.test(p), /[^a-zA-Z0-9]/.test(p)]
      .filter(Boolean).length;
  }

  // ── UI ────────────────────────────────────────────────────
  toggleCurrentPassword(): void { this.showCurrentPassword.update(v => !v); }
  toggleNewPassword():     void { this.showNewPassword.update(v => !v);     }
  toggleConfirmPassword(): void { this.showConfirmPassword.update(v => !v); }
  goBack():                void { this.router.navigate(['/espace-membre/thematiques']); }
  logout():                void { this.authService.logout(); this.toastService.info('Vous avez été déconnecté'); }
}
