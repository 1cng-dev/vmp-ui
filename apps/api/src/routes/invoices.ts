import express from 'express';
import { pool } from '../services/database.js';

const router = express.Router();

// ── GET /invoices ───────────────────────────────────────────────────────────
// Get all invoices (admin view for aging receivables)
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.id, i.legacy_id, i.customer_id, i.amount, i.currency, i.status,
              i.issued, i.due, i.paid_date, i.method, i.receipt, i.notes,
              COALESCE(json_agg(ii) FILTER (WHERE ii.id IS NOT NULL), '[]') AS items
       FROM invoices i
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       GROUP BY i.id
       ORDER BY i.issued DESC`
    );
    res.json({ ok: true, data: rows });
  } catch (err: any) {
    console.error('[invoices] Failed to fetch invoices:', err.message);
    res.status(500).json({ ok: false, error: 'Failed to fetch invoices' });
  }
});

// ── GET /invoices/:id ───────────────────────────────────────────────────────
// Get single invoice by ID
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.id, i.legacy_id, i.customer_id, i.amount, i.currency, i.status,
              i.issued, i.due, i.paid_date, i.method, i.receipt, i.notes,
              COALESCE(json_agg(ii) FILTER (WHERE ii.id IS NOT NULL), '[]') AS items
       FROM invoices i
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       WHERE i.id = $1
       GROUP BY i.id`,
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Invoice not found' });
    }
    
    res.json({ ok: true, data: rows[0] });
  } catch (err: any) {
    console.error('[invoices] Failed to fetch invoice:', err.message);
    res.status(500).json({ ok: false, error: 'Failed to fetch invoice' });
  }
});

// ── PATCH /invoices/:id ──────────────────────────────────────────────────────
// Update invoice (e.g., mark as paid)
router.patch('/:id', async (req, res) => {
  try {
    const { status, receipt, paid_at } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (receipt !== undefined) {
      updates.push(`receipt = $${paramCount++}`);
      values.push(receipt);
    }
    if (paid_at !== undefined) {
      updates.push(`paid_at = $${paramCount++}`);
      values.push(paid_at);
    }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: 'No fields to update' });
    }

    values.push(req.params.id);
    
    const { rows } = await pool.query(
      `UPDATE invoices SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Invoice not found' });
    }

    res.json({ ok: true, data: rows[0] });
  } catch (err: any) {
    console.error('[invoices] Failed to update invoice:', err.message);
    res.status(500).json({ ok: false, error: 'Failed to update invoice' });
  }
});

export default router;
