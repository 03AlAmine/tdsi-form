import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
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
export class ProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  user = this.authService.currentUser;
  loading = signal(false);
  savingProfile = signal(false);
  changingPassword = signal(false);
  showCurrentPassword = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);

  successMessage = signal('');
  errorMessage = signal('');

  // Profile form
  profileForm = this.fb.group({
    displayName: [this.user?.displayName || '', [Validators.required, Validators.minLength(3)]],
    promo: [this.user?.promo || '', Validators.required]
  });

  // Password form
  passwordForm = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required]
  }, { validators: this.passwordMatchValidator });

  promos = ['L1', 'L2', 'L3', 'M1', 'M2', 'Doctorat', 'Professionnel'];

  ngOnInit(): void {
    // Reset messages when forms change
    this.profileForm.valueChanges.subscribe(() => {
      this.successMessage.set('');
      this.errorMessage.set('');
    });
    this.passwordForm.valueChanges.subscribe(() => {
      this.successMessage.set('');
      this.errorMessage.set('');
    });
  }

  passwordMatchValidator(group: FormGroup): { [key: string]: boolean } | null {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { mismatch: true };
  }

  isProfileInvalid(field: string): boolean {
    const control = this.profileForm.get(field);
    return !!control?.invalid && !!control?.touched;
  }

  isPasswordInvalid(field: string): boolean {
    const control = this.passwordForm.get(field);
    return !!control?.invalid && !!control?.touched;
  }

  async updateProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.savingProfile.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const userRef = doc(db, 'users', this.user!.uid);
      await updateDoc(userRef, {
        displayName: this.profileForm.value.displayName,
        promo: this.profileForm.value.promo
      });

      // Update local user object
      if (this.user) {
        this.user.displayName = this.profileForm.value.displayName!;
        this.user.promo = this.profileForm.value.promo!;
      }

      this.successMessage.set('Profil mis à jour avec succès !');
      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (err) {
      this.errorMessage.set('Erreur lors de la mise à jour du profil');
    } finally {
      this.savingProfile.set(false);
    }
  }

  async changePassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.changingPassword.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const user = auth.currentUser;
    if (!user || !user.email) {
      this.errorMessage.set('Utilisateur non connecté');
      this.changingPassword.set(false);
      return;
    }

    const credential = EmailAuthProvider.credential(
      user.email,
      this.passwordForm.value.currentPassword!
    );

    try {
      // Re-authenticate user
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, this.passwordForm.value.newPassword!);

      this.successMessage.set('Mot de passe modifié avec succès !');
      this.passwordForm.reset();

      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (err: any) {
      if (err.code === 'auth/wrong-password') {
        this.errorMessage.set('Mot de passe actuel incorrect');
      } else if (err.code === 'auth/weak-password') {
        this.errorMessage.set('Le nouveau mot de passe est trop faible');
      } else {
        this.errorMessage.set('Erreur lors du changement de mot de passe');
      }
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
    this.router.navigate(['/etudiant/themes']);
  }
}
