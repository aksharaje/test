import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // We need to wait for isLoading to be false
    return toObservable(authService.isLoading).pipe(
        filter(isLoading => !isLoading),
        take(1),
        map(() => {
            const isAuthenticated = authService.isAuthenticated();
            if (isAuthenticated) {
                return true;
            }

            return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
        })
    );
};
