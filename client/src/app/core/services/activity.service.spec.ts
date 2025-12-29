import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivityService } from './activity.service';

describe('ActivityService', () => {
    let service: ActivityService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [ActivityService]
        });
        service = TestBed.inject(ActivityService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should log activity via POST', async () => {
        const featureKey = 'dashboard';
        const metadata = 'test';

        const promise = service.logActivity(featureKey, metadata);

        const req = httpMock.expectOne('/api/activity/log');
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({ feature_key: featureKey, metadata });

        req.flush({}); // Respond with empty success

        await promise;
    });

    it('should load shortcuts via GET', async () => {
        const mockShortcuts = [
            { id: 'dashboard', name: 'Dashboard', icon: '📊', url: '/dashboard', description: 'Overview', count: 10 }
        ];

        const promise = service.loadShortcuts();

        const req = httpMock.expectOne('/api/activity/shortcuts?limit=4');
        expect(req.request.method).toBe('GET');

        req.flush(mockShortcuts);

        await promise;
        expect(service.shortcuts()).toEqual(mockShortcuts);
    });
});
