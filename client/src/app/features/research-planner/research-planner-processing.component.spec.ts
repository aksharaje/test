import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { vi } from 'vitest';

import { ResearchPlannerProcessingComponent } from './research-planner-processing.component';
import { ResearchPlannerService } from './research-planner.service';
import { SessionStatusResponse } from './research-planner.types';

// Mock NgIcon
import { Component, Input } from '@angular/core';
@Component({
    selector: 'ng-icon',
    template: '',
    standalone: true
})
class MockNgIconComponent {
    @Input() name = '';
    @Input() size = '';
}

describe('ResearchPlannerProcessingComponent', () => {
    let component: ResearchPlannerProcessingComponent;
    let fixture: ComponentFixture<ResearchPlannerProcessingComponent>;
    let service: any;

    beforeEach(async () => {
        const serviceSpy = {
            pollSessionStatus: vi.fn(),
            retrySession: vi.fn()
        };

        await TestBed.configureTestingModule({
            imports: [
                RouterTestingModule,
                ResearchPlannerProcessingComponent
            ],
            providers: [
                { provide: ResearchPlannerService, useValue: serviceSpy },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: { paramMap: { get: () => '1' } }
                    }
                }
            ]
        })
            .overrideComponent(ResearchPlannerProcessingComponent, {
                remove: { imports: [NgIcon] },
                add: { imports: [MockNgIconComponent] }
            })
            .compileComponents();

        service = TestBed.inject(ResearchPlannerService);
        fixture = TestBed.createComponent(ResearchPlannerProcessingComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should start polling on init', fakeAsync(() => {
        const mockStatus: SessionStatusResponse = {
            id: 1,
            status: 'pending',
            progressStep: 0,
        };
        service.pollSessionStatus.mockResolvedValue(mockStatus);

        component.ngOnInit();
        tick(); // Initial poll

        expect(service.pollSessionStatus).toHaveBeenCalledWith(1);
        expect(component.status()).toBe('pending');

        discardPeriodicTasks(); // Clean up interval
    }));

    it('should update status when polling returns new status', fakeAsync(() => {
        const mockStatus1: SessionStatusResponse = {
            id: 1,
            status: 'pending',
            progressStep: 0,
        };
        const mockStatus2: SessionStatusResponse = {
            id: 1,
            status: 'recommending',
            progressStep: 1,
            progressMessage: 'Working...'
        };

        service.pollSessionStatus.mockResolvedValue(mockStatus1);
        component.ngOnInit();
        tick();

        service.pollSessionStatus.mockResolvedValue(mockStatus2);
        tick(3000); // Wait for interval

        expect(component.status()).toBe('recommending');
        expect(component.progressStep()).toBe(1);
        expect(component.progressMessage()).toBe('Working...');

        discardPeriodicTasks();
    }));

    it('should stop polling on completion', fakeAsync(() => {
        const mockStatus: SessionStatusResponse = {
            id: 1,
            status: 'selecting',
            progressStep: 2,
        };
        service.pollSessionStatus.mockResolvedValue(mockStatus);

        component.ngOnInit();
        tick();

        // Verify polling stopped by advancing time and checking call count
        service.pollSessionStatus.mockClear();
        tick(3000);
        expect(service.pollSessionStatus).not.toHaveBeenCalled();
    }));

    it('should retry session on failure', fakeAsync(() => {
        component.status.set('failed');

        service.retrySession.mockResolvedValue({
            id: 1,
            status: 'pending',
            progressStep: 0
        } as any);

        // Must set sessionId manually as ngOnInit sets it from route
        (component as any).sessionId = 1;

        // Mock pollSessionStatus for the startPolling call inside retry
        service.pollSessionStatus.mockResolvedValue({
            id: 1,
            status: 'pending',
            progressStep: 0
        });

        component.retry();
        tick();

        expect(service.retrySession).toHaveBeenCalledWith(1);
        expect(component.status()).toBe('pending');
        expect(component.isRetrying()).toBe(false);

        discardPeriodicTasks();
    }));

    it('should return correct status description', () => {
        expect(component.getStatusDescription('pending')).toBe('Preparing analysis...');
        expect(component.getStatusDescription('recommending')).toBe('Generating recommendations...');
    });
});
