import { Routes } from '@angular/router';
import { Login} from './pages/login/login'
import { AuthGuard } from './services/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.Login) },
  { path: 'menus', canActivate: [AuthGuard], loadComponent: () => import('./pages/menus/weekly-menus/weekly-menus').then(m => m.WeeklyMenus) },
  { path: '', redirectTo: '/login', pathMatch: 'full' }
];