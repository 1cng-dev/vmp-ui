-- Add column to track when customer last updated KYC documents
-- Run this in Supabase SQL Editor to update existing table

alter table public.customers 
add column if not exists kyc_documents_updated_at timestamptz;
