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

const FALLBACK_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <circle cx="64" cy="48" r="24" fill="#d1d5db"/>
      <rect x="24" y="84" width="80" height="28" rx="14" fill="#d1d5db"/>
    </svg>`
  );
  
function slug(s: string) {
  return s.normalize('NFKD').replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
}

@Injectable({ providedIn: 'root' })
export class AccountService {
  private bucket = 'avatars';
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
  async getAvatarUrl(input: string | null | undefined): Promise<string> {
    const key = (input ?? '').trim();
    if (!key) return FALLBACK_AVATAR;

    // 1) URL assoluto già pronto? (es. da OAuth)
    if (/^https?:\/\//i.test(key)) return key;

    // 2) Path di storage (es. "user123/avatar.png")
    //    Se il bucket è pubblico -> publicUrl. Se è privato, usa createSignedUrl.
    const storage = supabase.storage.from(this.bucket);

    // PUBLIC BUCKET
    const { data: pub } = storage.getPublicUrl(key);
    if (pub?.publicUrl) {
      // cache-buster per evitare thumbnail vecchie
      return `${pub.publicUrl}?v=${Date.now()}`;
    }

    // PRIVATE BUCKET (fallback firmato)
    const { data: signed, error } = await storage.createSignedUrl(key, 60 * 60); // 1h
    if (error || !signed?.signedUrl) return FALLBACK_AVATAR;
    return signed.signedUrl;
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
