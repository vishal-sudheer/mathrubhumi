import React, { useState, useEffect } from 'react';
import { TrashIcon } from '@heroicons/react/24/solid';
import Modal from '../../components/Modal';
import PageHeader from '../../components/PageHeader';
import api from '../../utils/axiosInstance';

export default function CreditCustomerMaster() {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    address1: '',
    address2: '',
    city: '',
    phone: '',
    email: '',
    debit: '',
    credit: '',
    credit_days: '',
    credit_limit: '',
    gstin: '',
    class: ''
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [modal, setModal] = useState({
    isOpen: false,
    message: '',
    type: 'info',
    buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
  });

  useEffect(() => {
    fetchAllCreditCustomers();
  }, [page, pageSize, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      const nextQuery = trimmed.length >= 2 ? trimmed : '';
      setPage((prev) => (prev === 1 ? prev : 1));
      setSearchQuery((prev) => (prev === nextQuery ? prev : nextQuery));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const classOptions = [
    { value: '0', label: 'Individual' },
    { value: '1', label: 'Educational Instt - School' },
    { value: '2', label: 'Educational Instt - College' },
    { value: '3', label: 'Local Library' },
    { value: '4', label: 'Local Bodies' },
    { value: '5', label: 'Commission Agents' },
    { value: '6', label: 'Agents' },
    { value: '7', label: 'Other Book Shops' },
    { value: '8', label: 'Corporate Firms' },
    { value: '9', label: 'Not Applicable' },
    { value: '10', label: 'Staff' },
    { value: '11', label: 'Freelancers' },
    { value: '12', label: 'Authors' },
    { value: '13', label: 'Section' }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    console.log(`Input changed: ${name} = ${value}`);
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTableInputChange = (id, field, value) => {
    console.log(`Table input changed: id=${id}, field=${field}, value=${value}`);
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleTableUpdate = async (id, updatedItem) => {
    console.log(`Updating credit customer: id=${id}, data=`, updatedItem);

    const payload = {
      id: id,
      customer_nm: updatedItem.name || '',
      address_1: updatedItem.address1 || null,
      address_2: updatedItem.address2 || null,
      city: updatedItem.city || null,
      telephone: updatedItem.phone || null,
      email_id: updatedItem.email || null,
      debit: parseFloat(updatedItem.debit) || 0.00,
      credit: parseFloat(updatedItem.credit) || 0.00,
      credit_days: parseInt(updatedItem.credit_days) || 0,
      credit_limit: parseFloat(updatedItem.credit_limit) || 0.00,
      gstin: updatedItem.gstin || null,
      class: parseInt(updatedItem.class) || 0
    };

    console.log('Update payload:', payload);

    try {
      const response = await api.put(`/auth/credit-customer-update/${id}/`, payload);
      console.log('Credit customer updated:', response.data);
      setModal({
        isOpen: true,
        message: 'Credit customer updated successfully!',
        type: 'success',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
    } catch (error) {
      console.error('Error updating credit customer:', error);
      setModal({
        isOpen: true,
        message: `Failed to update credit customer: ${error.response?.data?.error || error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
    }
  };

  const handleAddCreditCustomer = async () => {
    if (!formData.name) {
      console.log('Validation failed: name is empty');
      setModal({
        isOpen: true,
        message: 'Please fill Name field',
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      return;
    }

    const payload = {
      id: parseInt(formData.id || Math.floor(Math.random() * 1000000)), // Generate random ID if not provided
      customer_nm: formData.name,
      address_1: formData.address1 || null,
      address_2: formData.address2 || null,
      city: formData.city || null,
      telephone: formData.phone || null,
      email_id: formData.email || null,
      debit: parseFloat(formData.debit) || 0.00,
      credit: parseFloat(formData.credit) || 0.00,
      credit_days: parseInt(formData.credit_days) || 0,
      credit_limit: parseFloat(formData.credit_limit) || 0.00,
      gstin: formData.gstin || null,
      class: parseInt(formData.class) || 0
    };

    console.log('Form data on submit:', formData);
    console.log('Payload for API:', payload);

    try {
      const response = await api.post('/auth/credit-customer-create/', payload);
      console.log('Credit customer created:', response.data);
      setModal({
        isOpen: true,
        message: 'Credit customer added successfully!',
        type: 'success',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      if (page === 1) {
        fetchAllCreditCustomers({ page: 1, pageSize });
      } else {
        setPage(1);
      }
    } catch (error) {
      console.error('Error creating credit customer:', error);
      setModal({
        isOpen: true,
        message: `Failed to add credit customer: ${error.response?.data?.error || error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      return;
    }

    setFormData({
      name: '',
      address1: '',
      address2: '',
      city: '',
      phone: '',
      email: '',
      debit: '',
      credit: '',
      credit_days: '',
      credit_limit: '',
      gstin: '',
      class: ''
    });
  };

  const fetchAllCreditCustomers = async (options = {}) => {
    const pageToUse = options.page ?? page;
    const pageSizeToUse = options.pageSize ?? pageSize;
    const queryToUse = options.query ?? searchQuery;
    const trimmedQuery = (queryToUse || '').trim();

    setIsLoading(true);
    try {
      const response = await api.get(`/auth/credit-customer-master-search/`, {
        params: {
          page: pageToUse,
          page_size: pageSizeToUse,
          ...(trimmedQuery.length >= 2 ? { q: trimmedQuery } : {})
        }
      });
      console.log('Credit customers fetched:', response.data);
      const payload = response.data || {};
      const results = Array.isArray(payload) ? payload : (payload.results || []);
      const total = Array.isArray(payload) ? results.length : (payload.total ?? results.length);
      const nextTotalPages = Math.max(1, Math.ceil(total / pageSizeToUse));

      if (pageToUse > nextTotalPages) {
        setTotalCount(total);
        setPage(nextTotalPages);
        return;
      }

      const fetchedItems = results.map((item) => ({
        id: item.id,
        name: item.customer_nm || '',
        address1: item.address_1 || '',
        address2: item.address_2 || '',
        city: item.city || '',
        phone: item.telephone || '',
        email: item.email_id || '',
        debit: (item.debit && parseFloat(item.debit) !== 0) ? item.debit.toString() : '',
        credit: (item.credit && parseFloat(item.credit) !== 0) ? item.credit.toString() : '',
        credit_days: (item.credit_days && parseInt(item.credit_days) !== 0) ? item.credit_days.toString() : '',
        credit_limit: (item.credit_limit && parseFloat(item.credit_limit) !== 0) ? item.credit_limit.toString() : '',
        gstin: item.gstin || '',
        class: item.class !== null && item.class !== undefined ? item.class.toString() : ''
      }));
      setItems(fetchedItems);
      console.log('Updated items state:', fetchedItems);
      setTotalCount(total);
    } catch (error) {
      console.error('Error fetching credit customers:', error);
      setModal({
        isOpen: true,
        message: `Failed to load credit customers: ${error.response?.data?.error || error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCreditCustomer = (id) => {
    const row = items.find((x) => x.id === id);
    setModal({
      isOpen: true,
      message: `Are you sure you want to delete this credit customer${row?.name ? `: ${row.name}` : ''}?`,
      type: 'warning',
      buttons: [
        {
          label: 'Confirm',
          onClick: async () => {
            try {
              await api.delete(`/auth/credit-customer-delete/${id}/`);
              await fetchAllCreditCustomers({ page, pageSize });
              setModal({
                isOpen: true,
                message: 'Credit customer deleted successfully!',
                type: 'success',
                buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }],
              });
            } catch (error) {
              console.error('Error deleting credit customer:', error);
              setModal({
                isOpen: true,
                message: `Failed to delete credit customer: ${error.response?.data?.error || error.message}`,
                type: 'error',
                buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }],
              });
            }
          },
          className: 'bg-red-500 hover:bg-red-600',
        },
        {
          label: 'Cancel',
          onClick: () => setModal((prev) => ({ ...prev, isOpen: false })),
          className: 'bg-gray-500 hover:bg-gray-600',
        },
      ],
    });
  };

  const creditCustomerIcon = (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8h18M3 12h10m-7 4h7m2 0h3M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
    </svg>
  );

  const pageSizeOptions = [50, 100, 200];
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIndex = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(totalCount, page * pageSize);
  const isFiltering = searchQuery.trim().length >= 2;
  const showSearchHint = searchInput.trim().length === 1;

  const handlePageChange = (nextPage) => {
    const clamped = Math.min(Math.max(nextPage, 1), totalPages);
    if (clamped !== page) {
      setPage(clamped);
    }
  };

  const handlePageSizeChange = (e) => {
    const nextSize = parseInt(e.target.value, 10) || 100;
    if (nextSize !== pageSize) {
      setPage(1);
      setPageSize(nextSize);
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-4 sm:p-6 flex flex-col">
      <Modal
        isOpen={modal.isOpen}
        message={modal.message}
        type={modal.type}
        buttons={modal.buttons}
      />

      <div className="flex-shrink-0">
        <PageHeader
          icon={creditCustomerIcon}
          title="Credit Customers Master"
          subtitle="Manage credit customer profiles"
          compact
        />
      </div>

      <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-4 flex-1 min-h-0 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-700">Credit Customers</span>
              <span>
                {totalCount === 0 ? 'No records' : `Showing ${startIndex}-${endIndex} of ${totalCount}`}
              </span>
              {isFiltering && <span className="text-gray-500">Filter: "{searchQuery}"</span>}
              {isLoading && <span className="text-blue-600">Loading...</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <label className="text-gray-500">Search</label>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Customer name"
                  className="h-7 w-48 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                  disabled={isLoading}
                />
              </div>
              {showSearchHint && <span className="text-gray-400">Type at least 2 letters</span>}
              <label className="text-gray-500">Rows</label>
              <select
                value={pageSize}
                onChange={handlePageSizeChange}
                className="h-7 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700"
                disabled={isLoading}
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || isLoading}
                className="h-7 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
              >
                Prev
              </button>
              <span className="text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages || isLoading}
                className="h-7 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
              >
                Next
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto rounded-lg border border-gray-200">
            <div className="min-w-[1300px]">
              <table className="w-full table-fixed border-collapse">
                <thead className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                  <tr>
                    <th className="w-[300px] px-4 py-2 text-left text-sm font-semibold tracking-wide">Name</th>
                    <th className="w-[200px] px-4 py-2 text-left text-sm font-semibold tracking-wide">Address 1</th>
                    <th className="w-[200px] px-4 py-2 text-left text-sm font-semibold tracking-wide">Address 2</th>
                    <th className="w-[100px] px-4 py-2 text-left text-sm font-semibold tracking-wide">City</th>
                    <th className="w-[150px] px-4 py-2 text-left text-sm font-semibold tracking-wide">Phone</th>
                    <th className="w-[200px] px-4 py-2 text-left text-sm font-semibold tracking-wide">E-Mail</th>
                    <th className="w-[100px] px-4 py-2 text-left text-sm font-semibold tracking-wide">Debit</th>
                    <th className="w-[100px] px-4 py-2 text-left text-sm font-semibold tracking-wide">Credit</th>
                    <th className="w-[100px] px-4 py-2 text-left text-sm font-semibold tracking-wide">Cr Days</th>
                    <th className="w-[100px] px-4 py-2 text-left text-sm font-semibold tracking-wide">Cr Limit</th>
                    <th className="w-[150px] px-4 py-2 text-left text-sm font-semibold tracking-wide">GSTIN</th>
                    <th className="w-[150px] px-4 py-2 text-left text-sm font-semibold tracking-wide">Class</th>
                    <th className="w-[50px] px-4 py-2 text-center text-sm font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="13" className="px-4 py-8 text-center text-gray-400">
                        {isLoading ? 'Loading credit customers...' : 'No credit customers found. Add one below.'}
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                      <tr
                        key={item.id}
                        className="hover:bg-blue-50/50 transition-colors animate-fade-in"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.name || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'name', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, name: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.address1 || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'address1', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, address1: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.address2 || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'address2', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, address2: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.city || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'city', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, city: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.phone || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'phone', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, phone: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.email || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'email', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, email: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={item.debit || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'debit', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, debit: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                            step="0.001"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={item.credit || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'credit', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, credit: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                            step="0.001"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={item.credit_days || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'credit_days', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, credit_days: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                            step="1"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={item.credit_limit || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'credit_limit', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, credit_limit: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                            step="0.001"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.gstin || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'gstin', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, gstin: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={item.class ?? ''}
                            onChange={(e) => handleTableInputChange(item.id, 'class', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, class: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          >
                            <option value="" disabled hidden>Class</option>
                            {classOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleDeleteCreditCustomer(item.id)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete credit customer"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-gray-200 bg-gray-50/50 px-4 py-3 flex-shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="md:col-span-2">
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Name"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                             transition-all duration-200 input-premium"
                  autoComplete="off"
                />
              </div>
              <div className="md:col-span-2">
                <input
                  type="text"
                  name="address1"
                  value={formData.address1}
                  onChange={handleInputChange}
                  placeholder="Address 1"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                             transition-all duration-200 input-premium"
                  autoComplete="off"
                />
              </div>
              <div className="md:col-span-2">
                <input
                  type="text"
                  name="address2"
                  value={formData.address2}
                  onChange={handleInputChange}
                  placeholder="Address 2"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                             transition-all duration-200 input-premium"
                  autoComplete="off"
                />
              </div>
              <div>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  placeholder="City"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                             transition-all duration-200 input-premium"
                  autoComplete="off"
                />
              </div>
              <div>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Phone"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                             transition-all duration-200 input-premium"
                  autoComplete="off"
                />
              </div>
              <div>
                <input
                  type="text"
                  name="gstin"
                  value={formData.gstin}
                  onChange={handleInputChange}
                  placeholder="GSTIN"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                             transition-all duration-200 input-premium"
                  autoComplete="off"
                />
              </div>
              <div className="md:col-span-2">
                <input
                  type="text"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="E-Mail"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                             transition-all duration-200 input-premium"
                  autoComplete="off"
                />
              </div>
              <div className="md:col-span-2 lg:col-span-4">
                <div className="flex flex-wrap items-end gap-2">
                  <input
                    type="number"
                    name="debit"
                    value={formData.debit}
                    onChange={handleInputChange}
                    placeholder="Debit"
                    className="w-full sm:w-28 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                               transition-all duration-200 input-premium"
                    step="1"
                    autoComplete="off"
                  />
                  <input
                    type="number"
                    name="credit"
                    value={formData.credit}
                    onChange={handleInputChange}
                    placeholder="Credit"
                    className="w-full sm:w-28 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                               transition-all duration-200 input-premium"
                    step="1"
                    autoComplete="off"
                  />
                  <input
                    type="number"
                    name="credit_days"
                    value={formData.credit_days}
                    onChange={handleInputChange}
                    placeholder="Cr Days"
                    className="w-full sm:w-24 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                               transition-all duration-200 input-premium"
                    step="1"
                    autoComplete="off"
                  />
                  <input
                    type="number"
                    name="credit_limit"
                    value={formData.credit_limit}
                    onChange={handleInputChange}
                    placeholder="Cr Limit"
                    className="w-full sm:w-28 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                               transition-all duration-200 input-premium"
                    step="1"
                    autoComplete="off"
                  />
                  <select
                    name="class"
                    value={formData.class}
                    onChange={handleInputChange}
                    className="w-full sm:w-40 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                               transition-all duration-200 input-premium"
                  >
                    <option value="" disabled hidden>Class</option>
                    {classOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddCreditCustomer}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 w-full sm:w-auto sm:ml-auto
                               text-white text-sm font-medium shadow-lg shadow-blue-500/25
                               hover:from-blue-600 hover:to-indigo-700 active:scale-[0.98] transition-all duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Customer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
