import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Modal from '../../components/Modal';
import PageHeader from '../../components/PageHeader';
import api from '../../utils/axiosInstance';
import { getSession } from '../../utils/session';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatNumber = (value) => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return '0.00';
  if (num < 0) {
    return `${Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}-`;
  }
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getMatrixValues = (row) => ({
  malayalamOwn: row.language_id === 1 && row.own === 1 ? row.item_value : 0,
  malayalamOthers: row.language_id === 1 && row.own === 0 ? row.item_value : 0,
  englishOwn: row.language_id === 0 && row.own === 1 ? row.item_value : 0,
  englishOthers: row.language_id === 0 && row.own === 0 ? row.item_value : 0,
});

export default function DailyStockStatement() {
  const { branch } = getSession();
  const branchId = branch?.id || null;

  const [formData, setFormData] = useState({ as_on_date: '' });
  const [modal, setModal] = useState({
    isOpen: false,
    message: '',
    type: 'info',
    buttons: [],
  });
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportParams, setReportParams] = useState(null);
  const reportRef = useRef(null);

  useEffect(() => {
    const today = new Date();
    setFormData({ as_on_date: today.toISOString().split('T')[0] });
  }, []);

  const showModal = (message, type = 'info', buttons) => {
    setModal({
      isOpen: true,
      message,
      type,
      buttons:
        buttons ||
        [{ label: 'OK', onClick: () => closeModal(), className: 'bg-blue-500 hover:bg-blue-600' }],
    });
  };

  const closeModal = () => {
    setModal({ isOpen: false, message: '', type: 'info', buttons: [] });
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.as_on_date) {
      showModal('Please select an As On Date', 'error');
      return;
    }

    if (!branchId) {
      showModal('Branch information not found. Please log in again.', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await api.get('/auth/reports/daily-stock-statement/', {
        params: {
          branch_id: branchId,
          as_on_date: formData.as_on_date,
        },
      });

      setReportData(response.data.report_data || null);
      setReportParams(response.data.parameters || null);
    } catch (error) {
      console.error('Error generating daily stock statement:', error);
      showModal(`Failed to generate report: ${error.response?.data?.error || error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!reportRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Daily Stock Statement</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: 'Times New Roman', serif;
            margin: 20px;
            font-size: 11px;
            color: #000;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          th, td {
            padding: 4px 6px;
            border: none;
            vertical-align: top;
          }
          th {
            border-top: 1px solid #b5b3b3;
            border-bottom: 1px solid #b5b3b3;
            text-align: left;
            font-weight: normal;
          }
          .text-right { text-align: right; }
          .report-header { margin-bottom: 16px; }
          .company-name { font-size: 18px; font-weight: bold; }
          .report-title { font-size: 14px; font-weight: bold; margin-top: 6px; }
          .report-subtitle { margin-top: 4px; margin-bottom: 14px; }
          .section { margin-top: 20px; }
          .section-title {
            font-size: 13px;
            font-weight: bold;
            border-bottom: 1px solid #d1d5db;
            margin-bottom: 8px;
            padding-bottom: 4px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin: 12px 0 18px;
          }
          .summary-card {
            border: 1px solid #d1d5db;
            padding: 8px;
          }
          .summary-label {
            font-size: 10px;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .summary-value {
            font-size: 14px;
            font-weight: bold;
          }
          .total-row td {
            font-weight: bold;
            border-top: 1px solid #b5b3b3;
            border-bottom: 2px double #b5b3b3;
            padding-top: 6px;
            padding-bottom: 6px;
          }
          @media print {
            body { margin: 10px; }
            @page { margin: 1cm; }
          }
        </style>
      </head>
      <body>
        ${reportRef.current.innerHTML}
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportExcel = () => {
    if (!reportData) return;

    const workbook = XLSX.utils.book_new();

    const stockRows = reportData.stock_rows.map((row) => {
      const matrix = getMatrixValues(row);
      return [
        row.particulars,
        matrix.malayalamOwn,
        matrix.malayalamOthers,
        matrix.englishOwn,
        matrix.englishOthers,
      ];
    });

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Particulars', 'Malayalam Own', 'Malayalam Others', 'English Own', 'English Others'],
        ...stockRows,
      ]),
      'Stock Statement'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Bill No', 'Sale Type', 'Amount'],
        ...reportData.cancelled_sale_bills.map((row) => [row.bill_no, row.sale_type, row.bill_amount]),
      ]),
      'Cancelled Bills'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Title', 'Quantity', 'Inward Rate', 'Outward Rate'],
        ...reportData.sold_items_with_more_less_value.map((row) => [
          row.title,
          row.quantity,
          row.inward_rate,
          row.outward_rate,
        ]),
      ]),
      'Rate Modified Titles'
    );

    XLSX.writeFile(workbook, `Daily_Stock_Statement_${formData.as_on_date}.xlsx`);
  };

  const cardClasses = 'bg-white rounded-xl shadow-sm border border-gray-200/60';
  const inputClasses = 'w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm';
  const labelClasses = 'block text-sm font-medium text-gray-700 mb-1.5';

  const stockRows = reportData?.stock_rows || [];
  const cancelledSaleBills = reportData?.cancelled_sale_bills || [];
  const modifiedRateTitles = reportData?.sold_items_with_more_less_value || [];

  const totals = stockRows.reduce(
    (acc, row) => {
      const matrix = getMatrixValues(row);
      acc.malayalamOwn += matrix.malayalamOwn;
      acc.malayalamOthers += matrix.malayalamOthers;
      acc.englishOwn += matrix.englishOwn;
      acc.englishOthers += matrix.englishOthers;
      return acc;
    },
    { malayalamOwn: 0, malayalamOthers: 0, englishOwn: 0, englishOthers: 0 }
  );

  const renderReport = () => {
    if (!reportData) return null;

    return (
      <div ref={reportRef} className="bg-white text-gray-900">
        <div className="report-header mb-4">
          <div className="company-name text-xl font-bold">{branch?.branches_nm || 'Company'}</div>
          <div className="report-title text-base font-bold mt-2">Daily Stock Statement</div>
          <div className="report-subtitle text-sm text-gray-600">
            Stock Statement As On {formatDate(reportParams?.as_on_date)}
          </div>
        </div>

        <div className="summary-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
          {[
            ['Malayalam Own', totals.malayalamOwn],
            ['Malayalam Others', totals.malayalamOthers],
            ['English Own', totals.englishOwn],
            ['English Others', totals.englishOthers],
          ].map(([label, value]) => (
            <div key={label} className="summary-card border border-gray-200 rounded-lg p-3">
              <div className="summary-label text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
              <div className="summary-value text-lg font-semibold mt-1">{formatNumber(value)}</div>
            </div>
          ))}
        </div>

        <section className="section mt-5">
          <div className="section-title text-sm font-semibold border-b border-gray-200 pb-2 mb-3">Stock Statement</div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-t border-b border-gray-300">
                <th className="py-2 px-2 text-left font-normal">Particulars</th>
                <th className="py-2 px-2 text-right font-normal">Malayalam Own</th>
                <th className="py-2 px-2 text-right font-normal">Malayalam Others</th>
                <th className="py-2 px-2 text-right font-normal">English Own</th>
                <th className="py-2 px-2 text-right font-normal">English Others</th>
              </tr>
            </thead>
            <tbody>
              {stockRows.map((row, index) => {
                const matrix = getMatrixValues(row);
                return (
                  <tr key={`${row.particulars}-${row.type_id}-${index}`} className="hover:bg-gray-50">
                    <td className="py-1.5 px-2">{row.particulars}</td>
                    <td className="py-1.5 px-2 text-right">{formatNumber(matrix.malayalamOwn)}</td>
                    <td className="py-1.5 px-2 text-right">{formatNumber(matrix.malayalamOthers)}</td>
                    <td className="py-1.5 px-2 text-right">{formatNumber(matrix.englishOwn)}</td>
                    <td className="py-1.5 px-2 text-right">{formatNumber(matrix.englishOthers)}</td>
                  </tr>
                );
              })}
              <tr className="total-row">
                <td className="py-2 px-2 text-right font-bold">Total</td>
                <td className="py-2 px-2 text-right font-bold">{formatNumber(totals.malayalamOwn)}</td>
                <td className="py-2 px-2 text-right font-bold">{formatNumber(totals.malayalamOthers)}</td>
                <td className="py-2 px-2 text-right font-bold">{formatNumber(totals.englishOwn)}</td>
                <td className="py-2 px-2 text-right font-bold">{formatNumber(totals.englishOthers)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="section mt-5">
          <div className="section-title text-sm font-semibold border-b border-gray-200 pb-2 mb-3">Cancelled Bills</div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-t border-b border-gray-300">
                <th className="py-2 px-2 text-left font-normal">Bill No</th>
                <th className="py-2 px-2 text-left font-normal">Sale Type</th>
                <th className="py-2 px-2 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {cancelledSaleBills.length === 0 ? (
                <tr>
                  <td colSpan="3" className="py-3 px-2 text-center text-gray-500">No cancelled bills for this date.</td>
                </tr>
              ) : (
                cancelledSaleBills.map((row, index) => (
                  <tr key={`${row.bill_no}-${index}`} className="hover:bg-gray-50">
                    <td className="py-1.5 px-2">{row.bill_no}</td>
                    <td className="py-1.5 px-2">{row.sale_type}</td>
                    <td className="py-1.5 px-2 text-right">{formatNumber(row.bill_amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="section mt-5">
          <div className="section-title text-sm font-semibold border-b border-gray-200 pb-2 mb-3">Titles Sold with Rate / Exchange Rate Modified</div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-t border-b border-gray-300">
                <th className="py-2 px-2 text-left font-normal">Title</th>
                <th className="py-2 px-2 text-right font-normal">Quantity</th>
                <th className="py-2 px-2 text-right font-normal">Inward Rate</th>
                <th className="py-2 px-2 text-right font-normal">Outward Rate</th>
              </tr>
            </thead>
            <tbody>
              {modifiedRateTitles.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-3 px-2 text-center text-gray-500">No modified-rate titles for this date.</td>
                </tr>
              ) : (
                modifiedRateTitles.map((row, index) => (
                  <tr key={`${row.title}-${index}`} className="hover:bg-gray-50">
                    <td className="py-1.5 px-2">{row.title}</td>
                    <td className="py-1.5 px-2 text-right">{formatNumber(row.quantity)}</td>
                    <td className="py-1.5 px-2 text-right">{formatNumber(row.inward_rate)}</td>
                    <td className="py-1.5 px-2 text-right">{formatNumber(row.outward_rate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <Modal isOpen={modal.isOpen} message={modal.message} type={modal.type} buttons={modal.buttons} />

      <PageHeader
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
        title="Daily Stock Statement"
        subtitle="Generate the daily stock statement for the logged-in branch"
      />

      <div className="mt-6 max-w-7xl mx-auto">
        <div className={`${cardClasses} p-6 mb-6`}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label htmlFor="as_on_date" className={labelClasses}>
                  As On Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="as_on_date"
                  name="as_on_date"
                  value={formData.as_on_date}
                  onChange={handleInputChange}
                  className={inputClasses}
                  required
                />
              </div>

              <div className="flex items-end md:col-span-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-lg shadow-sm hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Generate Report
                    </>
                  )}
                </button>
              </div>
            </div>

            {branchId && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Branch:</span> {branch?.branches_nm || `ID: ${branchId}`}
                </p>
              </div>
            )}
          </form>
        </div>

        {reportData && (
          <div className={`${cardClasses} p-6`}>
            <div className="flex justify-end gap-3 mb-4 print:hidden">
              <button
                onClick={handleExportPDF}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg shadow-sm transition-all duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Export PDF
              </button>
              <button
                onClick={handleExportExcel}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg shadow-sm transition-all duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Export Excel
              </button>
            </div>

            <div className="mb-4 text-sm text-gray-600">
              Sections: {stockRows.length} stock rows, {cancelledSaleBills.length} cancelled bills, {modifiedRateTitles.length} modified-rate titles
            </div>

            <div className="overflow-x-auto">{renderReport()}</div>
          </div>
        )}
      </div>
    </div>
  );
}
