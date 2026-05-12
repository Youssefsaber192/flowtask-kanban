import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Customer } from '../models/customer.model';

@Injectable({
  providedIn: 'root',
})
export class CustomersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/customers`;

  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(this.apiUrl);
  }

  getCustomerById(id: string): Observable<Customer> {
    return this.http.get<Customer>(`${this.apiUrl}/${id}`);
  }
}