import { HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './authService';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error) => {
      if (error.status !== HttpStatusCode.Unauthorized) {
        return throwError(() => error);
      }

      return authService.refreshAccessToken().pipe(
        switchMap((res) => {
          const retryReq = req.clone({
            setHeaders: { Authorization: `Bearer ${res.accessToken}` },
          });
          return next(retryReq);
        }),
        catchError((refreshError) => {
          authService.logout();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
