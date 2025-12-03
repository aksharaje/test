import { Router } from 'express';
import multer from 'multer';
import { knowledgeBaseService } from '../services/knowledgeBase.js';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 20, // Max 20 files at once
  },
  fileFilter: (req, file, cb) => {
    // Allow text-based files
    const allowedMimes = [
      'text/plain',
      'text/markdown',
      'text/html',
      'text/css',
      'text/javascript',
      'application/json',
      'application/xml',
      'application/x-yaml',
    ];

    const allowedExtensions = [
      '.txt', '.md', '.html', '.css', '.js', '.ts', '.jsx', '.tsx',
      '.json', '.yaml', '.yml', '.xml', '.py', '.java', '.go', '.rs',
      '.c', '.cpp', '.h', '.rb', '.php', '.sql', '.sh',
    ];

    const ext = '.' + file.originalname.split('.').pop()?.toLowerCase();

    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

// List all knowledge bases
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const knowledgeBases = await knowledgeBaseService.list(userId);
    res.json(knowledgeBases);
  } catch (error) {
    console.error('Error listing knowledge bases:', error);
    res.status(500).json({ error: 'Failed to list knowledge bases' });
  }
});

// Create a new knowledge base
router.post('/', async (req, res) => {
  try {
    const { name, description, userId, settings } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const kb = await knowledgeBaseService.create({
      name,
      description,
      userId,
      settings,
    });

    res.status(201).json(kb);
  } catch (error) {
    console.error('Error creating knowledge base:', error);
    res.status(500).json({ error: 'Failed to create knowledge base' });
  }
});

// Get a specific knowledge base
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const kb = await knowledgeBaseService.get(id);

    if (!kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    res.json(kb);
  } catch (error) {
    console.error('Error getting knowledge base:', error);
    res.status(500).json({ error: 'Failed to get knowledge base' });
  }
});

// Update a knowledge base
router.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, settings } = req.body;

    const kb = await knowledgeBaseService.update(id, {
      name,
      description,
      settings,
    });

    if (!kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    res.json(kb);
  } catch (error) {
    console.error('Error updating knowledge base:', error);
    res.status(500).json({ error: 'Failed to update knowledge base' });
  }
});

// Delete a knowledge base
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await knowledgeBaseService.delete(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting knowledge base:', error);
    res.status(500).json({ error: 'Failed to delete knowledge base' });
  }
});

// Upload files to a knowledge base
router.post('/:id/upload', upload.array('files'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const fileData = files.map((file) => ({
      name: file.originalname,
      content: file.buffer.toString('utf-8'),
      mimeType: file.mimetype,
      size: file.size,
    }));

    const documents = await knowledgeBaseService.uploadFiles(id, fileData);

    // Start indexing in the background
    const indexPromise = knowledgeBaseService.indexKnowledgeBase(id);
    indexPromise.catch((err) => console.error('Background indexing error:', err));

    res.status(201).json({
      message: `${documents.length} file(s) uploaded. Indexing started.`,
      documents,
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Import from GitHub
router.post('/:id/github', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { repoUrl, token } = req.body;

    if (!repoUrl) {
      return res.status(400).json({ error: 'Repository URL is required' });
    }

    const documents = await knowledgeBaseService.importFromGitHub(id, repoUrl, token);

    // Start indexing in the background
    const indexPromise = knowledgeBaseService.indexKnowledgeBase(id);
    indexPromise.catch((err) => console.error('Background indexing error:', err));

    res.status(201).json({
      message: `${documents.length} file(s) imported from GitHub. Indexing started.`,
      documents,
    });
  } catch (error) {
    console.error('Error importing from GitHub:', error);
    const message = error instanceof Error ? error.message : 'Failed to import from GitHub';
    res.status(500).json({ error: message });
  }
});

// List documents in a knowledge base
router.get('/:id/documents', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const documents = await knowledgeBaseService.getDocuments(id);
    res.json(documents);
  } catch (error) {
    console.error('Error listing documents:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

// Delete a document
router.delete('/:id/documents/:docId', async (req, res) => {
  try {
    const docId = parseInt(req.params.docId);
    const deleted = await knowledgeBaseService.deleteDocument(docId);

    if (!deleted) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Semantic search / RAG query
router.post('/:id/query', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { query, limit = 5, threshold = 0.7 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results = await knowledgeBaseService.search(id, query, limit, threshold);

    res.json({
      query,
      results,
      count: results.length,
    });
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    const message = error instanceof Error ? error.message : 'Failed to search knowledge base';
    res.status(500).json({ error: message });
  }
});

// Re-index a knowledge base
router.post('/:id/reindex', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Start indexing in the background
    const indexPromise = knowledgeBaseService.indexKnowledgeBase(id);
    indexPromise.catch((err) => console.error('Background indexing error:', err));

    res.json({ message: 'Re-indexing started' });
  } catch (error) {
    console.error('Error starting re-index:', error);
    res.status(500).json({ error: 'Failed to start re-indexing' });
  }
});

export default router;
