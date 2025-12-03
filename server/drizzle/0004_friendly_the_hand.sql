ALTER TABLE "document_chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(768);--> statement-breakpoint
ALTER TABLE "document_chunks" ALTER COLUMN "metadata" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "knowledge_bases" ALTER COLUMN "settings" SET DEFAULT '{"chunkSize":1000,"chunkOverlap":200,"embeddingModel":"google/gemini-embedding-001"}'::jsonb;