import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ShellNavbarComponent } from '../shell-navbar/shell-navbar.component';
import { PublicFooterComponent } from '../../shared/components/public-footer/public-footer.component';
import { TechBackgroundComponent } from '../../shared/components/tech-background/tech-background.component';
import { ToastComponent } from '../../shared/components/toast/toast.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';

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
  ],
  templateUrl: './shell-layout.component.html',
  styleUrls: ['./shell-layout.component.scss'],
})
export class ShellLayoutComponent {}
