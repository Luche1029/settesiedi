import { Routes } from '@angular/router';
import { Login} from './pages/login/login'
import { ProposalForm } from './pages/proposals/proposal-form/proposal-form'
import { ProposalsList }  from './pages/proposals/proposals-list/proposals-list'
import { AuthGuard } from './services/auth.guard';
import { ProposalsReview } from './pages/admin/proposals-review/proposals-review';
import { EventsAdmin } from './pages/admin/events-admin/events-admin';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.Login) },
  { path: 'menus', canActivate: [AuthGuard], loadComponent: () => import('./pages/menus/weekly-menus/weekly-menus').then(m => m.WeeklyMenus) },
  { path: 'proposals', canActivate: [AuthGuard], loadComponent: () => import('./pages/proposals/proposals-list/proposals-list').then(m => m.ProposalsList) },
  { path: 'proposals/new', canActivate: [AuthGuard], loadComponent: () => import('./pages/proposals/proposal-form/proposal-form').then(m => m.ProposalForm) },
  { path: 'proposals/review', canActivate: [AuthGuard], loadComponent: () => import('./pages/admin/proposals-review/proposals-review').then(m => m.ProposalsReview) },  
  { path: 'events/admin', canActivate: [AuthGuard], loadComponent: () => import('./pages/admin/events-admin/events-admin').then(m => m.EventsAdmin) },
  { path: '', redirectTo: '/login', pathMatch: 'full' }
];