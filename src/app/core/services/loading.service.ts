import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private loading = signal(false);
  private message = signal('Chargement...');

  // Messages personnalisables
  private messages = [
    'Chargement...',
    'Préparation de ton espace...',
    'Connexion au serveur...',
    'Bientôt prêt...',
    'Finalisation...'
  ];
  private messageIndex = 0;
  private intervalId: any = null;

  isLoading() {
    return this.loading();
  }

  getMessage() {
    return this.message();
  }

  show(customMessage?: string) {
    this.loading.set(true);

    if (customMessage) {
      this.message.set(customMessage);
    } else {
      this.startMessageRotation();
    }
  }

  hide() {
    this.loading.set(false);
    this.stopMessageRotation();
    this.message.set('Chargement...');
    this.messageIndex = 0;
  }

  private startMessageRotation() {
    this.stopMessageRotation();
    this.intervalId = setInterval(() => {
      this.messageIndex = (this.messageIndex + 1) % this.messages.length;
      this.message.set(this.messages[this.messageIndex]);
    }, 2500);
  }

  private stopMessageRotation() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
