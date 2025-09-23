import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'eur' })
export class CentsToEurPipe implements PipeTransform {
  transform(value?: number | null, sign = false): string {
    if (value == null) return '€0,00';
    const euros = (value / 100);
    const s = euros.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return sign ? `€ ${s}` : s.replace('.', ',') + ' €';
  }
}
