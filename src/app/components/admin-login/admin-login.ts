import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-login',
  imports: [FormsModule],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.css',
})
export class AdminLogin {
  private authService = inject(AuthService);
  private router = inject(Router);

  username = '';
  password = '';
  error = signal('');

  login() {
    this.error.set('');
    this.authService.login(this.username, this.password).subscribe({
      next: () => this.router.navigateByUrl('/admin'),
      error: () => this.error.set('Invalid username or password'),
    });
  }
}
