import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './features/shared/components/toast/toast.component';
import { GlobalLoaderComponent } from "./features/shared/components/global-loader/global-loader.component";

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
export class AppComponent {}
