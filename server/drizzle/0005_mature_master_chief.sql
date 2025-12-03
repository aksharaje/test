CREATE TABLE IF NOT EXISTS "generated_artifacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"parent_id" integer,
	"input_description" text NOT NULL,
	"input_files" jsonb DEFAULT '[]'::jsonb,
	"knowledge_base_ids" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"generation_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_parent_id_generated_artifacts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."generated_artifacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
