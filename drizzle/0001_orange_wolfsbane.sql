CREATE TYPE "public"."rag_reference_kind" AS ENUM('refers', 'applies');--> statement-breakpoint
CREATE TABLE "rag_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"law_id" text NOT NULL,
	"article" integer NOT NULL,
	"paragraph" integer,
	"chunk_key" text NOT NULL,
	"heading" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"law_id" text NOT NULL,
	"title" text NOT NULL,
	"file_name" text NOT NULL,
	"object_key" text NOT NULL,
	"source_type" text DEFAULT 'text' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_chunk_id" uuid NOT NULL,
	"to_law_id" text NOT NULL,
	"to_article" integer NOT NULL,
	"to_chunk_id" uuid,
	"kind" "rag_reference_kind" NOT NULL,
	"raw_text" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_document_id_rag_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."rag_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_references" ADD CONSTRAINT "rag_references_from_chunk_id_rag_chunks_id_fk" FOREIGN KEY ("from_chunk_id") REFERENCES "public"."rag_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_references" ADD CONSTRAINT "rag_references_to_chunk_id_rag_chunks_id_fk" FOREIGN KEY ("to_chunk_id") REFERENCES "public"."rag_chunks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rag_chunks_chunk_key_unique" ON "rag_chunks" USING btree ("chunk_key");--> statement-breakpoint
CREATE INDEX "rag_chunks_law_id_article_idx" ON "rag_chunks" USING btree ("law_id","article");--> statement-breakpoint
CREATE UNIQUE INDEX "rag_documents_law_id_unique" ON "rag_documents" USING btree ("law_id");--> statement-breakpoint
CREATE INDEX "rag_references_from_chunk_id_idx" ON "rag_references" USING btree ("from_chunk_id");--> statement-breakpoint
CREATE INDEX "rag_references_to_law_article_idx" ON "rag_references" USING btree ("to_law_id","to_article");