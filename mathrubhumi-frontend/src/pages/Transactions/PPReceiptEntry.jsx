import React, { useMemo, useRef, useState } from "react";
import api from "../../utils/axiosInstance";
import Modal from "../../components/Modal";
import PageHeader from "../../components/PageHeader";

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

/* ---------- enum maps ---------- */
const R_TYPE = {
  "Registration": 0,
  "Registration for existing PP Members": 1,
  "Installment": 2,
};
const R_TYPE_INV = Object.fromEntries(Object.entries(R_TYPE).map(([k, v]) => [v, k]));

const A_TYPE = {
  "Cash": 0,
  "Money Order": 1,
  "Cheque": 2,
  "Demand Draft": 3,
  "Cr/Dr Card": 4,
  "Digital payment": 5,
};
const A_TYPE_INV = Object.fromEntries(Object.entries(A_TYPE).map(([k, v]) => [v, k]));

export default function PPReceiptEntry() {
  const [form, setForm] = useState({
    receiptType: "Registration",
    receiptNo: "",
    cancelled: "0",
    date: today(),
    ppRegNo: "",
    bookName: "",
    copies: "",
    installments: "",
    name: "",
    address1: "",
    address2: "",
    city: "",
    pin: "",
    phone: "",
    modeOfPay: "Cash",
    amount: "",
    bank: "",
    chqdd: "",
    agent: "",
    notes: "",
  });

  // keep selected IDs from suggestions
  const [ppBookId, setPpBookId] = useState(null);
  const [ppCustomerId, setPpCustomerId] = useState(null);
  const [agentId, setAgentId] = useState(null);

  /* ---------- Modal (same pattern as Sale pages) ---------- */
  const [modal, setModal] = useState({
    isOpen: false,
    message: "",
    type: "info",
    buttons: [
      {
        label: "OK",
        onClick: () => closeModal(),
        className: "bg-blue-500 hover:bg-blue-600",
      },
    ],
  });
  const showModal = (
    message,
    type = "info",
    buttons = [
      {
        label: "OK",
        onClick: () => closeModal(),
        className: "bg-blue-500 hover:bg-blue-600",
      },
    ]
  ) => setModal({ isOpen: true, message, type, buttons });
  const closeModal = () =>
    setModal({ isOpen: false, message: "", type: "info", buttons: [] });

  /* ---------- suggestions state ---------- */
  const [showBookSuggestions, setShowBookSuggestions] = useState(false);
  const [bookSuggestions, setBookSuggestions] = useState([]);

  const [showPPCustomerSuggestions, setShowPPCustomerSuggestions] = useState(false);
  const [ppCustomerSuggestions, setPPCustomerSuggestions] = useState([]);

  const [showAgentSuggestions, setShowAgentSuggestions] = useState(false);
  const [agentSuggestions, setAgentSuggestions] = useState([]);

  /* ---------- debounce helper ---------- */
  const debounceRef = useRef(null);
  const runDebounced = (fn, delay = 250) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, delay);
  };

  const isCheque = useMemo(() => {
    const chequeTypes = ["Cheque", "Demand Draft"];
    return chequeTypes.includes(form.modeOfPay);
  }, [form.modeOfPay]);

  /* ---------- API fetchers ---------- */
  const fetchBooks = (q) =>
    api
      .get(`/auth/pp-books-title-search/`, { params: { q } })
      .then((r) => (Array.isArray(r.data) ? r.data : []))
      .catch(() => []);

  const fetchPPCustomers = (q) =>
    api
      .get(`/auth/pp-customers-name-search/`, { params: { q } })
      .then((r) => (Array.isArray(r.data) ? r.data : []))
      .catch(() => []);

  const fetchAgents = (q) =>
    api
      .get(`/auth/agents-name-search/`, { params: { q } })
      .then((r) => (Array.isArray(r.data) ? r.data : []))
      .catch(() => []);

  /* ---------- change handlers ---------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleBookChange = (e) => {
    handleChange(e);
    setPpBookId(null);
    const q = e.target.value.trim();
    setShowBookSuggestions(!!q);
    if (!q) return setBookSuggestions([]);
    runDebounced(async () => setBookSuggestions(await fetchBooks(q)));
  };

  const handlePPCustomerChange = (e) => {
    handleChange(e);
    setPpCustomerId(null);
    const q = e.target.value.trim();
    setShowPPCustomerSuggestions(!!q);
    if (!q) return setPPCustomerSuggestions([]);
    runDebounced(async () => setPPCustomerSuggestions(await fetchPPCustomers(q)));
  };

  const handleAgentChange = (e) => {
    handleChange(e);
    setAgentId(null);
    const q = e.target.value.trim();
    setShowAgentSuggestions(!!q);
    if (!q) return setAgentSuggestions([]);
    runDebounced(async () => setAgentSuggestions(await fetchAgents(q)));
  };

  // close popover a tick after blur so clicks register
  const closeAfterBlur = (closer) => () => setTimeout(closer, 120);

  const isCancelled = useMemo(() => form.cancelled === "1", [form.cancelled]);

  /* ---------- computed: disable Receipt No + disable many fields for Installment ---------- */
  const isInstallment = form.receiptType === "Installment";

  const cardClasses = "bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-lg shadow-sm";
  const inputClasses = "w-full px-2.5 py-2 rounded-md border border-gray-200 bg-white text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 transition-all duration-200";
  const actionButtonClasses = "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-medium shadow-lg shadow-blue-500/20 hover:from-blue-600 hover:to-indigo-700 active:scale-[0.985] transition-all duration-200";
  const subduedInputClasses = "w-full px-2.5 py-2 rounded-md border border-gray-200 bg-gray-50 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-200 transition-all duration-200";

  const pageIcon = (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  /* ---------- SAVE (calls the PL/pgSQL procedure) ---------- */
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const errors = [];
    if (!form.date) errors.push("Date");
    if (!form.bookName || !ppBookId) errors.push("PP Book Name (pick from list)");
    if (!form.amount || asFloat(form.amount) <= 0) errors.push("Amount");
    if (!form.copies) errors.push("Copies");
    if (!form.installments) errors.push("Installments");
    if (!form.modeOfPay) errors.push("Mode of Pay");
    if (errors.length) {
      showModal(
        "Please fill the following fields:<br/>• " + errors.join("<br/>• "),
        "error"
      );
      return false;
    }
    return true;
  };

  const saveReceipt = async () => {
    if (!validate()) return;

    const r_type = R_TYPE[form.receiptType] ?? 0;
    const a_type = A_TYPE[form.modeOfPay] ?? 0;

    const payload = {
      company_id: 1,
      id: 1,
      receipt_no: asInt(form.receiptNo, null),
      entry_date: form.date,
      customer_id: 2,
      pp_customer_id: ppCustomerId,
      amount: asFloat(form.amount, 0),
      name: form.name,
      address1: form.address1 || null,
      address2: form.address2 || null,
      r_type,
      a_type,
      bank: form.bank || null,
      chq_dd_no: form.chqdd || null,
      reg_no: form.ppRegNo || null,
      pp_book_id: ppBookId,
      installments: form.installments || null,
      note1: form.notes || null,
      copies: asInt(form.copies, 0),
      agent_id: agentId,
      city: form.city || null,
      pin: form.pin || null,
      telephone: form.phone || null,
      exhibition_id: 0,
      user_id: null,
      pp_customer_book_id: 0,
      which: "I",
    };

    try {
      setSaving(true);
      const res = await api.post("/auth/pp-receipts-iud/", payload);
      showModal(res?.data?.message || "Receipt saved successfully.", "success");
      setForm((p) => ({ ...p, receiptNo: res?.data?.receipt_no ?? p.receiptNo }));
    } catch (e) {
      console.error(e);
      showModal(
        `Failed to save receipt: ${e?.response?.data?.error || e.message || "Unknown error"}`,
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  /* ---------- LOAD BY RECEIPT NO (existing) ---------- */
  const [loadReceiptNo, setLoadReceiptNo] = useState("");
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  const loadReceipt = async () => {
    const rn = (loadReceiptNo || "").trim();
    if (!rn) {
      showModal("Enter a Receipt No to load.", "error");
      return;
    }
    try {
      setLoadingReceipt(true);
      const res = await api.get("/auth/pp-receipt-by-no/", { params: { receipt_no: rn } });
      const r = res.data;

      const receiptType = R_TYPE_INV[r.r_type] ?? "Registration";
      const modeOfPay = A_TYPE_INV[r.a_type] ?? "Cash";

      setForm({
        receiptType,
        receiptNo: String(r.receipt_no ?? ""),
        cancelled: "0",
        date: r.entry_date || today(),
        ppRegNo: r.reg_no || "",
        bookName: r.title || "",
        copies: r.copies != null ? String(r.copies) : "",
        installments: r.installments || "",
        name: r.pp_customer_nm || "",
        address1: r.address1 || "",
        address2: r.address2 || "",
        city: r.city || "",
        pin: r.pin || "",
        phone: r.telephone || "",
        modeOfPay,
        amount: r.amount != null ? String(r.amount) : "",
        bank: r.bank || "",
        chqdd: r.chq_dd_no || "",
        agent: r.agent_nm || "",
        notes: r.note1 || "",
      });

      setPpBookId(r.pp_book_id ?? null);
      setPpCustomerId(r.pp_customer_id ?? null);
      setAgentId(r.agent_id ?? null);

      showModal(`Receipt ${r.receipt_no} loaded successfully.`, "success");
    } catch (e) {
      console.error(e);
      showModal(
        `Failed to load receipt: ${e?.response?.data?.error || e.message || "Unknown error"}`,
        "error"
      );
    } finally {
      setLoadingReceipt(false);
    }
  };

  /* ---------- NEW: Prefill for Installment by PP Reg. No on ENTER ---------- */
  const [prefilling, setPrefilling] = useState(false);
  const prefillFromRegNo = async () => {
    const reg = (form.ppRegNo || "").trim();
    if (!reg) {
      showModal("Enter a PP Reg. No to prefill.", "error");
      return;
    }
    if (!isInstallment) return; // strictly only for Installment mode
    try {
      setPrefilling(true);
      const res = await api.get("/auth/pp-installment-prefill/", { params: { reg_no: reg } });
      const d = res.data;

      // fill display fields
      setForm((p) => ({
        ...p,
        bookName: d.title || "",
        copies: d.copies != null ? String(d.copies) : "",
        name: d.pp_customer_nm || "",
        address1: d.address1 || "",
        address2: d.address2 || "",
        city: d.city || "",
        pin: d.pin || "",
        phone: d.telephone || "",
      }));

      // capture ids for saving
      setPpBookId(d.pp_book_id ?? null);
      setPpCustomerId(d.pp_customer_id ?? null);

      showModal("Details loaded from PP Reg. No.", "success");
    } catch (e) {
      console.error(e);
      showModal(
        `Prefill failed: ${e?.response?.data?.error || e.message || "Not found / error"}`,
        "error"
      );
    } finally {
      setPrefilling(false);
    }
  };

  const handleRegNoKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (isInstallment) prefillFromRegNo();
    }
  };

  /* ---------- render ---------- */
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-3 md:p-4 space-y-4">
      {/* Modal (notification popup) */}
      <Modal
        isOpen={modal.isOpen}
        message={modal.message}
        type={modal.type}
        buttons={modal.buttons}
      />

      <PageHeader
        icon={pageIcon}
        title="P P Receipt Entry"
        subtitle="Capture and manage PP receipts"
        compact
      />

      <div className={`${cardClasses} p-3`}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          <select
            name="receiptType"
            value={form.receiptType}
            onChange={handleChange}
            className={inputClasses}
            aria-label="Receipt Type"
          >
            {Object.keys(R_TYPE).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>

          <input
            name="receiptNo"
            value={form.receiptNo}
            readOnly
            tabIndex={-1}
            aria-readonly="true"
            placeholder="Receipt No"
            className={`${subduedInputClasses} select-none pointer-events-none font-semibold`}
          />

          <select
            name="cancelled"
            value={form.cancelled}
            onChange={handleChange}
            className={inputClasses}
            aria-label="Cancelled"
          >
            <option value="0">Cancelled: No</option>
            <option value="1">Cancelled: Yes</option>
          </select>

          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            className={inputClasses}
          />

          <input
            name="ppRegNo"
            value={form.ppRegNo}
            onChange={handleChange}
            onKeyDown={handleRegNoKey}
            readOnly={!isInstallment}
            aria-readonly={!isInstallment}
            placeholder="PP Reg. No"
            className={`${inputClasses} ${!isInstallment ? 'bg-gray-50 text-gray-600 border-gray-200' : ''}`}
          />
        </div>
      </div>

      <div className={`${cardClasses} p-3 space-y-2`}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          <div className="relative xl:col-span-2">
            <input
              name="bookName"
              value={form.bookName}
              onChange={handleBookChange}
              onBlur={closeAfterBlur(() => setShowBookSuggestions(false))}
              placeholder="PP Book Name"
              className={`${inputClasses} ${isInstallment ? 'bg-gray-50 cursor-not-allowed text-gray-600' : ''}`}
              autoComplete="off"
              disabled={isInstallment}
            />
            {showBookSuggestions && !isInstallment && bookSuggestions.length > 0 && (
              <ul className="absolute z-50 bg-white border border-gray-200 mt-1 w-full shadow-md rounded-lg text-xs max-h-48 overflow-y-auto">
                {bookSuggestions.map((row, i) => (
                  <li
                    key={`${row.id ?? i}`}
                    className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                    onMouseDown={() => {
                      setForm((p) => ({ ...p, bookName: row.title || "" }));
                      setPpBookId(row.id ?? null);
                      setShowBookSuggestions(false);
                    }}
                  >
                    {row.title}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <input
            type="number"
            name="copies"
            value={form.copies}
            onChange={handleChange}
            placeholder="Copies"
            className={`${inputClasses} text-right ${isInstallment ? 'bg-gray-50 cursor-not-allowed text-gray-600' : ''}`}
            onWheel={(e) => e.currentTarget.blur()}
            disabled={isInstallment}
          />
          <input
            name="installments"
            value={form.installments}
            onChange={handleChange}
            placeholder="Installments"
            className={inputClasses}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          <div className="relative xl:col-span-2">
            <input
              name="name"
              value={form.name}
              onChange={handlePPCustomerChange}
              onBlur={closeAfterBlur(() => setShowPPCustomerSuggestions(false))}
              className={`${inputClasses} ${isCancelled ? 'bg-gray-50' : ''} ${isInstallment ? 'bg-gray-50 text-gray-600 border-gray-200' : ''}`}
              placeholder="PP Customer Name"
              autoComplete="off"
              disabled={isInstallment}
            />
            {showPPCustomerSuggestions && !isInstallment && ppCustomerSuggestions.length > 0 && (
              <ul className="absolute z-40 bg-white border border-gray-200 mt-1 w-full shadow-md rounded-lg text-xs max-h-48 overflow-y-auto">
                {ppCustomerSuggestions.map((m, i) => (
                  <li
                    key={`${m.id ?? i}`}
                    className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                    onMouseDown={() => {
                      setForm((p) => ({
                        ...p,
                        name: m.pp_customer_nm || "",
                        address1: m.address1 || "",
                        address2: m.address2 || "",
                        city: m.city || "",
                        phone: m.telephone || "",
                        pin: m.pin || "",
                      }));
                      setPpCustomerId(m.id ?? null);
                      setShowPPCustomerSuggestions(false);
                    }}
                  >
                    {m.pp_customer_nm}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="relative">
            <input
              name="agent"
              value={form.agent}
              onChange={handleAgentChange}
              onBlur={closeAfterBlur(() => setShowAgentSuggestions(false))}
              className={inputClasses}
              autoComplete="off"
              placeholder="Agent"
            />
            {showAgentSuggestions && agentSuggestions.length > 0 && (
              <ul className="absolute z-40 bg-white border border-gray-200 mt-1 w-full shadow-md rounded-lg text-xs max-h-48 overflow-y-auto">
                {agentSuggestions.map((a, i) => (
                  <li
                    key={`${a.id ?? i}`}
                    className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                    onMouseDown={() => {
                      setForm((p) => ({ ...p, agent: a.agent_nm || "" }));
                      setAgentId(a.id ?? null);
                      setShowAgentSuggestions(false);
                    }}
                  >
                    {a.agent_nm}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <select
            name="modeOfPay"
            value={form.modeOfPay}
            onChange={handleChange}
            className={inputClasses}
            aria-label="Mode of Pay"
          >
            {Object.keys(A_TYPE).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          <input
            name="address1"
            value={form.address1}
            onChange={handleChange}
            placeholder="Address 1"
            className={`${inputClasses} ${isCancelled ? 'bg-gray-50' : ''} ${isInstallment ? 'bg-gray-50 text-gray-600 border-gray-200' : ''}`}
            onWheel={(e) => e.currentTarget.blur()}
            disabled={isInstallment}
          />

          <input
            name="address2"
            value={form.address2}
            onChange={handleChange}
            placeholder="Address 2"
            className={`${inputClasses} ${isCancelled ? 'bg-gray-50' : ''} ${isInstallment ? 'bg-gray-50 text-gray-600 border-gray-200' : ''}`}
            disabled={isInstallment}
          />

          <input
            name="city"
            value={form.city}
            onChange={handleChange}
            placeholder="City"
            className={`${inputClasses} ${isCancelled ? 'bg-gray-50' : ''} ${isInstallment ? 'bg-gray-50 text-gray-600 border-gray-200' : ''}`}
            disabled={isInstallment}
          />
          <input
            name="pin"
            value={form.pin}
            onChange={handleChange}
            placeholder="Pin"
            className={`${inputClasses} ${isCancelled ? 'bg-gray-50' : ''} ${isInstallment ? 'bg-gray-50 text-gray-600 border-gray-200' : ''}`}
            disabled={isInstallment}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="Phone"
            className={`${inputClasses} ${isCancelled ? 'bg-gray-50' : ''} ${isInstallment ? 'bg-gray-50 text-gray-600 border-gray-200' : ''}`}
            disabled={isInstallment}
          />

          <input
            type="number"
            step="0.01"
            name="amount"
            value={form.amount}
            onChange={handleChange}
            placeholder="Amount"
            className={`${inputClasses} text-right`}
            onWheel={(e) => e.currentTarget.blur()}
          />

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
            name="chqdd"
            value={form.chqdd}
            onChange={handleChange}
            placeholder="Chq/DD No"
            className={`${isCheque ? inputClasses : subduedInputClasses} ${isCheque ? '' : 'pointer-events-none'}`}
            readOnly={!isCheque}
            tabIndex={isCheque ? 0 : -1}
            aria-readonly={!isCheque}
          />
        </div>

        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          rows={2}
          placeholder="Notes"
          className={`${inputClasses} min-h-[52px]`}
        />
      </div>

      <div className={`${cardClasses} p-3`}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <input
              type="number"
              value={loadReceiptNo}
              onChange={(e) => setLoadReceiptNo(e.target.value)}
              placeholder="Receipt No"
              className={`${inputClasses} w-full sm:w-60 text-right`}
            />
            <button
              type="button"
              className={`${actionButtonClasses} from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 min-w-[140px]`}
              onClick={loadReceipt}
              title="Load an existing receipt by receipt number"
              disabled={loadingReceipt}
            >
              {loadingReceipt ? "Loading..." : "Load Receipt"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              disabled={saving}
              className={`${actionButtonClasses} from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 min-w-[150px]`}
              onClick={saveReceipt}
              title="Calls the stored procedure to insert the receipt"
            >
              {saving ? "Saving..." : "Save Receipt"}
            </button>

            <button
              type="button"
              className={`${actionButtonClasses} from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 min-w-[120px]`}
              onClick={() =>
                setForm({
                  receiptType: "Installment",
                  receiptNo: "",
                  cancelled: "0",
                  date: today(),
                  ppRegNo: "",
                  bookName: "",
                  copies: "",
                  installments: "",
                  name: "",
                  address1: "",
                  address2: "",
                  city: "",
                  pin: "",
                  phone: "",
                  modeOfPay: "Cash",
                  amount: "",
                  bank: "",
                  chqdd: "",
                  agent: "",
                  notes: "",
                })
              }
            >
              New
            </button>

            <button
              type="button"
              className={`${actionButtonClasses} from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 min-w-[120px]`}
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
