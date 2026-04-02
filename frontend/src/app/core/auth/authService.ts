import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UserDto,
  UserInfo,
} from '../models/auth.model';

const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_ID_KEY = 'userId';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _token$ = new BehaviorSubject<string | null>(null);

  readonly isAuthenticated$ = this._token$.pipe(map((t) => !!t));

  readonly currentUser$ = this._token$.pipe(
    map((token) => {
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1])) as UserInfo;
      return payload;
    }),
  );

  login(dto: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, dto).pipe(
      tap((res) => {
        this._token$.next(res.accessToken);
        sessionStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
        sessionStorage.setItem(USER_ID_KEY, res.user.id);
      }),
    );
  }

  register(dto: RegisterRequest): Observable<UserDto> {
    return this.http.post<UserDto>(`${environment.apiUrl}/auth/register`, dto);
  }

  logout(): void {
    const token = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    const userId = sessionStorage.getItem(USER_ID_KEY);

    if (token && userId) {
      this.http
        .post(`${environment.apiUrl}/auth/logout`, { token, userId })
        .subscribe({ error: () => {} });
    }

    this._token$.next(null);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(USER_ID_KEY);
    this.router.navigate(['/login']);
  }

  refreshAccessToken(): Observable<AuthResponse> {
    const token = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    const userId = sessionStorage.getItem(USER_ID_KEY);

    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, { token, userId })
      .pipe(
        tap((res) => {
          this._token$.next(res.accessToken);
          sessionStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
        }),
      );
  }

  getAccessToken(): string | null {
    return this._token$.getValue();
  }
}
