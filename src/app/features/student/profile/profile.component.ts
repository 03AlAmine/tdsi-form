// profile.component.ts - Version améliorée
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { auth, db } from '../../../../firebase.config';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastService = inject(ToastService);

  user = this.authService.currentUser;
  private refreshSubscription: Subscription | null = null;

  savingProfile = signal(false);
  changingPassword = signal(false);
  showCurrentPassword = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  profileForm = this.fb.group({
    displayName: [this.user?.displayName || '', [Validators.required, Validators.minLength(3)]],
    promo: [this.user?.promo || '', Validators.required]
  });

  passwordForm = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required]
  }, { validators: this.passwordMatchValidator });

  promos = ['L1', 'L2', 'L3', 'M1', 'M2', 'Doctorat', 'Professionnel'];

  get newPassword(): AbstractControl {
    return this.passwordForm.get('newPassword')!;
  }

  get confirmPassword(): AbstractControl {
    return this.passwordForm.get('confirmPassword')!;
  }

  ngOnInit(): void {
    // Refresh user data when profile is updated
    this.refreshSubscription = this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.user = user;
        this.profileForm.patchValue({
          displayName: user.displayName,
          promo: user.promo
        }, { emitEvent: false });
      }
    });
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { mismatch: true };
  }

  getStrengthClass(password: string): string {
    if (!password) return '';
    const strength = this.checkPasswordStrength(password);
    if (strength < 2) return 'weak';
    if (strength < 4) return 'medium';
    return 'strong';
  }

  getStrengthText(password: string): string {
    if (!password) return '';
    const strength = this.checkPasswordStrength(password);
    if (strength < 2) return 'Faible';
    if (strength < 4) return 'Moyen';
    return 'Fort';
  }

  private checkPasswordStrength(password: string): number {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/)) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    return strength;
  }

  isProfileInvalid(field: string): boolean {
    const control = this.profileForm.get(field);
    return control ? control.invalid && control.touched : false;
  }

  isPasswordInvalid(field: string): boolean {
    const control = this.passwordForm.get(field);
    return control ? control.invalid && control.touched : false;
  }

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
      await updateDoc(doc(db, 'users', this.user!.uid), {
        displayName: this.profileForm.value.displayName,
        promo: this.profileForm.value.promo
      });
      await this.authService.refreshCurrentUser();
      this.successMessage.set('Profil mis à jour avec succès !');
      this.toastService.success('Profil mis à jour avec succès');
      setTimeout(() => this.successMessage.set(''), 3000);
    } catch {
      this.errorMessage.set('Erreur lors de la mise à jour du profil');
      this.toastService.error('Erreur lors de la mise à jour du profil');
    } finally {
      this.savingProfile.set(false);
    }
  }

  async changePassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.toastService.error('Veuillez corriger les erreurs dans le formulaire');
      return;
    }

    this.changingPassword.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const user = auth.currentUser;
    if (!user?.email) {
      this.errorMessage.set('Utilisateur non connecté');
      this.toastService.error('Utilisateur non connecté');
      this.changingPassword.set(false);
      return;
    }

    try {
      await reauthenticateWithCredential(
        user,
        EmailAuthProvider.credential(user.email, this.passwordForm.value.currentPassword!)
      );
      await updatePassword(user, this.passwordForm.value.newPassword!);
      this.successMessage.set('Mot de passe modifié avec succès !');
      this.toastService.success('Mot de passe modifié avec succès');
      this.passwordForm.reset();
      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (err: any) {
      const messages: Record<string, string> = {
        'auth/wrong-password': 'Mot de passe actuel incorrect',
        'auth/weak-password': 'Le nouveau mot de passe est trop faible',
        'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard',
      };
      this.errorMessage.set(messages[err.code] ?? 'Erreur lors du changement de mot de passe');
      this.toastService.error(this.errorMessage());
    } finally {
      this.changingPassword.set(false);
    }
  }

  toggleCurrentPassword(): void {
    this.showCurrentPassword.update(v => !v);
  }

  toggleNewPassword(): void {
    this.showNewPassword.update(v => !v);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update(v => !v);
  }

  goBack(): void {
    this.router.navigate(['/espace-membre/thematiques']);
  }

  logout(): void {
    this.authService.logout();
    this.toastService.info('Vous avez été déconnecté');
  }
}
