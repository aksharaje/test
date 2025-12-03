import { Component, computed, input } from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { hlm } from '@spartan-ng/ui-core';

export const avatarVariants = cva(
  'relative flex shrink-0 overflow-hidden rounded-full',
  {
    variants: {
      size: {
        xs: 'h-6 w-6 text-xs',
        sm: 'h-8 w-8 text-xs',
        base: 'h-10 w-10 text-sm',
        lg: 'h-12 w-12 text-base',
        xl: 'h-16 w-16 text-lg',
      },
    },
    defaultVariants: {
      size: 'base',
    },
  }
);

export type AvatarVariants = VariantProps<typeof avatarVariants>;

@Component({
  selector: 'hlm-avatar',
  standalone: true,
  template: `
    @if (src()) {
      <img
        [src]="src()"
        [alt]="alt()"
        class="aspect-square h-full w-full object-cover"
      />
    } @else {
      <span
        class="flex h-full w-full items-center justify-center bg-muted font-medium uppercase text-muted-foreground"
      >
        {{ initials() }}
      </span>
    }
  `,
  host: {
    '[class]': '_computedClass()',
  },
})
export class HlmAvatarComponent {
  public readonly userClass = input<string>('', { alias: 'class' });
  public readonly size = input<AvatarVariants['size']>('base');
  public readonly src = input<string | null>(null);
  public readonly alt = input<string>('');
  public readonly fallback = input<string>('');

  protected initials = computed(() => {
    const fallback = this.fallback();
    if (fallback) {
      return fallback
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('');
    }
    return '?';
  });

  protected _computedClass = computed(() =>
    hlm(avatarVariants({ size: this.size() }), this.userClass())
  );
}
