// propose.component.ts - Version améliorée
import { Component, inject, signal, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';
import { AiService } from '../../../core/services/ai.service';
import { ThemeCategory } from '../../../core/model/models';
import { LoadingService } from '../../../core/services/loading.service';
import { ToastService } from '../../../core/services/toast.service';

const CATEGORIES: ThemeCategory[] = [
  'Sécurité Réseau',
  'Cryptographie',
  'Transmission de Données',
  'Intelligence Artificielle',
  'Développement Web',
  'Cloud & DevOps',
  'Autre',
];

const DIFFICULTIES = [
  { value: 'débutant', label: 'Débutant', desc: 'Accessible à tous', icon: '🌱' },
  { value: 'intermédiaire', label: 'Intermédiaire', desc: 'Connaissances de base requises', icon: '📘' },
  { value: 'avancé', label: 'Avancé', desc: 'Bonnes connaissances techniques', icon: '⚡' },
];

@Component({
  selector: 'app-propose',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './propose.component.html',
  styleUrls: ['./propose.component.scss'],
})
export class ProposeComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private themeService = inject(ThemeService);
  private authService = inject(AuthService);
  private aiService = inject(AiService);
  private loadingService = inject(LoadingService);
  private toastService = inject(ToastService);

  private destroy$ = new Subject<void>();

  categories = CATEGORIES;
  difficulties = DIFFICULTIES;

  loading = signal(false);
  success = signal(false);
  error = signal('');

  aiLoading = signal(false);
  aiError = signal('');
  aiUsed = signal(false);
  suggestLoading = signal(false);
  suggestions = signal<string[]>([]);
  showSuggestions = signal(false);
  titleInput$ = new Subject<string>();

  form = this.fb.group({
    proposedTitle: ['', [Validators.required, Validators.maxLength(80)]],
    category: ['', Validators.required],
    difficulty: ['intermédiaire', Validators.required],
    estimatedDuration: [90, [Validators.required, Validators.min(30), Validators.max(480)]],
    description: ['', [Validators.required, Validators.minLength(50)]],
    objectives: ['', Validators.required],
    prerequisites: [''],
    materialsNeeded: [''],
  });

  ngOnInit(): void {
    this.titleInput$
      .pipe(
        debounceTime(1200),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((val) => this.fetchSuggestions(val));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getDifficultyIcon(value: string): string {
    return this.difficulties.find(d => d.value === value)?.icon || '📚';
  }

  onTitleInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.titleInput$.next(val);
    if (val.length < 4) {
      this.suggestions.set([]);
      this.showSuggestions.set(false);
    }
  }

  private async fetchSuggestions(title: string): Promise<void> {
    if (title.length < 4) return;
    this.suggestLoading.set(true);
    try {
      const category = this.form.value.category ?? '';
      const results = await this.aiService.suggestTitles(title, category);
      this.suggestions.set(results.filter(s => s.toLowerCase() !== title.toLowerCase()));
      this.showSuggestions.set(this.suggestions().length > 0);
    } catch {
      // Silencieux
    } finally {
      this.suggestLoading.set(false);
    }
  }

  pickSuggestion(title: string): void {
    this.form.patchValue({ proposedTitle: title });
    this.showSuggestions.set(false);
    this.suggestions.set([]);
  }

  hideSuggestions(): void {
    setTimeout(() => this.showSuggestions.set(false), 200);
  }

  async autoComplete(): Promise<void> {
    const title = this.form.value.proposedTitle?.trim() ?? '';
    const category = this.form.value.category ?? '';

    if (!title) {
      this.aiError.set("Saisissez d'abord un titre pour générer le contenu.");
      setTimeout(() => this.aiError.set(''), 3000);
      return;
    }

    this.aiLoading.set(true);
    this.aiError.set('');

    try {
      const user = this.authService.currentUser!;
      const result = await this.aiService.completeThemeForm(
        title,
        category,
        user.promo ?? 'étudiant',
      );

      this.form.patchValue({
        description: result.description,
        objectives: result.objectives,
        prerequisites: result.prerequisites,
        materialsNeeded: result.materialsNeeded,
        estimatedDuration: result.estimatedDuration,
      });

      this.aiUsed.set(true);
      this.toastService.success('✨ Contenu généré par IA avec succès !');
    } catch {
      this.aiError.set('Erreur IA. Vérifiez votre connexion et réessayez.');
    } finally {
      this.aiLoading.set(false);
    }
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return control ? control.invalid && control.touched : false;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error('Veuillez corriger les erreurs dans le formulaire');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    const user = this.authService.currentUser!;
    this.loadingService.show('Envoi de votre proposition...');

    try {
      await this.themeService.submitTheme({
        studentId: user.uid,
        studentName: user.displayName,
        studentEmail: user.email,
        promo: user.promo ?? '',
        proposedTitle: this.form.value.proposedTitle!,
        description: this.form.value.description!,
        category: this.form.value.category as ThemeCategory,
        difficulty: this.form.value.difficulty as 'débutant' | 'intermédiaire' | 'avancé',
        objectives: this.form.value.objectives!,
        prerequisites: this.form.value.prerequisites ?? '',
        estimatedDuration: this.form.value.estimatedDuration!,
        materialsNeeded: this.form.value.materialsNeeded ?? '',
        status: 'en attente',
        submittedAt: new Date(),
      });
      this.loadingService.hide();
      this.success.set(true);
      this.toastService.success('Proposition soumise avec succès !');
    } catch {
      this.loadingService.hide();
      this.error.set('Erreur lors de la soumission. Veuillez réessayer.');
      this.toastService.error('Erreur lors de la soumission');
    } finally {
      this.loading.set(false);
    }
  }

  resetForm(): void {
    this.success.set(false);
    this.aiUsed.set(false);
    this.form.reset({ estimatedDuration: 90, difficulty: 'intermédiaire' });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.toastService.info('Formulaire réinitialisé');
  }
}
