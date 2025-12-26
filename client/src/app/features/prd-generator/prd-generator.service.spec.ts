import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PrdGeneratorService } from './prd-generator.service';

describe('PrdGeneratorService', () => {
    let service: PrdGeneratorService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [PrdGeneratorService]
        });
        service = TestBed.inject(PrdGeneratorService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should load initial PRD history', async () => {
        const mockPrds = [
            { id: 1, title: 'Test PRD', status: 'pending', createdAt: new Date() }
        ];

        const promise = service.loadPrds();

        // First call is default pagination
        const req = httpMock.expectOne('/api/prd-generator');
        expect(req.request.method).toBe('GET');
        req.flush(mockPrds);

        await promise;

        expect(service.prds()).toEqual(mockPrds as any);
    });

    it('should generate a PRD', async () => {
        const mockResponse = { id: 1, status: 'pending' };
        const formData = new FormData();
        formData.append('concept', 'Test Concept');

        const promise = service.generate({ concept: 'Test Concept' });

        const req = httpMock.expectOne('/api/prd-generator/generate');
        expect(req.request.method).toBe('POST');
        req.flush(mockResponse);

        const response = await promise;
        expect(response).toEqual(mockResponse as any);
    });

    it('should poll session status', async () => {
        const mockStatus = { id: 1, status: 'processing', progressStep: 1 };

        const promise = service.pollSessionStatus(1);

        // Initial status check
        const req = httpMock.expectOne('/api/prd-generator/1/status');
        expect(req.request.method).toBe('GET');
        req.flush(mockStatus);

        const response = await promise;
        expect(response).toBeTruthy();
        expect(response!.id).toBe(1);
        expect(response!.status).toBe('processing');
    });

    it('should retry a PRD', async () => {
        const mockResponse = { id: 1, status: 'pending' };

        const promise = service.retryPrd(1);

        const req = httpMock.expectOne('/api/prd-generator/1/retry');
        expect(req.request.method).toBe('POST');
        req.flush(mockResponse);

        const response = await promise;
        expect(response).toEqual(mockResponse as any);
    });

    it('should delete a PRD', async () => {
        const promise = service.deletePrd(1);

        const req = httpMock.expectOne('/api/prd-generator/1');
        expect(req.request.method).toBe('DELETE');
        req.flush(null);

        const result = await promise;
        expect(result).toBe(true);
    });
});
