import { computed, Directive, input } from '@angular/core';
import { hlm } from '@spartan-ng/ui-core';

@Directive({
  selector: '[hlmSeparator]',
  standalone: true,
  host: {
    '[class]': '_computedClass()',
  },
})
export class HlmSeparatorDirective {
  public readonly userClass = input<string>('', { alias: 'class' });
  public readonly orientation = input<'horizontal' | 'vertical'>('horizontal');

  protected _computedClass = computed(() => {
    const base = 'shrink-0 bg-border';
    const orientationClass =
      this.orientation() === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]';
    return hlm(base, orientationClass, this.userClass());
  });
}
