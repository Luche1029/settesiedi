import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule],
  templateUrl: './login.html'
})
export class Login {
  name = '';
  msg = '';

  constructor(private auth: AuthService, private router: Router) {}

  async login() {
    try {
      await this.auth.login(this.name);
      this.router.navigateByUrl('/menus');
    } catch (e:any) {
      this.msg = e.message;
    }
  }
}
