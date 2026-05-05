import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeCategory } from '../../../core/model/models';

const CATEGORIES: ThemeCategory[] = [
  'Sécurité Réseau', 'Cryptographie', 'Transmission de Données',
  'Intelligence Artificielle', 'Développement Web', 'Cloud & DevOps', 'Autre'
];

const DIFFICULTIES = [
  { value: 'débutant', label: '🌱 Débutant', desc: 'Accessible à tous' },
  { value: 'intermédiaire', label: '📘 Intermédiaire', desc: 'Connaissances de base requises' },
  { value: 'avancé', label: '⚡ Avancé', desc: 'Bonnes connaissances techniques' }
];

@Component({
  selector: 'app-propose',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './propose.component.html',
  styleUrls: ['./propose.component.scss']
})
export class ProposeComponent {
  private fb = inject(FormBuilder);
  private themeService = inject(ThemeService);
  private authService = inject(AuthService);

  categories = CATEGORIES;
  difficulties = DIFFICULTIES;
  loading = signal(false);
  success = signal(false);
  error = signal('');

  form = this.fb.group({
    proposedTitle: ['', [Validators.required, Validators.maxLength(80)]],
    category: ['', Validators.required],
    difficulty: ['intermédiaire', Validators.required], // ← NOUVEAU CHAMP
    estimatedDuration: [60, [Validators.required, Validators.min(30), Validators.max(480)]],
    description: ['', [Validators.required, Validators.minLength(50)]],
    objectives: ['', Validators.required],
    prerequisites: [''],
    materialsNeeded: ['']
  });

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control?.invalid && !!control?.touched;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const user = this.authService.currentUser!;

    try {
      await this.themeService.submitTheme({
        studentId: user.uid,
        studentName: user.displayName,
        studentEmail: user.email,
        promo: user.promo ?? '',
        proposedTitle: this.form.value.proposedTitle!,
        description: this.form.value.description!,
        category: this.form.value.category as ThemeCategory,
        difficulty: this.form.value.difficulty as 'débutant' | 'intermédiaire' | 'avancé', // ← AJOUTER
        objectives: this.form.value.objectives!,
        prerequisites: this.form.value.prerequisites ?? '',
        estimatedDuration: this.form.value.estimatedDuration!,
        materialsNeeded: this.form.value.materialsNeeded ?? '',
        status: 'en attente',
        submittedAt: new Date()
      });

      this.success.set(true);
    } catch (err) {
      this.error.set('Erreur lors de la soumission. Veuillez réessayer.');
    } finally {
      this.loading.set(false);
    }
  }

  resetForm(): void {
    this.success.set(false);
    this.form.reset({ estimatedDuration: 60, difficulty: 'intermédiaire' });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }
}
