import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { Customer } from '../../../../core/models/customer.model';
import {
  Invoice,
  InvoiceViewModel,
} from '../../../../core/models/invoice.model';
import { CustomersService } from '../../../../core/services/customers.service';
import { InvoicesService } from '../../../../core/services/invoices.service';
import {
  getInvoiceAmount,
  getInvoicePaidAmount,
  getInvoiceStatus,
  getOverdueDays,
  getRemainingAmount,
} from '../../../../core/utils/invoice.utils';

interface DashboardStats {
  totalCustomers: number;
  totalInvoices: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  overdueInvoices: number;
  collectionRate: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private readonly customersService = inject(CustomersService);
  private readonly invoicesService = inject(InvoicesService);
  private readonly cdr = inject(ChangeDetectorRef);

  customers: Customer[] = [];
  invoices: InvoiceViewModel[] = [];

  isLoading = false;
  errorMessage = '';

  stats: DashboardStats = {
    totalCustomers: 0,
    totalInvoices: 0,
    totalAmount: 0,
    paidAmount: 0,
    outstandingAmount: 0,
    overdueInvoices: 0,
    collectionRate: 0,
  };

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    forkJoin({
      customers: this.customersService.getCustomers(),
      invoices: this.invoicesService.getInvoices(),
    })
      .pipe(
        catchError((error) => {
          console.error('Dashboard API Error:', error);

          this.errorMessage =
            'Failed to load dashboard data. Please check MockAPI endpoints.';

          return of({
            customers: [] as Customer[],
            invoices: [] as Invoice[],
          });
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe(({ customers, invoices }) => {
        console.log('API customers:', customers);
        console.log('API invoices:', invoices);

        const safeCustomers = Array.isArray(customers) ? customers : [];
        const safeInvoices = Array.isArray(invoices) ? invoices : [];

        this.customers = safeCustomers;

        this.invoices = this.mapInvoicesToViewModel(
          safeInvoices,
          safeCustomers
        );

        this.stats = this.calculateStats(this.invoices, safeCustomers);
        this.cdr.detectChanges();
      });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  }

  private mapInvoicesToViewModel(
    invoices: Invoice[],
    customers: Customer[]
  ): InvoiceViewModel[] {
    return invoices.map((invoice) => {
      const customer = customers.find(
        (item) => String(item.id) === String(invoice.customerId)
      );

      return {
        ...invoice,
        amount: getInvoiceAmount(invoice),
        paidAmount: getInvoicePaidAmount(invoice),
        customerName: customer?.name ?? 'Unknown Customer',
        customerCompany: customer?.company ?? 'Unknown Company',
        remainingAmount: getRemainingAmount(invoice),
        status: getInvoiceStatus(invoice),
        overdueDays: getOverdueDays(invoice),
      };
    });
  }

  private calculateStats(
    invoices: InvoiceViewModel[],
    customers: Customer[]
  ): DashboardStats {
    const totalAmount = invoices.reduce(
      (sum, invoice) => sum + invoice.amount,
      0
    );

    const paidAmount = invoices.reduce(
      (sum, invoice) => sum + invoice.paidAmount,
      0
    );

    const outstandingAmount = invoices.reduce(
      (sum, invoice) => sum + invoice.remainingAmount,
      0
    );

    const overdueInvoices = invoices.filter(
      (invoice) => invoice.status === 'overdue'
    ).length;

    const collectionRate =
      totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

    return {
      totalCustomers: customers.length,
      totalInvoices: invoices.length,
      totalAmount,
      paidAmount,
      outstandingAmount,
      overdueInvoices,
      collectionRate,
    };
  }
}