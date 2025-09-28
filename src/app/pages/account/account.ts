import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountService } from '../../services/account.service';
import { AuthService } from '../../services/auth.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './account.html',
  styleUrl: './account.scss'
})
export class Account implements OnInit {
  private acc = inject(AccountService);
  private auth = inject(AuthService);

  me = signal<{ id: string; display_name: string } | null>(null);

  // form profilo
  display_name = signal('');
  email = signal('');
  paypal_email = signal('');
  is_admin = signal(false);
  avatarPath = signal<string | null>(null);
  avatarUrl = signal<string | null>(null);

  // form password
  oldPwd = signal('');  // opzionale
  newPwd = signal('');
  confirm = signal('');

  loading = signal(false);
  msg = signal('');
  ok = signal('');

  canSaveProfile = computed(() => !!this.display_name().trim());
  canChangePwd = computed(() => this.newPwd().length >= 6 && this.newPwd() === this.confirm());

  async ngOnInit() {
    this.auth.restore();
    const u = this.auth.user();
    if (!u) { this.msg.set('Non sei loggato'); return; }
    this.me.set({ id: u.id, display_name: u.display_name });

    try {
      const profile = await this.acc.getMe(u.id);
      this.display_name.set(profile.display_name || '');
      this.email.set(profile.email || '');
      this.paypal_email.set(profile.paypal_email || '');
      this.is_admin.set(profile.is_admin || false);
      this.avatarPath.set(profile.avatar || null);
      this.avatarUrl.set(await this.acc.getAvatarUrl(profile.avatar || null));
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore caricamento profilo');
    }
  }

  async saveProfile() {
    const u = this.me();
    if (!u) return;
    this.loading.set(true); this.msg.set(''); this.ok.set('');
    try {
      await this.acc.updateProfile(u.id, {
        display_name: this.display_name().trim(),
        email: this.email().trim() || null,
        paypal_email: this.paypal_email().trim() || null
      });
      this.ok.set('Profilo aggiornato ✔︎');
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore aggiornamento profilo');
    } finally {
      this.loading.set(false);
    }
  }

  async changePassword() {
    const u = this.me();
    if (!u) return;
    if (!this.canChangePwd()) { this.msg.set('Controlla password: min 6 caratteri e conferma uguale'); return; }

    this.loading.set(true); this.msg.set(''); this.ok.set('');
    try {
      const ok = await this.acc.changePassword(u.id, this.newPwd(), this.oldPwd() || undefined);
      if (!ok) {
        this.msg.set('Vecchia password non corretta');
      } else {
        this.ok.set('Password aggiornata ✔︎');
        this.oldPwd.set(''); this.newPwd.set(''); this.confirm.set('');
      }
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore cambio password');
    } finally {
      this.loading.set(false);
    }
  }

   async onAvatarSelected(ev: Event) {
    const u = this.me(); if (!u) return;
    const input = ev.target as HTMLInputElement;
    const file = (input.files && input.files[0]) || null;
    if (!file) return;

    this.loading.set(true); this.msg.set(''); this.ok.set('');
    try {
      const old = this.avatarPath();
      const { url, path } = await this.acc.uploadAvatar(u.id, file, old);
      this.avatarPath.set(path);
      this.avatarUrl.set(url);
      this.ok.set('Avatar aggiornato ✔︎');
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore upload avatar');
    } finally {
      this.loading.set(false);
      input.value = ''; // reset
    }
  }
}
