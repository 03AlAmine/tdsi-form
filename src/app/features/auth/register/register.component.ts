import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  template: '',
})
export class RegisterComponent implements OnInit {
  private router = inject(Router);

  ngOnInit(): void {
    // Redirige vers la page login avec le switch activé
    this.router.navigate(['/inscription'], { replaceUrl: true });
  }
}
