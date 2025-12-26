import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { vi } from 'vitest';

import { ResearchPlannerResultsComponent } from './research-planner-results.component';
import { ResearchPlannerService } from './research-planner.service';
import { SessionDetail } from './research-planner.types';

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

describe('ResearchPlannerResultsComponent', () => {
    let component: ResearchPlannerResultsComponent;
    let fixture: ComponentFixture<ResearchPlannerResultsComponent>;
    let service: any;

    const mockSessionDetail: SessionDetail = {
        session: {
            id: 1,
            objective: 'Test Objective',
            status: 'selecting',
            progressStep: 2,
            createdAt: '2023-01-01',
            updatedAt: '2023-01-01',
            selectedMethods: []
        },
        recommendedMethods: [
            {
                id: 1,
                sessionId: 1,
                methodName: 'user_interviews',
                methodLabel: 'User Interviews',
                rationale: 'Reason',
                effort: 'medium',
                costEstimate: '$100',
                timeline: '1 week',
                participantCount: '5',
                confidenceScore: 0.9,
                isSelected: false,
                displayOrder: 0,
                createdAt: '2023-01-01'
            }
        ],
        interviewGuides: [],
        surveys: [],
        recruitingPlans: []
    };

    beforeEach(async () => {
        const serviceSpy = {
            getSessionDetail: vi.fn(),
            selectMethods: vi.fn(),
            generateInstruments: vi.fn(),
            pollSessionStatus: vi.fn()
        };

        await TestBed.configureTestingModule({
            imports: [
                HttpClientTestingModule,
                RouterTestingModule,
                FormsModule,
                ResearchPlannerResultsComponent
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
            .overrideComponent(ResearchPlannerResultsComponent, {
                remove: { imports: [NgIcon] },
                add: { imports: [MockNgIconComponent] }
            })
            .compileComponents();

        service = TestBed.inject(ResearchPlannerService);
        fixture = TestBed.createComponent(ResearchPlannerResultsComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        service.getSessionDetail.mockResolvedValue(mockSessionDetail);
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should load session detail on init', fakeAsync(() => {
        service.getSessionDetail.mockResolvedValue(mockSessionDetail);

        component.ngOnInit();
        tick();

        expect(service.getSessionDetail).toHaveBeenCalledWith(1);
        expect(component.sessionDetail()).toEqual(mockSessionDetail);
        expect(component.loading()).toBe(false);
    }));

    it('should toggle method selection', () => {
        // Initial state: empty
        expect(component.selectedMethods()).toEqual([]);

        // Select
        component.toggleMethodSelection('user_interviews');
        expect(component.selectedMethods()).toEqual(['user_interviews']);

        // Deselect
        component.toggleMethodSelection('user_interviews');
        expect(component.selectedMethods()).toEqual([]);
    });

    it('should proceed to configuration step if methods selected', fakeAsync(() => {
        service.getSessionDetail.mockResolvedValue(mockSessionDetail);
        service.selectMethods.mockResolvedValue({ ...mockSessionDetail.session, selectedMethods: ['user_interviews'] });

        component.ngOnInit();
        tick();

        component.selectedMethods.set(['user_interviews']);
        component.proceedToConfiguration();
        tick();

        expect(service.selectMethods).toHaveBeenCalledWith(1, ['user_interviews']);
        expect(component.currentStep()).toBe(2);
    }));

    it('should not proceed if no methods selected', fakeAsync(() => {
        service.getSessionDetail.mockResolvedValue(mockSessionDetail);
        component.ngOnInit();
        tick();

        component.selectedMethods.set([]);
        component.proceedToConfiguration();
        tick();

        expect(service.selectMethods).not.toHaveBeenCalled();
        expect(component.currentStep()).toBe(1); // Stays on step 1
    }));

    it('should generate instruments and poll for completion', fakeAsync(() => {
        service.getSessionDetail.mockResolvedValue(mockSessionDetail);
        service.generateInstruments.mockResolvedValue({ success: true });
        service.pollSessionStatus.mockResolvedValue({
            id: 1,
            status: 'completed',
            progressStep: 5
        });

        component.ngOnInit();
        tick();

        component.generateInstruments();
        expect(component.isGenerating()).toBe(true);
        tick(); // Generate call
        tick(); // Poll call

        expect(service.generateInstruments).toHaveBeenCalled();
        expect(service.pollSessionStatus).toHaveBeenCalled();
        expect(component.currentStep()).toBe(3);
        expect(component.isGenerating()).toBe(false);
    }));
});
