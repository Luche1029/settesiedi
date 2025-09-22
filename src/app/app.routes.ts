import { Routes } from '@angular/router';
import { AuthGuard } from './services/auth.guard';

export const routes: Routes = [
    { path: 'login', loadComponent: () => 
        import('./pages/auth/login-grid/login-grid').then(m => m.LoginGrid) 
    },  
    { path: 'menus', canActivate: [AuthGuard], loadComponent: () => 
        import('./pages/menus/weekly-menus/weekly-menus').then(m => m.WeeklyMenus) 
    },
    { path: 'menus/:id', canActivate: [AuthGuard], loadComponent: () => 
        import('./pages/menus/menu-detail/menu-detail').then(m => m.MenuDetail) 
    },
    { path: 'proposals', canActivate: [AuthGuard], loadComponent: () => 
        import('./pages/proposals/proposals-list/proposals-list').then(m => m.ProposalsList)
    },
    { path: 'proposals/new', canActivate: [AuthGuard], loadComponent: () => 
        import('./pages/proposals/proposal-form/proposal-form').then(m => m.ProposalForm) 
    },
    { path: 'proposals/:id', canActivate: [AuthGuard], loadComponent: () => 
        import('./pages/proposals/proposal-edit/proposal-edit').then(m => m.ProposalEdit) 
    },
    { path: 'proposals/review', canActivate: [AuthGuard], loadComponent: () => 
        import('./pages/admin/proposals-review/proposals-review').then(m => m.ProposalsReview) 
    },  
    { path: 'expenses', loadComponent: () =>
      import('./pages/expenses/expenses-home/expenses-home').then(m => m.ExpensesHome)
    },
    { path: 'expenses/list', loadComponent: () =>
        import('./pages/expenses/expenses-list/expenses-list').then(m => m.ExpensesList)
    },
    { path: 'expenses/new', loadComponent: () =>
        import('./pages/expenses/expense-create/expense-create').then(m => m.ExpenseCreate)
    },
    { path: 'expenses/:id', loadComponent: () =>
        import('./pages/expenses/expense-detail/expense-detail').then(m => m.ExpenseDetail)
    },
    { path: 'balances', loadComponent: () =>
        import('./pages/expenses/balances-global/balances-global').then(m => m.BalancesGlobal)
    },
    { path: 'events/admin', canActivate: [AuthGuard], loadComponent: () => 
        import('./pages/admin/events-admin/events-admin').then(m => m.EventsAdmin) 
    },
    { path: 'auth/set-password', loadComponent: () => 
        import('./pages/auth/set-password/set-password').then(m => m.SetPassword)
    },
    {  path: 'shopping', loadComponent: () => 
        import('./pages/shopping/shopping-list-page/shopping-list-page').then(m => m.ShoppingListPage) 
    },
    { path: 'wallet/topup', loadComponent: () => 
        import('./pages/wallet/topup-page/topup-page').then(m => m.TopupPage) 
    },
    { path: '', redirectTo: '/login', pathMatch: 'full' }
];