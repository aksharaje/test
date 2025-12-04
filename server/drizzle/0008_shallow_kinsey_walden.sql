CREATE TABLE IF NOT EXISTS "artifact_jira_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"artifact_type" text NOT NULL,
	"artifact_id" integer NOT NULL,
	"integration_id" integer NOT NULL,
	"jira_issue_id" text NOT NULL,
	"jira_issue_key" text NOT NULL,
	"jira_project_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "field_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"integration_id" integer NOT NULL,
	"our_field" text NOT NULL,
	"provider_field_id" text NOT NULL,
	"provider_field_name" text NOT NULL,
	"provider_field_type" text,
	"confidence" integer DEFAULT 0 NOT NULL,
	"admin_confirmed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"cloud_id" text,
	"auth_type" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"scopes" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'connected' NOT NULL,
	"last_sync_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jira_boards" (
	"id" serial PRIMARY KEY NOT NULL,
	"integration_id" integer NOT NULL,
	"jira_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"project_id" text,
	"project_key" text,
	"velocity_avg" integer,
	"velocity_last_n" integer DEFAULT 5,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jira_issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"integration_id" integer NOT NULL,
	"jira_id" text NOT NULL,
	"key" text NOT NULL,
	"summary" text NOT NULL,
	"description" text,
	"issue_type" text NOT NULL,
	"issue_type_id" text NOT NULL,
	"status" text NOT NULL,
	"status_category" text,
	"priority" text,
	"assignee_id" text,
	"assignee_name" text,
	"reporter_id" text,
	"reporter_name" text,
	"story_points" integer,
	"sprint_id" integer,
	"epic_key" text,
	"parent_key" text,
	"labels" jsonb DEFAULT '[]'::jsonb,
	"components" jsonb DEFAULT '[]'::jsonb,
	"project_key" text NOT NULL,
	"created_date" timestamp,
	"updated_date" timestamp,
	"resolution_date" timestamp,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jira_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"integration_id" integer NOT NULL,
	"jira_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"project_type" text,
	"avatar_url" text,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jira_sprints" (
	"id" serial PRIMARY KEY NOT NULL,
	"integration_id" integer NOT NULL,
	"board_id" integer NOT NULL,
	"jira_id" integer NOT NULL,
	"name" text NOT NULL,
	"state" text NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"completed_points" integer,
	"committed_points" integer,
	"goal" text,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pi_planned_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"jira_issue_id" text,
	"jira_issue_key" text,
	"title" text NOT NULL,
	"assigned_board_id" integer,
	"target_sprint_id" integer,
	"sequence_order" integer,
	"estimated_points" integer,
	"confidence" integer,
	"dependencies" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"ai_suggested" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pi_planning_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"integration_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"sprint_count" integer DEFAULT 5,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pi_session_boards" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"board_id" integer NOT NULL,
	"board_name" text NOT NULL,
	"velocity_override" integer,
	"capacity_adjustment" integer DEFAULT 100,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "required_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"integration_id" integer NOT NULL,
	"project_id" text NOT NULL,
	"project_key" text NOT NULL,
	"issue_type_id" text NOT NULL,
	"issue_type_name" text NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artifact_jira_links" ADD CONSTRAINT "artifact_jira_links_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_mappings" ADD CONSTRAINT "field_mappings_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jira_boards" ADD CONSTRAINT "jira_boards_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jira_issues" ADD CONSTRAINT "jira_issues_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jira_projects" ADD CONSTRAINT "jira_projects_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jira_sprints" ADD CONSTRAINT "jira_sprints_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pi_planned_items" ADD CONSTRAINT "pi_planned_items_session_id_pi_planning_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pi_planning_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pi_planning_sessions" ADD CONSTRAINT "pi_planning_sessions_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pi_planning_sessions" ADD CONSTRAINT "pi_planning_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pi_session_boards" ADD CONSTRAINT "pi_session_boards_session_id_pi_planning_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pi_planning_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "required_fields" ADD CONSTRAINT "required_fields_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artifact_jira_links_artifact_idx" ON "artifact_jira_links" USING btree ("artifact_type","artifact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artifact_jira_links_integration_idx" ON "artifact_jira_links" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "field_mappings_integration_idx" ON "field_mappings" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integrations_provider_idx" ON "integrations" USING btree ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integrations_status_idx" ON "integrations" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jira_boards_integration_idx" ON "jira_boards" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jira_issues_integration_idx" ON "jira_issues" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jira_issues_key_idx" ON "jira_issues" USING btree ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jira_issues_epic_idx" ON "jira_issues" USING btree ("epic_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jira_issues_sprint_idx" ON "jira_issues" USING btree ("sprint_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jira_issues_assignee_idx" ON "jira_issues" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jira_issues_project_idx" ON "jira_issues" USING btree ("project_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jira_projects_integration_idx" ON "jira_projects" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jira_sprints_integration_idx" ON "jira_sprints" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jira_sprints_board_idx" ON "jira_sprints" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jira_sprints_state_idx" ON "jira_sprints" USING btree ("state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pi_planned_items_session_idx" ON "pi_planned_items" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pi_planned_items_board_idx" ON "pi_planned_items" USING btree ("assigned_board_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pi_planned_items_sprint_idx" ON "pi_planned_items" USING btree ("target_sprint_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pi_sessions_integration_idx" ON "pi_planning_sessions" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pi_sessions_status_idx" ON "pi_planning_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pi_session_boards_session_idx" ON "pi_session_boards" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "required_fields_integration_idx" ON "required_fields" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "required_fields_project_idx" ON "required_fields" USING btree ("project_id");