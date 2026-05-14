// shell-layout.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ShellNavbarComponent } from '../shell-navbar/shell-navbar.component';
import { PublicFooterComponent } from '../../shared/components/public-footer/public-footer.component';
import { TechBackgroundComponent } from '../../shared/components/tech-background/tech-background.component';
import { ToastComponent } from '../../shared/components/toast/toast.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-shell-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    ShellNavbarComponent,
    PublicFooterComponent,
    TechBackgroundComponent,
    ToastComponent,
    ConfirmModalComponent,
    CommonModule,
  ],
  templateUrl: './shell-layout.component.html',
  styleUrls: ['./shell-layout.component.scss'],
})
export class ShellLayoutComponent implements OnInit {
  private authService = inject(AuthService);

  // ✅ Utiliser un signal pour la valeur réactive
  authReady = signal(false);

  ngOnInit(): void {
    // ✅ S'abonner à l'observable pour mettre à jour le signal
    this.authService.authReady$.subscribe(ready => {
      this.authReady.set(ready);
    });
  }
}
