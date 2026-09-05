import { Routes } from '@angular/router';

/**
 * QrScanner feature, lazy-loaded via loadChildren from app.routes.ts.
 */
export const qrScannerRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./qr-scanner.component').then((m) => m.QrScannerComponent),
  },
];
