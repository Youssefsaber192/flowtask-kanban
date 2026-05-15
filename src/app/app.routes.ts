import { Routes } from '@angular/router';

import { Dashboard } from './features/dashboard/pages/dashboard/dashboard';
import { InvoiceForm } from './features/invoices/pages/invoice-form/invoice-form';
import { InvoicesList } from './features/invoices/pages/invoices-list/invoices-list';

export const routes: Routes = [
  {
    path: '',
    component: Dashboard,
  },
  {
    path: 'invoices',
    component: InvoicesList,
  },
  {
    path: 'invoices/new',
    component: InvoiceForm,
  },
  {
    path: 'invoices/:id/edit',
    component: InvoiceForm,
  },
  {
    path: '**',
    redirectTo: '',
  },
];