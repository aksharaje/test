import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { provideIcons } from '@ng-icons/core';
import { lucideClock, lucideZap, lucideTarget, lucideTrendingUp, lucideArrowRight } from '@ng-icons/lucide';

describe('DashboardComponent', () => {
    let component: DashboardComponent;
    let fixture: ComponentFixture<DashboardComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DashboardComponent],
            providers: [
                provideIcons({
                    lucideClock,
                    lucideZap,
                    lucideTarget,
                    lucideTrendingUp,
                    lucideArrowRight
                })
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(DashboardComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should display Hours Reclaimed metric', () => {
        const element = fixture.nativeElement as HTMLElement;
        expect(element.textContent).toContain('Hours Reclaimed');
        expect(element.textContent).toContain('42');
    });

    it('should display Velocity Multiplier metric', () => {
        const element = fixture.nativeElement as HTMLElement;
        expect(element.textContent).toContain('Velocity Multiplier');
        expect(element.textContent).toContain('3.5x');
    });

    it('should display Strategic Focus metric', () => {
        const element = fixture.nativeElement as HTMLElement;
        expect(element.textContent).toContain('Strategic Focus');
        expect(element.textContent).toContain('90%');
    });
});
