
import React, { useState, useEffect } from 'react';
import { TrashIcon } from '@heroicons/react/24/solid';
import Modal from '../../components/Modal';
import PageHeader from '../../components/PageHeader';
import api from '../../utils/axiosInstance';

export default function PPBooksMaster() {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({
    ppBookName: '',
    code: '',
    nos: '',
    faceValue: '',
    regStartDate: '',
    regEndDate: '',
    dateOfRelease: '',
    notes: '',
    closed: '0',
    ppBookFirm: '',
    ppBookFirmId: '',
    nosEx: '5000',
    productId: '0',
    inserted: '',
    modified: ''
  });
  const [titleHighlightedIndex, setTitleHighlightedIndex] = useState(-1);
  const [titleSuggestions, setTitleSuggestions] = useState([]);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [publisherHighlightedIndex, setPublisherHighlightedIndex] = useState(-1);
  const [publisherSuggestions, setPublisherSuggestions] = useState([]);
  const [showPublisherSuggestions, setShowPublisherSuggestions] = useState(false);
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
  const [deletePPBookId, setDeletePPBookId] = useState(null);

  useEffect(() => {
    fetchAllPPBooks();
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

  const handleKeyDown = (e, inputType) => {
    if (inputType === 'ppBookName' && showTitleSuggestions && titleSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setTitleHighlightedIndex((prev) => {
          const newIndex = prev < titleSuggestions.length - 1 ? prev + 1 : 0;
          const suggestionElement = document.getElementById(`title-suggestion-${newIndex}`);
          if (suggestionElement) {
            suggestionElement.scrollIntoView({ block: 'nearest' });
          }
          return newIndex;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setTitleHighlightedIndex((prev) => {
          const newIndex = prev > 0 ? prev - 1 : titleSuggestions.length - 1;
          const suggestionElement = document.getElementById(`title-suggestion-${newIndex}`);
          if (suggestionElement) {
            suggestionElement.scrollIntoView({ block: 'nearest' });
          }
          return newIndex;
        });
      } else if (e.key === 'Enter' && titleHighlightedIndex >= 0) {
        e.preventDefault();
        handleTitleSuggestionClick(titleSuggestions[titleHighlightedIndex]);
      } else if (e.key === 'Escape') {
        setShowTitleSuggestions(false);
        setTitleSuggestions([]);
        setTitleHighlightedIndex(-1);
      }
    } else if (inputType === 'ppBookFirm' && showPublisherSuggestions && publisherSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPublisherHighlightedIndex((prev) => {
          const newIndex = prev < publisherSuggestions.length - 1 ? prev + 1 : 0;
          const suggestionElement = document.getElementById(`publisher-suggestion-${newIndex}`);
          if (suggestionElement) {
            suggestionElement.scrollIntoView({ block: 'nearest' });
          }
          return newIndex;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPublisherHighlightedIndex((prev) => {
          const newIndex = prev > 0 ? prev - 1 : publisherSuggestions.length - 1;
          const suggestionElement = document.getElementById(`publisher-suggestion-${newIndex}`);
          if (suggestionElement) {
            suggestionElement.scrollIntoView({ block: 'nearest' });
          }
          return newIndex;
        });
      } else if (e.key === 'Enter' && publisherHighlightedIndex >= 0) {
        e.preventDefault();
        handlePublisherSuggestionClick(publisherSuggestions[publisherHighlightedIndex]);
      } else if (e.key === 'Escape') {
        setShowPublisherSuggestions(false);
        setPublisherSuggestions([]);
        setPublisherHighlightedIndex(-1);
      }
    }
  };

  const fetchAllPPBooks = async (options = {}) => {
    const pageToUse = options.page ?? page;
    const pageSizeToUse = options.pageSize ?? pageSize;
    const queryToUse = options.query ?? searchQuery;
    const trimmedQuery = (queryToUse || '').trim();

    setIsLoading(true);
    try {
      const response = await api.get('/auth/pp-books-master-search/', {
        params: {
          page: pageToUse,
          page_size: pageSizeToUse,
          ...(trimmedQuery.length >= 2 ? { q: trimmedQuery } : {})
        }
      });
      console.log('PP books fetched:', response.data);
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
        ppBookName: item.pp_book_nm || '',
        code: item.code || '',
        nos: item.nos ?? '',
        faceValue: item.face_value ?? '',
        regStartDate: item.reg_start_date || '',
        regEndDate: item.reg_end_date || '',
        dateOfRelease: item.date_of_release || '',
        notes: item.notes || '',
        closed: item.closed ?? '0',
        ppBookFirmId: item.pp_book_firm_id ?? '',
        ppBookFirm: item.pp_book_firm || '',
        nosEx: item.nos_ex ?? '5000',
        productId: item.product_id ?? '0',
        inserted: item.inserted || '',
        modified: item.modified || ''
      }));
      setItems(fetchedItems);
      setTotalCount(total);
      console.log('Updated items state:', fetchedItems);
    } catch (error) {
      console.error('Error fetching PP books:', error);
      setModal({
        isOpen: true,
        message: `Failed to load PP books: ${error.response?.data?.error || error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTitleSuggestionClick = (suggestion) => {
    setFormData((prev) => ({
      ...prev,
      ppBookName: suggestion.title,
      productId: suggestion.id
    }));
    setTitleSuggestions([]);
    setShowTitleSuggestions(false);
    setTitleHighlightedIndex(-1);
  };

  const handlePublisherSuggestionClick = (suggestion) => {
    setFormData((prev) => ({
      ...prev,
      ppBookFirm: suggestion.publisher_nm,
      ppBookFirmId: suggestion.id
    }));
    setPublisherSuggestions([]);
    setShowPublisherSuggestions(false);
    setPublisherHighlightedIndex(-1);
  };

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    console.log(`Input changed: ${name} = ${value}`);

    if (name === 'ppBookName') {
      setFormData((prev) => ({ ...prev, ppBookName: value, productId: '0' }));
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        setTitleSuggestions([]);
        setShowTitleSuggestions(false);
        setTitleHighlightedIndex(-1);
      } else {
        try {
          const res = await api.get(`/auth/product-search/?q=${encodeURIComponent(trimmed)}`);
          console.log('Title API response:', res.data);
          if (res.data && res.data.length > 0) {
            setTitleSuggestions(res.data);
            setShowTitleSuggestions(true);
            setTitleHighlightedIndex(-1);
          } else {
            setTitleSuggestions([]);
            setShowTitleSuggestions(false);
            setTitleHighlightedIndex(-1);
          }
        } catch (error) {
          console.error('Title autocomplete error:', error);
          setTitleSuggestions([]);
          setShowTitleSuggestions(false);
          setTitleHighlightedIndex(-1);
        }
      }
      return;
    }

    if (name === 'ppBookFirm') {
      setFormData((prev) => ({ ...prev, ppBookFirm: value, ppBookFirmId: '0' }));
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        setPublisherSuggestions([]);
        setShowPublisherSuggestions(false);
        setPublisherHighlightedIndex(-1);
      } else {
        try {
          const res = await api.get(`/auth/publisher-search/?q=${encodeURIComponent(trimmed)}`);
          console.log('Publisher API response:', res.data);
          if (res.data && res.data.length > 0) {
            setPublisherSuggestions(res.data);
            setShowPublisherSuggestions(true);
            setPublisherHighlightedIndex(-1);
          } else {
            setPublisherSuggestions([]);
            setShowPublisherSuggestions(false);
            setPublisherHighlightedIndex(-1);
          }
        } catch (error) {
          console.error('Publisher autocomplete error:', error);
          setPublisherSuggestions([]);
          setShowPublisherSuggestions(false);
          setPublisherHighlightedIndex(-1);
        }
      }
      return;
    }

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
    console.log(`Updating PP book: id=${id}, data=`, updatedItem);

    const payload = {
      company_id: 1,
      pp_book_nm: updatedItem.ppBookName || '',
      code: updatedItem.code || '',
      nos: updatedItem.nos ? parseInt(updatedItem.nos) : null,
      face_value: updatedItem.faceValue ? parseFloat(updatedItem.faceValue) : null,
      reg_start_date: updatedItem.regStartDate || null,
      reg_end_date: updatedItem.regEndDate || null,
      date_of_release: updatedItem.dateOfRelease || null,
      notes: updatedItem.notes || null,
      closed: Number(updatedItem.closed ?? 0),
      pp_book_firm_id: updatedItem.ppBookFirmId ? parseInt(updatedItem.ppBookFirmId) : 0,
      nos_ex: updatedItem.nosEx ? parseInt(updatedItem.nosEx) : 5000,
      product_id: updatedItem.productId ? parseInt(updatedItem.productId) : 0
    };

    console.log('Update payload:', payload);

    try {
      const response = await api.put(`/auth/pp-book-update/${id}/`, payload);
      console.log('PP book updated:', response.data);
      setModal({
        isOpen: true,
        message: 'PP book updated successfully!',
        type: 'success',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
    } catch (error) {
      console.error('Error updating PP book:', error);
      setModal({
        isOpen: true,
        message: `Failed to update PP book: ${error.response?.data?.error || error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
    }
  };

  const handleAddPPBook = async () => {
    if (!formData.ppBookName || !formData.code || !formData.closed || !formData.ppBookFirmId) {
      console.log('Validation failed: required fields missing');
      setModal({
        isOpen: true,
        message: 'Please fill all required fields: PP Book Name, Code, Closed, PP Book Firm Id',
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      return;
    }

    const payload = {
      company_id: 1,
      pp_book_nm: formData.ppBookName,
      code: formData.code,
      nos: formData.nos ? parseInt(formData.nos) : null,
      face_value: formData.faceValue ? parseFloat(formData.faceValue) : null,
      reg_start_date: formData.regStartDate || null,
      reg_end_date: formData.regEndDate || null,
      date_of_release: formData.dateOfRelease || null,
      notes: formData.notes || null,
      closed: Number(formData.closed ?? 0),
      pp_book_firm_id: parseInt(formData.ppBookFirmId, 10),
      nos_ex: formData.nosEx ? parseInt(formData.nosEx, 10) : 5000,
      product_id: formData.productId ? parseInt(formData.productId, 10) : 0
    };

    console.log('Form data on submit:', formData);
    console.log('Payload for API:', payload);

    try {
      const response = await api.post('/auth/pp-book-create/', payload);
      console.log('PP book created:', response.data);
      setModal({
        isOpen: true,
        message: 'PP book added successfully!',
        type: 'success',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      if (page === 1) {
        fetchAllPPBooks({ page: 1, pageSize });
      } else {
        setPage(1);
      }
      setFormData({
        ppBookName: '',
        code: '',
        nos: '',
        faceValue: '',
        regStartDate: '',
        regEndDate: '',
        dateOfRelease: '',
        notes: '',
        closed: '0',
        ppBookFirm: '',
        ppBookFirmId: '',
        nosEx: '5000',
        productId: '0',
        inserted: '',
        modified: ''
      });
      setTitleSuggestions([]);
      setShowTitleSuggestions(false);
      setTitleHighlightedIndex(-1);
      setPublisherSuggestions([]);
      setShowPublisherSuggestions(false);
      setPublisherHighlightedIndex(-1);
    } catch (error) {
      console.error('Error creating PP book:', error);
      setModal({
        isOpen: true,
        message: `Failed to add PP book: ${error.response?.data?.error || error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      return;
    }
  };

  const handleDeletePPBook = (id) => {
    console.log(`Prompting to delete PP book: id=${id}`);
    setDeletePPBookId(id);
    setModal({
      isOpen: true,
      message: 'Are you sure you want to delete this PP book?',
      type: 'warning',
      buttons: [
        {
          label: 'Confirm',
          onClick: async () => {
            try {
              const response = await api.delete(`/auth/pp-book-delete/${id}/`);
              console.log('PP book deleted:', response.data);
              await fetchAllPPBooks({ page, pageSize });
              setModal({
                isOpen: true,
                message: 'PP book deleted successfully!',
                type: 'success',
                buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
              });
            } catch (error) {
              console.error('Error deleting PP book:', error);
              setModal({
                isOpen: true,
                message: `Failed to delete PP book: ${error.response?.data?.error || error.message}`,
                type: 'error',
                buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
              });
            }
            setDeletePPBookId(null);
          },
          className: 'bg-red-500 hover:bg-red-600'
        },
        {
          label: 'Cancel',
          onClick: () => {
            setModal((prev) => ({ ...prev, isOpen: false }));
            setDeletePPBookId(null);
          },
          className: 'bg-gray-500 hover:bg-gray-600'
        }
      ]
    });
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

      <div className="flex-shrink-0">
        <PageHeader
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
          title="Pre-Publication Books Master"
          subtitle="Manage pre-publication book batches"
          compact
        />
      </div>

      <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-3 flex-1 min-h-0 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-700">PP Books</span>
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
                  placeholder="PP book name"
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
            <div className="min-w-[1700px]">
              <table className="w-full table-fixed border-collapse">
                <thead className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                  <tr>
                    <th className="w-[260px] px-3 py-2 text-left text-sm font-semibold tracking-wide">PP Book Name</th>
                    <th className="w-[90px] px-3 py-2 text-left text-sm font-semibold tracking-wide">Code</th>
                    <th className="w-[90px] px-3 py-2 text-left text-sm font-semibold tracking-wide">Nos</th>
                    <th className="w-[120px] px-3 py-2 text-left text-sm font-semibold tracking-wide">Face Value</th>
                    <th className="w-[140px] px-3 py-2 text-left text-sm font-semibold tracking-wide">Reg Start</th>
                    <th className="w-[140px] px-3 py-2 text-left text-sm font-semibold tracking-wide">Reg End</th>
                    <th className="w-[140px] px-3 py-2 text-left text-sm font-semibold tracking-wide">Release</th>
                    <th className="w-[200px] px-3 py-2 text-left text-sm font-semibold tracking-wide">Notes</th>
                    <th className="w-[90px] px-3 py-2 text-left text-sm font-semibold tracking-wide">Closed</th>
                    <th className="w-[180px] px-3 py-2 text-left text-sm font-semibold tracking-wide">PP Book Firm</th>
                    <th className="w-[80px] px-3 py-2 text-left text-sm font-semibold tracking-wide">Nos Ex</th>
                    <th className="w-[90px] px-3 py-2 text-left text-sm font-semibold tracking-wide">Title Id</th>
                    <th className="w-[140px] px-3 py-2 text-left text-sm font-semibold tracking-wide">Inserted</th>
                    <th className="w-[140px] px-3 py-2 text-left text-sm font-semibold tracking-wide">Modified</th>
                    <th className="w-[60px] px-3 py-2 text-center text-sm font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="15" className="px-4 py-8 text-center text-gray-400">
                        {isLoading ? 'Loading PP books...' : 'No PP books found. Add one below.'}
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                      <tr
                        key={item.id}
                        className="hover:bg-blue-50/50 transition-colors animate-fade-in"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.ppBookName || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'ppBookName', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, ppBookName: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.code || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'code', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, code: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={item.nos ?? ''}
                            onChange={(e) => handleTableInputChange(item.id, 'nos', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, nos: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.faceValue || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'faceValue', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, faceValue: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={item.regStartDate || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'regStartDate', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, regStartDate: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={item.regEndDate || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'regEndDate', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, regEndDate: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={item.dateOfRelease || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'dateOfRelease', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, dateOfRelease: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'notes', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, notes: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            aria-label="Closed"
                            value={String(item.closed ?? '0')}
                            onChange={(e) => handleTableInputChange(item.id, 'closed', e.target.value)}
                            onKeyDown={(e) =>
                              e.key === 'Enter' &&
                              handleTableUpdate(item.id, { ...item, closed: Number(e.target.value) })
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          >
                            <option value="0">No</option>
                            <option value="1">Yes</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.ppBookFirm || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'ppBookFirm', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, ppBookFirm: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={item.nosEx || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'nosEx', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, nosEx: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={item.productId || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'productId', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, productId: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                          />
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {item.inserted ? new Date(item.inserted).toLocaleString() : ''}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {item.modified ? new Date(item.modified).toLocaleString() : ''}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => handleDeletePPBook(item.id)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete PP book"
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
        </div>

        <div className="border-t border-gray-200 bg-gray-50/50 px-4 py-3 flex-shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2">
            <div className="relative lg:col-span-2">
              <input
                type="text"
                name="ppBookName"
                value={formData.ppBookName}
                onChange={handleInputChange}
                placeholder="PP Book Name"
                onKeyDown={(e) => handleKeyDown(e, 'ppBookName')}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
                autoComplete="off"
              />
              {showTitleSuggestions && titleSuggestions.length > 0 && formData.ppBookName.trim() && (
                <ul className="absolute z-10 bg-white border mt-1 w-full shadow-md rounded-lg text-sm max-h-48 overflow-y-auto">
                  {titleSuggestions.map((ppbook, index) => (
                    <li
                      key={ppbook.id}
                      id={`title-suggestion-${index}`}
                      className={`px-3 py-1 cursor-pointer ${titleHighlightedIndex === index ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                      onClick={() => handleTitleSuggestionClick(ppbook)}
                    >
                      {ppbook.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                placeholder="Code"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div>
              <input
                type="number"
                name="nos"
                value={formData.nos}
                onChange={handleInputChange}
                placeholder="Nos"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div>
              <input
                type="number"
                step="0.01"
                name="faceValue"
                value={formData.faceValue}
                onChange={handleInputChange}
                placeholder="Face Value"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div>
              <input
                type="date"
                name="regStartDate"
                value={formData.regStartDate}
                onChange={handleInputChange}
                placeholder="Reg Start Date"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div>
              <input
                type="date"
                name="regEndDate"
                value={formData.regEndDate}
                onChange={handleInputChange}
                placeholder="Reg End Date"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div>
              <input
                type="date"
                name="dateOfRelease"
                value={formData.dateOfRelease}
                onChange={handleInputChange}
                placeholder="Date Of Release"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div className="lg:col-span-2">
              <input
                type="text"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Notes"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div>
              <select
                name="closed"
                value={formData.closed}
                onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
              >
                <option value="0">No</option>
                <option value="1">Yes</option>
              </select>
            </div>
            <div className="relative lg:col-span-2">
              <input
                type="text"
                name="ppBookFirm"
                value={formData.ppBookFirm}
                onChange={handleInputChange}
                placeholder="PP Book Firm"
                onKeyDown={(e) => handleKeyDown(e, 'ppBookFirm')}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
                autoComplete="off"
              />
              {showPublisherSuggestions && publisherSuggestions.length > 0 && formData.ppBookFirm.trim() && (
                <ul className="absolute z-10 bg-white border mt-1 w-full shadow-md rounded-lg text-sm max-h-48 overflow-y-auto">
                  {publisherSuggestions.map((ppbook, index) => (
                    <li
                      key={ppbook.id}
                      id={`publisher-suggestion-${index}`}
                      className={`px-3 py-1 cursor-pointer ${publisherHighlightedIndex === index ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                      onClick={() => handlePublisherSuggestionClick(ppbook)}
                    >
                      {ppbook.publisher_nm}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <input
                type="number"
                name="nosEx"
                value={formData.nosEx}
                onChange={handleInputChange}
                placeholder="Nos Ex"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div>
              <input
                type="number"
                name="productId"
                value={formData.productId}
                onChange={handleInputChange}
                placeholder="Title Id"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div className="flex justify-end lg:col-span-2">
              <button
                onClick={handleAddPPBook}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 w-full sm:w-auto
                           text-white text-sm font-medium shadow-lg shadow-blue-500/25
                           hover:from-blue-600 hover:to-indigo-700 active:scale-[0.98] transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add PP Book
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
