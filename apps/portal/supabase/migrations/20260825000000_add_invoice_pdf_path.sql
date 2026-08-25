-- Add pdf_path column to store the storage path for invoice PDFs
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS pdf_path TEXT;
