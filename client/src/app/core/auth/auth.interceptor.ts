import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const router = inject(Router);
    const token = localStorage.getItem('access_token');

    if (token) {
        req = req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        });
    }

    return next(req).pipe(
        catchError(error => {
            if (error.status === 401 && !req.url.includes('/auth/login')) {
                // Auto logout on 401, unless it's the login endpoint itself failing
                localStorage.removeItem('access_token');
                router.navigate(['/auth/login']);
            }
            return throwError(() => error);
        })
    );
};
