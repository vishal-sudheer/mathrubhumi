import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Modal from '../../components/Modal';
import PageHeader from '../../components/PageHeader';
import api from '../../utils/axiosInstance';
import { getSession } from '../../utils/session';

const EMPTY_BALANCE = {
  cl_cash: 0,
  cl_cheque: 0,
  cl_card_books: 0,
  cl_card_periodicals: 0,
  cl_card_calendar: 0,
  cl_card_diary: 0,
  cl_card_paperbox: 0,
  cl_card_others: 0,
  cl_upi_books: 0,
  cl_upi_periodicals: 0,
  cl_upi_calendar: 0,
  cl_upi_diary: 0,
  cl_upi_paperbox: 0,
  cl_upi_others: 0,
};

const BALANCE_FIELDS = [
  { key: 'cl_cash', label: 'Cash' },
  { key: 'cl_cheque', label: 'Cheque' },
  { key: 'cl_card_books', label: 'Card Books' },
  { key: 'cl_card_periodicals', label: 'Card Periodicals' },
  { key: 'cl_card_calendar', label: 'Card Calendar' },
  { key: 'cl_card_diary', label: 'Card Diary' },
  { key: 'cl_card_paperbox', label: 'Card Paperbox' },
  { key: 'cl_card_others', label: 'Card Others' },
  { key: 'cl_upi_books', label: 'UPI Books' },
  { key: 'cl_upi_periodicals', label: 'UPI Periodicals' },
  { key: 'cl_upi_calendar', label: 'UPI Calendar' },
  { key: 'cl_upi_diary', label: 'UPI Diary' },
  { key: 'cl_upi_paperbox', label: 'UPI Paperbox' },
  { key: 'cl_upi_others', label: 'UPI Others' },
];

const getLanguageLabel = (languageId) => {
  if (languageId === 0) return 'English';
  if (languageId === 1) return 'Malayalam';
  return `Language ${languageId}`;
};

const sumByKey = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);

const sumBalance = (balance) =>
  BALANCE_FIELDS.reduce((total, field) => total + (Number(balance?.[field.key]) || 0), 0);

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

const ReportTable = ({ columns, rows, footer }) => (
  <table className="w-full text-xs border-collapse">
    <thead>
      <tr className="border-t border-b border-gray-300">
        {columns.map((column) => (
          <th
            key={column.key}
            className={`py-2 px-2 font-normal ${column.align === 'right' ? 'text-right' : 'text-left'}`}
          >
            {column.label}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, index) => (
        <tr key={row.id || `${index}-${columns[0]?.key || 'row'}`} className="hover:bg-gray-50">
          {columns.map((column) => (
            <td
              key={column.key}
              className={`py-1.5 px-2 align-top ${column.align === 'right' ? 'text-right' : 'text-left'}`}
            >
              {column.render ? column.render(row, index) : row[column.key]}
            </td>
          ))}
        </tr>
      ))}
      {footer ? footer : null}
    </tbody>
  </table>
);

export default function DailyAccountStatement() {
  const { branch } = getSession();
  const branchId = branch?.id || null;

  const [formData, setFormData] = useState({
    date_from: '',
    date_to: '',
  });
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
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    setFormData({
      date_from: firstDay.toISOString().split('T')[0],
      date_to: lastDay.toISOString().split('T')[0],
    });
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

    if (!formData.date_from) {
      showModal('Please select a From Date', 'error');
      return;
    }

    if (!formData.date_to) {
      showModal('Please select a To Date', 'error');
      return;
    }

    if (!branchId) {
      showModal('Branch information not found. Please log in again.', 'error');
      return;
    }

    if (new Date(formData.date_from) > new Date(formData.date_to)) {
      showModal('From Date cannot be greater than To Date', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await api.get('/auth/reports/daily-account-statement/', {
        params: {
          branch_id: branchId,
          date_from: formData.date_from,
          date_to: formData.date_to,
        },
      });

      setReportData(response.data.report_data || null);
      setReportParams(response.data.parameters || null);
    } catch (error) {
      console.error('Error generating daily account statement:', error);
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
        <title>Daily Account Statement</title>
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
          .balance-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }
          .subhead {
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 6px;
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

    const appendSheet = (name, rows) => {
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, name);
    };

    appendSheet('Sale Type', [
      ['Sale Type', 'Bill From', 'Bill To', 'Gross Sale', 'Discount', 'Nett Sale'],
      ...reportData.sales_type_summary.map((row) => [
        row.sale_type,
        row.bill_from,
        row.bill_to,
        row.gross_sale,
        row.total_discount,
        row.nett_sale,
      ]),
    ]);

    appendSheet('Language', [
      ['Language', 'Gross Sale', 'Discount', 'Nett Sale'],
      ...reportData.language_wise_sale.map((row) => [
        getLanguageLabel(row.language_id),
        row.gross_sale,
        row.total_discount,
        row.nett_sale,
      ]),
    ]);

    appendSheet('Sale Return', [
      ['Sale Type', 'Bill From', 'Bill To', 'Nett'],
      ...reportData.sale_return_summary.map((row) => [
        row.sale_type,
        row.bill_from,
        row.bill_to,
        row.nett,
      ]),
    ]);

    appendSheet('Opening Balance', [
      ['Mode', 'Amount'],
      ...BALANCE_FIELDS.map((field) => [field.label, reportData.opening_balance?.[field.key] || 0]),
    ]);

    appendSheet('Income Expense', [
      ['Type', 'Transaction ID', 'Entity 1', 'Entity 2', 'Description', 'Receipt', 'Payment'],
      ...reportData.incomes_and_expenses.map((row) => [
        row.data_type,
        row.trn_id,
        row.entity_1,
        row.entity_2,
        row.description,
        row.receipt,
        row.payment,
      ]),
    ]);

    appendSheet('Closing Balance', [
      ['Mode', 'Amount'],
      ...BALANCE_FIELDS.map((field) => [field.label, reportData.closing_balance?.[field.key] || 0]),
    ]);

    XLSX.writeFile(workbook, `Daily_Account_Statement_${formData.date_from}_to_${formData.date_to}.xlsx`);
  };

  const cardClasses = 'bg-white rounded-xl shadow-sm border border-gray-200/60';
  const inputClasses = 'w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm';
  const labelClasses = 'block text-sm font-medium text-gray-700 mb-1.5';

  const salesTypeSummary = reportData?.sales_type_summary || [];
  const languageWiseSale = reportData?.language_wise_sale || [];
  const saleReturnSummary = reportData?.sale_return_summary || [];
  const incomesAndExpenses = reportData?.incomes_and_expenses || [];
  const openingBalance = reportData?.opening_balance || EMPTY_BALANCE;
  const closingBalance = reportData?.closing_balance || EMPTY_BALANCE;

  const salesGrossTotal = sumByKey(salesTypeSummary, 'gross_sale');
  const salesDiscountTotal = sumByKey(salesTypeSummary, 'total_discount');
  const salesNettTotal = sumByKey(salesTypeSummary, 'nett_sale');
  const languageGrossTotal = sumByKey(languageWiseSale, 'gross_sale');
  const languageDiscountTotal = sumByKey(languageWiseSale, 'total_discount');
  const languageNettTotal = sumByKey(languageWiseSale, 'nett_sale');
  const saleReturnNettTotal = sumByKey(saleReturnSummary, 'nett');
  const totalReceipts = sumByKey(incomesAndExpenses, 'receipt');
  const totalPayments = sumByKey(incomesAndExpenses, 'payment');
  const openingTotal = sumBalance(openingBalance);
  const closingTotal = sumBalance(closingBalance);

  const renderBalanceTable = (balance) => (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-t border-b border-gray-300">
          <th className="py-2 px-2 text-left font-normal">Mode</th>
          <th className="py-2 px-2 text-right font-normal">Amount</th>
        </tr>
      </thead>
      <tbody>
        {BALANCE_FIELDS.map((field) => (
          <tr key={field.key}>
            <td className="py-1.5 px-2">{field.label}</td>
            <td className="py-1.5 px-2 text-right">{formatNumber(balance?.[field.key])}</td>
          </tr>
        ))}
        <tr className="total-row">
          <td className="py-2 px-2 text-right font-bold">Total</td>
          <td className="py-2 px-2 text-right font-bold">{formatNumber(sumBalance(balance))}</td>
        </tr>
      </tbody>
    </table>
  );

  const renderReport = () => {
    if (!reportData) return null;

    return (
      <div ref={reportRef} className="bg-white text-gray-900">
        <div className="report-header mb-4">
          <div className="company-name text-xl font-bold">{branch?.branches_nm || 'Company'}</div>
          <div className="report-title text-base font-bold mt-2">Daily Account Statement</div>
          <div className="report-subtitle text-sm text-gray-600">
            From {formatDate(reportParams?.date_from)} to {formatDate(reportParams?.date_to)}
          </div>
        </div>

        <div className="summary-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
          {[
            ['Opening Balance', openingTotal],
            ['Sales Nett', salesNettTotal],
            ['Receipts', totalReceipts],
            ['Closing Balance', closingTotal],
          ].map(([label, value]) => (
            <div key={label} className="summary-card border border-gray-200 rounded-lg p-3">
              <div className="summary-label text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
              <div className="summary-value text-lg font-semibold mt-1">{formatNumber(value)}</div>
            </div>
          ))}
        </div>

        <section className="section mt-5">
          <div className="section-title text-sm font-semibold border-b border-gray-200 pb-2 mb-3">Sales Type Summary</div>
          <ReportTable
            columns={[
              { key: 'sale_type', label: 'Type' },
              { key: 'bill_from', label: 'Bill From' },
              { key: 'bill_to', label: 'Bill To' },
              { key: 'gross_sale', label: 'Gross Sale', align: 'right', render: (row) => formatNumber(row.gross_sale) },
              { key: 'total_discount', label: 'Discount', align: 'right', render: (row) => formatNumber(row.total_discount) },
              { key: 'nett_sale', label: 'Nett Sale', align: 'right', render: (row) => formatNumber(row.nett_sale) },
            ]}
            rows={salesTypeSummary}
            footer={
              <tr className="total-row">
                <td colSpan="3" className="py-2 px-2 text-right font-bold">Total</td>
                <td className="py-2 px-2 text-right font-bold">{formatNumber(salesGrossTotal)}</td>
                <td className="py-2 px-2 text-right font-bold">{formatNumber(salesDiscountTotal)}</td>
                <td className="py-2 px-2 text-right font-bold">{formatNumber(salesNettTotal)}</td>
              </tr>
            }
          />
        </section>

        <section className="section mt-5">
          <div className="section-title text-sm font-semibold border-b border-gray-200 pb-2 mb-3">Language-wise Sale</div>
          <ReportTable
            columns={[
              { key: 'language_id', label: 'Language', render: (row) => getLanguageLabel(row.language_id) },
              { key: 'gross_sale', label: 'Gross Sale', align: 'right', render: (row) => formatNumber(row.gross_sale) },
              { key: 'total_discount', label: 'Discount', align: 'right', render: (row) => formatNumber(row.total_discount) },
              { key: 'nett_sale', label: 'Nett Sale', align: 'right', render: (row) => formatNumber(row.nett_sale) },
            ]}
            rows={languageWiseSale}
            footer={
              <tr className="total-row">
                <td className="py-2 px-2 text-right font-bold">Total</td>
                <td className="py-2 px-2 text-right font-bold">{formatNumber(languageGrossTotal)}</td>
                <td className="py-2 px-2 text-right font-bold">{formatNumber(languageDiscountTotal)}</td>
                <td className="py-2 px-2 text-right font-bold">{formatNumber(languageNettTotal)}</td>
              </tr>
            }
          />
        </section>

        <section className="section mt-5">
          <div className="section-title text-sm font-semibold border-b border-gray-200 pb-2 mb-3">Sale Return Summary</div>
          <ReportTable
            columns={[
              { key: 'sale_type', label: 'Type' },
              { key: 'bill_from', label: 'Bill From', align: 'right' },
              { key: 'bill_to', label: 'Bill To', align: 'right' },
              { key: 'nett', label: 'Nett', align: 'right', render: (row) => formatNumber(row.nett) },
            ]}
            rows={saleReturnSummary}
            footer={
              <tr className="total-row">
                <td colSpan="3" className="py-2 px-2 text-right font-bold">Total</td>
                <td className="py-2 px-2 text-right font-bold">{formatNumber(saleReturnNettTotal)}</td>
              </tr>
            }
          />
        </section>

        <section className="section mt-5">
          <div className="section-title text-sm font-semibold border-b border-gray-200 pb-2 mb-3">Balances</div>
          <div className="balance-grid grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div>
              <div className="subhead text-sm font-semibold mb-2">Opening Balance</div>
              {renderBalanceTable(openingBalance)}
            </div>
            <div>
              <div className="subhead text-sm font-semibold mb-2">Closing Balance</div>
              {renderBalanceTable(closingBalance)}
            </div>
          </div>
        </section>

        <section className="section mt-5">
          <div className="section-title text-sm font-semibold border-b border-gray-200 pb-2 mb-3">Incomes and Expenses</div>
          <ReportTable
            columns={[
              { key: 'data_type', label: 'Type' },
              { key: 'trn_id', label: 'Trn ID', align: 'right' },
              { key: 'entity_1', label: 'Entity 1' },
              { key: 'entity_2', label: 'Entity 2' },
              { key: 'description', label: 'Description' },
              { key: 'receipt', label: 'Receipt', align: 'right', render: (row) => formatNumber(row.receipt) },
              { key: 'payment', label: 'Payment', align: 'right', render: (row) => formatNumber(row.payment) },
            ]}
            rows={incomesAndExpenses}
            footer={
              <tr className="total-row">
                <td colSpan="5" className="py-2 px-2 text-right font-bold">Total</td>
                <td className="py-2 px-2 text-right font-bold">{formatNumber(totalReceipts)}</td>
                <td className="py-2 px-2 text-right font-bold">{formatNumber(totalPayments)}</td>
              </tr>
            }
          />
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
        title="Daily Account Statement"
        subtitle="Generate the daily account statement for the logged-in branch"
      />

      <div className="mt-6 max-w-7xl mx-auto">
        <div className={`${cardClasses} p-6 mb-6`}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div>
                <label htmlFor="date_from" className={labelClasses}>
                  Date From <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="date_from"
                  name="date_from"
                  value={formData.date_from}
                  onChange={handleInputChange}
                  className={inputClasses}
                  required
                />
              </div>

              <div>
                <label htmlFor="date_to" className={labelClasses}>
                  Date To <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="date_to"
                  name="date_to"
                  value={formData.date_to}
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
              Sections: {salesTypeSummary.length} sale rows, {languageWiseSale.length} language rows, {saleReturnSummary.length} sale return rows, {incomesAndExpenses.length} income/expense rows
            </div>

            <div className="overflow-x-auto">{renderReport()}</div>
          </div>
        )}
      </div>
    </div>
  );
}
