import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';

const TOKEN_KEY = 'authToken';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  isAuthenticated = () => !!this.token();

  constructor(private http: HttpClient) {}

  login(username: string, password: string) {
    return this.http
      .post<{ token: string; username: string }>(`${environment.apiUrl}/auth/login/`, {
        username,
        password,
      })
      .pipe(
        tap(({ token }) => {
          localStorage.setItem(TOKEN_KEY, token);
          this.token.set(token);
        }),
      );
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    this.token.set(null);
  }
}
