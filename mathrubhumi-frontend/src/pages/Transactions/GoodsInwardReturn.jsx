import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/axiosInstance';
import { TrashIcon } from '@heroicons/react/24/solid';

/* ---------- numeric helpers ---------- */
const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const tf = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
};
const computeValue = (qty, rate, ex, disP) => {
  const q = num(qty);
  const r = num(rate);
  const x = num(ex, 1);
  const dp = num(disP);
  return q * r * x * (1 - dp / 100);
};

export default function GoodsInwardReturnPage() {
  const [items, setItems] = useState([]);
  const [goodsInwardIdToLoad, setGoodsInwardIdToLoad] = useState('');
  const [goodsInwardId, setGoodsInwardId] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isDotPrefixed, setIsDotPrefixed] = useState(false);
  const [isMalayalam, setIsMalayalam] = useState(false);

  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [supplierHighlightedIndex, setSupplierHighlightedIndex] = useState(-1);

  const [billSuggestions, setBillSuggestions] = useState([]);
  const [showBillSuggestions, setShowBillSuggestions] = useState(false);
  const [billHighlightedIndex, setBillHighlightedIndex] = useState(-1);

  const [currencies, setCurrencies] = useState([]);
  const [suggestionPosition, setSuggestionPosition] = useState(null);
  const productInputRef = useRef(null);

  const [toast, setToast] = useState({
    isOpen: false,
    title: 'Message',
    message: '',
    type: 'info',
    buttons: [],
  });

  const [purchaseItemsModal, setPurchaseItemsModal] = useState({
    isOpen: false,
    purchaseId: null,
    invoiceNo: '',
    invoiceDate: '',
    items: [],
  });

  const [activeDiscountField, setActiveDiscountField] = useState(null);

  const [formData, setFormData] = useState({
    itemName: '',
    isbn: '',
    quantity: '',
    purchaseRate: '',
    exchangeRate: '1',
    currency: 'Indian Rupees',
    discount: '',
    discountAmount: '',
    titleId: '',
    currencyIndex: 0,
  });

  const [inwardMaster, setInwardMaster] = useState({
    srl_no: '',
    entry_date: '',
    supplier_nm: '',
    supplier_id: '',
    bill_no: '',
    nett: '',
    notes: '',
    is_local: '',
    gross: '',
    type: '',
    user_id: 1,
    branch_id: 1,
  });

  /* ---------- small toast helpers ---------- */
  const openToast = (message, type = 'info', title = undefined, buttons = undefined) => {
    setToast({
      isOpen: true,
      title: title ?? (type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Message'),
      message,
      type,
      buttons:
        buttons ??
        [{ label: 'OK', onClick: () => closeToast(), className: 'bg-blue-600 hover:bg-blue-700' }],
    });
  };
  const closeToast = () =>
    setToast({ isOpen: false, title: 'Message', message: '', type: 'info', buttons: [] });

  const decodeUnicode = (str) => {
    if (!str) return '';
    try {
      let decoded = str.replace(/\\u([0-9A-Fa-f]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
      decoded = decodeURIComponent(decoded.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))));
      return decoded;
    } catch {
      return str;
    }
  };

  /* ---------- load currencies once ---------- */
  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const response = await api.get('/auth/currencies/');
        const data = Array.isArray(response.data) ? response.data : [];
        const valid = data.every(cur => cur && cur.id !== undefined && cur.name);
        const list = valid ? data : [{ id: 0, name: 'Indian Rupees' }];
        setCurrencies(list);

        const defaultCurrency =
          list.find(cur => cur.name === 'Indian Rupees') || list[0] || { id: 0, name: 'Indian Rupees' };

        setFormData(prev => ({
          ...prev,
          currency: defaultCurrency.name,
          currencyIndex: defaultCurrency.id,
          exchangeRate: '1',
        }));
      } catch {
        setCurrencies([{ id: 0, name: 'Indian Rupees' }]);
        setFormData(prev => ({ ...prev, currency: 'Indian Rupees', currencyIndex: 0, exchangeRate: '1' }));
        openToast('Failed to load currencies. Using default currency.', 'error');
      }
    };
    fetchCurrencies();
  }, []);

  // Keep suggestion dropdown pinned to viewport (outside scrollable card)
  useEffect(() => {
    const updatePosition = () => {
      if (
        !showSuggestions ||
        suggestions.length === 0 ||
        !productInputRef.current ||
        !formData.itemName.trim()
      ) {
        setSuggestionPosition(null);
        return;
      }
      const rect = productInputRef.current.getBoundingClientRect();
      setSuggestionPosition({
        top: rect.top + window.scrollY - 6,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [showSuggestions, suggestions.length, formData.itemName]);

  /* ---------- item input autocomplete ---------- */
  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    if (['quantity', 'purchaseRate', 'exchangeRate', 'discount', 'discountAmount'].includes(name) && value < 0) {
      openToast('Negative values are not allowed', 'error');
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'itemName') {
      const trimmed = value.trim();
      const newIsDotPrefixed = trimmed.startsWith('.');
      setIsDotPrefixed(newIsDotPrefixed);
      setIsMalayalam(newIsDotPrefixed);

      if (trimmed.length === 0 || (newIsDotPrefixed && trimmed.length === 1)) {
        setSuggestions([]);
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        setFormData(prev => ({
          ...prev,
          purchaseRate: '',
          isbn: '',
          titleId: '',
          discount: '',
          discountAmount: '',
        }));
        setIsMalayalam(false);
      } else {
        try {
          const res = await api.get(`/auth/product-search/?q=${encodeURIComponent(trimmed)}`);
          const data = Array.isArray(res.data) ? res.data : [];
          const decoded = data.map(s => ({
            ...s,
            title_m: decodeUnicode(s.title_m),
            raw_title_m: s.raw_title_m,
          }));
          setSuggestions(decoded);
          setShowSuggestions(decoded.length > 0);
          setHighlightedIndex(-1);
        } catch {
          setSuggestions([]);
          setShowSuggestions(false);
          setHighlightedIndex(-1);
        }
      }
    }

    if (name === 'currency') {
      const selectedCurrency = currencies.find(cur => cur.name === value);
      setFormData(prev => ({
        ...prev,
        currency: value,
        currencyIndex: selectedCurrency ? selectedCurrency.id : (currencies.find(c => c.name === 'Indian Rupees')?.id || 0),
      }));
    }
  };

  /* ---------- master form handlers (supplier/bill) ---------- */
  const handleInwardMasterChange = async (e) => {
    const { name, value } = e.target;
    if (['nett', 'gross'].includes(name) && value < 0) {
      openToast('Negative values are not allowed', 'error');
      return;
    }
    setInwardMaster(prev => ({ ...prev, [name]: value }));

    if (name === 'supplier_nm') {
      if (value.trim().length === 0) {
        setSupplierSuggestions([]);
        setShowSupplierSuggestions(false);
        setSupplierHighlightedIndex(-1);
        setInwardMaster(prev => ({ ...prev, supplier_id: '', bill_no: '' }));
        setBillSuggestions([]);
        setShowBillSuggestions(false);
        return;
      }
      try {
        const res = await api.get(`/auth/suppliers/search/?q=${encodeURIComponent(value)}`);
        const data = Array.isArray(res.data) ? res.data : [];
        setSupplierSuggestions(data);
        setShowSupplierSuggestions(data.length > 0);
        setSupplierHighlightedIndex(-1);
      } catch {
        openToast('Failed to fetch supplier suggestions', 'error');
      }
    }

    if (name === 'bill_no' && inwardMaster.supplier_id) {
      if (value.trim().length === 0) {
        setBillSuggestions([]);
        setShowBillSuggestions(false);
        setBillHighlightedIndex(-1);
        return;
      }
      try {
        const res = await api.get(
          `/auth/purchase/search/?q=${encodeURIComponent(value)}&supplier_id=${inwardMaster.supplier_id}`
        );
        const data = Array.isArray(res.data) ? res.data : [];
        setBillSuggestions(data);
        setShowBillSuggestions(data.length > 0);
        setBillHighlightedIndex(-1);
      } catch {
        openToast('Failed to fetch bill suggestions', 'error');
      }
    }
  };

  /* ---------- keyboard nav across suggestion lists ---------- */
  const handleKeyDown = (e, inputName) => {
    if (inputName === 'itemName' && showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => {
          const next = e.key === 'ArrowDown'
            ? (prev < suggestions.length - 1 ? prev + 1 : 0)
            : (prev > 0 ? prev - 1 : suggestions.length - 1);
          const el = document.getElementById(`suggestion-${next}`);
          if (el) el.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault();
        handleItemSuggestionClick(suggestions[highlightedIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        setSuggestions([]);
        setHighlightedIndex(-1);
      }
      return;
    }

    if (inputName === 'supplier_nm' && showSupplierSuggestions && supplierSuggestions.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSupplierHighlightedIndex(prev => {
          const next = e.key === 'ArrowDown'
            ? (prev < supplierSuggestions.length - 1 ? prev + 1 : 0)
            : (prev > 0 ? prev - 1 : supplierSuggestions.length - 1);
          const el = document.getElementById(`supplier-suggestion-${next}`);
          if (el) el.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'Enter' && supplierHighlightedIndex >= 0) {
        e.preventDefault();
        handleSupplierSuggestionClick(supplierSuggestions[supplierHighlightedIndex]);
      } else if (e.key === 'Escape') {
        setShowSupplierSuggestions(false);
        setSupplierSuggestions([]);
        setSupplierHighlightedIndex(-1);
      }
      return;
    }

    if (inputName === 'bill_no' && showBillSuggestions && billSuggestions.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setBillHighlightedIndex(prev => {
          const next = e.key === 'ArrowDown'
            ? (prev < billSuggestions.length - 1 ? prev + 1 : 0)
            : (prev > 0 ? prev - 1 : billSuggestions.length - 1);
          const el = document.getElementById(`bill-suggestion-${next}`);
          if (el) el.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'Enter' && billHighlightedIndex >= 0) {
        e.preventDefault();
        handleBillSuggestionClick(billSuggestions[billHighlightedIndex]);
      } else if (e.key === 'Escape') {
        setShowBillSuggestions(false);
        setBillSuggestions([]);
        setBillHighlightedIndex(-1);
      }
    }

    if (purchaseItemsModal.isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setPurchaseItemsModal(prev => {
          const items = prev.items;
          const selectedIndex = items.findIndex(item => item.isSelected);
          let newIndex = selectedIndex;
          if (e.key === 'ArrowDown') {
            newIndex = selectedIndex < items.length - 1 ? selectedIndex + 1 : 0;
          } else if (e.key === 'ArrowUp') {
            newIndex = selectedIndex > 0 ? selectedIndex - 1 : items.length - 1;
          }
          const updatedItems = items.map((item, idx) => ({
            ...item,
            isSelected: idx === newIndex,
          }));
          const el = document.getElementById(`purchase-item-${newIndex}`);
          if (el) el.scrollIntoView({ block: 'nearest' });
          return { ...prev, items: updatedItems };
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleAddSelectedItems();
      } else if (e.key === 'Escape') {
        closePurchaseModal();
      }
    }
  };

  /* ---------- selection handlers ---------- */
  const handleItemSuggestionClick = (suggestion) => {
    const selectedTitle =
      isDotPrefixed ? suggestion.title_m : (suggestion.language_id === 1 ? suggestion.title_m : suggestion.title);
    const isMalayalamTitle = isDotPrefixed || suggestion.language_id === 1;

    setFormData(prev => ({
      ...prev,
      itemName: selectedTitle,
      isbn: suggestion.isbn || '',
      purchaseRate: suggestion.rate || '',
      exchangeRate: suggestion.exchangeRate || '1',
      discount: '0',
      discountAmount: '0',
      titleId: suggestion.id,
      currency: currencies.find(cur => cur.name === 'Indian Rupees')?.name || 'Indian Rupees',
      currencyIndex: currencies.find(cur => cur.name === 'Indian Rupees')?.id || 0,
    }));
    setIsMalayalam(isMalayalamTitle);
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    setIsDotPrefixed(false);
  };

  const handleSupplierSuggestionClick = (supplier) => {
    setInwardMaster(prev => ({
      ...prev,
      supplier_nm: supplier.supplier_nm,
      supplier_id: supplier.id,
      bill_no: '',
    }));
    setSupplierSuggestions([]);
    setShowSupplierSuggestions(false);
    setSupplierHighlightedIndex(-1);
    setBillSuggestions([]);
    setShowBillSuggestions(false);
  };

  const handleBillSuggestionClick = async (bill) => {
    setInwardMaster(prev => ({
      ...prev,
      bill_no: bill.invoice_no,
      invoice_date: bill.invoice_date,
    }));
    setBillSuggestions([]);
    setShowBillSuggestions(false);
    setBillHighlightedIndex(-1);

    try {
      setLoading(true);
      const res = await api.get(`/auth/purchase/${bill.id}/items/`);
      const data = Array.isArray(res.data) ? res.data : [];
      const newItems = data.map(raw => ({
        title: raw.title || '',
        isbn: raw.isbn || '',
        quantity: num(raw.quantity),
        rate: num(raw.rate),
        exchange_rate: num(raw.exchange_rate, 1),
        currency_name: raw.currency_name || 'Indian Rupees',
        discount_p: num(raw.discount_p),
        discount_a: num(raw.discount_a),
        title_id: num(raw.title_id),
        currency_id: num(raw.currency_id),
        language_id: num(raw.language_id),
        origin_company_id: num(raw.origin_company_id),
        origin_purchase_id: num(raw.origin_purchase_id),
        origin_purchase_items_id: num(raw.origin_purchase_items_id),
        isSelected: false,
        value: computeValue(raw.quantity, raw.rate, raw.exchange_rate, raw.discount_p),
      }));

      setPurchaseItemsModal({
        isOpen: true,
        purchaseId: bill.id,
        invoiceNo: bill.invoice_no,
        invoiceDate: bill.invoice_date,
        items: newItems,
      });

      if (newItems.length === 0) openToast('No purchase items found for this bill', 'warning');
    } catch {
      openToast('Failed to load purchase items', 'error');
    } finally {
      setLoading(false);
    }
  };

  const togglePurchaseItemSelection = (rowIndex) => {
    setPurchaseItemsModal(prev => {
      const items = prev.items.map((it, idx) =>
        idx === rowIndex ? { ...it, isSelected: !it.isSelected } : it
      );
      return { ...prev, items };
    });
  };

  const handleAddSelectedItems = () => {
    const selectedItems = purchaseItemsModal.items
      .filter(i => i.isSelected)
      .map(i => ({
        itemName: i.title,
        isbn: i.isbn || '',
        quantity: num(i.quantity),
        purchaseRate: num(i.rate),
        exchangeRate: num(i.exchange_rate, 1),
        currency: i.currency_name || 'Indian Rupees',
        discount: num(i.discount_p),
        discountAmount: num(i.discount_a),
        value: computeValue(i.quantity, i.rate, i.exchange_rate, i.discount_p),
        titleId: num(i.title_id),
        currencyIndex: num(i.currency_id),
        isMalayalam: i.language_id === 1,
        purchaseCompanyId: num(i.origin_company_id),
        purchaseId: num(i.origin_purchase_id),
        purchaseItemId: num(i.origin_purchase_items_id),
      }));

    setItems(prev => [...prev, ...selectedItems]);
    setPurchaseItemsModal({ isOpen: false, purchaseId: null, invoiceNo: '', invoiceDate: '', items: [] });
  };

  /* ---------- main grid handlers ---------- */
  const handleAddItem = () => {
    const { itemName, isbn, quantity, purchaseRate, exchangeRate, currency, discount, discountAmount, titleId } = formData;
    if (!itemName || !quantity || !purchaseRate || !currency || !titleId) {
      openToast('Please fill required item details (Product, Qty, F Val, Curr)', 'error');
      return;
    }
    if (quantity < 0 || purchaseRate < 0 || exchangeRate < 0 || discount < 0 || discountAmount < 0) {
      openToast('Negative values are not allowed', 'error');
      return;
    }

    const qty = num(quantity);
    const rt = num(purchaseRate);
    const exRt = num(exchangeRate, 1);
    const disc = num(discount);
    const discAmt = num(discountAmount);
    const currencyIndex = currencies.find(cur => cur.name === currency)?.id || 0;

    const value = computeValue(qty, rt, exRt, disc);

    setItems(prev => [
      ...prev,
      {
        itemName,
        isbn,
        quantity: qty,
        purchaseRate: rt,
        exchangeRate: exRt,
        currency,
        discount: disc,
        discountAmount: discAmt,
        value,
        titleId,
        currencyIndex,
        isMalayalam,
      },
    ]);

    if (disc > 0 && !activeDiscountField) setActiveDiscountField('item_discount');

    setFormData({
      itemName: '',
      isbn: '',
      quantity: '',
      purchaseRate: '',
      exchangeRate: '1',
      currency: currencies.find(cur => cur.name === 'Indian Rupees')?.name || 'Indian Rupees',
      discount: '',
      discountAmount: '',
      titleId: '',
      currencyIndex: currencies.find(cur => cur.name === 'Indian Rupees')?.id || 0,
    });
    setIsMalayalam(false);
  };

  const handleItemChange = (index, field, value) => {
    if (['quantity', 'purchaseRate', 'exchangeRate', 'discount', 'discountAmount'].includes(field) && value < 0) {
      openToast('Negative values are not allowed', 'error');
      return;
    }
    setItems(prevItems => {
      const updated = [...prevItems];
      const item = { ...updated[index] };

      if (field === 'currency') {
        const selectedCurrency = currencies.find(cur => cur.name === value);
        item.currency = value;
        item.currencyIndex = selectedCurrency ? selectedCurrency.id
          : (currencies.find(cur => cur.name === 'Indian Rupees')?.id || 0);
      } else {
        item[field] = value;
      }

      const qty = num(item.quantity);
      const rt = num(item.purchaseRate);
      const exRt = num(item.exchangeRate, 1);
      const disc = num(item.discount);
      item.value = computeValue(qty, rt, exRt, disc);

      updated[index] = item;
      return updated;
    });
  };

  const handleSubmitGoodsInward = async () => {
    if (!inwardMaster.supplier_id || items.length === 0) {
      openToast("Please fill supplier and add at least one item", "error");
      return;
    }
    if (num(inwardMaster.nett) < 0 || num(inwardMaster.gross) < 0) {
      openToast('Negative values are not allowed for Nett or Gross', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        purchase_rt: {
          company_id: 0,
          purchase_rt_no: num(inwardMaster.srl_no),
          entry_date: inwardMaster.entry_date,
          nett: num(inwardMaster.nett),
          supplier_id: num(inwardMaster.supplier_id),
          narration: inwardMaster.notes || '.',
          pr_type: { Return: 0, Purchase: 1, Owner: 2 }[inwardMaster.type] || 0,
          gross: num(inwardMaster.gross),
          inter_state: { Local: 0, 'Int. State': 1, Imported: 2 }[inwardMaster.is_local] || 0,
          user_id: num(inwardMaster.user_id),
          bill_no: inwardMaster.bill_no || '',
        },
        purchase_rt_items: items.map((item, index) => ({
          company_id: 0,
          id: num(item.rowId),
          title_id: num(item.titleId),
          quantity: num(item.quantity),
          rate: num(item.purchaseRate),
          exchange_rate: num(item.exchangeRate, 1),
          discount: num(item.discount),
          adjusted_amount: num(item.discountAmount),
          line_value: num(item.value),
          purchase_det_id: num(item.purchaseItemId),
          purchase_company_id: num(item.purchaseCompanyId),
          purchase_id: num(item.purchaseId),
          currency_id: num(item.currencyIndex),
        })),
      };

      const endpoint = isEditMode ? `/auth/goods-inward/${goodsInwardId}/` : '/auth/goods-inward/';
      const method = isEditMode ? api.put : api.post;
      const response = await method(endpoint, payload);

      openToast(
        isEditMode ? 'Goods inward updated successfully' : 'Goods inward created successfully',
        'success'
      );
      resetForm();
      if (!isEditMode) {
        setGoodsInwardId(response.data.id);
        setIsEditMode(true);
      }
    } catch (error) {
      console.error('Submit goods inward error:', error);
      openToast(`Failed to ${isEditMode ? 'update' : 'create'} goods inward: ${error.response?.data?.error || 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadGoodsInward = async () => {
    if (!goodsInwardIdToLoad) {
      openToast('Please enter a Goods Inward ID', 'error');
      return;
    }
    setLoading(true);
    try {
      const response = await api.get(`/auth/goods-inward/${goodsInwardIdToLoad}/`);
      const data = response.data;

      setInwardMaster({
        srl_no: data.purchase_rt_no || '',
        entry_date: data.entry_date || '',
        supplier_nm: data.supplier_nm || '',
        supplier_id: data.supplier_id || '',
        bill_no: data.bill_no || '',
        nett: data.nett || '',
        notes: data.narration || '',
        is_local: { 0: 'Local', 1: 'Int. State', 2: 'Imported' }[data.inter_state] ?? '',
        gross: data.gross || '',
        type: { 0: 'Return', 1: 'Purchase', 2: 'Owner' }[data.pr_type] ?? '',
        user_id: data.user_id || 1,
        branch_id: data.branch_id || 1,
      });

      setItems(data.items.map(item => ({
        itemName: item.title || '',
        isbn: item.isbn || '',
        quantity: num(item.quantity),
        purchaseRate: num(item.rate),
        exchangeRate: num(item.exchange_rate, 1),
        currency: item.currency_name || 'Indian Rupees',
        discount: num(item.discount),
        discountAmount: num(item.adjusted_amount),
        value: num(item.line_value),
        titleId: num(item.title_id),
        currencyIndex: num(item.currency_id),
        isMalayalam: item.language_id === 1,
        rowId: num(item.row_id),
        purchaseCompanyId: num(item.purchase_company_id),
        purchaseId: num(item.purchase_id),
        purchaseItemId: num(item.purchase_det_id),
      })));

      setGoodsInwardId(data.id);
      setIsEditMode(true);
      setGoodsInwardIdToLoad('');
      openToast('Goods inward loaded successfully', 'success');
    } catch (error) {
      console.error('Load goods inward error:', error);
      openToast('Failed to load goods inward', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setInwardMaster({
      srl_no: '',
      entry_date: '',
      supplier_nm: '',
      supplier_id: '',
      bill_no: '',
      nett: '',
      notes: '',
      is_local: '',
      gross: '',
      type: '',
      user_id: 1,
      branch_id: 1,
    });
    setItems([]);
    setFormData({
      itemName: '',
      isbn: '',
      quantity: '',
      purchaseRate: '',
      exchangeRate: '1',
      currency: currencies.find(cur => cur.name === 'Indian Rupees')?.name || 'Indian Rupees',
      discount: '',
      discountAmount: '',
      titleId: '',
      currencyIndex: currencies.find(cur => cur.name === 'Indian Rupees')?.id || 0,
    });
    setPurchaseItemsModal({ isOpen: false, purchaseId: null, invoiceNo: '', invoiceDate: '', items: [] });
    setSuggestions([]);
    setShowSuggestions(false);
    setSupplierSuggestions([]);
    setShowSupplierSuggestions(false);
    setBillSuggestions([]);
    setShowBillSuggestions(false);
    setHighlightedIndex(-1);
    setSupplierHighlightedIndex(-1);
    setBillHighlightedIndex(-1);
    setIsDotPrefixed(false);
    setIsMalayalam(false);
    setGoodsInwardId(null);
    setIsEditMode(false);
    setGoodsInwardIdToLoad('');
    setActiveDiscountField(null);
  };

  const totalValue = items.reduce((sum, item) => sum + num(item.value), 0);

  const cardClasses = "bg-white/90 border border-gray-200 rounded-lg shadow-sm";
  const inputClasses = "sb-input px-2 rounded-md border border-gray-200 bg-white text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 transition-all duration-200";
  const actionButtonClasses = "sb-input inline-flex items-center justify-center gap-2 px-3 rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-medium shadow-lg shadow-blue-500/20 hover:from-blue-600 hover:to-indigo-700 active:scale-[0.985] transition-all duration-200";
  const tableInputClasses = "sb-table-input w-full px-2 rounded-md border border-gray-200 bg-gray-50 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white transition-all duration-200";

  /* ---------- inline modal renderers ---------- */
  const renderToast = () => {
    if (!toast.isOpen) return null;
    const bg =
      toast.type === 'error' ? 'bg-red-50'
        : toast.type === 'success' ? 'bg-green-50'
          : toast.type === 'warning' ? 'bg-yellow-50'
            : 'bg-white';
    const titleColor =
      toast.type === 'error' ? 'text-red-700'
        : toast.type === 'success' ? 'text-green-700'
          : toast.type === 'warning' ? 'text-yellow-700'
            : 'text-gray-800';

    return (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={closeToast} />
        <div className={`relative ${bg} rounded-xl shadow-lg p-6 max-w-sm w-full mx-4`}>
          <h3 className={`text-lg font-semibold ${titleColor} mb-2`}>{toast.title}</h3>
          {toast.message ? <p className="text-sm text-gray-700 mb-4">{toast.message}</p> : null}
          <div className="flex justify-end gap-2">
            {toast.buttons.map((b, i) => (
              <button
                key={i}
                className={`${b.className || 'bg-gray-700 hover:bg-gray-800'} text-white px-4 py-2 rounded-lg text-sm`}
                onClick={b.onClick}
                type="button"
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const closePurchaseModal = () =>
    setPurchaseItemsModal({ isOpen: false, purchaseId: null, invoiceNo: '', invoiceDate: '', items: [] });

  const renderPurchaseItemsModal = () => {
    if (!purchaseItemsModal.isOpen) return null;
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={closePurchaseModal} />
        <div
          className="relative bg-white rounded-xl shadow-xl w-[min(95vw,1000px)] max-h-[85vh] overflow-hidden mx-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-3 border-b bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-800">
              {purchaseItemsModal.invoiceNo} — {purchaseItemsModal.invoiceDate}
            </h2>
          </div>
          <div className="p-4 overflow-auto max-h-[65vh]">
            {loading ? (
              <div className="text-center py-4">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                <p className="text-sm text-gray-600 mt-2">Loading purchase items...</p>
              </div>
            ) : purchaseItemsModal.items.length === 0 ? (
              <p className="text-sm text-gray-500">No purchase items found for this bill.</p>
            ) : (
              <table className="w-full table-auto border border-gray-300 border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="w-[50px] text-left p-2 text-sm font-semibold border border-gray-300">Select</th>
                    <th className="w-[330px] text-left p-2 text-sm font-semibold border border-gray-300">Product</th>
                    <th className="w-[110px] text-left p-2 text-sm font-semibold border border-gray-300">ISBN</th>
                    <th className="w-[60px] text-right p-2 text-sm font-semibold border border-gray-300">Qty</th>
                    <th className="w-[70px] text-right p-2 text-sm font-semibold border border-gray-300">F Val</th>
                    <th className="w-[60px] text-left p-2 text-sm font-semibold border border-gray-300">Curr</th>
                    <th className="w-[70px] text-right p-2 text-sm font-semibold border border-gray-300">ExRt</th>
                    <th className="w-[70px] text-right p-2 text-sm font-semibold border border-gray-300">Dis%</th>
                    <th className="w-[80px] text-right p-2 text-sm font-semibold border border-gray-300">-/+Adj</th>
                    <th className="w-[100px] text-right p-2 text-sm font-semibold border border-gray-300">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseItemsModal.items.map((item, index) => (
                    <tr key={`${item.title_id || 'row'}-${index}`} className="border-t" id={`purchase-item-${index}`}>
                      <td className="p-2 text-sm text-center">
                        <input
                          type="checkbox"
                          checked={!!item.isSelected}
                          onChange={() => togglePurchaseItemSelection(index)}
                          className="cursor-pointer"
                        />
                      </td>
                      <td
                        className={`p-2 text-sm ${item.language_id === 1 ? 'font-malayalam' : ''}`}
                        style={item.language_id === 1 ? { fontFamily: 'Noto Sans Malayalam, sans-serif' } : {}}
                      >
                        {item.title || ''}
                      </td>
                      <td className="p-2 text-sm">{item.isbn || ''}</td>
                      <td className="p-2 text-sm text-right">{num(item.quantity)}</td>
                      <td className="p-2 text-sm text-right">{tf(item.rate)}</td>
                      <td className="p-2 text-sm">{item.currency_name || 'Indian Rupees'}</td>
                      <td className="p-2 text-sm text-right">{tf(item.exchange_rate)}</td>
                      <td className="p-2 text-sm text-right">{tf(item.discount_p)}</td>
                      <td className="p-2 text-sm text-right">{tf(item.discount_a)}</td>
                      <td className="p-2 text-sm text-right">{tf(item.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="px-5 py-3 border-t bg-gray-50 flex justify-end gap-2">
            <button
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
              onClick={handleAddSelectedItems}
              type="button"
              disabled={loading}
            >
              Add Selected Items
            </button>
            <button
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm"
              onClick={closePurchaseModal}
              type="button"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ---------- render ---------- */
  return (
    <div className="sb-page min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 lg:h-[100svh] lg:overflow-hidden lg:flex lg:flex-col">
      {renderToast()}
      {renderPurchaseItemsModal()}

      {loading && (
        <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/20">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        </div>
      )}

      <div className="sb-layout flex flex-col lg:flex-1 lg:min-h-0">
        <div className={`${cardClasses} sb-card`}>
          <div className="sb-form-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <input
              type="text"
              name="srl_no"
              value={inwardMaster.srl_no}
              onChange={handleInwardMasterChange}
              placeholder="Srl No"
              className={`${inputClasses} bg-gray-50 font-semibold`}
              disabled={loading}
            />
            <input
              type={inwardMaster.entry_date ? 'date' : 'text'}
              onFocus={(e) => (e.target.type = 'date')}
              onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
              name="entry_date"
              value={inwardMaster.entry_date}
              onChange={handleInwardMasterChange}
              placeholder="Date"
              className={inputClasses}
              disabled={loading}
            />

            <div className="relative">
              <input
                type="text"
                name="supplier_nm"
                value={inwardMaster.supplier_nm}
                onChange={handleInwardMasterChange}
                onKeyDown={(e) => handleKeyDown(e, 'supplier_nm')}
                placeholder="Supplier"
                className={`${inputClasses} w-full`}
                autoComplete="off"
                disabled={loading}
              />
              {showSupplierSuggestions && supplierSuggestions.length > 0 && inwardMaster.supplier_nm.trim() && (
                <ul className="absolute z-20 bg-white border border-gray-200 mt-1.5 w-full shadow-lg rounded-lg text-xs max-h-48 overflow-y-auto">
                  {supplierSuggestions.map((supplier, index) => (
                    <li
                      key={supplier.id}
                      id={`supplier-suggestion-${index}`}
                      className={`px-3 py-2 cursor-pointer ${supplierHighlightedIndex === index ? 'bg-blue-50' : 'hover:bg-gray-100'}`}
                      onClick={() => handleSupplierSuggestionClick(supplier)}
                    >
                      {supplier.supplier_nm}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                name="bill_no"
                value={inwardMaster.bill_no}
                onChange={handleInwardMasterChange}
                onKeyDown={(e) => handleKeyDown(e, 'bill_no')}
                placeholder="Bill No"
                className={`${inputClasses} w-full`}
                autoComplete="off"
                disabled={loading}
              />
              {showBillSuggestions && billSuggestions.length > 0 && inwardMaster.bill_no.trim() && (
                <ul className="absolute z-20 bg-white border border-gray-200 mt-1.5 w-full shadow-lg rounded-lg text-xs max-h-48 overflow-y-auto">
                  {billSuggestions.map((bill, index) => (
                    <li
                      key={bill.id}
                      id={`bill-suggestion-${index}`}
                      className={`px-3 py-2 cursor-pointer ${billHighlightedIndex === index ? 'bg-blue-50' : 'hover:bg-gray-100'}`}
                      onClick={() => handleBillSuggestionClick(bill)}
                    >
                      {bill.invoice_no} - {bill.invoice_date}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <input
              type="number"
              name="gross"
              value={inwardMaster.gross}
              onChange={handleInwardMasterChange}
              placeholder="Gross"
              className={`${inputClasses} bg-gray-50 text-right font-semibold`}
              readOnly
              step="0.01"
              disabled={loading}
            />
            <input
              type="number"
              name="nett"
              value={inwardMaster.nett}
              onChange={handleInwardMasterChange}
              placeholder="Nett"
              className={`${inputClasses} bg-gray-50 text-right font-semibold`}
              readOnly
              step="0.01"
              disabled={loading}
            />
            <input
              type="text"
              name="notes"
              value={inwardMaster.notes}
              onChange={handleInwardMasterChange}
              placeholder="Notes"
              className={inputClasses}
              disabled={loading}
            />
            <select
              name="type"
              value={inwardMaster.type}
              onChange={handleInwardMasterChange}
              className={inputClasses}
              disabled={loading}
            >
              <option value="" disabled hidden>Type</option>
              <option value="Return">Return</option>
              <option value="Purchase">Purchase</option>
              <option value="Owner">Owner</option>
            </select>
            <select
              name="is_local"
              value={inwardMaster.is_local}
              onChange={handleInwardMasterChange}
              className={inputClasses}
              disabled={loading}
            >
              <option value="" disabled hidden>Is Local</option>
              <option value="Local">Local</option>
              <option value="Int. State">Int. State</option>
              <option value="Imported">Imported</option>
            </select>
          </div>
        </div>

        <div className={`${cardClasses} sb-card flex flex-col lg:flex-1 lg:min-h-0`}>
          <div className="flex items-center justify-between px-0.5 sb-text-sm text-gray-600">
            <span className="font-medium text-gray-700">Line items</span>
            <span className="font-semibold text-gray-800">Total: {tf(totalValue)}</span>
          </div>

          <div className="relative rounded-md border border-gray-100 overflow-hidden flex-1 min-h-0">
            <div className="overflow-auto max-h-[60vh] min-h-[120px] lg:max-h-none lg:h-full lg:min-h-0">
              <table className="w-full min-w-[980px] sb-text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white uppercase tracking-wide">
                    <th className="px-2 sb-th-py text-left font-semibold w-[240px]">Product</th>
                    <th className="px-2 sb-th-py text-left font-semibold w-[100px]">I S B N</th>
                    <th className="px-2 sb-th-py text-right font-semibold w-[60px]">Qty</th>
                    <th className="px-2 sb-th-py text-right font-semibold w-[80px]">F Val</th>
                    <th className="px-2 sb-th-py text-left font-semibold w-[80px]">Curr</th>
                    <th className="px-2 sb-th-py text-right font-semibold w-[70px]">ExRt</th>
                    <th className="px-2 sb-th-py text-right font-semibold w-[60px]">Dis%</th>
                    <th className="px-2 sb-th-py text-right font-semibold w-[70px]">-/+Adj</th>
                    <th className="px-2 sb-th-py text-right font-semibold w-[90px]">Value</th>
                    <th className="px-2 sb-th-py text-center font-semibold w-[40px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="px-4 py-4 text-center text-gray-400 sb-text-sm">
                        No items added yet. Use the form below to add lines.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                      <tr key={index} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-2 sb-td-py">
                          <input
                            type="text"
                            value={item.itemName}
                            onChange={(e) => handleItemChange(index, 'itemName', e.target.value)}
                            className={`${tableInputClasses} ${item.isMalayalam ? 'font-malayalam' : ''}`}
                            style={item.isMalayalam ? { fontFamily: 'Noto Sans Malayalam, sans-serif' } : {}}
                            disabled={loading}
                          />
                        </td>
                        <td className="px-2 sb-td-py">
                          <input
                            type="text"
                            value={item.isbn}
                            onChange={(e) => handleItemChange(index, 'isbn', e.target.value)}
                            className={tableInputClasses}
                            disabled={loading}
                          />
                        </td>
                        <td className="px-2 sb-td-py">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className={`${tableInputClasses} text-right`}
                            disabled={loading}
                          />
                        </td>
                        <td className="px-2 sb-td-py">
                          <input
                            type="number"
                            value={item.purchaseRate}
                            onChange={(e) => handleItemChange(index, 'purchaseRate', e.target.value)}
                            className={`${tableInputClasses} text-right`}
                            step="0.01"
                            disabled={loading}
                          />
                        </td>
                        <td className="px-2 sb-td-py">
                          <select
                            value={item.currency}
                            onChange={(e) => handleItemChange(index, 'currency', e.target.value)}
                            className={tableInputClasses}
                            disabled={loading}
                          >
                            <option value="" disabled>Currency</option>
                            {currencies.map(cur => (
                              <option key={cur.id} value={cur.name}>{cur.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 sb-td-py">
                          <input
                            type="number"
                            value={item.exchangeRate}
                            onChange={(e) => handleItemChange(index, 'exchangeRate', e.target.value)}
                            className={`${tableInputClasses} text-right`}
                            disabled={loading}
                          />
                        </td>
                        <td className="px-2 sb-td-py">
                          <input
                            type="number"
                            value={item.discount}
                            onChange={(e) => handleItemChange(index, 'discount', e.target.value)}
                            className={`${tableInputClasses} text-right`}
                            step="0.01"
                            disabled={loading}
                          />
                        </td>
                        <td className="px-2 sb-td-py">
                          <input
                            type="number"
                            value={item.discountAmount}
                            onChange={(e) => handleItemChange(index, 'discountAmount', e.target.value)}
                            className={`${tableInputClasses} text-right`}
                            step="0.01"
                            disabled={loading}
                          />
                        </td>
                        <td className="px-2 sb-td-py text-right sb-text-sm font-semibold text-gray-700">
                          {tf(item.value)}
                        </td>
                        <td className="px-2 sb-td-py text-center">
                          <button
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete item"
                            onClick={() => setItems(items.filter((_, i) => i !== index))}
                            disabled={loading}
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

        <div className={`${cardClasses} sb-card overflow-visible`}>
          <div className="sb-add-item-grid sb-add-item-grid--gir grid w-full overflow-x-auto relative z-0">
            <div className="relative">
              <input
                type="text"
                name="itemName"
                value={formData.itemName}
                onChange={handleInputChange}
                onKeyDown={(e) => handleKeyDown(e, 'itemName')}
                placeholder="Product"
                className={`${tableInputClasses} ${isMalayalam ? 'font-malayalam' : ''}`}
                style={isMalayalam ? { fontFamily: 'Noto Sans Malayalam, sans-serif' } : {}}
                autoComplete="off"
                disabled={loading}
                ref={productInputRef}
              />
            </div>
            <input
              type="text"
              name="isbn"
              value={formData.isbn}
              onChange={handleInputChange}
              placeholder="I S B N"
              className={tableInputClasses}
              disabled={loading}
            />
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleInputChange}
              placeholder="Qty"
              className={tableInputClasses}
              disabled={loading}
            />
            <input
              type="number"
              name="purchaseRate"
              value={formData.purchaseRate}
              onChange={handleInputChange}
              placeholder="F Val"
              className={tableInputClasses}
              step="0.01"
              disabled={loading}
            />
            <select
              name="currency"
              value={formData.currency}
              onChange={handleInputChange}
              className={tableInputClasses}
              disabled={loading}
            >
              <option value="" disabled>Currency</option>
              {currencies.map(cur => (
                <option key={cur.id} value={cur.name}>{cur.name}</option>
              ))}
            </select>
            <input
              type="number"
              name="exchangeRate"
              value={formData.exchangeRate}
              onChange={handleInputChange}
              placeholder="ExRt"
              className={tableInputClasses}
              disabled={loading}
            />
            <input
              type="number"
              name="discount"
              value={formData.discount}
              onChange={handleInputChange}
              placeholder="Dis%"
              className={tableInputClasses}
              step="0.01"
              disabled={loading}
            />
            <input
              type="number"
              name="discountAmount"
              value={formData.discountAmount}
              onChange={handleInputChange}
              placeholder="-/+Adj"
              className={tableInputClasses}
              step="0.01"
              disabled={loading}
            />
            <button
              onClick={handleAddItem}
              className={`${actionButtonClasses} w-full justify-center`}
              disabled={loading}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>
        </div>

        {suggestionPosition && showSuggestions && suggestions.length > 0 && formData.itemName.trim() && (
          <ul
            className="fixed z-[1200] bg-white border border-gray-200 shadow-xl rounded-lg text-xs max-h-60 overflow-y-auto font-malayalam"
            style={{
              top: suggestionPosition.top,
              left: suggestionPosition.left,
              width: suggestionPosition.width,
              transform: 'translateY(-100%)',
              fontFamily: isDotPrefixed ? 'Noto Sans Malayalam, sans-serif' : 'inherit',
            }}
          >
            {suggestions.map((product, index) => (
              <li
                key={product.id}
                id={`suggestion-${index}`}
                className={`px-3 py-2 cursor-pointer ${highlightedIndex === index ? 'bg-blue-50' : 'hover:bg-gray-100'}`}
                onClick={() => handleItemSuggestionClick(product)}
              >
                {isDotPrefixed ? product.title_m : product.title}
              </li>
            ))}
          </ul>
        )}

        <div className={`${cardClasses} sb-card`}>
          <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
            <div className="flex flex-1 flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={goodsInwardIdToLoad}
                onChange={(e) => setGoodsInwardIdToLoad(e.target.value)}
                placeholder="Enter Goods Inward ID"
                className={`${inputClasses} w-full sm:w-60`}
                disabled={loading}
              />
              <button
                onClick={handleLoadGoodsInward}
                className={`${actionButtonClasses} from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700`}
                disabled={loading}
              >
                Load Inward Return
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSubmitGoodsInward}
                className={`${actionButtonClasses} min-w-[150px]`}
                disabled={loading}
              >
                {isEditMode ? 'Update Inward Return' : 'Submit Inward Return'}
              </button>
              <button
                onClick={resetForm}
                className={`${actionButtonClasses} from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700`}
                disabled={loading}
              >
                Reset Form
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
