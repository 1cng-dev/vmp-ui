import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Query all pending invoices
    const { data: invoices, error: queryError } = await supabase
      .from('invoices')
      .select('*')
      .eq('status', 'Pending')
      .not('due', 'is', null)

    if (queryError) {
      console.error('Error querying invoices:', queryError)
      return new Response(
        JSON.stringify({ success: false, error: queryError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!invoices || invoices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending invoices to check', updated: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get today's date
    const today = new Date()

    // Filter invoices where due date is past
    const overdueInvoices = invoices.filter(inv => {
      const dueDate = new Date(inv.due)
      return dueDate < today
    })

    if (overdueInvoices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No overdue invoices found', updated: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Update status to 'Overdue'
    let updatedCount = 0
    for (const invoice of overdueInvoices) {
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: 'Overdue' })
        .eq('id', invoice.id)

      if (updateError) {
        console.error(`Error updating invoice ${invoice.id}:`, updateError)
      } else {
        updatedCount++
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated ${updatedCount} invoices to Overdue status`,
        updated: updatedCount
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
