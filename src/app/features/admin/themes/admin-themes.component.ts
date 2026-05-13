// admin-themes.component.ts - Version améliorée
import { Component, inject, signal, ViewChild, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ThemeService } from '../../../core/services/theme.service';
import { WorkshopService } from '../../../core/services/workshop.service';
import { AuthService } from '../../../core/services/auth.service';
import { Theme, ThemeCategory, Workshop } from '../../../core/model/models';
import { ThemeDetailComponent } from './theme-detail/theme-detail.component';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { AiService } from '../../../core/services/ai.service';

const CATEGORIES: ThemeCategory[] = [
  'Sécurité Réseau', 'Cryptographie', 'Transmission de Données',
  'Intelligence Artificielle', 'Développement Web', 'Cloud & DevOps', 'Autre',
];

interface ThemeWithWorkshop extends Omit<Theme, 'linkedWorkshop'> {
  linkedWorkshop?: Workshop;
}

@Component({
  selector: 'app-admin-themes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ThemeDetailComponent],
  templateUrl: './admin-themes.component.html',
  styleUrls: ['./admin-themes.component.scss'],
})
export class AdminThemesComponent implements OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private workshopService = inject(WorkshopService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private toastService = inject(ToastService);
  private confirmService = inject(ConfirmService);
  private aiService = inject(AiService);

  @ViewChild(ThemeDetailComponent) themeDetail!: ThemeDetailComponent;

  aiLoading = signal(false);
  aiError = signal('');
  aiUsed = signal(false);
  loading = signal(true);

  allThemes = signal<ThemeWithWorkshop[]>([]);
  categories = CATEGORIES;
  showForm = signal(false);
  saving = signal(false);
  searchQuery = signal('');
  selectedTheme = signal<Theme | null>(null);

  private subscription: Subscription | null = null;

  form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    category: ['', Validators.required],
    difficulty: ['intermédiaire', Validators.required],
    description: ['', [Validators.required, Validators.minLength(20)]],
    maxParticipants: [20, [Validators.required, Validators.min(1), Validators.max(100)]],
    tags: [''],
  });

  filteredThemes = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const themes = this.allThemes();
    if (!query) return themes;
    return themes.filter(t =>
      t.title.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query)
    );
  });

  ngOnInit(): void {
    this.subscription = this.themeService.getThemes().subscribe(themes => {
      this.allThemes.set(themes.map(theme => ({ ...theme })));
      this.loading.set(false);
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      ouvert: 'success',
      complet: 'warning',
      fermé: 'danger',
    };
    return classes[status] || 'neutral';
  }

  async autoCategorize(): Promise<void> {
    const title = this.form.value.title?.trim() ?? '';
    const description = this.form.value.description?.trim() ?? '';

    if (!title) {
      this.aiError.set('Saisissez d\'abord un titre.');
      setTimeout(() => this.aiError.set(''), 3000);
      return;
    }

    this.aiLoading.set(true);
    this.aiError.set('');

    try {
      const result = await this.aiService.categorizeTheme(title, description);
      this.form.patchValue({
        category: result.category,
        difficulty: result.difficulty,
        tags: result.tags.join(', ')
      });
      if (result.description && !description) {
        this.form.patchValue({ description: result.description });
      }
      this.aiUsed.set(true);
      this.toastService.success('Catégorisation IA appliquée !');
    } catch {
      this.aiError.set('Erreur IA. Réessayez.');
    } finally {
      this.aiLoading.set(false);
    }
  }

  toggleForm(): void {
    this.showForm.update(v => !v);
    if (!this.showForm()) {
      this.form.reset({ difficulty: 'intermédiaire', maxParticipants: 20 });
      this.aiUsed.set(false);
      this.aiError.set('');
    }
  }

  async create(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    this.saving.set(true);
    const values = this.form.value;

    try {
      await this.themeService.createTheme({
        title: values.title!,
        description: values.description!,
        category: values.category as ThemeCategory,
        tags: values.tags ? values.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        difficulty: values.difficulty as Theme['difficulty'],
        maxParticipants: values.maxParticipants ?? 20,
        currentParticipants: 0,
        status: 'ouvert',
        createdAt: new Date(),
        createdBy: this.authService.currentUser!.uid,
        linkedWorkshop: undefined,
      });
      this.form.reset({ difficulty: 'intermédiaire', maxParticipants: 20 });
      this.showForm.set(false);
      this.aiUsed.set(false);
      this.toastService.success('Thématique créée avec succès !');
    } catch {
      this.toastService.error('Erreur lors de la création');
    } finally {
      this.saving.set(false);
    }
  }

  async updateStatus(theme: Theme, event: Event): Promise<void> {
    const status = (event.target as HTMLSelectElement).value as Theme['status'];
    try {
      await this.themeService.updateTheme(theme.id!, { status });
      this.toastService.success(`Statut mis à jour : ${status}`);
    } catch {
      this.toastService.error('Erreur lors de la mise à jour');
    }
  }

  async deleteTheme(theme: Theme): Promise<void> {
    this.confirmService.confirm({
      title: 'Supprimer la thématique',
      message: `Êtes-vous sûr de vouloir supprimer "${theme.title}" ? Cette action est irréversible.`,
      type: 'danger',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      onConfirm: async () => {
        try {
          await this.themeService.deleteTheme(theme.id!);
          this.toastService.success('Thématique supprimée');
        } catch {
          this.toastService.error('Erreur lors de la suppression');
        }
      },
    });
  }

  openThemeDetail(theme: Theme): void {
    this.themeDetail.open(theme);
  }

  editTheme(theme: Theme): void {
    this.form.patchValue({
      title: theme.title,
      category: theme.category,
      difficulty: theme.difficulty,
      description: theme.description,
      maxParticipants: theme.maxParticipants,
      tags: theme.tags?.join(', '),
    });
    this.showForm.set(true);
    this.aiUsed.set(false);
  }
}
