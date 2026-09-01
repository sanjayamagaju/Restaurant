import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('authToken');
  if (!token) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Token ${token}` } }));
};
