import React, { useState, useEffect } from 'react';
import { TrashIcon } from '@heroicons/react/24/solid';
import Modal from '../../components/Modal';
import PageHeader from '../../components/PageHeader';
import api from '../../utils/axiosInstance';

export default function PurchaseBreakupsMaster() {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({
    breakupName: ''
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
  const [deleteBreakupId, setDeleteBreakupId] = useState(null);

  useEffect(() => {
    fetchAllPurchaseBreakups();
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

  // Icon for header
  const breakupIcon = (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

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
    console.log(`Updating purchase breakup: id=${id}, data=`, updatedItem);

    const payload = {
      breakup_nm: updatedItem.breakupName || ''
    };

    console.log('Update payload:', payload);

    try {
      const response = await api.put(`/auth/purchase-breakup-update/${id}/`, payload);
      console.log('Purchase breakup updated:', response.data);
      setModal({
        isOpen: true,
        message: 'Purchase breakup updated successfully!',
        type: 'success',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
    } catch (error) {
      console.error('Error updating purchase breakup:', error);
      setModal({
        isOpen: true,
        message: `Failed to update purchase breakup: ${error.response?.data?.error || error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
    }
  };

  const handleAddPurchaseBreakup = async () => {
    if (!formData.breakupName) {
      console.log('Validation failed: breakupName is empty');
      setModal({
        isOpen: true,
        message: 'Please fill Breakup Name field',
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      return;
    }

    const payload = {
      breakup_nm: formData.breakupName
    };

    console.log('Form data on submit:', formData);
    console.log('Payload for API:', payload);

    try {
      const response = await api.post('/auth/purchase-breakup-create/', payload);
      console.log('Purchase breakup created:', response.data);
      setModal({
        isOpen: true,
        message: 'Purchase breakup added successfully!',
        type: 'success',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      if (page === 1) {
        fetchAllPurchaseBreakups({ page: 1, pageSize });
      } else {
        setPage(1);
      }
      setFormData({
        breakupName: ''
      });
    } catch (error) {
      console.error('Error creating purchase breakup:', error);
      setModal({
        isOpen: true,
        message: `Failed to add purchase breakup: ${error.response?.data?.error || error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      return;
    }
  };

  const handleDeletePurchaseBreakup = (id) => {
    console.log(`Prompting to delete purchase breakup: id=${id}`);
    setDeleteBreakupId(id);
    setModal({
      isOpen: true,
      message: 'Are you sure you want to delete this purchase breakup?',
      type: 'warning',
      buttons: [
        {
          label: 'Confirm',
          onClick: async () => {
            try {
              const response = await api.delete(`/auth/purchase-breakup-delete/${id}/`);
              console.log('Purchase breakup deleted:', response.data);
              await fetchAllPurchaseBreakups({ page, pageSize });
              setModal({
                isOpen: true,
                message: 'Purchase breakup deleted successfully!',
                type: 'success',
                buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
              });
            } catch (error) {
              console.error('Error deleting purchase breakup:', error);
              setModal({
                isOpen: true,
                message: `Failed to delete purchase breakup: ${error.response?.data?.error || error.message}`,
                type: 'error',
                buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
              });
            }
            setDeleteBreakupId(null);
          },
          className: 'bg-red-500 hover:bg-red-600'
        },
        {
          label: 'Cancel',
          onClick: () => {
            setModal((prev) => ({ ...prev, isOpen: false }));
            setDeleteBreakupId(null);
          },
          className: 'bg-gray-500 hover:bg-gray-600'
        }
      ]
    });
  };

  const fetchAllPurchaseBreakups = async (options = {}) => {
    const pageToUse = options.page ?? page;
    const pageSizeToUse = options.pageSize ?? pageSize;
    const queryToUse = options.query ?? searchQuery;
    const trimmedQuery = (queryToUse || '').trim();

    setIsLoading(true);
    try {
      const response = await api.get(`/auth/purchase-breakups-master-search/`, {
        params: {
          page: pageToUse,
          page_size: pageSizeToUse,
          ...(trimmedQuery.length >= 2 ? { q: trimmedQuery } : {})
        }
      });
      console.log('Purchase breakups fetched:', response.data);
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
        breakupName: item.breakup_nm || ''
      }));
      setItems(fetchedItems);
      console.log('Updated items state:', fetchedItems);
      setTotalCount(total);
    } catch (error) {
      console.error('Error fetching purchase breakups:', error);
      setModal({
        isOpen: true,
        message: `Failed to load purchase breakups: ${error.response?.data?.error || error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
    } finally {
      setIsLoading(false);
    }
  };

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

      {/* Page Header */}
      <div className="flex-shrink-0">
        <PageHeader
          icon={breakupIcon}
          title="Purchase Breakups Master"
          subtitle="Manage purchase breakup names"
        />
      </div>

      {/* Main Content Card */}
      <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
        {/* Table Section */}
        <div className="p-4 flex-1 min-h-0 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-700">Purchase Breakups</span>
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
                  placeholder="Breakup name"
                  className="h-7 w-40 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
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
            <table className="w-full max-w-md table-fixed border-separate border-spacing-0">
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white uppercase tracking-wider text-xs shadow-md">
                  <th className="px-3 py-2 text-left font-medium tracking-wide border border-white/40 rounded-tl-lg">
                    Breakup Name
                  </th>
                  <th className="px-3 py-2 text-center font-medium w-[64px] border border-t border-r border-b border-white/40 rounded-tr-lg">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="2" className="px-4 py-8 text-center text-gray-400">
                      {isLoading ? 'Loading purchase breakups...' : 'No purchase breakups found. Add one below.'}
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr
                      key={item.id}
                      className="hover:bg-blue-50/50 transition-colors animate-fade-in"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <td className="px-2 py-1 border-b border-gray-100">
                        <input
                          type="text"
                          value={item.breakupName || ''}
                          onChange={(e) => handleTableInputChange(item.id, 'breakupName', e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, breakupName: e.target.value })}
                          className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                     focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white
                                     transition-all duration-200"
                          placeholder="Enter breakup name"
                        />
                      </td>
                      <td className="px-2 py-1 border-b border-gray-100 text-center w-[64px]">
                        <button
                          onClick={() => handleDeletePurchaseBreakup(item.id)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-red-500
                                     hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Delete purchase breakup"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Breakup Form */}
        <div className="border-t border-gray-200 bg-gray-50/50 px-4 py-4 flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-md">
            <div className="flex-1">
              <input
                type="text"
                name="breakupName"
                value={formData.breakupName}
                onChange={handleInputChange}
                placeholder="Enter new breakup name"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
                autoComplete="off"
                onKeyDown={(e) => e.key === 'Enter' && handleAddPurchaseBreakup()}
              />
            </div>
            <button
              onClick={handleAddPurchaseBreakup}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 w-full sm:w-auto
                         text-white text-sm font-medium shadow-lg shadow-blue-500/25
                         hover:from-blue-600 hover:to-indigo-700 active:scale-[0.98] transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Breakup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
