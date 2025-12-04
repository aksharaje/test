import { computed, Directive, input } from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { hlm } from '@spartan-ng/ui-core';

export const iconVariants = cva('inline-flex items-center justify-center shrink-0', {
  variants: {
    size: {
      xs: 'h-3 w-3',
      sm: 'h-4 w-4',
      base: 'h-5 w-5',
      lg: 'h-6 w-6',
      xl: 'h-8 w-8',
      none: '',
    },
  },
  defaultVariants: {
    size: 'base',
  },
});

export type IconVariants = VariantProps<typeof iconVariants>;

@Directive({
  selector: '[hlmIcon]',
  standalone: true,
  host: {
    '[class]': '_computedClass()',
  },
})
export class HlmIconDirective {
  public readonly userClass = input<string>('', { alias: 'class' });
  public readonly size = input<IconVariants['size']>('base');

  protected _computedClass = computed(() =>
    hlm(iconVariants({ size: this.size() }), this.userClass())
  );
}
