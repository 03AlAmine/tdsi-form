// app.component.ts
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './features/shared/components/toast/toast.component';
import { GlobalLoaderComponent } from "./features/shared/components/global-loader/global-loader.component";
import { MobileBlurService } from './core/services/mobile-blur.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent, GlobalLoaderComponent],
  template: `
    <router-outlet />
    <app-toast />
    <app-global-loader />
  `,
})
export class AppComponent implements OnInit {
  constructor(private mobileBlurService: MobileBlurService) {}

  ngOnInit(): void {
    // Le service s'initialise automatiquement
    // Il détecte la taille de l'écran et applique le blur si nécessaire
  }
}
