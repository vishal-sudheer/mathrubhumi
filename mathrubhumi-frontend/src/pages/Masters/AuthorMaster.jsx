import React, { useState, useEffect } from 'react';
import { TrashIcon } from '@heroicons/react/24/solid';
import Modal from '../../components/Modal';
import PageHeader from '../../components/PageHeader';
import api from '../../utils/axiosInstance';

export default function AuthorMaster() {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    contact: '',
    email: '',
    address1: '',
    address2: '',
    phone: '',
    city: ''
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
  const [deleteAuthorId, setDeleteAuthorId] = useState(null);

  useEffect(() => {
    fetchAllAuthors();
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTableInputChange = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleTableUpdate = async (id, updatedItem) => {
    const payload = {
      id: id,
      author_nm: updatedItem.name || '',
      contact: updatedItem.contact || null,
      mail_id: updatedItem.email || null,
      address1: updatedItem.address1 || null,
      address2: updatedItem.address2 || null,
      telephone: updatedItem.phone || null,
      city: updatedItem.city || null
    };
    try {
      const response = await api.put(`/auth/author-update/${id}/`, payload);
      setModal({
        isOpen: true,
        message: 'Author updated successfully!',
        type: 'success',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
    } catch (error) {
      console.error('Error updating author:', error);
      setModal({
        isOpen: true,
        message: `Failed to update author: ${error.response?.data?.error || error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
    }
  };

  const handleAddAuthor = async () => {
    if (!formData.code || !formData.name) {
      setModal({
        isOpen: true,
        message: 'Please fill Code and Name fields',
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      return;
    }

    const payload = {
      id: parseInt(formData.code),
      author_nm: formData.name,
      contact: formData.contact || null,
      mail_id: formData.email || null,
      address1: formData.address1 || null,
      address2: formData.address2 || null,
      telephone: formData.phone || null,
      city: formData.city || null
    };
    try {
      const response = await api.post('/auth/author-create/', payload);
      setModal({
        isOpen: true,
        message: 'Author added successfully!',
        type: 'success',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      if (page === 1) {
        fetchAllAuthors({ page: 1, pageSize });
      } else {
        setPage(1);
      }
    } catch (error) {
      console.error('Error creating author:', error);
      setModal({
        isOpen: true,
        message: `Failed to add author: ${error.response?.data?.error || error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      return;
    }

    setFormData({
      code: '',
      name: '',
      contact: '',
      email: '',
      address1: '',
      address2: '',
      phone: '',
      city: ''
    });
  };

  const fetchAllAuthors = async (options = {}) => {
    const pageToUse = options.page ?? page;
    const pageSizeToUse = options.pageSize ?? pageSize;
    const queryToUse = options.query ?? searchQuery;
    const trimmedQuery = (queryToUse || '').trim();

    setIsLoading(true);
    try {
      const response = await api.get(`/auth/author-master-search/`, {
        params: {
          page: pageToUse,
          page_size: pageSizeToUse,
          ...(trimmedQuery.length >= 2 ? { q: trimmedQuery } : {})
        }
      });
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
        code: item.id?.toString() || '',
        name: item.author_nm || '',
        contact: item.contact || '',
        email: item.mail_id || '',
        address1: item.address1 || '',
        address2: item.address2 || '',
        phone: item.telephone || '',
        city: item.city || ''
      }));
      setItems(fetchedItems);
      setTotalCount(total);
    } catch (error) {
      console.error('Error fetching authors:', error);
      setModal({
        isOpen: true,
        message: `Failed to load authors: ${error.response?.data?.error || error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAuthor = (id) => {
    setDeleteAuthorId(id);
    setModal({
      isOpen: true,
      message: 'Are you sure you want to delete this author?',
      type: 'warning',
      buttons: [
        {
          label: 'Delete',
          onClick: async () => {
            try {
              await api.delete(`/auth/author-delete/${id}/`);
              await fetchAllAuthors({ page, pageSize });
              setModal({
                isOpen: true,
                message: 'Author deleted successfully!',
                type: 'success',
                buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
              });
            } catch (error) {
              setModal({
                isOpen: true,
                message: `Failed to delete author: ${error.response?.data?.error || error.message}`,
                type: 'error',
                buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
              });
            }
            setDeleteAuthorId(null);
          },
          className: 'bg-red-500 hover:bg-red-600'
        },
        {
          label: 'Cancel',
          onClick: () => {
            setModal((prev) => ({ ...prev, isOpen: false }));
            setDeleteAuthorId(null);
          },
          className: 'bg-gray-500 hover:bg-gray-600'
        }
      ]
    });
  };

  // Author icon for header
  const authorIcon = (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
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

      {/* Page Header */}
      <div className="flex-shrink-0">
        <PageHeader
          icon={authorIcon}
          title="Authors Master"
          subtitle="Manage author information and contact details"
          compact
        />
      </div>

      {/* Main Content Card */}
      <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
        {/* Table Section */}
        <div className="p-3 flex-1 min-h-0 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-700">Authors</span>
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
                  placeholder="Author name"
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
            <table className="w-full min-w-[1100px] border-separate border-spacing-0">
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white uppercase tracking-wider text-xs shadow-md">
                  <th className="px-3 py-2 text-left font-medium tracking-wide w-[80px] border border-white/40 rounded-tl-lg">
                    Code
                  </th>
                  <th className="px-3 py-2 text-left font-medium tracking-wide w-[200px] border border-t border-b border-white/40">
                    Author Name
                  </th>
                  <th className="px-3 py-2 text-left font-medium tracking-wide w-[150px] border border-t border-b border-white/40">
                    Contact
                  </th>
                  <th className="px-3 py-2 text-left font-medium tracking-wide w-[200px] border border-t border-b border-white/40">
                    Email
                  </th>
                  <th className="px-3 py-2 text-left font-medium tracking-wide w-[150px] border border-t border-b border-white/40">
                    Address 1
                  </th>
                  <th className="px-3 py-2 text-left font-medium tracking-wide w-[150px] border border-t border-b border-white/40">
                    Address 2
                  </th>
                  <th className="px-3 py-2 text-left font-medium tracking-wide w-[120px] border border-t border-b border-white/40">
                    Phone
                  </th>
                  <th className="px-3 py-2 text-left font-medium tracking-wide w-[100px] border border-t border-b border-white/40">
                    City
                  </th>
                  <th className="px-3 py-2 text-center font-medium w-16 border border-t border-r border-b border-white/40 rounded-tr-lg">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-4 py-8 text-center text-gray-400">
                      {isLoading ? 'Loading authors...' : 'No authors found. Add one below.'}
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
                          value={item.code || ''}
                          onChange={(e) => handleTableInputChange(item.id, 'code', e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, code: e.target.value })}
                          className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                     focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white
                                     transition-all duration-200"
                          placeholder="Code"
                        />
                      </td>
                      <td className="px-2 py-1 border-b border-gray-100">
                        <input
                          type="text"
                          value={item.name || ''}
                          onChange={(e) => handleTableInputChange(item.id, 'name', e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, name: e.target.value })}
                          className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                     focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white
                                     transition-all duration-200"
                          placeholder="Author name"
                        />
                      </td>
                      <td className="px-2 py-1 border-b border-gray-100">
                        <input
                          type="text"
                          value={item.contact || ''}
                          onChange={(e) => handleTableInputChange(item.id, 'contact', e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, contact: e.target.value })}
                          className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                     focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white
                                     transition-all duration-200"
                          placeholder="Contact"
                        />
                      </td>
                      <td className="px-2 py-1 border-b border-gray-100">
                        <input
                          type="text"
                          value={item.email || ''}
                          onChange={(e) => handleTableInputChange(item.id, 'email', e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, email: e.target.value })}
                          className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                     focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white
                                     transition-all duration-200"
                          placeholder="Email"
                        />
                      </td>
                      <td className="px-2 py-1 border-b border-gray-100">
                        <input
                          type="text"
                          value={item.address1 || ''}
                          onChange={(e) => handleTableInputChange(item.id, 'address1', e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, address1: e.target.value })}
                          className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                     focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white
                                     transition-all duration-200"
                          placeholder="Address 1"
                        />
                      </td>
                      <td className="px-2 py-1 border-b border-gray-100">
                        <input
                          type="text"
                          value={item.address2 || ''}
                          onChange={(e) => handleTableInputChange(item.id, 'address2', e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, address2: e.target.value })}
                          className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                     focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white
                                     transition-all duration-200"
                          placeholder="Address 2"
                        />
                      </td>
                      <td className="px-2 py-1 border-b border-gray-100">
                        <input
                          type="text"
                          value={item.phone || ''}
                          onChange={(e) => handleTableInputChange(item.id, 'phone', e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, phone: e.target.value })}
                          className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                     focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white
                                     transition-all duration-200"
                          placeholder="Phone"
                        />
                      </td>
                      <td className="px-2 py-1 border-b border-gray-100">
                        <input
                          type="text"
                          value={item.city || ''}
                          onChange={(e) => handleTableInputChange(item.id, 'city', e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, city: e.target.value })}
                          className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                     focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white
                                     transition-all duration-200"
                          placeholder="City"
                        />
                      </td>
                      <td className="px-2 py-1 border-b border-gray-100 text-center">
                        <button
                          onClick={() => handleDeleteAuthor(item.id)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-red-500
                                     hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Delete author"
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

        {/* Add Author Form */}
        <div className="border-t border-gray-200 bg-gray-50/50 px-4 py-3 flex-shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            <div>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                placeholder="Author code"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div className="md:col-span-2">
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Author name"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
                autoComplete="off"
                onKeyDown={(e) => e.key === 'Enter' && handleAddAuthor()}
              />
            </div>
            <div>
              <input
                type="text"
                name="contact"
                value={formData.contact}
                onChange={handleInputChange}
                placeholder="Contact number"
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
                placeholder="Email address"
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
                placeholder="Address line 1"
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
                placeholder="Address line 2"
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
            <div className="flex justify-end">
              <button
                onClick={handleAddAuthor}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 w-full sm:w-auto
                           text-white text-sm font-medium shadow-lg shadow-blue-500/25
                           hover:from-blue-600 hover:to-indigo-700 active:scale-[0.98] transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Author
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
