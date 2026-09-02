import { CanActivateFn } from '@angular/router';
import { authGuard } from './auth.guard';

/**
 * Kitchen display access currently reuses plain staff authentication (no
 * user-role system exists yet). Once roles are introduced, tighten this to
 * require a 'kitchen' or 'admin' role instead of delegating to authGuard.
 */
export const kitchenGuard: CanActivateFn = (route, state) => authGuard(route, state);
