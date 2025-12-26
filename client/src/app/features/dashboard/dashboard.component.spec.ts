import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { provideIcons } from '@ng-icons/core';
import { lucideClock, lucideZap, lucideTarget, lucideTrendingUp, lucideArrowRight, lucideCalendar, lucideLoader2 } from '@ng-icons/lucide';
import { DashboardService } from './dashboard.service';
import { of } from 'rxjs';

describe('DashboardComponent', () => {
    let component: DashboardComponent;
    let fixture: ComponentFixture<DashboardComponent>;
    let mockService: any;

    const mockStats = {
        counts: { prd: 5, feasibility: 2, ideation: 10, total: 17 },
        roi: {
            hoursReclaimed: 42,
            velocityMultiplier: 3.5,
            strategicFocus: 90
        },
        timeframe: '30d'
    };

    beforeEach(async () => {
        mockService = {
            getStats: vi.fn().mockReturnValue(of(mockStats))
        };

        await TestBed.configureTestingModule({
            imports: [DashboardComponent],
            providers: [
                provideIcons({
                    lucideClock,
                    lucideZap,
                    lucideTarget,
                    lucideTrendingUp,
                    lucideArrowRight,
                    lucideCalendar,
                    lucideLoader2
                }),
                { provide: DashboardService, useValue: mockService }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(DashboardComponent);
        component = fixture.componentInstance;
        fixture.detectChanges(); // triggers ngOnInit -> effect -> loadData
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should load data on init', () => {
        expect(mockService.getStats).toHaveBeenCalledWith('30d');
        expect(component.stats()).toEqual(mockStats as any);
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

    it('should update timeframe', async () => {
        component.setTimeframe('all');
        fixture.detectChanges();
        await fixture.whenStable(); // wait for effect
        expect(mockService.getStats).toHaveBeenCalledWith('all');
    });
});
