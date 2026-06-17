// À ajouter dans core/model/models.ts

export type ArticleCategory =
  | 'Cybersécurité'
  | 'Intelligence Artificielle'
  | 'Développement Web'
  | 'Cloud & DevOps'
  | 'Cryptographie'
  | 'Réseaux'
  | 'Autre';

export interface Article {
  id?: string;
  title: string;
  summary: string;         // Résumé court (visible sur la liste)
  content: string;         // Contenu complet (Markdown ou HTML)
  category: ArticleCategory;
  tags: string[];
  coverImageUrl?: string;

  // Auteur (peut être anonyme si non connecté)
  authorId?: string;       // uid Firebase si connecté, null sinon
  authorName: string;
  authorEmail: string;     // Pour que l'admin puisse contacter

  status: 'en attente' | 'approuvé' | 'refusé';
  adminComment?: string;

  submittedAt: Date;
  publishedAt?: Date;
  updatedAt?: Date;

  readTimeMinutes?: number;
  views?: number;
}
