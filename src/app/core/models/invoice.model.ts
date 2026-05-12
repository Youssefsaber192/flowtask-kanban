export type InvoiceStatus = 'paid' | 'partial' | 'unpaid' | 'overdue';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  createdAt: string;
}

export interface InvoiceViewModel extends Invoice {
  customerName: string;
  customerCompany: string;
  remainingAmount: number;
  status: InvoiceStatus;
  overdueDays: number;
}