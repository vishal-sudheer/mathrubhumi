import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/axiosInstance';
import Modal from '../../components/Modal';
import { TrashIcon, XMarkIcon } from '@heroicons/react/24/solid';

export default function SaleBillPage() {
  const [items, setItems] = useState([]);
  const [saleIdToLoad, setSaleIdToLoad] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [saleId, setSaleId] = useState(null);

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isDotPrefixed, setIsDotPrefixed] = useState(false);
  const [isMalayalam, setIsMalayalam] = useState(false);
  const [suggestionPosition, setSuggestionPosition] = useState(null);
  const productInputRef = useRef(null);
  const discountInputRef = useRef(null);
  const addItemButtonRef = useRef(null);

  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [customerHighlightedIndex, setCustomerHighlightedIndex] = useState(-1);

  const [agentSuggestions, setAgentSuggestions] = useState([]);
  const [showAgentSuggestions, setShowAgentSuggestions] = useState(false);
  const [agentHighlightedIndex, setAgentHighlightedIndex] = useState(-1);

  const [modal, setModal] = useState({
    isOpen: false,
    message: '',
    type: 'info',
    buttons: [],
  });

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [batchData, setBatchData] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [isItemSelected, setIsItemSelected] = useState(false);
  const [batchActionIndex, setBatchActionIndex] = useState(-1);

  const [activeDiscountField, setActiveDiscountField] = useState(null);

  const [formData, setFormData] = useState({
    itemName: '',
    quantity: '',
    rate: '',
    exchangeRate: '',
    currency: 'Indian Rupees',
    tax: '',
    discount: '',
    currencyIndex: 0,
    titleId: '',
    purchaseCompanyId: '',
    purchaseId: '',
    purchaseItemId: '',
  });

  const [saleMaster, setSaleMaster] = useState({
    customer_nm: '',
    customer_id: '',
    billing_address: '',
    sale_date: '',
    mobile_number: '',
    type: '',
    mode: '',
    class: '',
    cancel: '',
    bill_discount: '',
    bill_discount_amount: '',
    gross: '',
    round_off: '',
    bill_amount: '',
    note_1: '',
    note_2: '',
    freight_postage: '',
    processing_charge: '',
    bill_no: '',
    branch_id: '',
    agent_id: '',
    agent_nm: '',
  });

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

  const decodeUnicode = (str) => {
    if (!str) return '';
    try {
      let decoded = str.replace(/\\u([0-9A-Fa-f]{4})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16)),
      );
      decoded = decodeURIComponent(
        decoded.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) =>
          String.fromCharCode(parseInt(hex, 16)),
        ),
      );
      return decoded;
    } catch {
      return str;
    }
  };

  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const response = await api.get('/auth/currencies/');
        if (Array.isArray(response.data) && response.data.every((cur) => cur.id !== undefined && cur.name)) {
          setCurrencies(response.data);
          const defaultCurrency =
            response.data.find((cur) => cur.name === 'Indian Rupees') ||
            response.data[0] ||
            { id: 0, name: 'Indian Rupees' };
          setFormData((prev) => ({
            ...prev,
            currency: defaultCurrency.name,
            currencyIndex: defaultCurrency.id,
          }));
        } else {
          showModal('Invalid currency data received from server', 'error');
          setCurrencies([{ id: 0, name: 'Indian Rupees' }]);
          setFormData((prev) => ({
            ...prev,
            currency: 'Indian Rupees',
            currencyIndex: 0,
          }));
        }
      } catch (error) {
        console.error('Failed to fetch currencies:', error);
        showModal('Failed to load currencies. Using default currency.', 'error');
        setCurrencies([{ id: 0, name: 'Indian Rupees' }]);
        setFormData((prev) => ({
          ...prev,
          currency: 'Indian Rupees',
          currencyIndex: 0,
        }));
      }
    };
    fetchCurrencies();
  }, []);

  useEffect(() => {
    if (!showBatchModal) {
      setBatchActionIndex(-1);
      return;
    }
    setBatchActionIndex((prev) => {
      if (batchData.length === 0) return -1;
      if (prev >= 0 && prev < batchData.length) return prev;
      return 0;
    });
  }, [showBatchModal, batchData.length]);

  useEffect(() => {
    if (!showBatchModal || batchData.length === 0) return;
    const handleKeyDown = (e) => {
      if (!showBatchModal || batchData.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setBatchActionIndex((prev) => {
          if (prev < 0) return 0;
          return prev < batchData.length - 1 ? prev + 1 : 0;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setBatchActionIndex((prev) => {
          if (prev < 0) return batchData.length - 1;
          return prev > 0 ? prev - 1 : batchData.length - 1;
        });
      } else if (e.key === 'Enter') {
        if (batchActionIndex >= 0 && batchActionIndex < batchData.length) {
          e.preventDefault();
          handleBatchSelect(batchData[batchActionIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showBatchModal, batchData, batchActionIndex]);

  useEffect(() => {
    if (!showBatchModal || batchActionIndex < 0) return;
    const rowEl = document.getElementById(`batch-row-${batchActionIndex}`);
    if (rowEl) rowEl.scrollIntoView({ block: 'nearest' });
  }, [showBatchModal, batchActionIndex]);

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

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'itemName') {
      const trimmed = value.trim();
      const newIsDotPrefixed = trimmed.startsWith('.');
      setIsDotPrefixed(newIsDotPrefixed);
      setIsMalayalam(newIsDotPrefixed);

      if (trimmed.length === 0 || (newIsDotPrefixed && trimmed.length === 1)) {
        setSuggestions([]);
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        setFormData((prev) => ({ ...prev, itemName: '', tax: '', titleId: '' }));
        setIsMalayalam(false);
      } else {
        try {
          const res = await api.get(`/auth/product-search/?q=${encodeURIComponent(trimmed)}`);
          if (res.data && res.data.length > 0) {
            const decodedSuggestions = res.data.map((suggestion) => ({
              ...suggestion,
              title_m: decodeUnicode(suggestion.title_m),
              raw_title_m: suggestion.raw_title_m,
            }));
            setSuggestions(decodedSuggestions);
            setShowSuggestions(true);
            setHighlightedIndex(-1);
          } else {
            setSuggestions([]);
            setShowSuggestions(false);
            setHighlightedIndex(-1);
          }
        } catch (error) {
          console.error('Autocomplete error:', error);
          setSuggestions([]);
          setShowSuggestions(false);
          setHighlightedIndex(-1);
        }
      }
    } else if (name === 'currency') {
      const selectedCurrency = currencies.find((cur) => cur.name === value);
      setFormData((prev) => ({
        ...prev,
        currency: value,
        currencyIndex: selectedCurrency
          ? selectedCurrency.id
          : currencies.find((cur) => cur.name === 'Indian Rupees')?.id || 0,
      }));
    }
  };

  const handleSaleMasterChange = async (e) => {
    const { name, value } = e.target;

    if (name === 'bill_discount' && value && !activeDiscountField) {
      setActiveDiscountField('bill_discount');
    } else if (name === 'bill_discount_amount' && value && !activeDiscountField) {
      setActiveDiscountField('bill_discount_amount');
    } else if (value === '' && (name === 'bill_discount' || name === 'bill_discount_amount')) {
      setActiveDiscountField(null);
    }

    setSaleMaster((prev) => {
      const updated = { ...prev, [name]: value };

      if (name === 'type') {
        if (value === 'Stock Transfer') {
          updated.cancel = 'No';
          updated.customer_nm = '';
          updated.customer_id = '';
          updated.branch_id = '';
          updated.agent_id = '';
          updated.agent_nm = '';
        } else {
          updated.branch_id = '';
        }

        if (value === 'Cash Sale' || value === 'Cash Memo') {
          updated.mode = 'Cash';
        } else {
          updated.mode = 'N.A.';
        }
      }

      if (name === 'cancel' && prev.type === 'Stock Transfer') {
        updated.cancel = 'No';
      }

      return updated;
    });

    // Customer / Branch suggestions
    if (name === 'customer_nm') {
      const trimmed = value.trim();
      if (!trimmed) {
        setCustomerSuggestions([]);
        setShowCustomerSuggestions(false);
        setCustomerHighlightedIndex(-1);
        return;
      }

      try {
        if (saleMaster.type === 'Credit Sale') {
          const res = await api.get(
            `/auth/customer-search/?q=${encodeURIComponent(trimmed)}`,
          );
          if (res.data && res.data.length > 0) {
            setCustomerSuggestions(res.data);
            setShowCustomerSuggestions(true);
            setCustomerHighlightedIndex(-1);
          } else {
            setCustomerSuggestions([]);
            setShowCustomerSuggestions(false);
            setCustomerHighlightedIndex(-1);
          }
        } else if (saleMaster.type === 'Stock Transfer') {
          const res = await api.get(
            `/auth/branches-name-search/?q=${encodeURIComponent(trimmed)}`,
          );
          if (res.data && res.data.length > 0) {
            setCustomerSuggestions(res.data);
            setShowCustomerSuggestions(true);
            setCustomerHighlightedIndex(-1);
          } else {
            setCustomerSuggestions([]);
            setShowCustomerSuggestions(false);
            setCustomerHighlightedIndex(-1);
          }
        } else {
          setCustomerSuggestions([]);
          setShowCustomerSuggestions(false);
          setCustomerHighlightedIndex(-1);
        }
      } catch (error) {
        console.error('Customer/Branch autocomplete error:', error);
        setCustomerSuggestions([]);
        setShowCustomerSuggestions(false);
        setCustomerHighlightedIndex(-1);
      }
    }

    // Agent suggestions (only for allowed types)
    if (name === 'agent_nm') {
      const allowedTypes = ['Cash Memo', 'Credit Sale', 'Cash Sale'];
      const trimmed = value.trim();
      if (!allowedTypes.includes(saleMaster.type) || trimmed.length < 2) {
        setAgentSuggestions([]);
        setShowAgentSuggestions(false);
        setAgentHighlightedIndex(-1);
        return;
      }
      try {
        const res = await api.get(
          `/auth/agents-name-search/?q=${encodeURIComponent(trimmed)}`,
        );
        if (res.data && res.data.length > 0) {
          setAgentSuggestions(res.data);
          setShowAgentSuggestions(true);
          setAgentHighlightedIndex(-1);
        } else {
          setAgentSuggestions([]);
          setShowAgentSuggestions(false);
          setAgentHighlightedIndex(-1);
        }
      } catch (error) {
        console.error('Agent autocomplete error:', error);
        setAgentSuggestions([]);
        setShowAgentSuggestions(false);
        setAgentHighlightedIndex(-1);
      }
    }
  };

  const handleItemSuggestionClick = async (suggestion) => {
    const selectedTitle = isDotPrefixed
      ? suggestion.title_m
      : suggestion.language === 1
        ? suggestion.title_m
        : suggestion.title;
    const isMalayalamTitle = isDotPrefixed || suggestion.language === 1;

    setFormData((prev) => ({
      ...prev,
      itemName: selectedTitle,
      rate: suggestion.rate !== null && suggestion.rate !== undefined ? suggestion.rate.toString() : '',
      tax: suggestion.tax !== null && suggestion.tax !== undefined ? suggestion.tax.toString() : '0',
      titleId: suggestion.id,
    }));
    setIsMalayalam(isMalayalamTitle);
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    setIsDotPrefixed(false);
    setIsItemSelected(true);

    setSelectedProduct(suggestion);
    try {
      const res = await api.get(`/auth/batch-select/?titleId=${encodeURIComponent(suggestion.id)}`);
      setBatchData(res.data);
      setShowBatchModal(true);
    } catch (error) {
      console.error('Failed to fetch batch data:', error);
    }
  };

  const handleBatchSelect = (batch) => {
    const selectedCurrency = currencies.find((cur) => cur.name === batch.currency);
    setFormData((prev) => ({
      ...prev,
      exchangeRate: batch.exchangeRate,
      rate: batch.rate,
      discount: '0.00',
      tax: batch.tax !== null && batch.tax !== undefined ? batch.tax.toString() : '0',
      quantity: '1',
      currency: batch.currency,
      currencyIndex: selectedCurrency ? selectedCurrency.id : currencies[0]?.id || 0,
      purchaseCompanyId: batch.purchaseCompanyId,
      purchaseId: batch.purchaseId,
      purchaseItemId: batch.purchaseItemId,
    }));
    setShowBatchModal(false);
    setIsItemSelected(true);
    setTimeout(() => {
      if (discountInputRef.current && !discountInputRef.current.disabled) {
        discountInputRef.current.focus();
        discountInputRef.current.select?.();
      } else {
        addItemButtonRef.current?.focus();
      }
    }, 0);
  };

  const handleDiscountKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItemButtonRef.current?.focus();
    }
  };

  const handleAddItemKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleAddItem();
    }
  };

  const handleCustomerSuggestionClick = (suggestion) => {
    if (saleMaster.type === 'Credit Sale') {
      const addressParts = [suggestion.address_1, suggestion.address_2, suggestion.city]
        .map((part) => (part ? String(part).trim() : ''))
        .filter(Boolean);
      setSaleMaster((prev) => ({
        ...prev,
        customer_nm: suggestion.customer_nm,
        customer_id: suggestion.id,
        billing_address: addressParts.join(', '),
        mobile_number: suggestion.telephone ? String(suggestion.telephone) : '',
      }));
    } else if (saleMaster.type === 'Stock Transfer') {
      setSaleMaster((prev) => ({
        ...prev,
        customer_nm: suggestion.branches_nm,
        branch_id: suggestion.id,
        customer_id: 0,
      }));
    }
    setCustomerSuggestions([]);
    setShowCustomerSuggestions(false);
    setCustomerHighlightedIndex(-1);
  };

  const handleAgentSuggestionClick = (agent) => {
    setSaleMaster((prev) => ({
      ...prev,
      agent_nm: agent.agent_nm,
      agent_id: agent.id,
    }));
    setAgentSuggestions([]);
    setShowAgentSuggestions(false);
    setAgentHighlightedIndex(-1);
  };

  const handleKeyDown = (e, inputType) => {
    if (inputType === 'itemName' && showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const newIndex = prev < suggestions.length - 1 ? prev + 1 : 0;
          const el = document.getElementById(`suggestion-${newIndex}`);
          if (el) el.scrollIntoView({ block: 'nearest' });
          return newIndex;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const newIndex = prev > 0 ? prev - 1 : suggestions.length - 1;
          const el = document.getElementById(`suggestion-${newIndex}`);
          if (el) el.scrollIntoView({ block: 'nearest' });
          return newIndex;
        });
      } else if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault();
        handleItemSuggestionClick(suggestions[highlightedIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        setSuggestions([]);
        setHighlightedIndex(-1);
      }
    } else if (
      inputType === 'customer_nm' &&
      showCustomerSuggestions &&
      customerSuggestions.length > 0
    ) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCustomerHighlightedIndex((prev) => {
          const newIndex = prev < customerSuggestions.length - 1 ? prev + 1 : 0;
          const el = document.getElementById(`customer-suggestion-${newIndex}`);
          if (el) el.scrollIntoView({ block: 'nearest' });
          return newIndex;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCustomerHighlightedIndex((prev) => {
          const newIndex =
            prev > 0 ? prev - 1 : customerSuggestions.length - 1;
          const el = document.getElementById(`customer-suggestion-${newIndex}`);
          if (el) el.scrollIntoView({ block: 'nearest' });
          return newIndex;
        });
      } else if (e.key === 'Enter' && customerHighlightedIndex >= 0) {
        e.preventDefault();
        handleCustomerSuggestionClick(
          customerSuggestions[customerHighlightedIndex],
        );
      } else if (e.key === 'Escape') {
        setShowCustomerSuggestions(false);
        setCustomerSuggestions([]);
        setCustomerHighlightedIndex(-1);
      }
    } else if (
      inputType === 'agent_nm' &&
      showAgentSuggestions &&
      agentSuggestions.length > 0
    ) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAgentHighlightedIndex((prev) => {
          const newIndex = prev < agentSuggestions.length - 1 ? prev + 1 : 0;
          const el = document.getElementById(`agent-suggestion-${newIndex}`);
          if (el) el.scrollIntoView({ block: 'nearest' });
          return newIndex;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAgentHighlightedIndex((prev) => {
          const newIndex = prev > 0 ? prev - 1 : agentSuggestions.length - 1;
          const el = document.getElementById(`agent-suggestion-${newIndex}`);
          if (el) el.scrollIntoView({ block: 'nearest' });
          return newIndex;
        });
      } else if (e.key === 'Enter' && agentHighlightedIndex >= 0) {
        e.preventDefault();
        handleAgentSuggestionClick(agentSuggestions[agentHighlightedIndex]);
      } else if (e.key === 'Escape') {
        setShowAgentSuggestions(false);
        setAgentSuggestions([]);
        setAgentHighlightedIndex(-1);
      }
    }
  };

  const handleAddItem = () => {
    const {
      itemName,
      quantity,
      rate,
      exchangeRate,
      currency,
      tax,
      discount,
      titleId,
      purchaseCompanyId,
      purchaseId,
      purchaseItemId,
    } = formData;

    if (!itemName || !quantity || !rate || !currency || !titleId) {
      showModal('Please fill required item details', 'error');
      return;
    }

    try {
      const qty = parseFloat(quantity);
      const rt = parseFloat(rate);
      const exRt = parseFloat(exchangeRate || '1');
      const disc = parseFloat(discount || '0');
      const tx = parseFloat(tax || '0');

      if (isNaN(qty) || isNaN(rt)) {
        showModal('Quantity and Rate must be valid numbers', 'error');
        return;
      }

      const selectedCurrency = currencies.find((cur) => cur.name === currency);
      const currencyIndex = selectedCurrency ? selectedCurrency.id : currencies[0]?.id || 0;

      const baseRate = rt / (1 + tx / 100);
      const value = qty * baseRate * exRt * (1 - disc / 100) * (1 + tx / 100);

      const newItem = {
        itemName,
        quantity: qty,
        rate: rt,
        exchangeRate: exRt,
        currency,
        tax: tx,
        discount: disc,
        value,
        isMalayalam,
        currencyIndex,
        titleId: parseInt(titleId),
        purchaseCompanyId: parseInt(purchaseCompanyId || '0'),
        purchaseId: parseInt(purchaseId || '0'),
        purchaseItemId: parseInt(purchaseItemId || '0'),
      };

      setItems((prev) => [...prev, newItem]);

      if (disc > 0 && !activeDiscountField) {
        setActiveDiscountField('item_discount');
      }

      const defaultCur = currencies.find((cur) => cur.name === 'Indian Rupees');
      setFormData({
        itemName: '',
        quantity: '',
        rate: '',
        exchangeRate: '',
        currency: defaultCur?.name || 'Indian Rupees',
        tax: '',
        discount: '',
        currencyIndex: defaultCur?.id || 0,
        titleId: '',
        purchaseCompanyId: '',
        purchaseId: '',
        purchaseItemId: '',
      });
      setIsMalayalam(false);
      setIsItemSelected(false);
    } catch (error) {
      console.error(error);
      showModal('Invalid item data', 'error');
    }
  };

  const handleDeleteItem = (indexToRemove) => {
    const updatedItems = items.filter((_, index) => index !== indexToRemove);
    setItems(updatedItems);
    if (
      activeDiscountField === 'item_discount' &&
      !updatedItems.some((item) => parseFloat(String(item.discount || 0)) > 0)
    ) {
      setActiveDiscountField(null);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index][field] = value;

    const quantity = parseFloat(String(updatedItems[index].quantity)) || 0;
    const rate = parseFloat(String(updatedItems[index].rate)) || 0;
    const exchangeRate = parseFloat(String(updatedItems[index].exchangeRate)) || 1;
    const tax = parseFloat(String(updatedItems[index].tax || 0));
    const discount = parseFloat(String(updatedItems[index].discount || 0));

    const baseRate = rate / (1 + tax / 100);
    updatedItems[index].value =
      quantity * baseRate * exchangeRate * (1 - discount / 100) * (1 + tax / 100);

    if (field === 'itemName') {
      updatedItems[index].isMalayalam = !!String(value).match(/[\u0D00-\u0D7F]/);
    }

    if (field === 'currency') {
      const selectedCurrency = currencies.find((cur) => cur.name === value);
      updatedItems[index].currencyIndex = selectedCurrency
        ? selectedCurrency.id
        : currencies[0]?.id || 0;
    }

    setItems(updatedItems);

    if (field === 'discount') {
      if (value && !activeDiscountField) {
        setActiveDiscountField('item_discount');
      } else if (!value && activeDiscountField === 'item_discount') {
        const hasOther = updatedItems.some(
          (it) => parseFloat(String(it.discount || 0)) > 0,
        );
        if (!hasOther) setActiveDiscountField(null);
      }
    }
  };

  const gross = items.reduce(
    (sum, item) => sum + (parseFloat(String(item.value)) || 0),
    0,
  );
  const hasItemDiscount = items.some(
    (item) => parseFloat(String(item.discount || 0)) > 0,
  );
  const billDiscountPercent = parseFloat(saleMaster.bill_discount || '0') || 0;
  const billDiscountAmount =
    parseFloat(saleMaster.bill_discount_amount || '0') || 0;
  const roundOff = parseFloat(saleMaster.round_off || '0') || 0;

  const billAmount = hasItemDiscount
    ? gross + roundOff
    : gross -
    (billDiscountPercent ? (billDiscountPercent * gross) / 100 : billDiscountAmount) +
    roundOff;

  useEffect(() => {
    setSaleMaster((prev) => ({
      ...prev,
      gross: gross === 0 ? '' : gross.toFixed(2),
      bill_amount: billAmount === 0 ? '' : billAmount.toFixed(2),
    }));
  }, [gross, billDiscountPercent, billDiscountAmount, roundOff, hasItemDiscount]);

  const resetSaleForm = () => {
    const defaultCur = currencies.find((cur) => cur.name === 'Indian Rupees');
    setSaleMaster({
      customer_nm: '',
      customer_id: '',
      billing_address: '',
      sale_date: '',
      mobile_number: '',
      type: '',
      mode: '',
      class: '',
      cancel: '',
      bill_discount: '',
      bill_discount_amount: '',
      gross: '',
      round_off: '',
      bill_amount: '',
      note_1: '',
      note_2: '',
      freight_postage: '',
      processing_charge: '',
      bill_no: '',
      branch_id: '',
      agent_id: '',
      agent_nm: '',
    });
    setItems([]);
    setFormData({
      itemName: '',
      quantity: '',
      rate: '',
      exchangeRate: '',
      currency: defaultCur?.name || 'Indian Rupees',
      tax: '',
      discount: '',
      currencyIndex: defaultCur?.id || 0,
      titleId: '',
      purchaseCompanyId: '',
      purchaseId: '',
      purchaseItemId: '',
    });
    setIsEditMode(false);
    setSaleId(null);
    setSaleIdToLoad('');
    setActiveDiscountField(null);
    setIsMalayalam(false);
    setCustomerSuggestions([]);
    setShowCustomerSuggestions(false);
    setCustomerHighlightedIndex(-1);
    setAgentSuggestions([]);
    setShowAgentSuggestions(false);
    setAgentHighlightedIndex(-1);
  };

  const handleSubmitSale = async () => {
    const requiredFields = [
      'customer_nm',
      'sale_date',
      'mobile_number',
      'type',
      'mode',
      'class',
      'cancel',
    ];
    for (const field of requiredFields) {
      if (!saleMaster[field] || String(saleMaster[field]).trim() === '') {
        showModal(`Please fill the ${field.replace('_', ' ')} field`, 'error');
        return;
      }
    }
    if (items.length === 0) {
      showModal('Please add at least one item', 'error');
      return;
    }

    try {
      const payload = {
        customer_nm: saleMaster.customer_nm,
        billing_address: saleMaster.billing_address,
        sale_date: saleMaster.sale_date,
        mobile_number: saleMaster.mobile_number,
        type: saleMaster.type,
        mode: saleMaster.mode,
        class: saleMaster.class,
        cancel: saleMaster.cancel,
        bill_discount: parseFloat(saleMaster.bill_discount || '0') || 0.0,
        bill_discount_amount:
          parseFloat(saleMaster.bill_discount_amount || '0') || 0.0,
        gross: parseFloat(saleMaster.gross || '0') || 0.0,
        round_off: parseFloat(saleMaster.round_off || '0') || 0.0,
        bill_amount: parseFloat(saleMaster.bill_amount || '0') || 0.0,
        bill_no: saleMaster.bill_no,
        note_1: saleMaster.note_1 || '',
        note_2: saleMaster.note_2 || '',
        freight_postage:
          parseFloat(saleMaster.freight_postage || '0') || 0.0,
        processing_charge:
          parseFloat(saleMaster.processing_charge || '0') || 0.0,
        customer_id: parseInt(saleMaster.customer_id || '0') || 0,
        branch_id: parseInt(saleMaster.branch_id || '0') || 0,
        agent_id: parseInt(saleMaster.agent_id || '0') || 0,
        items: items.map((item) => ({
          itemName: item.itemName,
          quantity: parseFloat(String(item.quantity)),
          rate: parseFloat(String(item.rate)),
          exchangeRate: parseFloat(String(item.exchangeRate || 1)),
          currency: item.currency,
          tax: parseFloat(String(item.tax || 0)),
          discount: parseFloat(String(item.discount || 0)),
          value: parseFloat(String(item.value)),
          currencyIndex: parseInt(String(item.currencyIndex)),
          titleId: parseInt(String(item.titleId)),
          purchaseCompanyId: parseInt(String(item.purchaseCompanyId || 0)),
          purchaseId: parseInt(String(item.purchaseId || 0)),
          purchaseItemId: parseInt(String(item.purchaseItemId || 0)),
        })),
      };
      console.log('Payload:', JSON.stringify(payload, null, 2));

      if (isEditMode && saleId) {
        await api.put(`/auth/sales/${saleId}/`, payload);
        showModal('Sale updated successfully', 'success');
      } else {
        const response = await api.post('/auth/sales/', payload);
        showModal(
          `Sale submitted successfully with ID: ${response.data.sale_id}`,
          'success',
        );
      }

      resetSaleForm();
    } catch (error) {
      console.error(
        'Error details:',
        error?.response?.data,
        error?.response?.status,
        error?.message,
      );
      showModal(`Error: ${error?.response?.data?.error || error.message}`, 'error');
    }
  };

  const handleLoadSale = async () => {
    if (!saleIdToLoad) {
      showModal('Please enter a Sale ID', 'error');
      return;
    }

    try {
      const response = await api.get(`/auth/sales/${saleIdToLoad}/`);
      const data = response.data;

      setSaleMaster((prev) => ({
        ...prev,
        customer_nm: data.customer_nm,
        billing_address: data.billing_address,
        sale_date: data.sale_date,
        mobile_number: data.mobile_number,
        type: data.type,
        mode: data.mode,
        class: data.class,
        cancel: data.cancel,
        bill_discount: data.bill_discount ? String(data.bill_discount) : '',
        bill_discount_amount: data.bill_discount_amount
          ? String(data.bill_discount_amount)
          : '',
        gross: (data.gross && parseFloat(data.gross) !== 0) ? String(data.gross) : '',
        round_off: data.round_off ? String(data.round_off) : '',
        bill_amount: (data.bill_amount && parseFloat(data.bill_amount) !== 0) ? String(data.bill_amount) : '',
        bill_no: data.bill_no,
        note_1: data.note_1,
        note_2: data.note_2,
        freight_postage: data.freight_postage
          ? String(data.freight_postage)
          : '',
        processing_charge: data.processing_charge
          ? String(data.processing_charge)
          : '',
        customer_id: data.customer_id || '',
        branch_id: data.branch_id || '',
        agent_id: data.agent_id || '',
        agent_nm: data.agent_nm || '',
      }));

      setItems(
        data.items.map((item) => ({
          itemName: item.itemName,
          quantity: item.quantity,
          rate: item.rate,
          exchangeRate: item.exchangeRate,
          currency: item.currency,
          tax:
            item.tax !== null && item.tax !== undefined ? item.tax : 0,
          discount: item.discount,
          value: item.value,
          currencyIndex: item.currencyIndex,
          titleId: item.titleId,
          isMalayalam: !!String(item.itemName).match(/[\u0D00-\u0D7F]/),
          purchaseCompanyId: item.purchaseCompanyId,
          purchaseId: item.purchaseId,
          purchaseItemId: item.purchaseItemId,
        })),
      );

      if (data.items.length > 0) {
        const firstItemCurrency = data.items[0].currency;
        const selectedCurrency = currencies.find(
          (cur) => cur.name === firstItemCurrency,
        );
        setFormData((prev) => ({
          ...prev,
          currency: firstItemCurrency,
          currencyIndex: selectedCurrency
            ? selectedCurrency.id
            : currencies[0]?.id || 0,
        }));
      } else {
        const defaultCur = currencies.find((cur) => cur.name === 'Indian Rupees');
        setFormData((prev) => ({
          ...prev,
          currency: defaultCur?.name || 'Indian Rupees',
          currencyIndex: defaultCur?.id || 0,
        }));
      }

      setIsEditMode(true);
      setSaleId(parseInt(saleIdToLoad, 10));

      if (data.items.some((item) => parseFloat(String(item.discount || 0)) > 0)) {
        setActiveDiscountField('item_discount');
      } else if (parseFloat(String(data.bill_discount || 0)) > 0) {
        setActiveDiscountField('bill_discount');
      } else if (parseFloat(String(data.bill_discount_amount || 0)) > 0) {
        setActiveDiscountField('bill_discount_amount');
      }

      showModal('Sale loaded successfully', 'success');
    } catch (error) {
      console.error(
        'Error details:',
        error?.response?.data,
        error?.response?.status,
        error?.message,
      );
      showModal(`Error: ${error?.response?.data?.error || error.message}`, 'error');
    }
  };

  const totalValue = items.reduce(
    (sum, item) => sum + (parseFloat(String(item.value)) || 0),
    0,
  );

  const cancelOptions =
    saleMaster.type === 'Stock Transfer' ? ['No'] : ['Yes', 'No'];

  const isAgentTypeAllowed = ['Cash Memo', 'Credit Sale', 'Cash Sale'].includes(
    saleMaster.type,
  );

  const cardClasses = "bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-lg shadow-sm";
  const inputClasses = "sb-input px-2 rounded-md border border-gray-200 bg-white text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 transition-all duration-200";
  const actionButtonClasses = "sb-input inline-flex items-center justify-center gap-2 px-3 rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-medium shadow-lg shadow-blue-500/20 hover:from-blue-600 hover:to-indigo-700 active:scale-[0.985] transition-all duration-200";
  const tableInputClasses = "sb-table-input w-full px-2 rounded-md border border-gray-200 bg-gray-50 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white transition-all duration-200";

  return (
    <div className="sb-page min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 lg:h-[100svh] lg:overflow-hidden lg:flex lg:flex-col">
      <Modal
        isOpen={modal.isOpen}
        message={modal.message}
        type={modal.type}
        buttons={modal.buttons}
      />

      <div className="sb-layout flex flex-col lg:flex-1 lg:min-h-0">
        <div className={`${cardClasses} sb-card`}>
          <div className="sb-form-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <input
              type="text"
              name="bill_no"
              value={saleMaster.bill_no}
              placeholder="Bill No"
              className={`${inputClasses} bg-gray-50 font-semibold`}
              readOnly
            />
            <input
              type={saleMaster.sale_date ? 'date' : 'text'}
              onFocus={(e) => (e.target.type = 'date')}
              onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
              name="sale_date"
              value={saleMaster.sale_date}
              placeholder="Sale Date"
              className={`${inputClasses} bg-gray-50 font-semibold`}
              readOnly
            />

            <div className="relative">
              <input
                type="text"
                name="customer_nm"
                value={saleMaster.customer_nm}
                onChange={handleSaleMasterChange}
                onKeyDown={(e) => handleKeyDown(e, 'customer_nm')}
                placeholder={saleMaster.type === 'Stock Transfer' ? 'Branch (Customer)' : 'Customer Name'}
                className={`${inputClasses} w-full`}
                autoComplete="off"
              />
              {showCustomerSuggestions && customerSuggestions.length > 0 && saleMaster.customer_nm.trim() && (
                <ul className="absolute z-10 bg-white border border-gray-200 mt-1 w-full shadow-md rounded-lg text-sm max-h-48 overflow-y-auto">
                  {customerSuggestions.map((item, index) => (
                    <li
                      key={item.id}
                      id={`customer-suggestion-${index}`}
                      className={`px-3 py-2 cursor-pointer ${customerHighlightedIndex === index ? 'bg-blue-50' : 'hover:bg-gray-100'}`}
                      onClick={() => handleCustomerSuggestionClick(item)}
                    >
                      {saleMaster.type === 'Stock Transfer' ? item.branches_nm : item.customer_nm}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <input
              type="text"
              name="billing_address"
              value={saleMaster.billing_address}
              onChange={handleSaleMasterChange}
              placeholder="Billing Address"
              className={inputClasses}
            />
            <input
              type="text"
              name="mobile_number"
              value={saleMaster.mobile_number}
              onChange={handleSaleMasterChange}
              placeholder="Mobile Number"
              className={inputClasses}
            />

            <div className="relative">
              <input
                type="text"
                name="agent_nm"
                value={saleMaster.agent_nm}
                onChange={handleSaleMasterChange}
                onKeyDown={(e) => handleKeyDown(e, 'agent_nm')}
                placeholder="Agents"
                className={`${inputClasses} w-full`}
                autoComplete="off"
                disabled={!isAgentTypeAllowed}
              />
              {showAgentSuggestions && agentSuggestions.length > 0 && saleMaster.agent_nm.trim() && isAgentTypeAllowed && (
                <ul className="absolute z-10 bg-white border border-gray-200 mt-1 w-full shadow-md rounded-lg text-sm max-h-48 overflow-y-auto">
                  {agentSuggestions.map((agent, index) => (
                    <li
                      key={agent.id}
                      id={`agent-suggestion-${index}`}
                      className={`px-3 py-2 cursor-pointer ${agentHighlightedIndex === index ? 'bg-blue-50' : 'hover:bg-gray-100'}`}
                      onClick={() => handleAgentSuggestionClick(agent)}
                    >
                      {agent.agent_nm}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <select
              name="type"
              value={saleMaster.type}
              onChange={handleSaleMasterChange}
              className={inputClasses}
            >
              <option value="" disabled hidden>Type</option>
              {['Credit Sale', 'Cash Sale', 'P P Sale', 'Stock Transfer', 'Approval', 'Gift Voucher', 'Gift Bill', 'Cash Memo'].map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <select
              name="mode"
              value={saleMaster.mode}
              onChange={handleSaleMasterChange}
              className={inputClasses}
            >
              <option value="" disabled hidden>Mode</option>
              {['Cash', 'Card', 'UPI', 'N.A.'].map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <select
              name="class"
              value={saleMaster.class}
              onChange={handleSaleMasterChange}
              className={inputClasses}
            >
              <option value="" disabled hidden>Class</option>
              {[
                'Individual',
                'Educational Instt - School',
                'Educational Instt - College',
                'Local Library',
                'Local Bodies',
                'Commission Agents',
                'Agents',
                'Other Book Shops',
                'Corporate Firms',
                'Not Applicable',
                'Staff',
                'Freelancers',
                'Authors',
                'Section',
              ].map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <select
              name="cancel"
              value={saleMaster.cancel}
              onChange={handleSaleMasterChange}
              className={inputClasses}
              disabled={saleMaster.type === 'Stock Transfer'}
            >
              <option value="" disabled hidden>Cancel</option>
              {cancelOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <input
              type="number"
              name="bill_discount"
              value={saleMaster.bill_discount}
              onChange={handleSaleMasterChange}
              placeholder="Bill Ds%"
              className={`${inputClasses} text-right`}
              disabled={!!activeDiscountField && activeDiscountField !== 'bill_discount'}
              step="1"
            />
            <input
              type="number"
              name="bill_discount_amount"
              value={saleMaster.bill_discount_amount}
              onChange={handleSaleMasterChange}
              placeholder="Bill Discount Amount"
              className={`${inputClasses} text-right`}
              disabled={!!activeDiscountField && activeDiscountField !== 'bill_discount_amount'}
              step="1"
            />
            <input
              type="number"
              name="gross"
              value={saleMaster.gross}
              placeholder="Gross"
              className={`${inputClasses} bg-gray-50 text-right font-semibold`}
              readOnly
            />
            <input
              type="number"
              name="round_off"
              value={saleMaster.round_off}
              onChange={handleSaleMasterChange}
              placeholder="Round Off"
              className={`${inputClasses} text-right`}
              step="1"
            />
            <input
              type="number"
              name="bill_amount"
              value={saleMaster.bill_amount}
              placeholder="Bill Amount"
              className={`${inputClasses} bg-gray-50 text-right font-semibold`}
              readOnly
            />
            <input
              type="text"
              name="note_1"
              value={saleMaster.note_1}
              onChange={handleSaleMasterChange}
              placeholder="Note 1"
              className={inputClasses}
            />
            <input
              type="text"
              name="note_2"
              value={saleMaster.note_2}
              onChange={handleSaleMasterChange}
              placeholder="Note 2"
              className={inputClasses}
            />
            <input
              type="number"
              name="freight_postage"
              value={saleMaster.freight_postage}
              onChange={handleSaleMasterChange}
              placeholder="Freight/Postage"
              className={`${inputClasses} text-right`}
              step="1"
            />
            <input
              type="number"
              name="processing_charge"
              value={saleMaster.processing_charge}
              onChange={handleSaleMasterChange}
              placeholder="Processing Charge"
              className={`${inputClasses} text-right`}
              step="1"
            />
          </div>
        </div>

        <div className={`${cardClasses} sb-card flex flex-col lg:flex-1 lg:min-h-0`}>
          <div className="flex items-center justify-end px-0.5 sb-text-sm text-gray-600">
            <span className="font-semibold text-gray-800">Total: {totalValue.toFixed(2)}</span>
          </div>

          <div className="relative rounded-md border border-gray-100 overflow-hidden flex-1 min-h-0">
            <div className="overflow-auto max-h-[60vh] min-h-[120px] lg:max-h-none lg:h-full lg:min-h-0">
              <table className="w-full min-w-[820px] sb-text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white uppercase tracking-wide">
                    <th className="px-2 sb-th-py text-left font-semibold w-[240px]">Item Name</th>
                    <th className="px-2 sb-th-py text-right font-semibold w-[60px]">Qty</th>
                    <th className="px-2 sb-th-py text-right font-semibold w-[80px]">Rate</th>
                    <th className="px-2 sb-th-py text-right font-semibold w-[70px]">Ex Rt</th>
                    <th className="px-2 sb-th-py text-left font-semibold w-[80px]">Currency</th>
                    <th className="px-2 sb-th-py text-right font-semibold w-[60px]">Tax %</th>
                    <th className="px-2 sb-th-py text-right font-semibold w-[60px]">Disc %</th>
                    <th className="px-2 sb-th-py text-right font-semibold w-[90px]">Value</th>
                    <th className="px-2 sb-th-py text-center font-semibold w-[40px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-4 py-4 text-center text-gray-400 sb-text-sm">
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
                          />
                        </td>
                        <td className="px-2 sb-td-py">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className={`${tableInputClasses} text-right`}
                          />
                        </td>
                        <td className="px-2 sb-td-py">
                          <input
                            type="number"
                            value={item.rate}
                            onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                            className={`${tableInputClasses} text-right`}
                          />
                        </td>
                        <td className="px-2 sb-td-py">
                          <input
                            type="number"
                            value={item.exchangeRate}
                            onChange={(e) => handleItemChange(index, 'exchangeRate', e.target.value)}
                            className={`${tableInputClasses} text-right`}
                          />
                        </td>
                        <td className="px-2 sb-td-py">
                          <select
                            value={item.currency}
                            onChange={(e) => handleItemChange(index, 'currency', e.target.value)}
                            className={tableInputClasses}
                          >
                            <option value="" disabled>Currency</option>
                            {currencies.map((cur) => (
                              <option key={cur.id} value={cur.name}>{cur.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 sb-td-py">
                          <input
                            type="number"
                            value={item.tax}
                            onChange={(e) => handleItemChange(index, 'tax', e.target.value)}
                            className={`${tableInputClasses} text-right`}
                            disabled={isEditMode}
                            step="0.01"
                          />
                        </td>
                        <td className="px-2 sb-td-py">
                          <input
                            type="number"
                            value={item.discount || 0}
                            onChange={(e) => handleItemChange(index, 'discount', e.target.value)}
                            className={`${tableInputClasses} text-right`}
                            disabled={!!activeDiscountField && activeDiscountField !== 'item_discount'}
                            step="0.01"
                          />
                        </td>
                        <td className="px-2 sb-td-py text-right sb-text-sm font-semibold text-gray-700">
                          {Number(item.value).toFixed(2)}
                        </td>
                        <td className="px-2 sb-td-py text-center">
                          <button
                            onClick={() => handleDeleteItem(index)}
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

        <div className={`${cardClasses} sb-card overflow-visible`}>
          <div className="sb-add-item-grid grid w-full overflow-x-auto relative z-0">
            <div className="relative">
              <input
                type="text"
                name="itemName"
                value={formData.itemName}
                onChange={handleInputChange}
                onKeyDown={(e) => handleKeyDown(e, 'itemName')}
                placeholder="Item Name"
                className={`${tableInputClasses} ${isMalayalam ? 'font-malayalam' : ''}`}
                style={isMalayalam ? { fontFamily: 'Noto Sans Malayalam, sans-serif' } : {}}
                autoComplete="off"
                ref={productInputRef}
              />
            </div>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleInputChange}
              placeholder="Qty"
              className={tableInputClasses}
            />
            <input
              type="number"
              name="rate"
              value={formData.rate}
              onChange={handleInputChange}
              placeholder="Rate"
              className={tableInputClasses}
            />
            <input
              type="number"
              name="exchangeRate"
              value={formData.exchangeRate}
              onChange={handleInputChange}
              placeholder="Exchange Rate"
              className={tableInputClasses}
            />
            <select
              name="currency"
              value={formData.currency}
              onChange={handleInputChange}
              className={tableInputClasses}
            >
              <option value="" disabled>Currency</option>
              {currencies.map((cur) => (
                <option key={cur.id} value={cur.name}>{cur.name}</option>
              ))}
            </select>
            <input
              type="number"
              name="tax"
              value={formData.tax}
              onChange={handleInputChange}
              placeholder="Tax %"
              className={tableInputClasses}
              disabled={isEditMode || isItemSelected}
              step="0.01"
            />
            <input
              type="number"
              name="discount"
              value={formData.discount}
              onChange={handleInputChange}
              onKeyDown={handleDiscountKeyDown}
              placeholder="Disc %"
              className={tableInputClasses}
              disabled={!!activeDiscountField && activeDiscountField !== 'item_discount'}
              step="0.01"
              ref={discountInputRef}
            />
            <button
              onClick={handleAddItem}
              onKeyDown={handleAddItemKeyDown}
              className={`${actionButtonClasses} w-full justify-center`}
              ref={addItemButtonRef}
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

        {/* Batch modal */}
        {showBatchModal && selectedProduct && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowBatchModal(false)}
            />
            <div
              className="relative bg-gradient-to-br from-slate-50 via-blue-50/50 to-slate-100 rounded-xl shadow-2xl w-[min(95vw,1100px)] max-h-[85vh] overflow-hidden mx-3 border border-gray-200 ring-1 ring-black/5 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/20">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 leading-tight">Batch Details</h2>
                    <p className="text-xs text-gray-500 font-medium">
                      For: <span className="text-blue-700">{formData.itemName || selectedProduct.title}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBatchModal(false)}
                  className="rounded-full p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-50/50">
                <div className={`${cardClasses} p-3`}>
                  <div className="overflow-auto rounded-lg border border-gray-200 bg-white">
                    <table className="min-w-full text-xs text-left">
                      <thead className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white uppercase text-[10px] sticky top-0">
                        <tr>
                          <th className="px-3 py-2 border border-blue-400/20 w-40">Supplier</th>
                          <th className="px-3 py-2 border border-blue-400/20 w-32">Inward Date</th>
                          <th className="px-3 py-2 border border-blue-400/20 w-24">Rate</th>
                          <th className="px-3 py-2 border border-blue-400/20 w-32">Exchange Rate</th>
                          <th className="px-3 py-2 border border-blue-400/20 w-24">Currency</th>
                          <th className="px-3 py-2 border border-blue-400/20 w-24">Tax %</th>
                          <th className="px-3 py-2 border border-blue-400/20 w-24">Discount</th>
                          <th className="px-3 py-2 border border-blue-400/20 w-24">Stock</th>
                          <th className="px-3 py-2 border border-blue-400/20 w-24">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {batchData.length > 0 ? (
                          batchData.map((batch, index) => (
                            <tr
                              key={index}
                              id={`batch-row-${index}`}
                              className={`transition-colors ${index === batchActionIndex ? 'bg-blue-50/70' : 'hover:bg-blue-50/40'}`}
                              onMouseEnter={() => setBatchActionIndex(index)}
                            >
                              <td className="px-3 py-2 border border-gray-100">{batch.supplier}</td>
                              <td className="px-3 py-2 border border-gray-100">{batch.inwardDate}</td>
                              <td className="px-3 py-2 border border-gray-100">{batch.rate}</td>
                              <td className="px-3 py-2 border border-gray-100">{batch.exchangeRate}</td>
                              <td className="px-3 py-2 border border-gray-100">{batch.currency}</td>
                              <td className="px-3 py-2 border border-gray-100">
                                {batch.tax !== null && batch.tax !== undefined ? batch.tax.toFixed(2) : '0.00'}
                              </td>
                              <td className="px-3 py-2 border border-gray-100">{batch.inwardDiscount}</td>
                              <td className="px-3 py-2 border border-gray-100">{batch.stock}</td>
                              <td className="px-3 py-2 border border-gray-100">
                                <button
                                  onClick={() => handleBatchSelect(batch)}
                                  className={`inline-flex items-center justify-center px-3 py-1 rounded-md text-[10px] font-semibold transition-all ${index === batchActionIndex
                                    ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                    }`}
                                  aria-selected={index === batchActionIndex}
                                >
                                  Select
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="9" className="text-center text-gray-500 py-6">
                              No batch data found for this item.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
                  <span>Use Up/Down arrows to move the action highlight, Enter to select.</span>
                  <button
                    onClick={() => setShowBatchModal(false)}
                    className="text-xs text-gray-600 hover:text-gray-800"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={`${cardClasses} sb-card`}>
          <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
            <div className="flex flex-1 flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={saleIdToLoad}
                onChange={(e) => setSaleIdToLoad(e.target.value)}
                placeholder="Sale ID"
                className={`${inputClasses} w-full sm:w-60`}
              />
              <button
                onClick={handleLoadSale}
                className={`${actionButtonClasses} from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700`}
              >
                Load Sale
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSubmitSale}
                className={`${actionButtonClasses} min-w-[160px]`}
              >
                {isEditMode ? 'Update Sale' : 'Submit Sale'}
              </button>
              <button
                onClick={resetSaleForm}
                className={`${actionButtonClasses} from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700`}
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
