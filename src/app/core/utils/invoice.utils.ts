import { Invoice, InvoiceStatus } from '../models/invoice.model';

export function getInvoiceAmount(invoice: Invoice): number {
  return Number(invoice.amount) || 0;
}

export function getInvoicePaidAmount(invoice: Invoice): number {
  return Number(invoice.paidAmount) || 0;
}

export function getRemainingAmount(invoice: Invoice): number {
  return Math.max(getInvoiceAmount(invoice) - getInvoicePaidAmount(invoice), 0);
}

export function getOverdueDays(invoice: Invoice): number {
  const remainingAmount = getRemainingAmount(invoice);

  if (remainingAmount <= 0) {
    return 0;
  }

  const today = new Date();
  const dueDate = new Date(invoice.dueDate);

  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - dueDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(diffDays, 0);
}

export function getInvoiceStatus(invoice: Invoice): InvoiceStatus {
  const amount = getInvoiceAmount(invoice);
  const paidAmount = getInvoicePaidAmount(invoice);
  const overdueDays = getOverdueDays(invoice);

  if (amount > 0 && paidAmount >= amount) {
    return 'paid';
  }

  if (overdueDays > 0) {
    return 'overdue';
  }

  if (paidAmount > 0 && paidAmount < amount) {
    return 'partial';
  }

  return 'unpaid';
}