import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IntegrationService } from './integration.service';
import type { Integration, FieldMapping, JiraField } from './integration.types';

describe('IntegrationService', () => {
  let service: IntegrationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [IntegrationService],
    });

    service = TestBed.inject(IntegrationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('loadIntegrations', () => {
    it('should load integrations and update state', async () => {
      const mockIntegrations: Integration[] = [
        {
          id: 1,
          provider: 'jira',
          name: 'Test Jira',
          baseUrl: 'https://example.atlassian.net',
          cloudId: 'cloud-123',
          authType: 'oauth',
          status: 'connected',
          lastSyncAt: '2024-01-01T00:00:00Z',
          errorMessage: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      const loadPromise = service.loadIntegrations();
      const req = httpMock.expectOne('/api/integrations');
      expect(req.request.method).toBe('GET');
      req.flush(mockIntegrations);

      await loadPromise;

      expect(service.integrations()).toEqual(mockIntegrations);
      expect(service.loading()).toBe(false);
      expect(service.error()).toBeNull();
    });

    it('should handle load error', async () => {
      const loadPromise = service.loadIntegrations();
      const req = httpMock.expectOne('/api/integrations');
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      await loadPromise;

      expect(service.error()).toBe('Failed to load integrations');
      expect(service.loading()).toBe(false);
    });
  });

  describe('getIntegration', () => {
    it('should get single integration', async () => {
      const mockIntegration: Integration = {
        id: 1,
        provider: 'jira',
        name: 'Test Jira',
        baseUrl: 'https://example.atlassian.net',
        cloudId: 'cloud-123',
        authType: 'oauth',
        status: 'connected',
        lastSyncAt: null,
        errorMessage: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const getPromise = service.getIntegration(1);
      const req = httpMock.expectOne('/api/integrations/1');
      expect(req.request.method).toBe('GET');
      req.flush(mockIntegration);

      const result = await getPromise;

      expect(result).toEqual(mockIntegration);
      expect(service.selectedIntegration()).toEqual(mockIntegration);
    });

    it('should return null on error', async () => {
      const getPromise = service.getIntegration(999);
      const req = httpMock.expectOne('/api/integrations/999');
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      const result = await getPromise;

      expect(result).toBeNull();
      expect(service.error()).toBe('Failed to load integration');
    });
  });

  describe('deleteIntegration', () => {
    it('should delete integration and update state', async () => {
      // First load some integrations
      const mockIntegrations: Integration[] = [
        {
          id: 1,
          provider: 'jira',
          name: 'Test Jira 1',
          baseUrl: 'https://example1.atlassian.net',
          cloudId: 'cloud-1',
          authType: 'oauth',
          status: 'connected',
          lastSyncAt: null,
          errorMessage: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          provider: 'jira',
          name: 'Test Jira 2',
          baseUrl: 'https://example2.atlassian.net',
          cloudId: 'cloud-2',
          authType: 'pat',
          status: 'connected',
          lastSyncAt: null,
          errorMessage: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      const loadPromise = service.loadIntegrations();
      const loadReq = httpMock.expectOne('/api/integrations');
      loadReq.flush(mockIntegrations);
      await loadPromise;

      // Now delete
      const deletePromise = service.deleteIntegration(1);
      const deleteReq = httpMock.expectOne('/api/integrations/1');
      expect(deleteReq.request.method).toBe('DELETE');
      deleteReq.flush({});

      const result = await deletePromise;

      expect(result).toBe(true);
      expect(service.integrations().length).toBe(1);
      expect(service.integrations()[0].id).toBe(2);
    });

    it('should return false on error', async () => {
      const deletePromise = service.deleteIntegration(999);
      const req = httpMock.expectOne('/api/integrations/999');
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      const result = await deletePromise;

      expect(result).toBe(false);
      expect(service.error()).toBe('Failed to disconnect integration');
    });
  });

  describe('syncIntegration', () => {
    it('should sync integration', async () => {
      const mockIntegration: Integration = {
        id: 1,
        provider: 'jira',
        name: 'Test Jira',
        baseUrl: 'https://example.atlassian.net',
        cloudId: 'cloud-123',
        authType: 'oauth',
        status: 'connected',
        lastSyncAt: '2024-01-15T00:00:00Z',
        errorMessage: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      };

      const syncPromise = service.syncIntegration(1);
      const req = httpMock.expectOne('/api/integrations/1/sync');
      expect(req.request.method).toBe('POST');
      req.flush(mockIntegration);

      const result = await syncPromise;

      expect(result).toEqual(mockIntegration);
    });
  });

  describe('connectWithPAT', () => {
    it('should connect with PAT successfully', async () => {
      const mockIntegration: Integration = {
        id: 1,
        provider: 'jira',
        name: 'Jira Server',
        baseUrl: 'https://jira.company.com',
        cloudId: null,
        authType: 'pat',
        status: 'connected',
        lastSyncAt: null,
        errorMessage: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const connectPromise = service.connectWithPAT(
        'https://jira.company.com',
        'test-pat-token',
        'Jira Server'
      );

      const req = httpMock.expectOne('/api/integrations/jira/pat');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        baseUrl: 'https://jira.company.com',
        pat: 'test-pat-token',
        name: 'Jira Server',
      });
      req.flush(mockIntegration);

      const result = await connectPromise;

      expect(result).toEqual(mockIntegration);
      expect(service.integrations()).toContainEqual(mockIntegration);
    });

    it('should handle PAT connection error', async () => {
      const connectPromise = service.connectWithPAT(
        'https://jira.company.com',
        'invalid-token'
      );

      const req = httpMock.expectOne('/api/integrations/jira/pat');
      req.flush(
        { error: 'Invalid Personal Access Token' },
        { status: 401, statusText: 'Unauthorized' }
      );

      const result = await connectPromise;

      expect(result).toBeNull();
    });
  });

  describe('loadFieldMappings', () => {
    it('should load field mappings', async () => {
      const mockMappings: FieldMapping[] = [
        {
          id: 1,
          integrationId: 1,
          ourField: 'story_points',
          providerFieldId: 'customfield_10001',
          providerFieldName: 'Story Points',
          providerFieldType: 'number',
          confidence: 95,
          adminConfirmed: true,
        },
      ];

      const loadPromise = service.loadFieldMappings(1);
      const req = httpMock.expectOne('/api/integrations/1/mappings');
      req.flush(mockMappings);

      await loadPromise;

      expect(service.fieldMappings()).toEqual(mockMappings);
    });
  });

  describe('updateFieldMapping', () => {
    it('should update field mapping', async () => {
      const mockMapping: FieldMapping = {
        id: 1,
        integrationId: 1,
        ourField: 'story_points',
        providerFieldId: 'customfield_10002',
        providerFieldName: 'New Story Points',
        providerFieldType: 'number',
        confidence: 100,
        adminConfirmed: true,
      };

      const updatePromise = service.updateFieldMapping(
        1,
        'story_points',
        'customfield_10002',
        'New Story Points',
        'number'
      );

      const req = httpMock.expectOne('/api/integrations/1/mappings/story_points');
      expect(req.request.method).toBe('PUT');
      req.flush(mockMapping);

      const result = await updatePromise;

      expect(result).toEqual(mockMapping);
    });
  });

  describe('deleteFieldMapping', () => {
    it('should delete field mapping', async () => {
      // First load some mappings
      const mockMappings: FieldMapping[] = [
        {
          id: 1,
          integrationId: 1,
          ourField: 'story_points',
          providerFieldId: 'customfield_10001',
          providerFieldName: 'Story Points',
          providerFieldType: 'number',
          confidence: 95,
          adminConfirmed: true,
        },
      ];

      const loadPromise = service.loadFieldMappings(1);
      const loadReq = httpMock.expectOne('/api/integrations/1/mappings');
      loadReq.flush(mockMappings);
      await loadPromise;

      // Now delete
      const deletePromise = service.deleteFieldMapping(1, 'story_points');
      const deleteReq = httpMock.expectOne('/api/integrations/1/mappings/story_points');
      expect(deleteReq.request.method).toBe('DELETE');
      deleteReq.flush({});

      const result = await deletePromise;

      expect(result).toBe(true);
      expect(service.fieldMappings()).toEqual([]);
    });
  });

  describe('loadAvailableFields', () => {
    it('should load available Jira fields', async () => {
      const mockFields: JiraField[] = [
        {
          id: 'summary',
          key: 'summary',
          name: 'Summary',
          custom: false,
          schema: { type: 'string' },
        },
        {
          id: 'customfield_10001',
          key: 'customfield_10001',
          name: 'Story Points',
          custom: true,
          schema: { type: 'number' },
        },
      ];

      const loadPromise = service.loadAvailableFields(1);
      const req = httpMock.expectOne('/api/integrations/1/fields');
      req.flush(mockFields);

      await loadPromise;

      expect(service.availableFields()).toEqual(mockFields);
    });
  });

  describe('loadProjects', () => {
    it('should load projects', async () => {
      const mockProjects = [
        { id: 1, jiraId: '10001', key: 'PROJ1', name: 'Project 1' },
        { id: 2, jiraId: '10002', key: 'PROJ2', name: 'Project 2' },
      ];

      const loadPromise = service.loadProjects(1);
      const req = httpMock.expectOne('/api/jira/1/projects');
      req.flush(mockProjects);

      await loadPromise;

      expect(service.projects()).toEqual(mockProjects);
    });
  });

  describe('loadBoards', () => {
    it('should load boards', async () => {
      const mockBoards = [
        { id: 1, jiraId: 1, name: 'Board 1', type: 'scrum' },
        { id: 2, jiraId: 2, name: 'Board 2', type: 'kanban' },
      ];

      const loadPromise = service.loadBoards(1);
      const req = httpMock.expectOne('/api/jira/1/boards');
      req.flush(mockBoards);

      await loadPromise;

      expect(service.boards()).toEqual(mockBoards);
    });
  });

  describe('computed signals', () => {
    it('should compute hasIntegrations correctly', async () => {
      expect(service.hasIntegrations()).toBe(false);

      const loadPromise = service.loadIntegrations();
      const req = httpMock.expectOne('/api/integrations');
      req.flush([
        {
          id: 1,
          provider: 'jira',
          name: 'Test',
          baseUrl: 'https://example.atlassian.net',
          cloudId: 'cloud-123',
          authType: 'oauth',
          status: 'connected',
          lastSyncAt: null,
          errorMessage: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ]);
      await loadPromise;

      expect(service.hasIntegrations()).toBe(true);
    });

    it('should compute connectedIntegrations correctly', async () => {
      const loadPromise = service.loadIntegrations();
      const req = httpMock.expectOne('/api/integrations');
      req.flush([
        {
          id: 1,
          provider: 'jira',
          name: 'Connected',
          baseUrl: 'https://example1.atlassian.net',
          cloudId: 'cloud-1',
          authType: 'oauth',
          status: 'connected',
          lastSyncAt: null,
          errorMessage: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          provider: 'jira',
          name: 'Error',
          baseUrl: 'https://example2.atlassian.net',
          cloudId: 'cloud-2',
          authType: 'oauth',
          status: 'error',
          lastSyncAt: null,
          errorMessage: 'Connection failed',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ]);
      await loadPromise;

      expect(service.connectedIntegrations().length).toBe(1);
      expect(service.connectedIntegrations()[0].name).toBe('Connected');
    });
  });

  describe('helper methods', () => {
    it('should select integration', () => {
      const integration: Integration = {
        id: 1,
        provider: 'jira',
        name: 'Test',
        baseUrl: 'https://example.atlassian.net',
        cloudId: 'cloud-123',
        authType: 'oauth',
        status: 'connected',
        lastSyncAt: null,
        errorMessage: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      service.selectIntegration(integration);
      expect(service.selectedIntegration()).toEqual(integration);

      service.selectIntegration(null);
      expect(service.selectedIntegration()).toBeNull();
    });

    it('should clear error', async () => {
      const loadPromise = service.loadIntegrations();
      const req = httpMock.expectOne('/api/integrations');
      req.flush('Error', { status: 500, statusText: 'Server Error' });
      await loadPromise;

      expect(service.error()).not.toBeNull();

      service.clearError();

      expect(service.error()).toBeNull();
    });

    it('should get field mapping for field', async () => {
      const mockMappings: FieldMapping[] = [
        {
          id: 1,
          integrationId: 1,
          ourField: 'story_points',
          providerFieldId: 'customfield_10001',
          providerFieldName: 'Story Points',
          providerFieldType: 'number',
          confidence: 95,
          adminConfirmed: true,
        },
      ];

      const loadPromise = service.loadFieldMappings(1);
      const req = httpMock.expectOne('/api/integrations/1/mappings');
      req.flush(mockMappings);
      await loadPromise;

      const mapping = service.getFieldMappingForField('story_points');
      expect(mapping).toEqual(mockMappings[0]);

      const noMapping = service.getFieldMappingForField('sprint');
      expect(noMapping).toBeUndefined();
    });
  });
});
