import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { UserService } from '../../../core/services/user.service';
import { LoggerService } from '../../../core/services/logger.service';
import { User } from '../../../core/model/models';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss'],
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  private toast   = inject(ToastService);
  private confirm = inject(ConfirmService);
  private userSvc = inject(UserService);
  private logger  = inject(LoggerService);

  users       = signal<User[]>([]);
  loading     = signal(true);
  searchTerm  = signal('');
  filterRole  = signal<'all' | 'student' | 'admin'>('all');
  currentPage = signal(1);
  pageSize    = 10;

  selectedUser = signal<User | null>(null);
  selectedRole = signal<'student' | 'admin'>('student');
  updatingRole = signal(false);

  filteredUsers = computed(() => {
    let result = this.users();
    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      result = result.filter(u =>
        u.displayName?.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term)
      );
    }
    const role = this.filterRole();
    if (role !== 'all') result = result.filter(u => u.role === role);
    return result;
  });

  paginatedUsers = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredUsers().slice(start, start + this.pageSize);
  });

  totalPages = computed(() =>
    Math.ceil(this.filteredUsers().length / this.pageSize)
  );

  stats = computed(() => ({
    total:    this.users().length,
    students: this.users().filter(u => u.role === 'student').length,
    admins:   this.users().filter(u => u.role === 'admin').length,
  }));

  async ngOnInit(): Promise<void> { await this.loadUsers(); }
  ngOnDestroy(): void {}

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    try {
      this.users.set(await this.userSvc.getAllUsers());
    } catch (err) {
      this.logger.error('[AdminUsers] Erreur chargement:', err);
      this.toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      this.loading.set(false);
    }
  }

  prevPage(): void { if (this.currentPage() > 1) this.currentPage.update(p => p - 1); }
  nextPage(): void { if (this.currentPage() < this.totalPages()) this.currentPage.update(p => p + 1); }

  openRoleModal(user: User): void { this.selectedUser.set(user); this.selectedRole.set(user.role); }
  closeRoleModal(): void { this.selectedUser.set(null); }

  async updateRole(): Promise<void> {
    const user = this.selectedUser();
    if (!user) return;
    this.updatingRole.set(true);
    try {
      await this.userSvc.updateRole(user.uid, this.selectedRole());
      this.users.update(users =>
        users.map(u => u.uid === user.uid ? { ...u, role: this.selectedRole() } : u)
      );
      this.toast.success('Rôle de ' + user.displayName + ' mis à jour');
      this.closeRoleModal();
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
      message: 'Êtes-vous sûr de vouloir suspendre "' + user.displayName + '" ? Il ne pourra plus se connecter.',
      type: 'danger',
      confirmText: 'Suspendre',
      cancelText: 'Annuler',
      onConfirm: async () => {
        try {
          await this.userSvc.suspendUser(user.uid);
          this.users.update(users =>
            users.map(u => u.uid === user.uid ? { ...u, disabled: true } as any : u)
          );
          this.toast.warning(user.displayName + ' a été suspendu');
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
      message: 'Réactiver le compte de "' + user.displayName + '" ?',
      type: 'info',
      confirmText: 'Réactiver',
      cancelText: 'Annuler',
      onConfirm: async () => {
        try {
          await this.userSvc.reinstateUser(user.uid);
          this.users.update(users =>
            users.map(u => u.uid === user.uid ? { ...u, disabled: false } as any : u)
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
