-- Add force_password_change field to customers table
-- This flag is used to force customers to change their password on first login

alter table public.customers 
add column if not exists force_password_change boolean default false;
