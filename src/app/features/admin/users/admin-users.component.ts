import {
  Component, inject, signal, computed, OnInit
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService }   from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { UserService }    from '../../../core/services/user.service';
import { WorkshopService }from '../../../core/services/workshop.service';
import { LoggerService }  from '../../../core/services/logger.service';
import { User, Workshop } from '../../../core/model/models';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss'],
})
export class AdminUsersComponent implements OnInit {
  private toast      = inject(ToastService);
  private confirm    = inject(ConfirmService);
  private userSvc    = inject(UserService);
  private workshopSvc= inject(WorkshopService);
  private logger     = inject(LoggerService);

  // ── State ──────────────────────────────────────────────────
  today       = new Date();
  users       = signal<User[]>([]);
  workshops   = signal<Workshop[]>([]);
  loading     = signal(true);
  searchTerm  = signal('');
  filterRole  = signal<'all' | 'student' | 'admin'>('all');
  filterPromo = signal<string>('all');
  currentPage = signal(1);
  pageSize    = 12;

  // Panel détail
  selectedUser   = signal<User | null>(null);
  panelMode      = signal<'detail' | 'role'>('detail');
  selectedRole   = signal<'student' | 'admin'>('student');
  updatingRole   = signal(false);

  // ── Computed ───────────────────────────────────────────────
  promos = computed(() => {
    const all = this.users().map(u => u.promo).filter(Boolean) as string[];
    return ['all', ...Array.from(new Set(all)).sort()];
  });

  filteredUsers = computed(() => {
    let result = this.users();
    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      result = result.filter(u =>
        u.displayName?.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.promo ?? '').toLowerCase().includes(term)
      );
    }
    if (this.filterRole() !== 'all')
      result = result.filter(u => u.role === this.filterRole());
    if (this.filterPromo() !== 'all')
      result = result.filter(u => u.promo === this.filterPromo());
    return result;
  });

  paginatedUsers = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredUsers().slice(start, start + this.pageSize);
  });

  totalPages = computed(() =>
    Math.ceil(this.filteredUsers().length / this.pageSize)
  );

  stats = computed(() => {
    const all = this.users();
    const promoMap = new Map<string, number>();
    all.forEach(u => {
      const p = u.promo || 'N/A';
      promoMap.set(p, (promoMap.get(p) ?? 0) + 1);
    });
    return {
      total:    all.length,
      students: all.filter(u => u.role === 'student').length,
      admins:   all.filter(u => u.role === 'admin').length,
      promos:   Array.from(promoMap.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([promo, count]) => ({ promo, count })),
    };
  });

  // Ateliers auxquels l'utilisateur sélectionné a participé
  userWorkshops = computed(() => {
    const user = this.selectedUser();
    if (!user) return [];
    return this.workshops().filter(w =>
      w.registrations?.includes(user.uid)
    ).sort((a, b) => b.date.getTime() - a.date.getTime());
  });

  userStats = computed(() => {
    const ws = this.userWorkshops();
    return {
      total: ws.length,
      completed: ws.filter(w => new Date(w.date) < new Date()).length,
      upcoming:  ws.filter(w => new Date(w.date) >= new Date()).length,
    };
  });

  // ── Lifecycle ──────────────────────────────────────────────
  async ngOnInit(): Promise<void> { await this.loadData(); }

  async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const [users, workshops] = await Promise.all([
        this.userSvc.getAllUsers(),
        firstValueFrom(this.workshopSvc.getWorkshops()),
      ]);
      this.users.set(users);
      this.workshops.set(workshops);
    } catch (err) {
      this.logger.error('[AdminUsers] Erreur chargement:', err);
      this.toast.error('Erreur lors du chargement');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Navigation ─────────────────────────────────────────────
  prevPage(): void { if (this.currentPage() > 1) this.currentPage.update(p => p - 1); }
  nextPage(): void { if (this.currentPage() < this.totalPages()) this.currentPage.update(p => p + 1); }

  // ── Panel détail ───────────────────────────────────────────
  openUserDetail(user: User): void {
    this.selectedUser.set(user);
    this.selectedRole.set(user.role);
    this.panelMode.set('detail');
  }

  closePanel(): void { this.selectedUser.set(null); }

  openRoleEdit(): void { this.panelMode.set('role'); }
  backToDetail(): void { this.panelMode.set('detail'); }

  getInitials(name: string): string {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  // ── Actions ────────────────────────────────────────────────
  async updateRole(): Promise<void> {
    const user = this.selectedUser();
    if (!user) return;
    this.updatingRole.set(true);
    try {
      await this.userSvc.updateRole(user.uid, this.selectedRole());
      this.users.update(us =>
        us.map(u => u.uid === user.uid ? { ...u, role: this.selectedRole() } : u)
      );
      this.selectedUser.set({ ...user, role: this.selectedRole() });
      this.toast.success('Rôle de ' + user.displayName + ' mis à jour');
      this.panelMode.set('detail');
    } catch (err) {
      this.logger.error('[AdminUsers] Erreur rôle:', err);
      this.toast.error('Erreur lors de la mise à jour du rôle');
    } finally {
      this.updatingRole.set(false);
    }
  }

  async suspendUser(user: User): Promise<void> {
    this.confirm.confirm({
      title: "Suspendre l'utilisateur",
      message: `Suspendre "${user.displayName}" ? Il ne pourra plus se connecter.`,
      type: 'danger', confirmText: 'Suspendre', cancelText: 'Annuler',
      onConfirm: async () => {
        try {
          await this.userSvc.suspendUser(user.uid);
          this.users.update(us =>
            us.map(u => u.uid === user.uid ? { ...u, disabled: true } as any : u)
          );
          this.toast.warning(user.displayName + ' a été suspendu');
          this.closePanel();
        } catch (err) {
          this.logger.error('[AdminUsers] Erreur suspension:', err);
          this.toast.error('Erreur lors de la suspension');
        }
      },
    });
  }

  async reinstateUser(user: User): Promise<void> {
    this.confirm.confirm({
      title: "Réactiver l'utilisateur",
      message: `Réactiver le compte de "${user.displayName}" ?`,
      type: 'info', confirmText: 'Réactiver', cancelText: 'Annuler',
      onConfirm: async () => {
        try {
          await this.userSvc.reinstateUser(user.uid);
          this.users.update(us =>
            us.map(u => u.uid === user.uid ? { ...u, disabled: false } as any : u)
          );
          this.toast.success(user.displayName + ' a été réactivé');
        } catch (err) {
          this.logger.error('[AdminUsers] Erreur réactivation:', err);
          this.toast.error('Erreur lors de la réactivation');
        }
      },
    });
  }
}
