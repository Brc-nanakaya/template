ALTER TABLE "rag_chunks" ADD COLUMN "page_start" integer;--> statement-breakpoint
ALTER TABLE "rag_chunks" ADD COLUMN "embedding" jsonb;--> statement-breakpoint
ALTER TABLE "rag_documents" ADD COLUMN "page_count" integer;--> statement-breakpoint
ALTER TABLE "rag_documents" ADD COLUMN "uploaded_by" uuid;--> statement-breakpoint
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;