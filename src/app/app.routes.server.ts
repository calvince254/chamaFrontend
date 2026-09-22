import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Dynamic routes with parameters should use client-side rendering
  {
    path: 'app/meetings/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'app/investments/:id',
    renderMode: RenderMode.Client
  },
  // All other routes can be prerendered
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
