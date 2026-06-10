// notes.component.ts

import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase.config';

@Component({
  selector: 'app-member-notes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './notes.component.html',
  styleUrls: ['./notes.component.scss'],
})
export class MemberNotesComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn;
  }

  user = this.authService.currentUser;

  notesContent   = signal('');
  userNotes      = signal('');
  notesEditing   = signal(false);
  lastNoteUpdate = signal(new Date());
  loading        = signal(true);
  saving         = signal(false);
  isFlipping     = signal(false);
  isOpening      = signal(false);

  private unsubscribeNotes: (() => void) | null = null;
  private t1: ReturnType<typeof setTimeout> | null = null;
  private t2: ReturnType<typeof setTimeout> | null = null;
  private t3: ReturnType<typeof setTimeout> | null = null;

  // ============================================================
  // LIFECYCLE
  // ============================================================

  ngOnInit(): void {
    if (this.isLoggedIn && this.user?.uid) {
      this.subscribeToNotes();
    } else {
      // Guest : pas de chargement nécessaire
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.unsubscribeNotes) this.unsubscribeNotes();
    [this.t1, this.t2, this.t3].forEach(t => t && clearTimeout(t));
  }

  // ============================================================
  // OUVERTURE — fonctionne pour connecté ET guest
  //
  // Séquence identique dans les deux cas :
  //  t=0ms   → feuilletage + superposition
  //  t=380ms → cahier ouvert (éditeur OU contenu guest)
  //  t=680ms → overlay retiré
  //  t=950ms → cahier fermé retiré du DOM
  // ============================================================

  triggerOpen(): void {
    // Si déjà ouvert
    if (this.notesEditing()) {
      if (this.isLoggedIn) {
        this.saveNotes();
      } else {
        this.cancelNotes(); // ferme simplement pour le guest
      }
      return;
    }

    if (this.isLoggedIn) {
      this.notesContent.set(this.userNotes());
    }

    this.isFlipping.set(true);
    this.isOpening.set(true);

    this.t1 = setTimeout(() => {
      this.notesEditing.set(true);
      this.t2 = setTimeout(() => {
        this.isFlipping.set(false);
        this.t3 = setTimeout(() => {
          this.isOpening.set(false);
        }, 270);
      }, 300);
    }, 380);
  }

  // ============================================================
  // SUBSCRIPTION FIRESTORE
  // ============================================================

  private subscribeToNotes(): void {
    if (!this.user?.uid) return;
    this.loading.set(true);
    const docRef = doc(db, 'user_notes', this.user.uid);

    this.unsubscribeNotes = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          this.userNotes.set(data['content'] || '');
          this.lastNoteUpdate.set(data['updatedAt']?.toDate() || new Date());
        } else {
          this.userNotes.set('');
        }
        this.loading.set(false);
      },
      (error) => {
        console.error('Erreur snapshot notes:', error);
        this.loading.set(false);
      }
    );
  }

  // ============================================================
  // GESTION DES NOTES
  // ============================================================

  async saveNotes(): Promise<void> {
    if (!this.isLoggedIn || !this.user?.uid) return;

    this.saving.set(true);
    try {
      const docRef = doc(db, 'user_notes', this.user.uid);
      await setDoc(docRef, {
        content: this.notesContent(),
        updatedAt: new Date(),
        userId: this.user.uid,
      });
      this.userNotes.set(this.notesContent());
      this.lastNoteUpdate.set(new Date());
      this.notesEditing.set(false);
      this.toastService.success('📝 Notes enregistrées avec succès');
    } catch (error) {
      console.error('Erreur sauvegarde notes:', error);
      this.toastService.error('❌ Erreur lors de la sauvegarde');
    } finally {
      this.saving.set(false);
    }
  }

  cancelNotes(): void {
    this.notesEditing.set(false);
    this.notesContent.set(this.userNotes());
  }

  notesWordCount(): number {
    const text = this.userNotes();
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
}
