import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, map, of } from 'rxjs';

import { Customer } from '../../../../core/models/customer.model';
import {
  Invoice,
  InvoiceStatus,
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

@Component({
  selector: 'app-invoices-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './invoices-list.html',
  styleUrl: './invoices-list.css',
})
export class InvoicesList implements OnInit {
  private readonly customersService = inject(CustomersService);
  private readonly invoicesService = inject(InvoicesService);
  private readonly cdr = inject(ChangeDetectorRef);

  customers: Customer[] = [];
  invoices: InvoiceViewModel[] = [];

  searchTerm = '';
  selectedStatus: InvoiceStatus | 'all' = 'all';

  isLoading = false;
  errorMessage = '';

  readonly statusOptions: Array<InvoiceStatus | 'all'> = [
    'all',
    'paid',
    'partial',
    'unpaid',
    'overdue',
  ];

  ngOnInit(): void {
    this.loadInvoices();
  }

  get filteredInvoices(): InvoiceViewModel[] {
    const normalizedSearch = this.searchTerm.trim().toLowerCase();

    return this.invoices.filter((invoice) => {
      const matchesStatus =
        this.selectedStatus === 'all' || invoice.status === this.selectedStatus;

      const matchesSearch =
        !normalizedSearch ||
        invoice.invoiceNumber.toLowerCase().includes(normalizedSearch) ||
        invoice.customerName.toLowerCase().includes(normalizedSearch) ||
        invoice.customerCompany.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }

  loadInvoices(): void {
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
          console.error('Invoices API Error:', error);

          this.errorMessage =
            'Failed to load invoices. Please check MockAPI endpoints.';

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
        const safeCustomers = Array.isArray(customers) ? customers : [];
        const safeInvoices = Array.isArray(invoices) ? invoices : [];

        this.customers = safeCustomers;
        this.invoices = this.mapInvoicesToViewModel(
          safeInvoices,
          safeCustomers
        );

        this.cdr.detectChanges();
      });
  }

  recordPayment(invoice: InvoiceViewModel): void {
    const value = window.prompt(
      `Enter payment amount for ${invoice.invoiceNumber}`
    );

    if (!value) {
      return;
    }

    const paymentAmount = Number(value);

    if (!paymentAmount || paymentAmount <= 0) {
      window.alert('Please enter a valid payment amount.');
      return;
    }

    if (paymentAmount > invoice.remainingAmount) {
      window.alert('Payment amount cannot be greater than remaining amount.');
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.invoicesService
      .recordPayment(invoice, paymentAmount)
      .pipe(
        catchError((error) => {
          console.error('Record payment error:', error);
          this.errorMessage = 'Failed to record payment.';
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((updatedInvoice) => {
        if (!updatedInvoice) {
          return;
        }

        this.invoices = this.invoices.map((item) =>
          item.id === updatedInvoice.id
            ? this.mapInvoiceToViewModel(updatedInvoice, this.customers)
            : item
        );

        this.cdr.detectChanges();
      });
  }

  deleteInvoice(invoice: InvoiceViewModel): void {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${invoice.invoiceNumber}?`
    );

    if (!confirmed) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.invoicesService
      .deleteInvoice(invoice.id)
      .pipe(
        map(() => true),
        catchError((error) => {
          console.error('Delete invoice error:', error);
          this.errorMessage = 'Failed to delete invoice.';
          return of(false);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((isDeleted) => {
        if (!isDeleted) {
          return;
        }

        this.invoices = this.invoices.filter((item) => item.id !== invoice.id);
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

  getStatusLabel(status: InvoiceStatus): string {
    const labels: Record<InvoiceStatus, string> = {
      paid: 'Paid',
      partial: 'Partial',
      unpaid: 'Unpaid',
      overdue: 'Overdue',
    };

    return labels[status];
  }

  getStatusOptionLabel(status: InvoiceStatus | 'all'): string {
    if (status === 'all') {
      return 'All statuses';
    }

    return this.getStatusLabel(status);
  }

  private mapInvoicesToViewModel(
    invoices: Invoice[],
    customers: Customer[]
  ): InvoiceViewModel[] {
    return invoices.map((invoice) =>
      this.mapInvoiceToViewModel(invoice, customers)
    );
  }

  private mapInvoiceToViewModel(
    invoice: Invoice,
    customers: Customer[]
  ): InvoiceViewModel {
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
  }
}