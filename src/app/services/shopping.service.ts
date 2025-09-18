// src/app/services/shopping.service.ts
import { Injectable } from '@angular/core';
import { supabase } from '../supabase.client';

export type ShoppingRow = {
  id: string;
  name: string;
  notes?: string | null;
  qty?: number | null;
  status: 'open'|'purchased';
  added_by: string;
  purchased_by?: string | null;
  created_at: string;
  purchased_at?: string | null;
  added_name?: string;       // joined
  purchased_name?: string;   // joined
};

@Injectable({ providedIn: 'root' })
export class ShoppingService {
  async list() {
    const { data, error } = await supabase
      .from('shopping_item')
      .select('*, added:app_user!shopping_item_added_by_fkey(display_name), bought:app_user!shopping_item_purchased_by_fkey(display_name)')
      .order('status', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map((r:any) => ({
      ...r,
      added_name: r.added?.display_name ?? '—',
      purchased_name: r.bought?.display_name ?? null
    })) as ShoppingRow[];
  }

  async add(payload: { name: string; notes?: string|null; qty?: number|null; added_by: string }) {
    const { data, error } = await supabase
      .from('shopping_item')
      .insert({
        name: payload.name.trim(),
        notes: payload.notes?.trim() || null,
        qty: payload.qty ?? null,
        added_by: payload.added_by
      })
      .select()
      .single();
    if (error) throw error;
    return data as ShoppingRow;
  }

  async toggle(id: string, userId: string) {
    const { data, error } = await supabase.rpc('shopping_toggle', { p_id: id, p_user: userId });
    if (error) throw error;
    return data as ShoppingRow;
  }

  async remove(id: string) {
    const { error } = await supabase.from('shopping_item').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
}
