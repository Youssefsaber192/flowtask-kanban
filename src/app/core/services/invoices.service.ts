import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Invoice } from '../models/invoice.model';

export type CreateInvoiceRequest = Omit<Invoice, 'id' | 'createdAt'>;
export type UpdateInvoiceRequest = Partial<Omit<Invoice, 'id'>>;

@Injectable({
  providedIn: 'root',
})
export class InvoicesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/invoices`;

  getInvoices(): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(this.apiUrl);
  }

  getInvoiceById(id: string): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.apiUrl}/${id}`);
  }

  createInvoice(invoice: CreateInvoiceRequest): Observable<Invoice> {
    return this.http.post<Invoice>(this.apiUrl, {
      ...invoice,
      createdAt: new Date().toISOString(),
    });
  }

  updateInvoice(id: string, invoice: UpdateInvoiceRequest): Observable<Invoice> {
    return this.http.patch<Invoice>(`${this.apiUrl}/${id}`, invoice);
  }

  deleteInvoice(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  recordPayment(invoice: Invoice, paymentAmount: number): Observable<Invoice> {
    const currentPaidAmount = Number(invoice.paidAmount) || 0;
    const invoiceAmount = Number(invoice.amount) || 0;

    const updatedPaidAmount = Math.min(
      currentPaidAmount + paymentAmount,
      invoiceAmount
    );

    return this.updateInvoice(invoice.id, {
      paidAmount: updatedPaidAmount,
    });
  }
}