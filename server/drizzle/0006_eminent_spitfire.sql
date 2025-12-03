CREATE TABLE IF NOT EXISTS "agent_executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"split_test_id" integer,
	"prompt_version_id" integer,
	"conversation_id" integer,
	"input_prompt" text NOT NULL,
	"response" text NOT NULL,
	"metadata" jsonb,
	"executed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "code_chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "code_chat_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"title" text,
	"knowledge_base_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "extracted_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"feedback_id" integer NOT NULL,
	"content" text NOT NULL,
	"knowledge_base_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"execution_id" integer NOT NULL,
	"user_id" integer,
	"sentiment" text NOT NULL,
	"text" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation_extracted_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"feedback_id" integer NOT NULL,
	"content" text NOT NULL,
	"knowledge_base_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"artifact_id" integer NOT NULL,
	"user_id" integer,
	"sentiment" text NOT NULL,
	"text" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prompt_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"version" integer NOT NULL,
	"system_prompt" text NOT NULL,
	"model" text DEFAULT 'google/gemini-2.0-flash-001' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prompt_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"version" integer NOT NULL,
	"system_prompt" text NOT NULL,
	"model" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "split_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"prompt_version_ids" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story_generator_split_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"artifact_type" text NOT NULL,
	"prompt_template_ids" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generated_artifacts" DROP CONSTRAINT "generated_artifacts_parent_id_generated_artifacts_id_fk";
--> statement-breakpoint
ALTER TABLE "document_chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(1536);--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD COLUMN "prompt_template_id" integer;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD COLUMN "split_test_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_executions" ADD CONSTRAINT "agent_executions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_executions" ADD CONSTRAINT "agent_executions_split_test_id_split_tests_id_fk" FOREIGN KEY ("split_test_id") REFERENCES "public"."split_tests"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_executions" ADD CONSTRAINT "agent_executions_prompt_version_id_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_executions" ADD CONSTRAINT "agent_executions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "code_chat_messages" ADD CONSTRAINT "code_chat_messages_session_id_code_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."code_chat_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "code_chat_sessions" ADD CONSTRAINT "code_chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "extracted_facts" ADD CONSTRAINT "extracted_facts_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "extracted_facts" ADD CONSTRAINT "extracted_facts_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback" ADD CONSTRAINT "feedback_execution_id_agent_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."agent_executions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation_extracted_facts" ADD CONSTRAINT "generation_extracted_facts_feedback_id_generation_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."generation_feedback"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation_extracted_facts" ADD CONSTRAINT "generation_extracted_facts_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation_feedback" ADD CONSTRAINT "generation_feedback_artifact_id_generated_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."generated_artifacts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation_feedback" ADD CONSTRAINT "generation_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "split_tests" ADD CONSTRAINT "split_tests_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_executions_agent_idx" ON "agent_executions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_executions_split_test_idx" ON "agent_executions" USING btree ("split_test_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_executions_version_idx" ON "agent_executions" USING btree ("prompt_version_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extracted_facts_feedback_idx" ON "extracted_facts" USING btree ("feedback_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extracted_facts_status_idx" ON "extracted_facts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_execution_idx" ON "feedback" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_sentiment_idx" ON "feedback" USING btree ("sentiment");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gen_extracted_facts_feedback_idx" ON "generation_extracted_facts" USING btree ("feedback_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gen_extracted_facts_status_idx" ON "generation_extracted_facts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_feedback_artifact_idx" ON "generation_feedback" USING btree ("artifact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_feedback_sentiment_idx" ON "generation_feedback" USING btree ("sentiment");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prompt_templates_type_idx" ON "prompt_templates" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prompt_templates_status_idx" ON "prompt_templates" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prompt_versions_agent_idx" ON "prompt_versions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "split_tests_agent_idx" ON "split_tests" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "split_tests_status_idx" ON "split_tests" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sg_split_tests_type_idx" ON "story_generator_split_tests" USING btree ("artifact_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sg_split_tests_status_idx" ON "story_generator_split_tests" USING btree ("status");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_prompt_template_id_prompt_templates_id_fk" FOREIGN KEY ("prompt_template_id") REFERENCES "public"."prompt_templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_split_test_id_story_generator_split_tests_id_fk" FOREIGN KEY ("split_test_id") REFERENCES "public"."story_generator_split_tests"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generated_artifacts_template_idx" ON "generated_artifacts" USING btree ("prompt_template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generated_artifacts_split_test_idx" ON "generated_artifacts" USING btree ("split_test_id");