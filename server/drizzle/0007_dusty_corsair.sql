CREATE TABLE IF NOT EXISTS "generated_prds" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"concept" text NOT NULL,
	"target_project" text,
	"target_persona" text,
	"industry_context" text,
	"primary_metric" text,
	"user_story_role" text,
	"user_story_goal" text,
	"user_story_benefit" text,
	"knowledge_base_ids" jsonb DEFAULT '[]'::jsonb,
	"input_files" jsonb DEFAULT '[]'::jsonb,
	"template_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"generation_metadata" jsonb,
	"citations" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prd_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" integer DEFAULT 0 NOT NULL,
	"is_custom" integer DEFAULT 0 NOT NULL,
	"system_prompt" text NOT NULL,
	"json_schema" jsonb,
	"user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generated_prds" ADD CONSTRAINT "generated_prds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generated_prds" ADD CONSTRAINT "generated_prds_template_id_prd_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."prd_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prd_templates" ADD CONSTRAINT "prd_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generated_prds_user_idx" ON "generated_prds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generated_prds_template_idx" ON "generated_prds" USING btree ("template_id");