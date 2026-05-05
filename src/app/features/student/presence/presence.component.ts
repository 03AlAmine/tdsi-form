import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, FormGroup, Validators } from '@angular/forms';
import { WorkshopService } from '../../../core/services/workshop.service';
import { AuthService } from '../../../core/services/auth.service';
import { Workshop } from '../../../core/model/models';

@Component({
  selector: 'app-presence',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="container">
        <div class="presence animate-fadeUp">

          @if (loading) {
            <div class="state-center">
              <div class="spinner"></div>
              <p class="font-mono text-xs text-muted" style="margin-top:.75rem">Chargement…</p>
            </div>

          } @else if (!workshop) {
            <div class="state-center">
              <span style="font-size:2rem">❌</span>
              <p style="margin-top:.75rem;color:var(--text-2)">Workshop introuvable.</p>
              <a routerLink="/etudiant/themes" class="btn btn--outline btn--sm" style="margin-top:1rem">
                ← Retour aux thématiques
              </a>
            </div>

          } @else if (!workshop.presenceFormEnabled) {
            <div class="state-center">
              <span style="font-size:2rem">⏳</span>
              <h2 style="margin-top:.75rem;font-size:1.125rem">Formulaire pas encore disponible</h2>
              <p style="margin-top:.375rem;color:var(--text-2);font-size:.875rem">
                L'administrateur n'a pas encore activé le formulaire de présence pour ce workshop.
              </p>
              <a routerLink="/etudiant/themes" class="btn btn--outline btn--sm" style="margin-top:1rem">
                ← Retour
              </a>
            </div>

          } @else if (alreadySubmitted) {
            <div class="success-card">
              <span class="success-card__icon">✅</span>
              <h2>Présence déjà enregistrée</h2>
              <p>Tu as déjà confirmé ta présence pour <strong>{{ workshop.themeTitle }}</strong>.</p>
              <a routerLink="/etudiant/themes" class="btn btn--outline btn--sm" style="margin-top:1.25rem">
                ← Retour aux thématiques
              </a>
            </div>

          } @else if (submitted) {
            <div class="success-card">
              <span class="success-card__icon">🎉</span>
              <h2>Présence confirmée !</h2>
              <p>Ta présence au workshop <strong>{{ workshop.themeTitle }}</strong> a bien été enregistrée.</p>
              <a routerLink="/etudiant/themes" class="btn btn--primary" style="margin-top:1.25rem">
                ← Retour aux thématiques
              </a>
            </div>

          } @else {
            <!-- Header -->
            <div class="presence__back">
              <a routerLink="/etudiant/themes" class="btn btn--ghost btn--sm">← Retour</a>
            </div>

            <div class="presence__header">
              <div class="presence__tag font-mono">FORMULAIRE DE PRÉSENCE</div>
              <h1 class="presence__title">{{ workshop.themeTitle }}</h1>
              <p class="presence__sub">
                Par {{ workshop.presenter }} · {{ workshop.duration }} min · {{ workshop.location }}
              </p>
            </div>

            <form [formGroup]="form" (ngSubmit)="submit()" class="presence-form">

              <!-- Infos auto-remplies -->
              <div class="form-section">
                <div class="form-section__label">Informations personnelles</div>
                <div class="form-grid">
                  <div class="form-group">
                    <label class="form-label">Nom complet</label>
                    <input type="text" class="form-control" [value]="user?.displayName" disabled />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" class="form-control" [value]="user?.email" disabled />
                  </div>
                </div>
              </div>

              <!-- Champs dynamiques configurés par l'admin -->
              @if (workshop.presenceFormConfig?.fields?.length) {
                <div class="form-section">
                  <div class="form-section__label">Informations complémentaires</div>

                  @for (field of workshop.presenceFormConfig!.fields; track field.id) {
                    <div class="form-group">
                      <label class="form-label">
                        {{ field.label }}
                        @if (field.required) { <span class="form-required">*</span> }
                      </label>

                      @switch (field.type) {
                        @case ('text') {
                          <input [formControlName]="field.id" type="text"
                            class="form-control"
                            [class.form-control--error]="isFieldInvalid(field.id)"
                            [placeholder]="field.placeholder ?? ''" />
                        }
                        @case ('email') {
                          <input [formControlName]="field.id" type="email"
                            class="form-control"
                            [class.form-control--error]="isFieldInvalid(field.id)"
                            [placeholder]="field.placeholder ?? ''" />
                        }
                        @case ('number') {
                          <input [formControlName]="field.id" type="number"
                            class="form-control"
                            [class.form-control--error]="isFieldInvalid(field.id)"
                            [placeholder]="field.placeholder ?? ''" />
                        }
                        @case ('textarea') {
                          <textarea [formControlName]="field.id"
                            class="form-control"
                            [class.form-control--error]="isFieldInvalid(field.id)"
                            rows="3" [placeholder]="field.placeholder ?? ''"></textarea>
                        }
                        @case ('select') {
                          <select [formControlName]="field.id"
                            class="form-control"
                            [class.form-control--error]="isFieldInvalid(field.id)">
                            <option value="">Sélectionner…</option>
                            @for (opt of field.options; track opt) {
                              <option [value]="opt">{{ opt }}</option>
                            }
                          </select>
                        }
                        @case ('checkbox') {
                          <label class="checkbox-label">
                            <input [formControlName]="field.id" type="checkbox" class="checkbox" />
                            <span>{{ field.placeholder || field.label }}</span>
                          </label>
                        }
                      }

                      @if (isFieldInvalid(field.id)) {
                        <span class="form-error">Ce champ est obligatoire</span>
                      }
                    </div>
                  }
                </div>
              }

              @if (error) {
                <div class="alert alert--error">{{ error }}</div>
              }

              <button type="submit" class="btn btn--primary btn--full btn--lg" [disabled]="saving">
                @if (saving) {
                  <span class="spinner" style="width:16px;height:16px;border-width:2px"></span>
                  Enregistrement…
                } @else {
                  ✓ Confirmer ma présence
                }
              </button>
            </form>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .presence {
      max-width: 580px;
      margin: 0 auto;
      padding-top: 1.5rem;
      padding-bottom: 3rem;

      &__back { margin-bottom: 1.25rem; }

      &__header { margin-bottom: 2rem; }

      &__tag {
        font-size: .7rem; color: var(--cyan);
        letter-spacing: .12em; margin-bottom: .5rem;
      }

      &__title { font-size: 1.375rem; font-weight: 700; margin-bottom: .375rem; }

      &__sub { font-size: .875rem; color: var(--text-2); }
    }

    .presence-form { display: flex; flex-direction: column; gap: 1rem; }

    .form-section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 1.25rem 1.5rem;
      display: flex; flex-direction: column; gap: 1rem;

      &__label {
        font-size: .7rem; font-family: var(--font-mono);
        color: var(--text-3); letter-spacing: .1em; text-transform: uppercase;
      }
    }

    .checkbox-label {
      display: flex; align-items: center; gap: .625rem;
      cursor: pointer; font-size: .9375rem; color: var(--text);
    }

    .checkbox {
      width: 16px; height: 16px;
      border-radius: 3px; cursor: pointer; accent-color: var(--accent);
    }

    .state-center {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: 5rem 2rem; text-align: center;
    }

    .success-card {
      background: var(--green-dim);
      border: 1px solid rgba(16,185,129,.25);
      border-radius: var(--radius-xl);
      padding: 3rem 2rem; text-align: center;
      animation: fadeUp .4s ease both;
      display: flex; flex-direction: column; align-items: center;

      &__icon { font-size: 2.5rem; margin-bottom: 1rem; }
      h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: .5rem; }
      p { font-size: .9rem; color: var(--text-2); max-width: 320px; }
    }
  `]
})
export class PresenceComponent implements OnInit {
  private route = inject(ActivatedRoute);
  public router = inject(Router);
  private fb = inject(FormBuilder);
  private wsService = inject(WorkshopService);
  private authService = inject(AuthService);

  workshop: Workshop | null = null;
  form: FormGroup = this.fb.group({});
  loading = true;
  saving = false;
  submitted = false;
  alreadySubmitted = false;
  error = '';

  get user() { return this.authService.currentUser; }

  async ngOnInit() {
    const workshopId = this.route.snapshot.params['workshopId'];

    // ✅ Récupère via onSnapshot (1 émission suffit)
    const workshop = await new Promise<Workshop | null>(resolve => {
      const sub = this.wsService.getWorkshops().subscribe(list => {
        const found = list.find(w => w.id === workshopId) ?? null;
        resolve(found);
        sub.unsubscribe();
      });
    });

    this.workshop = workshop;

    if (workshop?.presenceFormEnabled && workshop.presenceFormConfig?.fields?.length) {
      const controls: Record<string, unknown[]> = {};
      for (const field of workshop.presenceFormConfig.fields) {
        const validators = field.required ? [Validators.required] : [];
        controls[field.id] = [field.type === 'checkbox' ? false : '', validators];
      }
      this.form = this.fb.group(controls);
    }

    // Vérifie si déjà soumis
    if (workshop && this.user) {
      const presences = await new Promise<any[]>(resolve => {
        const sub = this.wsService.getPresences(workshopId).subscribe(list => {
          resolve(list);
          sub.unsubscribe();
        });
      });
      this.alreadySubmitted = presences.some(p => p.userId === this.user!.uid);
    }

    this.loading = false;
  }

  isFieldInvalid(fieldId: string): boolean {
    const c = this.form.get(fieldId);
    return !!(c?.invalid && c?.touched);
  }

  async submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    this.error = '';
    const user = this.user!;
    try {
      await this.wsService.submitPresence({
        workshopId: this.workshop!.id!,
        userId: user.uid,
        userName: user.displayName,
        userEmail: user.email,
        checkedInAt: new Date(),
        responses: this.form.value
      });
      this.submitted = true;
    } catch {
      this.error = 'Erreur lors de l\'enregistrement. Réessaie.';
    } finally {
      this.saving = false;
    }
  }
}
