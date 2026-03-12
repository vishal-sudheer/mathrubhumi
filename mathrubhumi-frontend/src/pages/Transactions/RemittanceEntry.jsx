import React, { useRef, useState, useMemo } from "react";
import Modal from "../../components/Modal";
import PageHeader from "../../components/PageHeader";
import api from "../../utils/axiosInstance";

/* ---------- tiny helpers ---------- */
const today = () => new Date().toISOString().split("T")[0];
const asInt = (v, d = null) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};
const asFloat = (v, d = null) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
};
// NEW: tiny DD/MM/YYYY formatter (handles ISO or already-formatted)
const fmtDmy = (isoOrDate) => {
  if (!isoOrDate) return "";
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return String(isoOrDate);
  return String(d.getDate()).padStart(2, "0") + "/" +
    String(d.getMonth() + 1).padStart(2, "0") + "/" +
    d.getFullYear();
};

/* ---------- a_type map for Remittance ---------- */
const A_TYPE = {
  "Credit Sale Chq/DD": 0,
  "Cash": 1,
  "Cash Sale Chq/DD": 2,
  "Scheme Chq/DD": 3,
  "P P Chq/DD": 4,
  "UPI Books": 5,
  "UPI Periodicals": 6,
  "UPI Calendar": 7,
  "UPI Diary": 8,
  "UPI Paperbox": 9,
  "UPI Others": 10,
  "Card Books": 11,
  "Card Periodicals": 12,
  "Card Calender": 13,
  "Card Diary": 14,
  "Card Paperbox": 15,
  "Card Others": 16,
};
const A_TYPE_OPTIONS = Object.keys(A_TYPE);

export default function RemittanceEntry() {
  const [form, setForm] = useState({
    remittanceNo: "",
    cancelled: "", // 0 = No, 1 = Yes
    date: "",
    type: "",
    customer: "CASH/CARD/UPI",
    bank: "",
    receiptNo: "",
    chqdd: "",
    remittedAt: "",
    amount: "",
    notes: "",
  });

  /* selected IDs from suggestions */
  const [customerId, setCustomerId] = useState(0); // cr_customers.id
  const [branchId, setBranchId] = useState(0);     // branches.id

  /* ---------- Modal ---------- */
  const [modal, setModal] = useState({
    isOpen: false,
    message: "",
    type: "info",
    buttons: [
      { label: "OK", onClick: () => closeModal(), className: "bg-blue-500 hover:bg-blue-600" },
    ],
  });
  const showModal = (message, type = "info", buttons = [
    { label: "OK", onClick: () => closeModal(), className: "bg-blue-500 hover:bg-blue-600" },
  ]) => setModal({ isOpen: true, message, type, buttons });
  const closeModal = () => setModal({ isOpen: false, message: "", type: "info", buttons: [] });

  /* ---------- local state ---------- */
  const [saving, setSaving] = useState(false);
  const [loadingRemit, setLoadingRemit] = useState(false);
  const [loadRemitNo, setLoadRemitNo] = useState("");

  /* ---------- suggestions state ---------- */
  const [showCustomerSug, setShowCustomerSug] = useState(false);
  const [customerSug, setCustomerSug] = useState([]);

  const [showBranchSug, setShowBranchSug] = useState(false);
  const [branchSug, setBranchSug] = useState([]);

  // NEW: receipt picker state
  const [receipts, setReceipts] = useState([]);
  const [showReceiptPicker, setShowReceiptPicker] = useState(false);
  const [loadingReceipts, setLoadingReceipts] = useState(false);

  /* ---------- debounce ---------- */
  const debounceRef = useRef(null);
  const runDebounced = (fn, delay = 250) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, delay);
  };

  /* ---------- derived ---------- */
  const isCreditType = useMemo(() => form.type === "Credit Sale Chq/DD", [form.type]);
  const isPPType = useMemo(() => form.type === "P P Chq/DD", [form.type]);
  const isChqType = useMemo(() => isCreditType || isPPType, [isCreditType, isPPType]);
  const isCheque = useMemo(() => {
    const chequeTypes = [
      "Credit Sale Chq/DD",
      "Cash Sale Chq/DD",
      "Scheme Chq/DD",
      "P P Chq/DD",
    ];
    return chequeTypes.includes(form.type);
  }, [form.type]);

  const cardClasses = "bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-lg shadow-sm";
  const inputClasses = "w-full px-2.5 py-2 rounded-md border border-gray-200 bg-white text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 transition-all duration-200";
  const actionButtonClasses = "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-medium shadow-lg shadow-blue-500/20 hover:from-blue-600 hover:to-indigo-700 active:scale-[0.985] transition-all duration-200";
  const subduedInputClasses = "w-full px-2.5 py-2 rounded-md border border-gray-200 bg-gray-50 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-200/60 focus:border-blue-300 transition-all duration-200";

  /* ---------- API fetchers ---------- */
  const fetchCustomers = (q) => {
    const endpoint =
      form.type === "P P Chq/DD"
        ? "/auth/pp-customers-name-search/"
        : "/auth/customer-search/";

    return api
      .get(endpoint, { params: { q } })
      .then((r) => (Array.isArray(r.data) ? r.data : []))
      .catch(() => []);
  };

  const fetchBranches = (q) =>
    api
      .get("/auth/branches-name-search/", { params: { q } })
      .then((r) => (Array.isArray(r.data) ? r.data : []))
      .catch(() => []);

  // NEW: fetch receipts by customer id, endpoint depends on type
  const fetchReceiptsByCustomer = async (custId) => {
    if (!custId) return [];
    try {
      const url = isCreditType
        ? "/auth/cr-realisation-by-customer-id/"
        : "/auth/pp-receipt-by-customer-id/";
      const res = await api.get(url, { params: { customer_id: custId } });
      const arr = Array.isArray(res.data) ? res.data : [];
      return arr.map((r) => ({
        receipt_no: r.receipt_no,
        entry_date: r.entry_date,
        bank: r.bank,
        chq_dd_no: r.chq_dd_no,
        amount: r.amount,
      }));
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  /* ---------- handlers ---------- */
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Type: lock/unlock Customer box + suggestions + clear receipt-derived fields when switching away
    if (name === "type") {
      const next = value;
      if (next === "Credit Sale Chq/DD" || next === "P P Chq/DD") {
        setForm((p) => ({ ...p, type: next, customer: "", bank: "", receiptNo: "", chqdd: "" }));
        setCustomerId(0);
      } else {
        setForm((p) => ({
          ...p,
          type: next,
          customer: "CASH/CARD/DIGITAL",
          bank: "",
          receiptNo: "",
          chqdd: "",
        }));
        setCustomerId(0);
        setShowCustomerSug(false);
        setCustomerSug([]);
        setShowReceiptPicker(false);
        setReceipts([]);
      }
      return;
    }

    // If user edits the visible text of Customer or Branch, clear IDs
    if (name === "customer") setCustomerId(0);
    if (name === "remittedAt") setBranchId(0);

    setForm((p) => ({ ...p, [name]: value }));
  };

  const closeAfterBlur = (closer) => () => setTimeout(closer, 120);

  const handleCustomerChange = (e) => {
    if (!isChqType) return; // lock when not cheque/DD modes
    handleChange(e);
    const q = e.target.value.trim();
    setShowCustomerSug(!!q);
    if (!q) return setCustomerSug([]);
    runDebounced(async () => setCustomerSug(await fetchCustomers(q)));
  };

  const handleBranchChange = (e) => {
    handleChange(e);
    const q = e.target.value.trim();
    setShowBranchSug(!!q);
    if (!q) return setBranchSug([]);
    runDebounced(async () => setBranchSug(await fetchBranches(q)));
  };

  const resetForm = () => {
    setForm({
      remittanceNo: "",
      cancelled: "",
      date: "",
      type: "",
      customer: "CASH/CARD/DIGITAL",
      bank: "",
      receiptNo: "",
      chqdd: "",
      remittedAt: "",
      amount: "",
      notes: "",
    });
    setCustomerId(0);
    setBranchId(0);
    setShowReceiptPicker(false);
    setReceipts([]);
  };

  /* ---------- SAVE (insert into remittance) ---------- */
  const validate = () => {
    const errs = [];
    if (!form.date) errs.push("Date");
    if (!form.type) errs.push("Type");
    if (!form.amount || asFloat(form.amount) <= 0) errs.push("Amount");
    if (!form.remittedAt || branchId === 0) errs.push("Remitted at (pick from list)");
    if (isChqType && (!form.customer || customerId === 0)) errs.push("Customer (pick from list)");
    if (errs.length) {
      showModal(
        "Please fill the following fields:<br/>• " + errs.join("<br/>• "),
        "error"
      );
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const payload = {
      // server computes: id (MAX+1), remittance_no (get_next_value)
      entry_date: form.date,
      a_type: A_TYPE[form.type] ?? 0,
      amount: asFloat(form.amount, 0),
      note1: form.notes || null,
      cancelled: asInt(form.cancelled, 0),
      // c_name rule per spec:
      c_name: isChqType ? "" : "CASH/CARD/DIGITAL",
      account_id: branchId || 0,                     // branches.id (required)
      customer_id: isCreditType ? (customerId || 0) : 0, // cr_customers.id
      pp_customer_id: isPPType ? (customerId || 0) : 0, // pp_customers.id
      // Optional UI fields (not stored columns, kept for your later use if needed):
      bank_text: form.bank || "",
      receipt_no_text: form.receiptNo || "",
      chqdd_text: form.chqdd || "",
    };

    try {
      setSaving(true);
      const res = await api.post("/auth/remittance-save/", payload);
      const msg =
        res?.data?.message ||
        `Remittance saved. No: ${res?.data?.remittance_no ?? "(auto)"}`;
      showModal(msg, "success");

      // reflect server-generated remittance_no in the UI
      setForm((p) => ({
        ...p,
        remittanceNo:
          res?.data?.remittance_no != null
            ? String(res.data.remittance_no)
            : p.remittanceNo,
      }));
    } catch (e) {
      console.error(e);
      showModal(
        `Failed to save remittance: ${e?.response?.data?.error || e.message || "Unknown error"}`,
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  /* ---------- LOAD BY REMITTANCE NO ---------- */
  const loadRemittance = async () => {
    const rn = (loadRemitNo || "").trim();
    if (!rn) {
      showModal("Please enter a Remittance No to load.", "error");
      return;
    }
    setLoadingRemit(true);
    try {
      const res = await api.get("/auth/remittance-by-no/", { params: { remittance_no: rn } });
      const r = res.data || {};

      // Translate a_type back to label if possible
      const typeLabel =
        Object.entries(A_TYPE).find(([, v]) => v === r.a_type)?.[0] || "";
      const isLoadedChq = typeLabel === "Credit Sale Chq/DD" || typeLabel === "P P Chq/DD";

      setForm({
        remittanceNo: r.remittance_no != null ? String(r.remittance_no) : rn,
        cancelled: r.cancelled != null ? String(r.cancelled) : "",
        date: r.entry_date || "",
        type: typeLabel,
        customer: isLoadedChq ? (r.c_name || "") : "CASH/CARD/DIGITAL",
        bank: "", // bank_id is numeric; keep text empty (or wire your own bank name lookup)
        receiptNo: r.ac_receipt_id ? String(r.ac_receipt_id) : "",
        chqdd: "",
        remittedAt: r.branch_name || "",
        amount: r.amount != null ? String(r.amount) : "",
        notes: r.note1 || "",
      });

      setCustomerId(isLoadedChq ? (r.customer_id || 0) : 0);
      setBranchId(r.account_id || 0);

      showModal(`Remittance ${rn} loaded successfully.`, "success");
    } catch (e) {
      console.error(e);
      showModal(
        `Failed to load remittance: ${e?.response?.data?.error || e.message || "Unknown error"}`,
        "error"
      );
    } finally {
      setLoadingRemit(false);
    }
  };

  /* ---------- render ---------- */
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-3 md:p-4 space-y-4">
      {/* Modal */}
      <Modal
        isOpen={modal.isOpen}
        message={modal.message}
        type={modal.type}
        buttons={modal.buttons}
      />

      <PageHeader
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10l1.5 1.5a9 9 0 0012.728 0L18 10M5 10V6h4M19 10V6h-4" />
          </svg>
        }
        title="Remittance Entry"
        subtitle="Record cash, cheque, and digital remittances"
        compact
      />

      <div className={`${cardClasses} p-3 space-y-3`}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
          <input
            name="remittanceNo"
            value={form.remittanceNo}
            readOnly
            tabIndex={-1}
            aria-readonly="true"
            placeholder="Remittance No"
            className={`${subduedInputClasses} font-semibold select-none pointer-events-none`}
          />
          <input
            type={form.date ? "date" : "text"}
            onFocus={(e) => (e.target.type = "date")}
            onBlur={(e) => { if (!e.target.value) e.target.type = "text"; }}
            name="date"
            value={form.date}
            onChange={handleChange}
            placeholder="Date"
            className={inputClasses}
          />
          <select
            name="type"
            value={form.type}
            onChange={handleChange}
            className={inputClasses}
          >
            <option value="" disabled hidden>Type</option>
            {A_TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <select
            name="cancelled"
            value={form.cancelled}
            onChange={handleChange}
            className={inputClasses}
          >
            <option value="" disabled hidden>Cancelled</option>
            <option value="0">No</option>
            <option value="1">Yes</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          <div className="relative xl:col-span-2">
            <input
              name="customer"
              value={isChqType ? form.customer : "CASH/CARD/DIGITAL"}
              onChange={handleCustomerChange}
              onBlur={closeAfterBlur(() => setShowCustomerSug(false))}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && isChqType) {
                  if (!customerId) {
                    showModal("Please pick a Customer from the list first.", "error");
                    return;
                  }
                  setLoadingReceipts(true);
                  const data = await fetchReceiptsByCustomer(customerId);
                  setReceipts(data);
                  setLoadingReceipts(false);
                  if (data.length === 0) {
                    showModal("No eligible receipts found for this customer.", "info");
                  } else {
                    setShowReceiptPicker(true);
                  }
                }
              }}
              placeholder={isChqType ? "Customer" : "CASH/CARD/DIGITAL"}
              className={`${inputClasses} ${isChqType ? "" : "bg-gray-50 text-gray-600 border-gray-200 cursor-not-allowed"
                }`}
              autoComplete="off"
              readOnly={!isChqType}
              aria-readonly={!isChqType}
            />
            {isChqType && showCustomerSug && customerSug.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-gray-200 w-full shadow-lg rounded-lg text-xs max-h-48 overflow-y-auto">
                {customerSug.map((c) => {
                  const name =
                    form.type === "P P Chq/DD"
                      ? c.pp_customer_nm
                      : c.customer_nm;

                  return (
                    <li
                      key={c.id}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                      onMouseDown={() => {
                        setForm((p) => ({ ...p, customer: name || "" }));
                        setCustomerId(c.id || 0);
                        setShowCustomerSug(false);
                      }}
                    >
                      {name}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="relative xl:col-span-2">
            <input
              name="remittedAt"
              value={form.remittedAt}
              onChange={handleBranchChange}
              onBlur={closeAfterBlur(() => setShowBranchSug(false))}
              placeholder="Remitted at"
              className={inputClasses}
              autoComplete="off"
            />
            {showBranchSug && branchSug.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-gray-200 w-full shadow-lg rounded-lg text-xs max-h-48 overflow-y-auto">
                {branchSug.map((b) => (
                  <li
                    key={b.id}
                    className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                    onMouseDown={() => {
                      setForm((p) => ({ ...p, remittedAt: b.branches_nm || "" }));
                      setBranchId(b.id || 0);
                      setShowBranchSug(false);
                    }}
                  >
                    {b.branches_nm}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          <input
            name="bank"
            value={form.bank}
            onChange={handleChange}
            placeholder="Bank"
            className={`${isCheque ? inputClasses : subduedInputClasses} ${isCheque ? '' : 'pointer-events-none'}`}
            readOnly={!isCheque}
            tabIndex={isCheque ? 0 : -1}
            aria-readonly={!isCheque}
          />
          <input
            name="receiptNo"
            value={form.receiptNo}
            onChange={handleChange}
            placeholder="Receipt No"
            className={inputClasses}
          />
          <input
            name="chqdd"
            value={form.chqdd}
            onChange={handleChange}
            placeholder="Chq/DD No"
            className={`${isCheque ? inputClasses : subduedInputClasses} ${isCheque ? '' : 'pointer-events-none'}`}
            readOnly={!isCheque}
            tabIndex={isCheque ? 0 : -1}
            aria-readonly={!isCheque}
          />
          <input
            type="number"
            step="1"
            name="amount"
            value={form.amount}
            onChange={handleChange}
            placeholder="Amount"
            className={`${inputClasses} text-right`}
            onWheel={(e) => e.currentTarget.blur()}
          />
        </div>

        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          rows={2}
          placeholder="Notes"
          className={`${inputClasses} min-h-[60px]`}
        />

        {/* RECEIPT PICKER (table) */}
        {showReceiptPicker && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30"
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowReceiptPicker(false);
            }}
          >
            <div className="bg-white rounded-xl shadow-xl w-[min(900px,95vw)] max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="text-sm font-semibold">Select a receipt</h3>
                <button
                  className="px-3 py-1 text-xs rounded-md bg-gray-200 hover:bg-gray-300"
                  onClick={() => setShowReceiptPicker(false)}
                  aria-label="Close"
                >
                  Close
                </button>
              </div>

              <div className="p-3">
                {loadingReceipts ? (
                  <div className="text-sm text-gray-600">Loading receipts…</div>
                ) : (
                  <div className="overflow-auto border rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr className="text-left">
                          <th className="px-3 py-2 border-b">Receipt No</th>
                          <th className="px-3 py-2 border-b">Date</th>
                          <th className="px-3 py-2 border-b">Bank</th>
                          <th className="px-3 py-2 border-b">Chq No</th>
                          <th className="px-3 py-2 border-b text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receipts.map((rc) => (
                          <tr
                            key={`${rc.receipt_no}-${rc.chq_dd_no}-${rc.entry_date}`}
                            className="hover:bg-emerald-50 cursor-pointer"
                            onClick={() => {
                              setForm((p) => ({
                                ...p,
                                bank: rc.bank || "",
                                receiptNo: rc.receipt_no != null ? String(rc.receipt_no) : "",
                                chqdd: rc.chq_dd_no || "",
                                amount: rc.amount != null ? String(rc.amount) : "",
                              }));
                              setShowReceiptPicker(false);
                            }}
                          >
                            <td className="px-3 py-2 border-b">{rc.receipt_no}</td>
                            <td className="px-3 py-2 border-b">{fmtDmy(rc.entry_date)}</td>
                            <td className="px-3 py-2 border-b">{rc.bank}</td>
                            <td className="px-3 py-2 border-b">{rc.chq_dd_no}</td>
                            <td className="px-3 py-2 border-b text-right">
                              {rc.amount != null ? Number(rc.amount).toFixed(2) : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="px-4 py-3 border-t flex justify-end">
                <button
                  className="px-4 py-2 text-sm rounded-md bg-gray-700 text-white hover:bg-gray-800"
                  onClick={() => setShowReceiptPicker(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`${cardClasses} p-3`}>
        <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
          <div className="flex flex-1 flex-col sm:flex-row gap-2">
            <input
              type="number"
              value={loadRemitNo}
              onChange={(e) => setLoadRemitNo(e.target.value)}
              placeholder="Remittance No"
              className={`${inputClasses} w-full sm:w-60 text-right`}
            />
            <button
              type="button"
              className={`${actionButtonClasses} from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700`}
              onClick={loadRemittance}
              disabled={loadingRemit}
              title="Load remittance by number"
            >
              {loadingRemit ? "Loading…" : "Load Remittance"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              className={`${actionButtonClasses} min-w-[160px]`}
              onClick={handleSave}
            >
              {saving ? "Saving…" : "Save Remittance"}
            </button>
            <button
              type="button"
              className={`${actionButtonClasses} from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 min-w-[110px]`}
              onClick={resetForm}
            >
              New
            </button>
            <button
              type="button"
              className={`${actionButtonClasses} from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 min-w-[110px]`}
              onClick={() => window.location.reload()}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
