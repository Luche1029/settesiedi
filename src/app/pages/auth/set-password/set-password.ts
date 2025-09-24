// src/app/pages/auth/set-password/set-password.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-set-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './set-password.html'
})
export class SetPassword {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  token = this.route.snapshot.queryParamMap.get('token') || '';

  email = '';                      // <-- nuovo
  pwd = signal('');
  confirm = signal('');
  show = signal(false);
  msg = signal('');
  loading = signal(false);

  private isEmailValid(e: string) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());
  }

  valid() {
    return this.isEmailValid(this.email)
        && this.pwd().length >= 6
        && this.pwd() === this.confirm();
  }

  async save() {
    if (!this.token) { this.msg.set('Token mancante o non valido.'); return; }
    if (!this.valid()) { this.msg.set('Controlla i campi: email valida, almeno 6 caratteri e conferma uguale.'); return; }

    this.loading.set(true); this.msg.set('');
    try {
      await this.auth.setPasswordAndPaypalEmailByToken(this.token, this.pwd(), this.email.trim());
      this.msg.set('Password impostata ✅ Ora puoi accedere.');
      setTimeout(() => this.router.navigateByUrl('/login'), 1200);
    } catch (e: any) {
      this.msg.set(e.message ?? 'Errore durante il salvataggio.');
    } finally {
      this.loading.set(false);
    }
  }
}
