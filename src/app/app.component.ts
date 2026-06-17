// app.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './features/shared/components/toast/toast.component';
import { GlobalLoaderComponent } from './features/shared/components/global-loader/global-loader.component';
import { MobileBlurService } from './core/services/mobile-blur.service';
import { DevtoolsProtectionService } from './core/services/devtools-protection.service';

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
  // inject() évite toute ambiguïté sur le token d'injection
  private readonly mobileBlur  = inject(MobileBlurService);
  private readonly devtools    = inject(DevtoolsProtectionService);

  ngOnInit(): void {
    this.devtools.init();
  }
}
