// presence-config.component.ts - Version améliorée
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormArray, FormGroup, AbstractControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { WorkshopService } from '../../../core/services/workshop.service';
import { ToastService } from '../../../core/services/toast.service';
import { Workshop, PresenceField } from '../../../core/model/models';
import { db } from '../../../../firebase.config';
import { doc, getDoc } from 'firebase/firestore';
import {
  CdkDragDrop,
  moveItemInArray,
  DragDropModule
} from '@angular/cdk/drag-drop';

type FieldType = 'text' | 'email' | 'select' | 'checkbox' | 'textarea' | 'number';

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Texte court' },
  { value: 'textarea', label: 'Texte long' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Nombre' },
  { value: 'select', label: 'Liste déroulante' },
  { value: 'checkbox', label: 'Case à cocher' },
];

@Component({
  selector: 'app-presence-config',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DragDropModule
  ],
   templateUrl: './presence-config.component.html',
  styleUrls: ['./presence-config.component.scss']
})
export class PresenceConfigComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private wsService = inject(WorkshopService);
  private toast = inject(ToastService);

  workshop: Workshop | null = null;
  loading = true;
  saving = false;
  saved = false;
  error = '';
  fieldTypes = FIELD_TYPES;

  form = this.fb.group({
    presenceFormEnabled: [false],
    fields: this.fb.array([]),
  });

  get fields(): FormArray {
    return this.form.get('fields') as FormArray;
  }

  async ngOnInit(): Promise<void> {
    const workshopId = this.route.snapshot.params['workshopId'];

    try {
      const snap = await getDoc(doc(db, 'workshops', workshopId));

      if (snap.exists()) {
        const data: any = snap.data();
        this.workshop = {
          ...data,
          id: snap.id,
          date: data['date']?.toDate?.() ?? new Date(),
          createdAt: data['createdAt']?.toDate?.() ?? new Date(),
        } as Workshop;

        this.form.patchValue({
          presenceFormEnabled: this.workshop.presenceFormEnabled ?? false,
        });

        if (this.workshop.presenceFormConfig?.fields?.length) {
          for (const field of this.workshop.presenceFormConfig.fields) {
            this.fields.push(this.buildFieldGroup(field));
          }
        }
      }
    } catch {
      this.error = 'Erreur lors du chargement';
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy(): void {}

  buildFieldGroup(field?: Partial<PresenceField>): FormGroup {
    return this.fb.group({
      id: [field?.id ?? this.generateId()],
      label: [field?.label ?? '', Validators.required],
      type: [field?.type ?? 'text'],
      required: [field?.required ?? false],
      placeholder: [field?.placeholder ?? ''],
      optionsText: [field?.options?.join('\n') ?? ''],
    });
  }

  generateId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  addField(): void {
    this.fields.push(this.buildFieldGroup());
  }

  removeField(index: number): void {
    this.fields.removeAt(index);
  }

  onDrop(event: CdkDragDrop<AbstractControl[]>): void {
    // ✅ moveItemInArray sur fields.controls modifie directement le
    // tableau interne du FormArray, mais Angular Forms n'est pas notifié
    // de ce changement (pas de recalcul de validité, pas d'émission sur
    // valueChanges). On force la resynchronisation avec updateValueAndValidity()
    // pour que le FormArray reflète immédiatement le nouvel ordre.
    moveItemInArray(
      this.fields.controls,
      event.previousIndex,
      event.currentIndex,
    );
    this.fields.updateValueAndValidity();
  }

  toggleEnabled(): void {
    const current = this.form.get('presenceFormEnabled')?.value;
    this.form.patchValue({ presenceFormEnabled: !current });
  }

  goBack(): void {
    this.router.navigate(['/admin/workshops']);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Veuillez corriger les erreurs dans le formulaire');
      return;
    }

    this.saving = true;
    this.saved = false;
    this.error = '';

    const rawFields = this.form.value.fields as any[];
    const fields: PresenceField[] = rawFields.map(f => ({
      id: f.id,
      label: f.label,
      type: f.type as PresenceField['type'],
      required: f.required ?? false,
      placeholder: f.placeholder ?? '',
      options: f.type === 'select' && f.optionsText
        ? f.optionsText.split('\n').map((s: string) => s.trim()).filter(Boolean)
        : undefined,
    }));

    try {
      await this.wsService.updateWorkshop(this.workshop!.id!, {
        presenceFormEnabled: this.form.value.presenceFormEnabled!,
        presenceFormConfig: {
          fields,
          requirePhoto: false,
          sendConfirmation: false,
        },
      });
      this.saved = true;
      this.toast.success('Configuration sauvegardée');
      setTimeout(() => {
        this.saved = false;
      }, 3000);
    } catch {
      this.error = 'Erreur lors de la sauvegarde. Réessayez.';
      this.toast.error(this.error);
    } finally {
      this.saving = false;
    }
  }
}
