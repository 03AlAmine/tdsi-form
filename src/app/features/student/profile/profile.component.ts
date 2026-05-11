import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { auth, db } from '../../../../firebase.config';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent {
  private fb          = inject(FormBuilder);
  private authService = inject(AuthService);
  private router      = inject(Router);

  user = this.authService.currentUser;

  savingProfile       = signal(false);
  changingPassword    = signal(false);
  showCurrentPassword = signal(false);
  showNewPassword     = signal(false);
  showConfirmPassword = signal(false);
  successMessage      = signal('');
  errorMessage        = signal('');

  profileForm = this.fb.group({
    displayName: [this.user?.displayName || '', [Validators.required, Validators.minLength(3)]],
    promo:       [this.user?.promo || '', Validators.required]
  });

  passwordForm = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword:     ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required]
  }, { validators: this.passwordMatchValidator });

  promos = ['L1', 'L2', 'L3', 'M1', 'M2', 'Doctorat', 'Professionnel'];

  constructor() {
    // takeUntilDestroyed doit être appelé dans le constructeur
    const clearMessages = () => { this.successMessage.set(''); this.errorMessage.set(''); };

    this.profileForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(clearMessages);

    this.passwordForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(clearMessages);
  }

  passwordMatchValidator(group: FormGroup): { [key: string]: boolean } | null {
    const newPassword     = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { mismatch: true };
  }

  isProfileInvalid(field: string): boolean {
    const c = this.profileForm.get(field);
    return !!c?.invalid && !!c?.touched;
  }

  isPasswordInvalid(field: string): boolean {
    const c = this.passwordForm.get(field);
    return !!c?.invalid && !!c?.touched;
  }

  async updateProfile(): Promise<void> {
    if (this.profileForm.invalid) { this.profileForm.markAllAsTouched(); return; }
    this.savingProfile.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      await updateDoc(doc(db, 'users', this.user!.uid), {
        displayName: this.profileForm.value.displayName,
        promo:       this.profileForm.value.promo
      });
      await this.authService.refreshCurrentUser();
      this.user = this.authService.currentUser;
      this.successMessage.set('Profil mis à jour avec succès !');
      setTimeout(() => this.successMessage.set(''), 3000);
    } catch {
      this.errorMessage.set('Erreur lors de la mise à jour du profil');
    } finally {
      this.savingProfile.set(false);
    }
  }

  async changePassword(): Promise<void> {
    if (this.passwordForm.invalid) { this.passwordForm.markAllAsTouched(); return; }
    this.changingPassword.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const user = auth.currentUser;
    if (!user?.email) {
      this.errorMessage.set('Utilisateur non connecté');
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
      this.passwordForm.reset();
      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (err: any) {
      const msgs: Record<string, string> = {
        'auth/wrong-password': 'Mot de passe actuel incorrect',
        'auth/weak-password':  'Le nouveau mot de passe est trop faible',
      };
      this.errorMessage.set(msgs[err.code] ?? 'Erreur lors du changement de mot de passe');
    } finally {
      this.changingPassword.set(false);
    }
  }

  toggleCurrentPassword(): void { this.showCurrentPassword.update(v => !v); }
  toggleNewPassword(): void     { this.showNewPassword.update(v => !v); }
  toggleConfirmPassword(): void { this.showConfirmPassword.update(v => !v); }

  goBack(): void { this.router.navigate(['/espace-membre/thematiques']); }
}
