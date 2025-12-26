/**
 * Research Planner Input Component Tests
 */
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { NgIcon } from '@ng-icons/core';

import { ResearchPlannerInputComponent } from './research-planner-input.component';
import { ResearchPlannerService } from './research-planner.service';
import { AvailableContextSources } from './research-planner.types';

// Mock NgIcon to avoid issues
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

describe('ResearchPlannerInputComponent', () => {
    let component: ResearchPlannerInputComponent;
    let fixture: ComponentFixture<ResearchPlannerInputComponent>;
    let service: jasmine.SpyObj<ResearchPlannerService>;

    beforeEach(async () => {
        const serviceSpy = jasmine.createSpyObj('ResearchPlannerService', ['loadContextSources', 'createSession']);
        serviceSpy.loadContextSources.and.returnValue(Promise.resolve({
            knowledgeBases: [],
            ideationSessions: [],
            feasibilitySessions: [],
            businessCaseSessions: []
        }));

        await TestBed.configureTestingModule({
            imports: [
                HttpClientTestingModule,
                RouterTestingModule,
                ReactiveFormsModule,
                ResearchPlannerInputComponent // Component under test is standalone
            ],
            providers: [
                { provide: ResearchPlannerService, useValue: serviceSpy }
            ]
        })
            .overrideComponent(ResearchPlannerInputComponent, {
                remove: { imports: [NgIcon] },
                add: { imports: [MockNgIconComponent] }
            })
            .compileComponents();

        service = TestBed.inject(ResearchPlannerService) as jasmine.SpyObj<ResearchPlannerService>;
        fixture = TestBed.createComponent(ResearchPlannerInputComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize the form with empty values', () => {
        expect(component.form.get('objective')?.value).toBe('');
        expect(component.form.get('budget')?.value).toBe('');
        expect(component.form.get('timeline')?.value).toBe('');
    });

    it('should mark objective as invalid if empty', () => {
        const objectiveControl = component.form.get('objective');
        objectiveControl?.setValue('');
        expect(objectiveControl?.valid).toBeFalse();
        expect(objectiveControl?.errors?.['required']).toBeTruthy();
    });

    it('should mark objective as invalid if less than 10 chars', () => {
        const objectiveControl = component.form.get('objective');
        objectiveControl?.setValue('Short');
        expect(objectiveControl?.valid).toBeFalse();
        expect(objectiveControl?.errors?.['minlength']).toBeTruthy();
    });

    it('should mark form as valid when objective is valid', () => {
        component.form.get('objective')?.setValue('This is a valid research objective that is long enough.');
        expect(component.form.valid).toBeTrue();
    });

    it('should load context sources on init', fakeAsync(() => {
        const mockSources: AvailableContextSources = {
            knowledgeBases: [{ id: 1, name: 'KB1', documentCount: 5 }],
            ideationSessions: [],
            feasibilitySessions: [],
            businessCaseSessions: []
        };
        service.loadContextSources.and.returnValue(Promise.resolve(mockSources));

        component.ngOnInit();
        tick();

        expect(service.loadContextSources).toHaveBeenCalled();
        expect(component.contextSources()).toEqual(mockSources);
    }));

    it('should patch objective when setting example', () => {
        const example = "Example objective text";
        component.setExample(example);
        expect(component.form.get('objective')?.value).toBe(example);
        expect(component.showExamples()).toBeFalse();
    });

    it('should toggle examples visibility', () => {
        expect(component.showExamples()).toBeFalse();
        component.showExamples.set(true);
        expect(component.showExamples()).toBeTrue();
    });

    it('should calculate selected context count correctly', () => {
        component.selectedKnowledgeBases.set([1, 2]);
        component.selectedIdeationSession.set(1);

        // 2 KBs + 1 Ideation = 3
        expect(component.selectedContextCount()).toBe(3);

        component.selectedFeasibilitySession.set(5);
        // 3 + 1 Feasibility = 4
        expect(component.selectedContextCount()).toBe(4);
    });
});
