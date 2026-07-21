// core/services/article.service.ts
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  increment,
} from 'firebase/firestore';
import { Observable, shareReplay, finalize, EMPTY } from 'rxjs';
import { db } from '../../../firebase.config';
import { Article } from '../model/article.model';

@Injectable({ providedIn: 'root' })
export class ArticleService {
  // ✅ SSR-safe : les listeners Firestore (onSnapshot) utilisent le
  // bundle navigateur de Firebase (window) — jamais au prerender.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));


  // ── Cache public : articles approuvés ──────────────────────────────────────
  private published$: Observable<Article[]> | null = null;

  getPublishedArticles(): Observable<Article[]> {
    if (!this.isBrowser) return EMPTY;

    if (!this.published$) {
      this.published$ = new Observable<Article[]>((observer) => {
        const ref = query(
          collection(db, 'articles'),
          where('status', '==', 'approuvé'),
          orderBy('publishedAt', 'desc'),
        );
        const unsub = onSnapshot(ref, (snap) => {
          observer.next(snap.docs.map(d => this.mapDoc(d)));
        }, err => observer.error(err));
        return () => unsub();
      }).pipe(
        shareReplay({ bufferSize: 1, refCount: true }),
        finalize(() => { this.published$ = null; }),
      );
    }
    return this.published$;
  }

  // ── Toutes les soumissions (admin) ─────────────────────────────────────────
  private all$: Observable<Article[]> | null = null;

  getAllArticles(): Observable<Article[]> {
    if (!this.isBrowser) return EMPTY;

    if (!this.all$) {
      this.all$ = new Observable<Article[]>((observer) => {
        const ref = query(
          collection(db, 'articles'),
          orderBy('submittedAt', 'desc'),
        );
        const unsub = onSnapshot(ref, (snap) => {
          observer.next(snap.docs.map(d => this.mapDoc(d)));
        }, err => observer.error(err));
        return () => unsub();
      }).pipe(
        shareReplay({ bufferSize: 1, refCount: true }),
        finalize(() => { this.all$ = null; }),
      );
    }
    return this.all$;
  }

  // ── Soumission publique (sans connexion) ───────────────────────────────────
  async submitArticle(article: Omit<Article, 'id' | 'status' | 'submittedAt'>): Promise<string> {
    const wordCount = article.content.trim().split(/\s+/).length;
    const ref = await addDoc(collection(db, 'articles'), {
      ...article,
      status: 'en attente',
      submittedAt: Timestamp.now(),
      readTimeMinutes: Math.max(1, Math.round(wordCount / 200)),
      views: 0,
    });
    return ref.id;
  }

  // ── Admin : approuver ──────────────────────────────────────────────────────
  async approveArticle(id: string, comment = ''): Promise<void> {
    await updateDoc(doc(db, 'articles', id), {
      status: 'approuvé',
      adminComment: comment,
      publishedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  // ── Admin : refuser ────────────────────────────────────────────────────────
  async refuseArticle(id: string, comment: string): Promise<void> {
    await updateDoc(doc(db, 'articles', id), {
      status: 'refusé',
      adminComment: comment,
      updatedAt: Timestamp.now(),
    });
  }

  // ── Admin : supprimer ──────────────────────────────────────────────────────
  async deleteArticle(id: string): Promise<void> {
    await deleteDoc(doc(db, 'articles', id));
  }

  // ── Incrémenter les vues ───────────────────────────────────────────────────
  async incrementViews(id: string): Promise<void> {
    await updateDoc(doc(db, 'articles', id), { views: increment(1) });
  }

  // ── Helper mapping ─────────────────────────────────────────────────────────
  private mapDoc(d: any): Article {
    const data = d.data();
    return {
      ...data,
      id: d.id,
      submittedAt: data.submittedAt?.toDate?.() ?? new Date(),
      publishedAt: data.publishedAt?.toDate?.() ?? undefined,
      updatedAt: data.updatedAt?.toDate?.() ?? undefined,
    } as Article;
  }
}
