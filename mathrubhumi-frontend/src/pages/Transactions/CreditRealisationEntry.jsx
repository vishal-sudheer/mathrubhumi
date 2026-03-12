// src/pages/Transactions/CreditRealisationEntry.jsx
import React, { useRef, useState } from "react";
import api from "../../utils/axiosInstance";
import Modal from "../../components/Modal";
import PageHeader from "../../components/PageHeader";

const today = () => new Date().toISOString().split("T")[0];

// Map Mode of Pay → a_type (smallint)
const A_TYPE = {
  Cash: 0,
  "Money Order": 1,
  "Cheque": 2,
  "Demand Draft": 3,
  "Cr/Dr Card": 4,
  "Digital Payment": 5,
};
const A_TYPE_INV = Object.fromEntries(
  Object.entries(A_TYPE).map(([k, v]) => [v, k])
);

export default function CreditRealisationEntry() {
  const [form, setForm] = useState({
    receiptNo: "",
    cancelled: "", // 0 = No, 1 = Yes
    date: "",
    name: "",
    address: "",
    modeOfPay: "",
    amount: "",
    bank: "",
    chqdd: "",
    notes: "",
  });

  // Map the selected label to its numeric code
  const modeCode = A_TYPE[form.modeOfPay] ?? -1;
  // Activate for these codes
  const MODES_ACTIVATE_BANK = new Set([2, 3, 5, 6]);
  const bankFieldsActive = MODES_ACTIVATE_BANK.has(modeCode);
  const cardClasses = "bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-lg shadow-sm";
  const inputClasses = "w-full px-2.5 py-2 rounded-md border border-gray-200 bg-white text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 transition-all duration-200";
  const actionButtonClasses = "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-medium shadow-lg shadow-blue-500/20 hover:from-blue-600 hover:to-indigo-700 active:scale-[0.985] transition-all duration-200";
  const subduedInputClasses = "w-full px-2.5 py-2 rounded-md border border-gray-200 bg-gray-50 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-200/60 focus:border-blue-300 transition-all duration-200";

  // Keep selected customer id (from suggestions)
  const [customerId, setCustomerId] = useState(null);

  const [loadCreditNo, setLoadCreditNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ---------- Modal (same pattern used elsewhere) ---------- */
  const [modal, setModal] = useState({
    isOpen: false,
    message: "",
    type: "info", // "info" | "success" | "error" (your Modal can style these)
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

  /* ---------- suggestions for Name (cr_customers.customer_nm) ---------- */
  const [showNameSug, setShowNameSug] = useState(false);
  const [nameSug, setNameSug] = useState([]);

  const debounceRef = useRef(null);
  const runDebounced = (fn, delay = 250) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, delay);
  };

  const fetchCustomers = (q) =>
    api
      .get("/auth/customer-search/", { params: { q } })
      .then((r) => (Array.isArray(r.data) ? r.data : []))
      .catch(() => []);

  const closeAfterBlur = (closer) => () => setTimeout(closer, 120);

  const handleNameChange = (e) => {
    handleChange(e);
    setCustomerId(null); // typing again clears chosen id
    const q = e.target.value.trim();
    setShowNameSug(!!q);
    if (!q) return setNameSug([]);
    runDebounced(async () => setNameSug(await fetchCustomers(q)));
  };

  /* ---------- generic form handlers ---------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const resetForm = () => {
    setForm({
      receiptNo: "",
      cancelled: "",
      date: "",
      name: "",
      address: "",
      modeOfPay: "",
      amount: "",
      bank: "",
      chqdd: "",
      notes: "",
    });
    setCustomerId(null);
  };

  const validate = () => {
    const errs = [];
    if (!form.date) errs.push("Date");
    if (!form.name || !customerId) errs.push("Name (pick from list)");
    const amt = parseFloat(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) errs.push("Amount");
    if (!form.modeOfPay) errs.push("Mode of Pay");

    if (errs.length) {
      showModal(
        "Please fix the following:<br/>• " + errs.join("<br/>• "),
        "error"
      );
      return false;
    }
    return true;
  };

  /* ---------- SAVE ---------- */
  const handleSave = async () => {
    if (!validate()) return;
    const payload = {
      entry_date: form.date,
      customer_id: customerId,
      amount: parseFloat(form.amount),
      a_type: A_TYPE[form.modeOfPay] ?? 0,
      bank: form.bank || null,
      chq_dd_no: form.chqdd || null,
      note1: form.notes || null,
      cancelled: parseInt(form.cancelled, 10) || 0,
      // address is display-only; not stored in cr_realisation
    };

    try {
      setSaving(true);
      const res = await api.post("/auth/cr-realisation-save/", payload);
      const data = res?.data || {};
      setForm((p) => ({ ...p, receiptNo: String(data.receipt_no || p.receiptNo) }));
      showModal(data.message || "Credit realisation saved.", "success");
    } catch (e) {
      console.error(e);
      showModal(
        `Save failed: ${e?.response?.data?.error || e.message || "Unknown error"}`,
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  /* ---------- LOAD BY RECEIPT NO ---------- */
  const handleLoad = async () => {
    const rn = (loadCreditNo || "").trim();
    if (!rn) {
      showModal("Enter a Receipt No to load.", "error");
      return;
    }
    try {
      setLoading(true);
      const res = await api.get("/auth/cr-realisation-by-no/", {
        params: { receipt_no: rn },
      });
      const r = res?.data || {};
      setForm({
        receiptNo: String(r.receipt_no ?? rn),
        cancelled: r.cancelled != null ? String(r.cancelled) : "",
        date: r.entry_date || "",
        name: r.customer_nm || "",
        address: r.address || "",
        modeOfPay: A_TYPE_INV?.[r.a_type ?? 0] || "",
        amount: r.amount != null ? String(r.amount) : "",
        bank: r.bank || "",
        chqdd: r.chq_dd_no || "",
        notes: r.note1 || "",
      });
      setCustomerId(r.customer_id ?? null);
      showModal(`Credit ${rn} loaded successfully.`, "success");
    } catch (e) {
      console.error(e);
      showModal(
        `Load failed: ${e?.response?.data?.error || e.message || "Unknown error"}`,
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => window.location.reload();

  const pageIcon = (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

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
        icon={pageIcon}
        title="Credit Realisation Entry"
        subtitle="Record and manage credit realisations"
        compact
      />

      <div className={`${cardClasses} p-3 space-y-3`}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
          <input
            name="receiptNo"
            value={form.receiptNo}
            readOnly
            tabIndex={-1}
            aria-readonly="true"
            placeholder="Receipt No"
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
            name="modeOfPay"
            value={form.modeOfPay}
            onChange={handleChange}
            className={inputClasses}
          >
            <option value="" disabled hidden>Mode of Pay</option>
            {Object.keys(A_TYPE).map((opt) => (
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="relative">
            <input
              name="name"
              value={form.name}
              onChange={handleNameChange}
              onBlur={closeAfterBlur(() => setShowNameSug(false))}
              className={inputClasses}
              placeholder="Customer Name"
              autoComplete="off"
            />
            {showNameSug && nameSug.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-gray-200 w-full shadow-lg rounded-lg text-xs max-h-48 overflow-y-auto">
                {nameSug.map((c) => (
                  <li
                    key={c.id}
                    className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                    onMouseDown={() => {
                      setForm((p) => ({
                        ...p,
                        name: c.customer_nm || "",
                        address: [c.address_1, c.address_2, c.city].filter(Boolean).join(", "),
                      }));
                      setCustomerId(c.id ?? null);
                      setShowNameSug(false);
                    }}
                  >
                    {c.customer_nm}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <textarea
            name="address"
            value={form.address}
            rows={1}
            readOnly
            tabIndex={-1}
            aria-readonly="true"
            placeholder="Address"
            className={`${subduedInputClasses} h-[34px] resize-none select-none pointer-events-none`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_160px] gap-2">
          <input
            name="bank"
            value={form.bank}
            onChange={handleChange}
            placeholder="Bank"
            className={`${bankFieldsActive ? inputClasses : subduedInputClasses} ${bankFieldsActive ? "" : "pointer-events-none"}`}
            readOnly={!bankFieldsActive}
            tabIndex={bankFieldsActive ? 0 : -1}
            aria-readonly={!bankFieldsActive}
          />
          <input
            name="chqdd"
            value={form.chqdd}
            onChange={handleChange}
            placeholder="Chq/DD No"
            className={`${bankFieldsActive ? inputClasses : subduedInputClasses} ${bankFieldsActive ? "" : "pointer-events-none"}`}
            readOnly={!bankFieldsActive}
            tabIndex={bankFieldsActive ? 0 : -1}
            aria-readonly={!bankFieldsActive}
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
      </div>

      <div className={`${cardClasses} p-3`}>
        <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
          <div className="flex flex-1 flex-col sm:flex-row gap-2">
            <input
              type="number"
              value={loadCreditNo}
              onChange={(e) => setLoadCreditNo(e.target.value)}
              placeholder="Receipt No"
              className={`${inputClasses} w-full sm:w-60 text-right`}
            />
            <button
              type="button"
              className={`${actionButtonClasses} from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700`}
              onClick={handleLoad}
              title="Load credit by receipt no"
              disabled={loading}
            >
              {loading ? "Loading…" : "Load Credit Realisation"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              className={`${actionButtonClasses} min-w-[190px]`}
              onClick={handleSave}
            >
              {saving ? "Saving…" : "Save Credit Realisation"}
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
              onClick={handleReset}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
