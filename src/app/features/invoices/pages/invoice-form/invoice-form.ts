import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { Customer } from '../../../../core/models/customer.model';
import { Invoice } from '../../../../core/models/invoice.model';
import { CustomersService } from '../../../../core/services/customers.service';
import { InvoicesService } from '../../../../core/services/invoices.service';

@Component({
  selector: 'app-invoice-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './invoice-form.html',
  styleUrl: './invoice-form.css',
})
export class InvoiceForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly customersService = inject(CustomersService);
  private readonly invoicesService = inject(InvoicesService);

  customers: Customer[] = [];

  isLoading = false;
  isSubmitting = false;
  errorMessage = '';

  private readonly invoiceId = this.route.snapshot.paramMap.get('id');

  readonly invoiceForm = this.fb.nonNullable.group({
    invoiceNumber: ['', [Validators.required]],
    customerId: ['', Validators.required],
    issueDate: ['', Validators.required],
    dueDate: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(1)]],
    paidAmount: [0, [Validators.required, Validators.min(0)]],
  });

  get isEditMode(): boolean {
    return Boolean(this.invoiceId);
  }

  get pageTitle(): string {
    return this.isEditMode ? 'Edit Invoice' : 'Add Invoice';
  }

  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    if (this.isEditMode && this.invoiceId) {
      forkJoin({
        customers: this.customersService.getCustomers(),
        invoice: this.invoicesService.getInvoiceById(this.invoiceId),
      })
        .pipe(
          catchError((error) => {
            console.error('Invoice form loading error:', error);
            this.errorMessage = 'Failed to load invoice data.';

            return of({
              customers: [] as Customer[],
              invoice: null as Invoice | null,
            });
          }),
          finalize(() => {
            this.isLoading = false;
            this.cdr.detectChanges();
          })
        )
        .subscribe(({ customers, invoice }) => {
          this.customers = Array.isArray(customers) ? customers : [];

          if (invoice) {
            this.patchForm(invoice);
          }
        });

      return;
    }

    forkJoin({
      customers: this.customersService.getCustomers(),
      invoices: this.invoicesService.getInvoices(),
    })
      .pipe(
        catchError((error) => {
          console.error('Invoice form loading error:', error);
          this.errorMessage = 'Failed to load invoice form data.';

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
        this.customers = Array.isArray(customers) ? customers : [];

        const safeInvoices = Array.isArray(invoices) ? invoices : [];
        const generatedInvoiceNumber =
          this.generateNextInvoiceNumber(safeInvoices);

        this.invoiceForm.patchValue({
          invoiceNumber: generatedInvoiceNumber,
          issueDate: this.getTodayDate(),
          dueDate: this.getDefaultDueDate(),
          paidAmount: 0,
        });

        this.cdr.detectChanges();
      });
  }

  submitForm(): void {
    this.errorMessage = '';

    if (this.invoiceForm.invalid) {
      this.invoiceForm.markAllAsTouched();
      return;
    }

    const formValue = this.invoiceForm.getRawValue();

    const amount = Number(formValue.amount) || 0;
    const paidAmount = Number(formValue.paidAmount) || 0;

    if (paidAmount > amount) {
      this.errorMessage = 'Paid amount cannot be greater than invoice amount.';
      return;
    }

    if (new Date(formValue.dueDate) < new Date(formValue.issueDate)) {
      this.errorMessage = 'Due date cannot be earlier than issue date.';
      return;
    }

    const payload = {
      invoiceNumber: formValue.invoiceNumber.trim(),
      customerId: formValue.customerId,
      issueDate: formValue.issueDate,
      dueDate: formValue.dueDate,
      amount,
      paidAmount,
    };

    this.isSubmitting = true;
    this.cdr.detectChanges();

    const request =
      this.isEditMode && this.invoiceId
        ? this.invoicesService.updateInvoice(this.invoiceId, payload)
        : this.invoicesService.createInvoice(payload);

    request
      .pipe(
        catchError((error) => {
          console.error('Save invoice error:', error);
          this.errorMessage = 'Failed to save invoice.';
          return of(null);
        }),
        finalize(() => {
          this.isSubmitting = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((invoice) => {
        if (!invoice) {
          return;
        }

        this.router.navigate(['/invoices']);
      });
  }

  isFieldInvalid(fieldName: keyof typeof this.invoiceForm.controls): boolean {
    const control = this.invoiceForm.controls[fieldName];

    return control.invalid && (control.dirty || control.touched);
  }

  private patchForm(invoice: Invoice): void {
    this.invoiceForm.patchValue({
      invoiceNumber: invoice.invoiceNumber,
      customerId: String(invoice.customerId),
      issueDate: this.toDateInput(invoice.issueDate),
      dueDate: this.toDateInput(invoice.dueDate),
      amount: Number(invoice.amount) || 0,
      paidAmount: Number(invoice.paidAmount) || 0,
    });
  }

  private generateNextInvoiceNumber(invoices: Invoice[]): string {
    const currentYear = new Date().getFullYear();

    const invoiceNumbers = invoices
      .map((invoice) => invoice.invoiceNumber)
      .filter(Boolean)
      .map((invoiceNumber) => {
        const match = invoiceNumber.match(/^INV-(\d{4})-(\d+)$/);

        if (!match) {
          return null;
        }

        const year = Number(match[1]);
        const sequence = Number(match[2]);

        return year === currentYear ? sequence : null;
      })
      .filter((sequence): sequence is number => sequence !== null);

    const nextSequence =
      invoiceNumbers.length > 0
        ? Math.max(...invoiceNumbers) + 1
        : invoices.length + 1;

    return `INV-${currentYear}-${String(nextSequence).padStart(3, '0')}`;
  }

  private getTodayDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getDefaultDueDate(): string {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    return dueDate.toISOString().slice(0, 10);
  }

  private toDateInput(value: string): string {
    if (!value) {
      return '';
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      return value.slice(0, 10);
    }

    return parsedDate.toISOString().slice(0, 10);
  }
}