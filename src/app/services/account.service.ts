import { Injectable } from '@angular/core';
import { supabase } from '../../../supabase/supabase.client';

export interface AccountProfile {
  id: string;
  display_name: string;
  email: string | null;
  paypal_email: string | null;
  is_admin: boolean | false;
  avatar: string | null;
}

function slug(s: string) {
  return s.normalize('NFKD').replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
}

@Injectable({ providedIn: 'root' })
export class AccountService {

  async getMe(userId: string): Promise<AccountProfile> {
    const { data, error } = await supabase
      .from('app_user')
      .select('id, display_name, email, paypal_email, is_admin, avatar')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data as AccountProfile;
  }

  // via RPC (consigliato)
  async updateProfile(userId: string, payload: { display_name: string; email?: string | null; paypal_email?: string | null; }) {
    const { error } = await supabase.rpc('update_account_profile', {
      p_user_id: userId,
      p_display_name: payload.display_name ?? '',
      p_email: payload.email ?? null,
      p_paypal_email: payload.paypal_email ?? null
    });
    if (error) throw error;
    return true;
  }

  async changePassword(userId: string, newPassword: string, oldPassword?: string) {
    const { data, error } = await supabase.rpc('change_password', {
      p_user_id: userId,
      p_old_password: oldPassword ?? null,
      p_new_password: newPassword
    });
    if (error) throw error;
    // data === true se ok; false se old non valida
    return !!data;
  }

   /** Ritorna un URL firmato (scade) per l’avatar salvato */
  async getAvatarUrl(path: string | null, expiresSec = 600): Promise<string | null> {
    if (!path) return null;
    const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path, expiresSec);
    if (error) return null;
    return data?.signedUrl ?? null;
  }

  /** Carica file nel bucket e imposta app_user.avatar con RPC set_avatar. Torna {urlFirmata, path} */
  async uploadAvatar(userId: string, file: File, oldPath?: string | null) {
    const folder = `${userId}`;
    const path = `${folder}/${Date.now()}-${slug(file.name || 'avatar')}`;

    // 1) upload
    const bucket = supabase.storage.from('avatars');
    const { error: upErr } = await bucket.upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false
    });
    if (upErr) throw upErr;

    // 2) aggiorna DB con RPC
    const { error: rpcErr } = await supabase.rpc('set_avatar', { p_user_id: userId, p_path: path });
    if (rpcErr) {
      // best-effort cleanup del file appena caricato
      await bucket.remove([path]).catch(()=>{});
      throw rpcErr;
    }

    // 3) (opzionale) elimina avatar precedente
    if (oldPath && oldPath !== path) {
      await bucket.remove([oldPath]).catch(()=>{ /* ignora errori */ });
    }

    // 4) URL firmata per render
    const url = await this.getAvatarUrl(path);
    return { url, path };
  }
}
