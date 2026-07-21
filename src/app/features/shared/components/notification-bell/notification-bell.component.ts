// notification-bell.component.ts
import {
  Component, inject, signal, computed, OnInit, OnDestroy, HostListener, Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { AppNotification, NotificationType } from '../../../../core/model/models';

// ─────────────────────────────────────────────────────────────
// Cloche de notification réutilisable, montée à la fois dans
// la navbar membre (shell-navbar) et la sidebar admin
// (admin-layout). S'abonne en temps réel aux notifications du
// compte connecté via NotificationService.
// ─────────────────────────────────────────────────────────────
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-bell.component.html',
  styleUrls: ['./notification-bell.component.scss'],
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  // 'down' (défaut, navbar en haut d'écran) ou 'up' (sidebar en bas
  // d'écran, le panneau doit s'ouvrir vers le haut pour rester visible).
  @Input() openDirection: 'down' | 'up' = 'down';

  private subscription: Subscription | null = null;

  notifications = signal<AppNotification[]>([]);
  isOpen = signal(false);

  unreadCount = computed(
    () => this.notifications().filter((n) => !n.read).length,
  );

  // Badge plafonné à "9+" pour ne pas casser la mise en page
  badgeLabel = computed(() => {
    const count = this.unreadCount();
    return count > 9 ? '9+' : String(count);
  });

  ngOnInit(): void {
    const uid = this.authService.currentUser?.uid;
    if (!uid) return;
    this.subscription = this.notificationService
      .getNotifications(uid)
      .subscribe((notifications) => this.notifications.set(notifications));
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  toggle(): void {
    this.isOpen.update((v) => !v);
  }

  close(): void {
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.notification-bell')) {
      this.isOpen.set(false);
    }
  }

  async onNotificationClick(notification: AppNotification): Promise<void> {
    if (!notification.read && notification.id) {
      // Mise à jour optimiste pour un retour visuel immédiat
      this.notifications.update((list) =>
        list.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
      );
      try {
        await this.notificationService.markAsRead(notification.id);
      } catch (e) {
        console.error('Erreur markAsRead:', e);
      }
    }

    this.close();
    if (notification.link) {
      this.router.navigateByUrl(notification.link);
    }
  }

  async markAllAsRead(): Promise<void> {
    const current = this.notifications();
    this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
    try {
      await this.notificationService.markAllAsRead(current);
    } catch (e) {
      console.error('Erreur markAllAsRead:', e);
    }
  }

  async removeNotification(event: Event, notification: AppNotification): Promise<void> {
    event.stopPropagation();
    if (!notification.id) return;
    this.notifications.update((list) => list.filter((n) => n.id !== notification.id));
    try {
      await this.notificationService.deleteNotification(notification.id);
    } catch (e) {
      console.error('Erreur deleteNotification:', e);
    }
  }

  // ── Présentation ────────────────────────────────────────────
  iconFor(type: NotificationType): string {
    const map: Record<NotificationType, string> = {
      submission_approved: 'fa-circle-check',
      submission_refused: 'fa-circle-xmark',
      submission_received: 'fa-inbox',
      theme_created: 'fa-book-open',
      workshop_created: 'fa-calendar-plus',
      workshop_cancelled: 'fa-calendar-xmark',
      account_suspended: 'fa-triangle-exclamation',
      theme_interest_threshold: 'fa-thumbs-up',
      waitlist_promoted: 'fa-circle-check',
    };
    return map[type] ?? 'fa-bell';
  }

  colorClassFor(type: NotificationType): string {
    const map: Record<NotificationType, string> = {
      submission_approved: 'icon--success',
      submission_refused: 'icon--danger',
      submission_received: 'icon--info',
      theme_created: 'icon--info',
      workshop_created: 'icon--info',
      workshop_cancelled: 'icon--warning',
      account_suspended: 'icon--danger',
      theme_interest_threshold: 'icon--success',
      waitlist_promoted: 'icon--success',
    };
    return map[type] ?? 'icon--info';
  }

  timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "à l'instant";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `il y a ${days} j`;
    return date.toLocaleDateString('fr-FR');
  }
}
