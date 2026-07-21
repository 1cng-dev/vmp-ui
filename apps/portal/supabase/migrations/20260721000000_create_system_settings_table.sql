-- Create system_settings table to store global company settings
-- This table will have a single row with id = 1 that contains company-wide settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'One Cloud Next-Gen',
  logo_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default settings
INSERT INTO public.system_settings (company_name)
VALUES ('One Cloud Next-Gen')
ON CONFLICT DO NOTHING;

-- Enable RLS (only team members can update settings)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Team members can view settings
CREATE POLICY "Team members can view system settings"
  ON public.system_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.user_id = auth.uid()
    )
  );

-- Policy: Team members can update settings
CREATE POLICY "Team members can update system settings"
  ON public.system_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.user_id = auth.uid()
    )
  );

-- Enable realtime for system settings
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
