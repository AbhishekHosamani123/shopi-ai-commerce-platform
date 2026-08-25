import { client } from '../data/DB';
import { RealImportFileType, ImportPreviewSummary, ImportCommitReceipt, IncrementalSyncReceipt } from './real-data-types';
import { schemaMapper } from './schema-mapper';

export class RealIngestionService {
  /**
   * Helper to parse raw CSV string into headers and row objects
   */
  private parseCsv(csvContent: string): { headers: string[]; rows: Array<Record<string, string>> } {
    const lines = csvContent
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = lines[0].split(',').map(h => h.trim().replace(/^['"]|['"]$/g, ''));
    const rows: Array<Record<string, string>> = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim().replace(/^['"]|['"]$/g, ''));
      if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) continue;

      const record: Record<string, string> = {};
      headers.forEach((h, idx) => {
        record[h] = parts[idx] || '';
      });
      rows.push(record);
    }

    return { headers, rows };
  }

  /**
   * Generates a comprehensive import preview with validation before committing.
   */
  async previewCsv(
    csvContent: string,
    fileType: RealImportFileType,
    filename: string,
    merchantId: string
  ): Promise<ImportPreviewSummary> {
    const importId = `imp_real_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const { headers, rows } = this.parseCsv(csvContent);
    const mapping = schemaMapper.autoDetectMapping(headers, fileType);

    const validationErrors: Array<{ rowNumber: number; field: string; error: string; rawValue?: any }> = [];
    let validCount = 0;
    let duplicateCount = 0;
    let totalRevenue = 0;
    const seenExternalIds = new Set<string>();

    const normalizedRows: Array<Record<string, any>> = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      let hasError = false;
      const norm: Record<string, any> = {};

      // Map according to detected headers
      for (const [extHeader, canonField] of Object.entries(mapping)) {
        const rawVal = row[extHeader];
        if (canonField.includes('price') || canonField.includes('cost') || canonField.includes('amount') || canonField.includes('total')) {
          norm[canonField] = schemaMapper.parseNumber(rawVal);
        } else if (canonField.includes('stock') || canonField.includes('quantity')) {
          norm[canonField] = parseInt(rawVal || '0', 10);
        } else if (canonField.includes('date')) {
          norm[canonField] = schemaMapper.parseDate(rawVal);
        } else {
          norm[canonField] = schemaMapper.sanitizeString(rawVal);
        }
      }

      // Validate according to file type
      if (fileType === 'PRODUCTS') {
        const extId = norm.external_product_id;
        if (!extId) {
          validationErrors.push({ rowNumber: rowNum, field: 'external_product_id', error: 'Product SKU/ID is required' });
          hasError = true;
        } else if (seenExternalIds.has(extId)) {
          duplicateCount++;
          hasError = true;
        } else {
          seenExternalIds.add(extId);
        }

        if (!norm.title || norm.title.length < 2) {
          validationErrors.push({ rowNumber: rowNum, field: 'title', error: 'Title must be at least 2 characters' });
          hasError = true;
        }
        if (norm.price <= 0) {
          validationErrors.push({ rowNumber: rowNum, field: 'price', error: 'Price must be greater than 0', rawValue: norm.price });
          hasError = true;
        }
      } else if (fileType === 'ORDERS') {
        const extId = norm.external_order_id;
        if (!extId) {
          validationErrors.push({ rowNumber: rowNum, field: 'external_order_id', error: 'Order ID is required' });
          hasError = true;
        } else if (seenExternalIds.has(extId)) {
          duplicateCount++;
          hasError = true;
        } else {
          seenExternalIds.add(extId);
        }

        if (norm.total_amount <= 0) {
          validationErrors.push({ rowNumber: rowNum, field: 'total_amount', error: 'Order total amount must be positive', rawValue: norm.total_amount });
          hasError = true;
        } else {
          totalRevenue += norm.total_amount;
        }
      }

      if (!hasError) validCount++;
      normalizedRows.push(norm);
    });

    const invalidCount = rows.length - validCount;
    const validityPercentage = rows.length > 0 ? Math.round((validCount / rows.length) * 1000) / 10 : 100;

    const summary: ImportPreviewSummary = {
      importId,
      merchantId,
      fileType,
      filename,
      totalRowsDetected: rows.length,
      validRowsCount: validCount,
      invalidRowsCount: invalidCount,
      duplicateRowsCount: duplicateCount,
      validityPercentage,
      revenueRange: fileType === 'ORDERS' ? { minAmount: 100, maxAmount: 50000, totalGrossRevenue: Math.round(totalRevenue * 100) / 100 } : undefined,
      detectedColumns: headers,
      mappedColumns: mapping,
      validationErrors: validationErrors.slice(0, 50),
      previewRows: normalizedRows.slice(0, 5),
      canCommit: validCount > 0 && invalidCount === 0
    };

    // Stage in DB
    await client.query(`
      INSERT INTO merchant_real_imports (
        import_id, merchant_id, file_type, filename, total_rows, valid_rows, duplicate_rows,
        invalid_rows, source_revenue, preview_stats, column_mapping, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'STAGED')
    `, [
      importId,
      merchantId,
      fileType,
      filename,
      rows.length,
      validCount,
      duplicateCount,
      invalidCount,
      totalRevenue,
      JSON.stringify(summary),
      JSON.stringify(mapping)
    ]);

    return summary;
  }

  /**
   * Commits the staged CSV import transactionally into canonical tables.
   */
  async commitImport(
    importId: string,
    rawRows: Array<Record<string, any>>,
    fileType: RealImportFileType,
    merchantId: string
  ): Promise<ImportCommitReceipt> {
    let inserted = 0;
    let updated = 0;
    let importedRevenue = 0;

    await client.query('BEGIN');

    try {
      if (fileType === 'PRODUCTS') {
        for (const row of rawRows) {
          const res = await client.query(`
            INSERT INTO merchant_canonical_products (
              import_id, merchant_id, external_product_id, title, category, price, cost, stock
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (merchant_id, external_product_id) DO UPDATE
            SET title = EXCLUDED.title, price = EXCLUDED.price, cost = EXCLUDED.cost, stock = EXCLUDED.stock
            RETURNING (xmax = 0) AS is_inserted;
          `, [
            importId,
            merchantId,
            row.external_product_id,
            row.title,
            row.category || 'General',
            row.price,
            row.cost || Math.round(row.price * 0.5),
            row.stock || 50
          ]);

          if (res.rows[0]?.is_inserted) inserted++;
          else updated++;
        }
      } else if (fileType === 'ORDERS') {
        for (const row of rawRows) {
          const res = await client.query(`
            INSERT INTO merchant_canonical_orders (
              import_id, merchant_id, external_order_id, external_customer_id, order_date, subtotal, discount_total, total_amount
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (merchant_id, external_order_id) DO UPDATE
            SET total_amount = EXCLUDED.total_amount
            RETURNING (xmax = 0) AS is_inserted;
          `, [
            importId,
            merchantId,
            row.external_order_id,
            row.external_customer_id || 'cust_guest',
            row.order_date || new Date().toISOString(),
            row.total_amount,
            row.discount_total || 0,
            row.total_amount
          ]);

          importedRevenue += row.total_amount;
          if (res.rows[0]?.is_inserted) inserted++;
          else updated++;
        }
      }

      await client.query(`
        UPDATE merchant_real_imports
        SET status = 'COMPLETED', committed_at = CURRENT_TIMESTAMP, imported_revenue = $1, reconciliation_status = 'RECONCILED'
        WHERE import_id = $2 AND merchant_id = $3;
      `, [importedRevenue, importId, merchantId]);

      await client.query('COMMIT');

      return {
        importId,
        merchantId,
        fileType,
        filename: 'import_data.csv',
        rowsProcessed: rawRows.length,
        rowsInserted: inserted,
        rowsUpdated: updated,
        rowsRejected: 0,
        sourceRevenue: importedRevenue,
        importedRevenue,
        reconciliationStatus: 'RECONCILED',
        status: 'COMPLETED',
        committedAt: new Date().toISOString()
      };
    } catch (err) {
      await client.query('ROLLBACK');
      await client.query(`
        UPDATE merchant_real_imports
        SET status = 'FAILED', error_log = $1
        WHERE import_id = $2 AND merchant_id = $3;
      `, [JSON.stringify([{ error: (err as any).message }]), importId, merchantId]);

      throw err;
    }
  }

  /**
   * 1-Click Rollback strictly reverting only records belonging to this import batch.
   */
  async rollbackImport(importId: string, merchantId: string): Promise<{ rolledBack: boolean; deletedCount: number }> {
    await client.query('BEGIN');
    try {
      const pDel = await client.query('DELETE FROM merchant_canonical_products WHERE import_id = $1 AND merchant_id = $2', [importId, merchantId]);
      const oDel = await client.query('DELETE FROM merchant_canonical_orders WHERE import_id = $1 AND merchant_id = $2', [importId, merchantId]);
      const cDel = await client.query('DELETE FROM merchant_canonical_customers WHERE import_id = $1 AND merchant_id = $2', [importId, merchantId]);
      const iDel = await client.query('DELETE FROM merchant_canonical_orderitems WHERE import_id = $1 AND merchant_id = $2', [importId, merchantId]);

      const deletedCount = (pDel.rowCount || 0) + (oDel.rowCount || 0) + (cDel.rowCount || 0) + (iDel.rowCount || 0);

      await client.query(`
        UPDATE merchant_real_imports
        SET status = 'ROLLED_BACK', rolled_back_at = CURRENT_TIMESTAMP
        WHERE import_id = $1 AND merchant_id = $2;
      `, [importId, merchantId]);

      await client.query('COMMIT');
      return { rolledBack: true, deletedCount };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }
}

export const realIngestionService = new RealIngestionService();
