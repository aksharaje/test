import { Router } from 'express';
import crypto from 'crypto';
import {
  integrationService,
  getOAuthAuthorizationUrl,
  handleOAuthCallback,
  connectWithPAT,
  getAvailableFields,
  syncRequiredFields,
  getRequiredFieldsForProject,
} from '../services/jira/integration.service.js';
import type { MappableField } from '../db/schema.js';

const router = Router();

// Frontend URL for redirects after OAuth
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4200';

// In-memory state store for OAuth (in production, use Redis or DB)
const oauthStates = new Map<string, { createdAt: number; returnUrl?: string }>();

// Clean up expired states (older than 10 minutes)
function cleanupExpiredStates() {
  const now = Date.now();
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.createdAt > 10 * 60 * 1000) {
      oauthStates.delete(state);
    }
  }
}

// ==================
// OAuth Flow
// ==================

// Start OAuth flow - returns authorization URL
router.post('/jira/oauth/start', (req, res) => {
  try {
    cleanupExpiredStates();

    const { returnUrl } = req.body;
    const state = crypto.randomUUID();

    oauthStates.set(state, {
      createdAt: Date.now(),
      returnUrl,
    });

    const authUrl = getOAuthAuthorizationUrl(state);
    res.json({ authUrl, state });
  } catch (error) {
    console.error('Error starting OAuth flow:', error);
    res.status(500).json({ error: 'Failed to start OAuth flow' });
  }
});

// OAuth callback - exchanges code for tokens and creates integration
router.get('/jira/oauth/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error('OAuth error:', error);
      return res.redirect(`${FRONTEND_URL}/settings/integrations?error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}/settings/integrations?error=missing_params`);
    }

    // Validate state
    const stateData = oauthStates.get(state as string);
    if (!stateData) {
      return res.redirect(`${FRONTEND_URL}/settings/integrations?error=invalid_state`);
    }
    oauthStates.delete(state as string);

    // Exchange code for tokens and create integration
    const integration = await handleOAuthCallback(code as string);

    // Redirect to frontend with success
    // Handle both relative and absolute URLs
    let returnUrl = stateData.returnUrl || '/settings/integrations';
    if (returnUrl.startsWith('/')) {
      returnUrl = `${FRONTEND_URL}${returnUrl}`;
    }
    res.redirect(`${returnUrl}?integration_id=${integration.id}&success=true`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    const message = error instanceof Error ? error.message : 'OAuth callback failed';
    res.redirect(`${FRONTEND_URL}/settings/integrations?error=${encodeURIComponent(message)}`);
  }
});

// ==================
// PAT Connection
// ==================

// Connect using Personal Access Token
router.post('/jira/pat', async (req, res) => {
  try {
    const { baseUrl, pat, name } = req.body;

    if (!baseUrl || !pat) {
      return res.status(400).json({ error: 'baseUrl and pat are required' });
    }

    const integration = await connectWithPAT(baseUrl, pat, name);
    res.status(201).json(integration);
  } catch (error) {
    console.error('PAT connection error:', error);
    const message = error instanceof Error ? error.message : 'Failed to connect with PAT';
    res.status(400).json({ error: message });
  }
});

// ==================
// Integration CRUD
// ==================

// List all integrations
router.get('/', async (req, res) => {
  try {
    const integrations = await integrationService.list();
    res.json(integrations);
  } catch (error) {
    console.error('Error listing integrations:', error);
    res.status(500).json({ error: 'Failed to list integrations' });
  }
});

// Get a specific integration
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const integration = await integrationService.get(id);

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    res.json(integration);
  } catch (error) {
    console.error('Error getting integration:', error);
    res.status(500).json({ error: 'Failed to get integration' });
  }
});

// Delete (disconnect) an integration
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await integrationService.delete(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting integration:', error);
    res.status(500).json({ error: 'Failed to delete integration' });
  }
});

// ==================
// Sync
// ==================

// Trigger a sync for an integration
router.post('/:id/sync', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const integration = await integrationService.get(id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    await integrationService.sync(id);

    // Return updated integration
    const updated = await integrationService.get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error syncing integration:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    res.status(500).json({ error: message });
  }
});

// ==================
// Field Mappings
// ==================

// Get field mappings for an integration
router.get('/:id/mappings', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const integration = await integrationService.get(id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const mappings = await integrationService.getFieldMappings(id);
    res.json(mappings);
  } catch (error) {
    console.error('Error getting field mappings:', error);
    res.status(500).json({ error: 'Failed to get field mappings' });
  }
});

// Update a field mapping
router.put('/:id/mappings/:ourField', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const ourField = req.params.ourField as MappableField;
    const { providerFieldId, providerFieldName, providerFieldType } = req.body;

    if (!providerFieldId || !providerFieldName) {
      return res.status(400).json({ error: 'providerFieldId and providerFieldName are required' });
    }

    const integration = await integrationService.get(id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const mapping = await integrationService.updateFieldMapping(
      id,
      ourField,
      providerFieldId,
      providerFieldName,
      providerFieldType
    );

    res.json(mapping);
  } catch (error) {
    console.error('Error updating field mapping:', error);
    res.status(500).json({ error: 'Failed to update field mapping' });
  }
});

// Delete a field mapping
router.delete('/:id/mappings/:ourField', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const ourField = req.params.ourField as MappableField;

    const integration = await integrationService.get(id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const deleted = await integrationService.deleteFieldMapping(id, ourField);

    if (!deleted) {
      return res.status(404).json({ error: 'Field mapping not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting field mapping:', error);
    res.status(500).json({ error: 'Failed to delete field mapping' });
  }
});

// Get available fields from Jira
router.get('/:id/fields', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const integration = await integrationService.get(id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const fields = await getAvailableFields(id);
    res.json(fields);
  } catch (error) {
    console.error('Error getting available fields:', error);
    res.status(500).json({ error: 'Failed to get available fields' });
  }
});

// ==================
// Required Fields
// ==================

// Get required fields for a project
router.get('/:id/projects/:projectKey/required-fields', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { projectKey } = req.params;

    const integration = await integrationService.get(id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Check if we have cached required fields, if not sync them
    let requiredFieldsList = await getRequiredFieldsForProject(id, projectKey);

    if (requiredFieldsList.length === 0) {
      await syncRequiredFields(id, projectKey);
      requiredFieldsList = await getRequiredFieldsForProject(id, projectKey);
    }

    res.json(requiredFieldsList);
  } catch (error) {
    console.error('Error getting required fields:', error);
    res.status(500).json({ error: 'Failed to get required fields' });
  }
});

// Sync required fields for a project
router.post('/:id/projects/:projectKey/required-fields/sync', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { projectKey } = req.params;

    const integration = await integrationService.get(id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    await syncRequiredFields(id, projectKey);
    const requiredFieldsList = await getRequiredFieldsForProject(id, projectKey);

    res.json(requiredFieldsList);
  } catch (error) {
    console.error('Error syncing required fields:', error);
    res.status(500).json({ error: 'Failed to sync required fields' });
  }
});

export default router;
