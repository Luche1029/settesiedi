import { Injectable } from '@angular/core';
import { supabase } from '../../../supabase/supabase.client';

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  async createPaypalTopup(userId: string, amount: number) {
    const { data, error } = await supabase.functions.invoke('payments-paypal-create', {
      body: { user_id: userId, amount }        // il client aggiunge già Authorization/apikey
    });
    if (error) throw error;
    return data as { id: string; approvalUrl: string };
  }
}
