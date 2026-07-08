-- Create support tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  category TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
  status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
  assignee TEXT,
  attachments TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_tickets_customer_id ON public.tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON public.tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_legacy_id ON public.tickets(legacy_id);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Staff can view all tickets"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "Staff can insert tickets"
  ON public.tickets FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "Staff can update tickets"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "Staff can delete tickets"
  ON public.tickets FOR DELETE
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "Customers can view their own tickets"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Customers can insert their own tickets"
  ON public.tickets FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update their own tickets"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_tickets_updated_at();

-- Ticket replies table (for conversation history)
CREATE TABLE IF NOT EXISTS public.ticket_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  who TEXT NOT NULL, -- 'customer' or staff name
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for ticket_replies
CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket_id ON public.ticket_replies(ticket_id);

-- Enable RLS for ticket_replies
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ticket_replies
CREATE POLICY "Staff can view all ticket replies"
  ON public.ticket_replies FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "Staff can insert ticket replies"
  ON public.ticket_replies FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "Customers can view replies to their own tickets"
  ON public.ticket_replies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = ticket_replies.ticket_id
      AND tickets.customer_id = auth.uid()
    )
  );

CREATE POLICY "Customers can insert replies to their own tickets"
  ON public.ticket_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = ticket_replies.ticket_id
      AND tickets.customer_id = auth.uid()
    )
  );


-- Add attachments column to ticket_replies table
ALTER TABLE public.ticket_replies ADD COLUMN IF NOT EXISTS attachments TEXT[] DEFAULT '{}';

-- Enable realtime replication for tickets and ticket_replies
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_replies;


