// admin-users.component.ts
import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../../../firebase.config';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';

interface User {
  uid: string;
  email: string;
  displayName: string;
  promo: string;
  role: 'student' | 'admin';
  createdAt: Date;
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss'],
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  users = signal<User[]>([]);
  loading = signal(true);
  searchTerm = signal('');
  filterRole = signal<'all' | 'student' | 'admin'>('all');
  currentPage = signal(1);
  pageSize = 10;

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
    if (role !== 'all') {
      result = result.filter(u => u.role === role);
    }

    return result;
  });

  paginatedUsers = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredUsers().slice(start, start + this.pageSize);
  });

  totalPages = computed(() => Math.ceil(this.filteredUsers().length / this.pageSize));

  stats = computed(() => ({
    total: this.users().length,
    students: this.users().filter(u => u.role === 'student').length,
    admins: this.users().filter(u => u.role === 'admin').length,
  }));

  async ngOnInit(): Promise<void> {
    await this.loadUsers();
  }

  ngOnDestroy(): void {}

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      const usersList: User[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          email: data['email'] || '',
          displayName: data['displayName'] || 'Inconnu',
          promo: data['promo'] || 'Non défini',
          role: data['role'] || 'student',
          createdAt: data['createdAt']?.toDate?.() || new Date(),
        };
      });

      this.users.set(usersList);
    } catch {
      this.toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      this.loading.set(false);
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  openRoleModal(user: User): void {
    this.selectedUser.set(user);
    this.selectedRole.set(user.role);
  }

  closeRoleModal(): void {
    this.selectedUser.set(null);
  }

  async updateRole(): Promise<void> {
    const user = this.selectedUser();
    if (!user) return;

    this.updatingRole.set(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        role: this.selectedRole(),
      });

      this.users.update(users =>
        users.map(u =>
          u.uid === user.uid ? { ...u, role: this.selectedRole() } : u
        )
      );

      this.toast.success(`Rôle de ${user.displayName} mis à jour`);
      this.closeRoleModal();
    } catch {
      this.toast.error('Erreur lors de la mise à jour du rôle');
    } finally {
      this.updatingRole.set(false);
    }
  }

  async suspendUser(user: User): Promise<void> {
    this.confirm.confirm({
      title: 'Suspendre l\'utilisateur',
      message: `Êtes-vous sûr de vouloir suspendre "${user.displayName}" ?`,
      type: 'danger',
      confirmText: 'Suspendre',
      cancelText: 'Annuler',
      onConfirm: async () => {
        // Implémenter la suspension (désactivation du compte)
        this.toast.info(`Utilisateur ${user.displayName} suspendu`);
      },
    });
  }
}
