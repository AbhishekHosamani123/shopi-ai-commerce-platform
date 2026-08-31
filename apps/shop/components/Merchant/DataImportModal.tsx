'use client';
import { merchantFetch } from '@/components/Merchant/merchantFetch';

import React, { useState } from 'react';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [fileType, setFileType] = useState<string>('COGS');
  const [csvContent, setCsvContent] = useState<string>(
    'product_id,unit_cost,supplier_cost,shipping_cost,handling_cost\n20000001,1200,1050,90,60\n20000002,950,820,80,50\n20000003,1400,1200,110,90'
  );
  const [validationResult, setValidationResult] = useState<any>(null);
  const [commitResult, setCommitResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [step, setStep] = useState<'INPUT' | 'PREVIEW' | 'COMMITTED'>('INPUT');

  if (!isOpen) return null;

  const handleValidate = async () => {
    setLoading(true);
    try {
      const res = await merchantFetch('/api/merchant/data-import/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-merchant-role': 'merchant_admin',
          'x-merchant-id': 'default_merchant'
        },
        body: JSON.stringify({ csvContent, fileType })
      });
      const data = await res.json();
      if (data.success && data.result) {
        setValidationResult(data.result);
        setStep('PREVIEW');
      }
    } catch (e) {
      console.error('Validation error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    setLoading(true);
    try {
      const res = await merchantFetch('/api/merchant/data-import/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-merchant-role': 'merchant_admin',
          'x-merchant-id': 'default_merchant'
        },
        body: JSON.stringify({
          csvContent,
          fileType,
          filename: `${fileType.toLowerCase()}_upload_${Date.now()}.csv`
        })
      });
      const data = await res.json();
      if (data.success && data.result) {
        setCommitResult(data.result);
        setStep('COMMITTED');
        if (onSuccess) onSuccess();
      }
    } catch (e) {
      console.error('Commit error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="bg-slate-950/80 border-b border-slate-800 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-base font-bold">
              📥
            </div>
            <div>
              <h3 className="text-base font-bold text-white">CSV Historical & Cost Data Ingestion</h3>
              <p className="text-xs text-slate-400">Import telemetry with column validation, dry-run simulation and duplicate checks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
          {step === 'INPUT' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Data Domain</label>
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="COGS">Product Unit Cost of Goods Sold (COGS)</option>
                  <option value="PRODUCTS">Products Catalog & Categories</option>
                  <option value="ORDERS">Historical Sales & Orders</option>
                  <option value="SUPPLIERS">Suppliers Master & Lead Times</option>
                  <option value="CUSTOMERS">Customer Accounts & Segments</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">CSV Content / Raw Text</label>
                <textarea
                  rows={8}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                  placeholder="paste CSV rows here..."
                />
              </div>

              <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-3 text-xs text-slate-300 flex items-start gap-2">
                <span className="text-blue-400 text-sm shrink-0">🛡️</span>
                <span>
                  <strong>Dry-Run Guarantee:</strong> Validating first performs schema detection, checks required fields, and flags duplicate rows without altering production data.
                </span>
              </div>
            </div>
          )}

          {step === 'PREVIEW' && validationResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-400">Total Rows</span>
                  <div className="text-lg font-bold text-white">{validationResult.totalRows}</div>
                </div>
                <div className="bg-slate-950 border border-emerald-500/30 p-3 rounded-xl">
                  <span className="text-[11px] text-emerald-400">Valid</span>
                  <div className="text-lg font-bold text-emerald-400">{validationResult.validCount}</div>
                </div>
                <div className="bg-slate-950 border border-amber-500/30 p-3 rounded-xl">
                  <span className="text-[11px] text-amber-400">Duplicates</span>
                  <div className="text-lg font-bold text-amber-400">{validationResult.duplicateCount}</div>
                </div>
                <div className="bg-slate-950 border border-rose-500/30 p-3 rounded-xl">
                  <span className="text-[11px] text-rose-400">Invalid</span>
                  <div className="text-lg font-bold text-rose-400">{validationResult.invalidCount}</div>
                </div>
              </div>

              {validationResult.previewRows?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300">Parsed Row Preview:</h4>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="border-b border-slate-800 text-slate-400 bg-slate-900/50">
                        <tr>
                          {validationResult.detectedColumns.map((col: string) => (
                            <th key={col} className="p-2.5 font-bold uppercase">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {validationResult.previewRows.map((row: any, idx: number) => (
                          <tr key={idx}>
                            {validationResult.detectedColumns.map((col: string) => (
                              <td key={col} className="p-2.5">{row[col]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'COMMITTED' && commitResult && (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 text-2xl font-bold">
                ✓
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">Data Successfully Ingested</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Committed {commitResult.validRowsCommitted} rows to {commitResult.fileType} ledger.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950/80 border-t border-slate-800 p-4 flex items-center justify-between">
          {step === 'INPUT' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleValidate}
                disabled={loading || !csvContent.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20"
              >
                {loading ? 'Validating...' : 'Dry-Run Validate'}
              </button>
            </>
          )}

          {step === 'PREVIEW' && (
            <>
              <button
                onClick={() => setStep('INPUT')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Back to Edit
              </button>
              <button
                onClick={handleCommit}
                disabled={loading || validationResult?.validCount === 0}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
              >
                {loading ? 'Committing...' : `Commit ${validationResult?.validCount} Valid Rows`}
              </button>
            </>
          )}

          {step === 'COMMITTED' && (
            <button
              onClick={onClose}
              className="w-full px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
