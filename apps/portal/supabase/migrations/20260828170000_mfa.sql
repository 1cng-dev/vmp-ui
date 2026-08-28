ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS mfa_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS mfa_disabled boolean DEFAULT false;
