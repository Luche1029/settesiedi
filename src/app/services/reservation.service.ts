// src/app/services/reservation.service.ts
import { Injectable } from '@angular/core';
import { supabase } from '../supabase.client';

export type RsvpStatus = 'going' | 'maybe' | 'not_going';

@Injectable({ providedIn: 'root' })
export class ReservationService {
  async setStatus(event_id: string, user_id: string, status: RsvpStatus) {
    const { error } = await supabase
      .from('reservation')
      .upsert(
        { event_id, user_id, status },
        { onConflict: 'event_id,user_id' }
      );
    if (error) throw error;
    return true;
  }
  // + aggiungi:
    async listByEvent(eventId: string) {
    const { data, error } = await supabase
        .from('reservation')
        .select('id, user_id, status, created_at, app_user:user_id(display_name)')
        .eq('event_id', eventId);
    if (error) throw error;
    return (data||[]).map((r:any)=>({
        ...r,
        name: r.app_user?.display_name ?? '—'
    }));
    }

}
