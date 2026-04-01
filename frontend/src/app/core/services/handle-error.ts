import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';

export function handleError(operation: string): (err: HttpErrorResponse) => Observable<never> {
  return (err: HttpErrorResponse): Observable<never> => {
    console.error(`operation: ${operation} leads to err:${err}`);
    const msg = err.error?.message ?? 'something went wrong';
    return throwError(() => new Error(msg));
  };
}
