CREATE UNIQUE INDEX IF NOT EXISTS "jira_boards_unique" ON "jira_boards" USING btree ("integration_id","jira_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "jira_issues_unique" ON "jira_issues" USING btree ("integration_id","jira_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "jira_projects_unique" ON "jira_projects" USING btree ("integration_id","jira_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "jira_sprints_unique" ON "jira_sprints" USING btree ("integration_id","jira_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "required_fields_unique" ON "required_fields" USING btree ("integration_id","project_id","issue_type_id");