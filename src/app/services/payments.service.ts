import { Injectable, inject } from '@angular/core';
import { supabase } from '../../../supabase/supabase.client';


@Injectable({ providedIn: 'root' })
export class PaymentsService {


  // CREATE: ritorna { id, approvalUrl }
  async createPaypalTopup(userId: string, amount: number, currency = 'EUR') {
    // DEBUG: vedi cosa stai per inviare
    console.log('createPaypalTopup payload →', { user_id: userId, amount, currency });

    const { data, error } = await supabase.functions.invoke('payments-paypal-create', {
      body: { user_id: userId, amount, currency }
    });

    if (error) {
      console.error('createPaypalTopup error', error);
      throw error;
    }
    return data as { id: string; approvalUrl: string | null };
  }

  async createDebtSettlementOrder(
    fromUserId: string, 
    toUserId: string, // NUOVO PARAMETRO
    amount: number, 
    currency = 'EUR'
) {
    const { data, error } = await supabase.functions.invoke('payments-paypal-create', {
      body: { 
          user_id: fromUserId, 
          to_user_id: toUserId, // PASSATO
          amount, 
          currency 
        }
      });
        if (error) {
      console.error('createPaypalTopup error', error);
      throw error;
    }
    return data as { id: string; approvalUrl: string | null };
}

  // CAPTURE: input orderId (token del ritorno PayPal)
  async capturePaypalOrder(orderId: string): Promise<any> {
    const { data, error } = await supabase.functions.invoke('paypal-capture', {
      body: { orderId }
    });
    if (error) {
      console.error('Edge error (capturePaypalOrder):', error.name, error.message, error.cause, error.context);
      throw error;
    }     
    return data; // oggetto PayPal capture
  }
  
  async getMyDue(userId: string) {
    const { data, error } = await supabase.rpc('get_user_due_from_nets', {
      p_user_id: userId,
      p_from: null,   // o '2025-01-01' se vuoi filtrare
      p_to:   null
    });
    if (error) {
      console.error('Edge error (getMyDue):', error.name, error.message, error.cause);
      throw error;
    }     const row = Array.isArray(data) ? data[0] : data;
    return {
      amount: Number(row?.amount) ?? 0, 
      paid:   Number(row?.paid ?? 0),
      owed:   Number(row?.owed ?? 0),
      net:    Number(row?.net ?? 0),
    };
  }

}
