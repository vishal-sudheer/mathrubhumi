// src/pages/Transactions/SaleBillReturn.jsx
import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/axiosInstance';
import Modal from '../../components/Modal';
import { TrashIcon } from '@heroicons/react/24/solid';

/* ---------- helpers ---------- */
const asNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const money = (v) => asNum(v).toFixed(2);
const today = () => new Date().toISOString().split('T')[0];

/* Value = Qty * Rate * ExRt * (1 + Tax%/100) - DiscountAmount */
const computeValue = (qty, rate, exrt, tax, discA) => {
  const q = asNum(qty);
  const r = asNum(rate);
  const x = asNum(exrt, 1);
  const t = asNum(tax);
  const da = asNum(discA);
  return Math.max(0, q * r * x * (1 + t / 100) - da);
};

export default function SaleBillReturn() {
  /* ---------- modal (like SaleBill.jsx) ---------- */
  const [modal, setModal] = useState({
    isOpen: false,
    message: '',
    type: 'info',
    buttons: [],
  });
  const showModal = (
    message,
    type = 'info',
    buttons = [
      {
        label: 'OK',
        onClick: () => closeModal(),
        className: 'bg-blue-500 hover:bg-blue-600',
      },
    ]
  ) => setModal({ isOpen: true, message, type, buttons });
  const closeModal = () =>
    setModal({ isOpen: false, message: '', type: 'info', buttons: [] });

  /* ---------- header / master ---------- */
  const [header, setHeader] = useState({
    no: '',
    date: today(),
    type: 'Credit Sale',
    pay: 'Cash',
    customer: '',
    notes: '',
    disP: '',
    amt: '',
    nett: '',
    rpv: '',
    billNo: '',
  });

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeader((prev) => ({ ...prev, [name]: value }));

    if (name === 'customer') {
      const trimmed = value.trim();
      setShowCustomerSuggestions(!!trimmed);
      setSelectedCustomer(value);
      setHeader((prev) => ({ ...prev, billNo: '' }));
      setBillSuggestions([]);
      setShowBillSuggestions(false);
    }
    if (name === 'billNo') {
      setShowBillSuggestions(value.trim().length > 0 && !!selectedCustomer);
    }
  };

  /* ---------- items (main table) ---------- */
  const [items, setItems] = useState([]);

  const handleItemChange = (idx, field, val) => {
    setItems((prev) => {
      const copy = [...prev];
      const it = { ...copy[idx] };

      if (['qty', 'rate', 'exrt', 'tax', 'disA'].includes(field)) {
        it[field] = asNum(val);
        it.value = computeValue(it.qty, it.rate, it.exrt, it.tax, it.disA);
      } else {
        it[field] = val;
      }
      copy[idx] = it;
      return copy;
    });
  };

  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const total = useMemo(() => items.reduce((s, it) => s + asNum(it.value), 0), [items]);

  useEffect(() => {
    setHeader(prev => ({ ...prev, nett: money(total) }));
  }, [total]);

  const cardClasses = "bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-lg shadow-sm";
  const inputClasses = "sb-input px-2 rounded-md border border-gray-200 bg-white text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 transition-all duration-200";
  const actionButtonClasses = "sb-input inline-flex items-center justify-center gap-2 px-3 rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-medium shadow-lg shadow-blue-500/20 hover:from-blue-600 hover:to-indigo-700 active:scale-[0.985] transition-all duration-200";
  const tableInputClasses = "sb-table-input w-full px-2 rounded-md border border-gray-200 bg-gray-50 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white transition-all duration-200";

  /* ---------- suggestions: customer + bill ---------- */
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');

  useEffect(() => {
    const q = header.customer?.trim();
    if (!showCustomerSuggestions || !q) {
      setCustomerSuggestions([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await api.get('/auth/sales-rt/customers/', { params: { q } });
        if (!active) return;
        setCustomerSuggestions(Array.isArray(res.data) ? res.data : []);
      } catch {
        setCustomerSuggestions([]);
      }
    })();
    return () => { active = false; };
  }, [header.customer, showCustomerSuggestions]);

  const handleCustomerPick = (row) => {
    setHeader((prev) => ({ ...prev, customer: row.customer_nm }));
    setSelectedCustomer(row.customer_nm);
    setShowCustomerSuggestions(false);
    setHeader((prev) => ({ ...prev, billNo: '' }));
    setBillSuggestions([]);
    setShowBillSuggestions(false);
  };

  const [billSuggestions, setBillSuggestions] = useState([]);
  const [showBillSuggestions, setShowBillSuggestions] = useState(false);

  useEffect(() => {
    const q = header.billNo?.trim();
    if (!showBillSuggestions || !q || !selectedCustomer) {
      setBillSuggestions([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await api.get('/auth/sales-rt/bills/', {
          params: { customer: selectedCustomer, q },
        });
        if (!active) return;
        setBillSuggestions(Array.isArray(res.data) ? res.data : []);
      } catch {
        setBillSuggestions([]);
      }
    })();
    return () => { active = false; };
  }, [header.billNo, showBillSuggestions, selectedCustomer]);

  const [loading, setLoading] = useState(false);

  const handleBillPick = async (row) => {
    setHeader((prev) => ({ ...prev, billNo: row.bill_no }));
    setShowBillSuggestions(false);

    try {
      setLoading(true);
      const res = await api.get(`/auth/sales-rt/bill/${row.id}/items/`);
      const lines = Array.isArray(res.data) ? res.data : [];

      const modalRows = lines.map((it) => ({
        sale_det_id: it.id,
        purchase_company_id: it.purchase_company_id,
        purchase_id: it.purchase_id,
        purchase_det_id: it.purchase_item_id,
        title_id: it.title_id,
        product: it.title || '',
        bqty: asNum(it.quantity),
        rqty: asNum(it.r_qty || 0),
        tqty: 0,
        rate: asNum(it.rate),
        curr: it.currency_name || 'Indian Rupees',
        exrt: asNum(it.exchange_rate, 1),
        tax: asNum(it.tax),
        // keep originals for proportional recalculation
        disAFull: asNum(it.dis_a),
        valueFull: asNum(it.line_value),
        // shown values (will update when T Qty changes)
        disA: asNum(it.dis_a),
        value: asNum(it.line_value),
      }));

      setSaleModal({
        isOpen: true,
        saleId: row.id,
        billNo: row.bill_no,
        saleDate: row.sale_date,
        items: modalRows,
      });
    } catch (err) {
      console.error('Failed to load sale items:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ---------- modal for picking return quantities ---------- */
  const [saleModal, setSaleModal] = useState({
    isOpen: false,
    saleId: null,
    billNo: '',
    saleDate: '',
    items: [],
  });

  const closeSaleModal = () => {
    setSaleModal({ isOpen: false, saleId: null, billNo: '', saleDate: '', items: [] });
  };

  // ⬇️ Recalculate Dis A and Value proportionally when T Qty changes; fix step to ±1 in input
  const updateTqty = (idx, val) => {
    setSaleModal((prev) => {
      const itemsCopy = [...prev.items];
      const row = { ...itemsCopy[idx] };

      const maxQty = Math.max(0, asNum(row.bqty) - asNum(row.rqty));
      const tqty = Math.max(0, Math.min(asNum(val), maxQty));

      // per-unit discount from the original sale line
      const perUnitDisc = asNum(row.disAFull ?? row.disA) / (asNum(row.bqty) || 1);
      const newDisA = perUnitDisc * tqty;

      row.tqty = tqty;
      row.disA = newDisA;
      row.value = computeValue(tqty, row.rate, row.exrt, row.tax, newDisA);

      itemsCopy[idx] = row;
      return { ...prev, items: itemsCopy };
    });
  };

  const addSelectedFromModal = () => {
    const selected = saleModal.items.filter((r) => asNum(r.tqty) > 0);
    if (selected.length === 0) {
      closeSaleModal();
      return;
    }
    const mapped = selected.map((r) => ({
      product: r.product,
      qty: asNum(r.tqty),
      rate: asNum(r.rate),
      curr: r.curr,
      exrt: asNum(r.exrt, 1),
      tax: asNum(r.tax),
      disA: asNum(r.disA),
      value: computeValue(asNum(r.tqty), asNum(r.rate), asNum(r.exrt, 1), asNum(r.tax), asNum(r.disA)),
      title_id: r.title_id,
      sale_det_id: r.sale_det_id,
      purchase_company_id: r.purchase_company_id,
      purchase_id: r.purchase_id,
      purchase_det_id: r.purchase_det_id,
    }));
    setItems((prev) => [...prev, ...mapped]);
    closeSaleModal();
  };

  /* ---------- load/submit/reset ---------- */
  const [saleRtIdToLoad, setSaleRtIdToLoad] = useState('');
  const [saleRtId, setSaleRtId] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const loadSaleReturnById = async (id) => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await api.get(`/auth/sales-rt/${id}/`);
      const data = res.data;

      setHeader({
        no: String(data.sales_rt_no ?? ''),
        date: data.entry_date || today(),
        type: data.s_type_label || 'Credit Sale',
        pay: data.cash_label || 'Cash',
        customer: data.cash_customer || '',
        notes: data.narration || '',
        disP: String(data.discount_p ?? ''),
        amt: String(data.discount_a ?? ''),
        nett: String(data.nett ?? ''),
        rpv: '',
        billNo: '',
      });

      const loaded = (data.items || []).map((r) => ({
        product: r.title || '',
        title_id: r.title_id,
        qty: asNum(r.quantity),
        rate: asNum(r.rate),
        curr: r.currency_name || 'Indian Rupees',
        exrt: asNum(r.exchange_rate, 1),
        tax: asNum(r.tax),
        disA: asNum(r.discount_a),
        value: asNum(r.line_value),
        sale_det_id: asNum(r.sale_det_id),
        purchase_company_id: asNum(r.purchase_company_id),
        purchase_id: asNum(r.purchase_id),
        purchase_det_id: asNum(r.purchase_det_id),
      }));
      setItems(loaded);
      setSaleRtId(data.id);
      setIsEditMode(true);
      setSaleRtIdToLoad('');

      showModal('Sale Return loaded successfully', 'success');
    } catch (e) {
      console.error(e);
      showModal(`Failed to load Sale Return: ${e?.response?.data?.error || e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadClick = async () => {
    const id = saleRtIdToLoad.trim();
    if (!id) {
      showModal('Enter a Sale Return ID', 'error');
      return;
    }
    await loadSaleReturnById(id);
  };

  const submitSaleReturn = async () => {
    if (!header.date) {
      showModal('Please select Date', 'error');
      return;
    }
    if (!header.customer?.trim()) {
      showModal('Please select Customer', 'error');
      return;
    }
    if (items.length === 0) {
      showModal('Please add at least one item from a bill', 'error');
      return;
    }

    const payload = {
      header,
      items: items.map((it) => ({
        title_id: it.title_id,
        qty: asNum(it.qty),
        rate: asNum(it.rate),
        tax: asNum(it.tax),
        exchange_rate: asNum(it.exrt, 1),
        discount_a: asNum(it.disA),
        line_value: asNum(it.value),
        sale_det_id: asNum(it.sale_det_id),
        purchase_company_id: asNum(it.purchase_company_id),
        purchase_id: asNum(it.purchase_id),
        purchase_det_id: asNum(it.purchase_det_id),
      })),
    };

    try {
      setLoading(true);
      const isUpdate = isEditMode && saleRtId;
      const endpoint = isUpdate ? `/auth/sales-rt/${saleRtId}/` : '/auth/sales-rt/';
      const method = isUpdate ? api.put : api.post;
      const res = await method(endpoint, payload);

      if (isUpdate) {
        showModal('Sales return updated successfully', 'success');
        await loadSaleReturnById(String(saleRtId));
      } else {
        showModal(`Sales return saved successfully. ID: ${res.data.id}`, 'success');
        setSaleRtIdToLoad(String(res.data.id));
        await loadSaleReturnById(String(res.data.id));
      }
    } catch (e) {
      console.error(e);
      showModal(`Failed to submit: ${e?.response?.data?.error || e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSaleReturn = () => {
    if (!isEditMode || !saleRtId) {
      showModal('Load a Sale Return to delete', 'error');
      return;
    }

    showModal(`Delete Sale Return ID ${saleRtId}?`, 'error', [
      {
        label: 'Cancel',
        onClick: () => closeModal(),
        className: 'bg-gray-600 hover:bg-gray-700',
      },
      {
        label: 'Delete',
        onClick: async () => {
          closeModal();
          try {
            setLoading(true);
            await api.delete(`/auth/sales-rt/${saleRtId}/`);
            showModal('Sales return deleted successfully', 'success');
            resetForm();
          } catch (e) {
            showModal(`Failed to delete: ${e?.response?.data?.error || e.message}`, 'error');
          } finally {
            setLoading(false);
          }
        },
        className: 'bg-red-600 hover:bg-red-700',
      },
    ]);
  };

  const resetForm = () => {
    setHeader({
      no: '',
      date: today(),
      type: 'Credit Sale',
      pay: 'Cash',
      customer: '',
      notes: '',
      disP: '',
      amt: '',
      nett: '',
      rpv: '',
      billNo: '',
    });
    setCustomerSuggestions([]);
    setShowCustomerSuggestions(false);
    setSelectedCustomer('');
    setBillSuggestions([]);
    setShowBillSuggestions(false);
    setSaleModal({ isOpen: false, saleId: null, billNo: '', saleDate: '', items: [] });
    setItems([]);
    setSaleRtIdToLoad('');
    setSaleRtId(null);
    setIsEditMode(false);
  };

  /* ---------- render ---------- */
  return (
    <div className="sb-page min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 lg:h-[100svh] lg:overflow-hidden lg:flex lg:flex-col">
      <Modal
        isOpen={modal.isOpen}
        message={modal.message}
        type={modal.type}
        buttons={modal.buttons}
      />

      {loading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        </div>
      )}

      <div className="sb-layout flex flex-col lg:flex-1 lg:min-h-0">
        <div className={`${cardClasses} sb-card`}>
          <div className="sb-form-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <input
              name="no"
              value={header.no}
              onChange={handleHeaderChange}
              placeholder="No."
              className={`${inputClasses} bg-gray-50 font-semibold`}
            />
            <input
              type="date"
              name="date"
              value={header.date}
              onChange={handleHeaderChange}
              className={inputClasses}
            />
            <select
              name="type"
              value={header.type}
              onChange={handleHeaderChange}
              className={inputClasses}
            >
              {['Credit Sale', 'Cash Sale', 'P P Sale', 'Stock Transfer', 'Approval', 'Gift Voucher', 'Gift Bill', 'Cash Memo'].map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <select
              name="pay"
              value={header.pay}
              onChange={handleHeaderChange}
              className={inputClasses}
            >
              {['Cash', 'Money Order', 'Cheque', 'Demand Draft', 'Cr/Dr Card', 'Digital Payment'].map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>

            <div className="relative">
              <input
                name="customer"
                value={header.customer}
                onChange={handleHeaderChange}
                placeholder="Customer"
                className={`${inputClasses} w-full`}
                autoComplete="off"
              />
              {showCustomerSuggestions && header.customer.trim() && (
                <ul className="absolute z-50 bg-white border border-gray-200 mt-1 w-full shadow-md rounded-lg text-sm max-h-48 overflow-y-auto">
                  {customerSuggestions.map((c, i) => (
                    <li
                      key={`${c.id || c.customer_nm}-${i}`}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleCustomerPick(c)}
                    >
                      {c.customer_nm}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <input
              name="notes"
              value={header.notes}
              onChange={handleHeaderChange}
              placeholder="Notes"
              className={inputClasses}
            />
            <input
              type="number"
              step="0.01"
              name="disP"
              value={header.disP}
              onChange={handleHeaderChange}
              placeholder="Dis%"
              className={`${inputClasses} text-right`}
            />
            <input
              type="number"
              step="0.01"
              name="amt"
              value={header.amt}
              onChange={handleHeaderChange}
              placeholder="Amt"
              className={`${inputClasses} text-right`}
            />
            <input
              type="number"
              step="0.01"
              name="nett"
              value={header.nett}
              onChange={handleHeaderChange}
              placeholder="Nett"
              className={`${inputClasses} bg-gray-50 text-right font-semibold`}
              readOnly
            />
            <input
              type="text"
              name="rpv"
              value={header.rpv}
              onChange={handleHeaderChange}
              placeholder="R/P V"
              className={inputClasses}
            />

            <div className="relative">
              <input
                type="text"
                name="billNo"
                value={header.billNo}
                onChange={handleHeaderChange}
                placeholder="Bill No"
                className={`${inputClasses} w-full`}
                autoComplete="off"
                disabled={!selectedCustomer}
                title={!selectedCustomer ? 'Select Customer first' : ''}
              />
              {showBillSuggestions && header.billNo.trim() && selectedCustomer && (
                <ul className="absolute z-50 bg-white border border-gray-200 mt-1 w-full shadow-md rounded-lg text-sm max-h-48 overflow-y-auto">
                  {billSuggestions.map((b) => (
                    <li
                      key={`bill-${b.id}`}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleBillPick(b)}
                    >
                      <div className="font-medium">
                        {b.bill_no} - {b.sale_date}
                      </div>
                      <div className="text-xs text-gray-500">{selectedCustomer}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className={`${cardClasses} sb-card flex flex-col lg:flex-1 lg:min-h-0`}>
          <div className="flex items-center justify-end px-0.5 sb-text-sm text-gray-600">
            <span className="font-semibold text-gray-800">Total: {money(total)}</span>
          </div>

          <div className="relative rounded-md border border-gray-100 overflow-hidden flex-1 min-h-0">
            <div className="overflow-auto max-h-[60vh] min-h-[120px] lg:max-h-none lg:h-full lg:min-h-0">
              <table className="w-full min-w-[820px] sb-text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white uppercase tracking-wide">
                    <th className="px-2 sb-th-py text-left font-semibold w-[240px]">Product</th>
                    <th className="px-2 sb-th-py text-right font-semibold w-[60px]">Qty</th>
                    <th className="px-2 sb-th-py text-right font-semibold w-[80px]">Rate</th>
                    <th className="px-2 sb-th-py text-left font-semibold w-[80px]">Curr</th>
                    <th className="px-2 sb-th-py text-right font-semibold w-[70px]">ExRt</th>
                    <th className="px-2 sb-th-py text-right font-semibold w-[60px]">Tax</th>
                    <th className="px-2 sb-th-py text-right font-semibold w-[70px]">Dis A</th>
                    <th className="px-2 sb-th-py text-right font-semibold w-[90px]">Value</th>
                    <th className="px-2 sb-th-py text-center font-semibold w-[40px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-4 py-4 text-center text-gray-400 sb-text-sm">
                        No items added yet. Load a bill and pick items.
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-2 sb-td-py">
                          <input
                            value={it.product}
                            onChange={(e) => handleItemChange(idx, 'product', e.target.value)}
                            className={tableInputClasses}
                          />
                        </td>
                        <td className="px-2 sb-td-py">
                          <input
                            type="number"
                            value={it.qty}
                            onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                            className={`${tableInputClasses} text-right`}
                          />
                        </td>
                        <td className="px-2 sb-td-py">
                          <input
                            type="number"
                            step="0.01"
                            value={it.rate}
                            onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                            className={`${tableInputClasses} text-right`}
                          />
                        </td>
                        <td className="px-2 sb-td-py">
                          <input
                            value={it.curr}
                            onChange={(e) => handleItemChange(idx, 'curr', e.target.value)}
                            className={tableInputClasses}
                          />
                        </td>
                        <td className="px-2 sb-td-py">
                          <input
                            type="number"
                            value={it.exrt}
                            onChange={(e) => handleItemChange(idx, 'exrt', e.target.value)}
                            className={`${tableInputClasses} text-right`}
                          />
                        </td>
                        <td className="px-2 sb-td-py">
                          <input
                            type="number"
                            step="0.01"
                            value={it.tax}
                            onChange={(e) => handleItemChange(idx, 'tax', e.target.value)}
                            className={`${tableInputClasses} text-right`}
                          />
                        </td>
                        <td className="px-2 sb-td-py">
                          <input
                            type="number"
                            step="0.01"
                            value={it.disA}
                            onChange={(e) => handleItemChange(idx, 'disA', e.target.value)}
                            className={`${tableInputClasses} text-right`}
                          />
                        </td>
                        <td className="px-2 sb-td-py text-right sb-text-sm font-semibold text-gray-700">
                          {money(it.value)}
                        </td>
                        <td className="px-2 sb-td-py text-center">
                          <button
                            onClick={() => removeItem(idx)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete item"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className={`${cardClasses} sb-card`}>
          <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
            <div className="flex flex-1 flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={saleRtIdToLoad}
                onChange={(e) => setSaleRtIdToLoad(e.target.value)}
                placeholder="Sale Return ID"
                className={`${inputClasses} w-full sm:w-60`}
              />
              <button
                onClick={handleLoadClick}
                className={`${actionButtonClasses} from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700`}
              >
                Load Sale Return
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={submitSaleReturn}
                className={`${actionButtonClasses} min-w-[160px]`}
              >
                {isEditMode ? 'Update Sale Return' : 'Submit Sale Return'}
              </button>
              {isEditMode && saleRtId ? (
                <button
                  onClick={handleDeleteSaleReturn}
                  className={`${actionButtonClasses} from-red-500 to-red-600 hover:from-red-600 hover:to-red-700`}
                >
                  Delete Sale Return
                </button>
              ) : null}
              <button
                onClick={resetForm}
                className={`${actionButtonClasses} from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700`}
              >
                Reset Form
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: sale items */}
      {saleModal.isOpen && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeSaleModal} />
          <div
            className="relative bg-white rounded-xl shadow-xl w-[min(95vw,1100px)] max-h-[85vh] overflow-hidden mx-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-800">
                Bill: {saleModal.billNo} — {saleModal.saleDate} (Sale ID: {saleModal.saleId})
              </h2>
            </div>
            <div className="p-4 overflow-auto max-h-[65vh]">
              <table className="w-full table-auto border border-gray-300 border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-2 text-xs font-semibold border">Product</th>
                    <th className="text-right p-2 text-xs font-semibold border">B Qty</th>
                    <th className="text-right p-2 text-xs font-semibold border">R Qty</th>
                    <th className="text-right p-2 text-xs font-semibold border">T Qty</th>
                    <th className="text-right p-2 text-xs font-semibold border">Rate</th>
                    <th className="text-left p-2 text-xs font-semibold border">Curr</th>
                    <th className="text-right p-2 text-xs font-semibold border">ExRt</th>
                    <th className="text-right p-2 text-xs font-semibold border">Tax</th>
                    <th className="text-right p-2 text-xs font-semibold border">Dis A</th>
                    <th className="text-right p-2 text-xs font-semibold border">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {saleModal.items.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center text-gray-500 py-6">
                        No items found for this bill.
                      </td>
                    </tr>
                  ) : (
                    saleModal.items.map((r, idx) => (
                      <tr key={`${r.sale_det_id}-${idx}`} className="border-t">
                        <td className="p-2 text-sm">{r.product}</td>
                        <td className="p-2 text-sm text-right">{money(r.bqty)}</td>
                        <td className="p-2 text-sm text-right">{money(r.rqty)}</td>
                        <td className="p-2 text-sm text-right">
                          <input
                            type="number"
                            className="border p-1 rounded w-[100px] text-right"
                            value={r.tqty}
                            onChange={(e) => updateTqty(idx, e.target.value)}
                            min="0"
                            max={r.bqty - r.rqty}
                            step="1"
                          />
                        </td>
                        <td className="p-2 text-sm text-right">{money(r.rate)}</td>
                        <td className="p-2 text-sm">{r.curr}</td>
                        <td className="p-2 text-sm text-right">{money(r.exrt)}</td>
                        <td className="p-2 text-sm text-right">{money(r.tax)}</td>
                        <td className="p-2 text-sm text-right">{money(r.disA)}</td>
                        <td className="p-2 text-sm text-right">{money(r.value)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t bg-gray-50 flex justify-end gap-2">
              <button
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
                onClick={addSelectedFromModal}
                type="button"
              >
                Add Selected Items
              </button>
              <button
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm"
                onClick={closeSaleModal}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
