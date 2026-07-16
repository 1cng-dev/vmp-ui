-- Add created_by column to invoices table to track who created the invoice
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS created_by text;
