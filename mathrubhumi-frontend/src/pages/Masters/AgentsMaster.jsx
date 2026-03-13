import React, { useState, useEffect } from 'react';
import { TrashIcon } from '@heroicons/react/24/solid';
import Modal from '../../components/Modal';
import PageHeader from '../../components/PageHeader';
import api from '../../utils/axiosInstance';

export default function AgentsMaster() {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({
    agentName: '',
    address1: '',
    address2: '',
    city: '',
    telephone: '',
    contact: '',
    email: ''
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
  const [deleteAgentId, setDeleteAgentId] = useState(null);

  useEffect(() => {
    fetchAllAgents();
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
      agent_nm: updatedItem.agentName || '',
      address1: updatedItem.address1 || null,
      address2: updatedItem.address2 || null,
      city: updatedItem.city || null,
      telephone: updatedItem.telephone || null,
      contact: updatedItem.contact || null,
      email: updatedItem.email || null
    };
    try {
      const response = await api.put(`/auth/agent-update/${id}/`, payload);
      setModal({
        isOpen: true,
        message: 'Agent updated successfully!',
        type: 'success',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
    } catch (error) {
      console.error('Error updating agent:', error);
      setModal({
        isOpen: true,
        message: `Failed to update agent: ${error.response?.data?.error || error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
    }
  };

  const handleAddAgent = async () => {
    if (!formData.agentName) {
      setModal({
        isOpen: true,
        message: 'Please fill Agent Name field',
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      return;
    }

    const payload = {
      agent_nm: formData.agentName,
      address1: formData.address1 || null,
      address2: formData.address2 || null,
      city: formData.city || null,
      telephone: formData.telephone || null,
      contact: formData.contact || null,
      email: formData.email || null
    };
    try {
      const response = await api.post('/auth/agent-create/', payload);
      setModal({
        isOpen: true,
        message: 'Agent added successfully!',
        type: 'success',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      if (page === 1) {
        fetchAllAgents({ page: 1, pageSize });
      } else {
        setPage(1);
      }
      setFormData({
        agentName: '',
        address1: '',
        address2: '',
        city: '',
        telephone: '',
        contact: '',
        email: ''
      });
    } catch (error) {
      console.error('Error creating agent:', error);
      setModal({
        isOpen: true,
        message: `Failed to add agent: ${error.response?.data?.error || error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      return;
    }
  };

  const handleDeleteAgent = (id) => {
    setDeleteAgentId(id);
    setModal({
      isOpen: true,
      message: 'Are you sure you want to delete this agent?',
      type: 'warning',
      buttons: [
        {
          label: 'Confirm',
          onClick: async () => {
            try {
              const response = await api.delete(`/auth/agent-delete/${id}/`);
              await fetchAllAgents({ page, pageSize });
              setModal({
                isOpen: true,
                message: 'Agent deleted successfully!',
                type: 'success',
                buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
              });
            } catch (error) {
              console.error('Error deleting agent:', error);
              setModal({
                isOpen: true,
                message: `Failed to delete agent: ${error.response?.data?.error || error.message}`,
                type: 'error',
                buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
              });
            }
            setDeleteAgentId(null);
          },
          className: 'bg-red-500 hover:bg-red-600'
        },
        {
          label: 'Cancel',
          onClick: () => {
            setModal((prev) => ({ ...prev, isOpen: false }));
            setDeleteAgentId(null);
          },
          className: 'bg-gray-500 hover:bg-gray-600'
        }
      ]
    });
  };

  const fetchAllAgents = async (options = {}) => {
    const pageToUse = options.page ?? page;
    const pageSizeToUse = options.pageSize ?? pageSize;
    const queryToUse = options.query ?? searchQuery;
    const trimmedQuery = (queryToUse || '').trim();

    setIsLoading(true);
    try {
      const response = await api.get(`/auth/agents-master-search/`, {
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
        agentName: item.agent_nm || '',
        address1: item.address1 || '',
        address2: item.address2 || '',
        city: item.city || '',
        telephone: item.telephone || '',
        contact: item.contact || '',
        email: item.email || ''
      }));
      setItems(fetchedItems);
      setTotalCount(total);
    } catch (error) {
      console.error('Error fetching agents:', error);
      setModal({
        isOpen: true,
        message: `Failed to load agents: ${error.response?.data?.error || error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Agent icon for header
  const agentIcon = (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
          icon={agentIcon}
          title="Agents Master"
          subtitle="Manage agent information and contacts"
          compact
        />
      </div>

      {/* Main Content Card */}
      <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
        {/* Table Section */}
        <div className="p-3 flex-1 min-h-0 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-700">Agents</span>
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
                  placeholder="Agent name"
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
            <div className="min-w-[900px]">
              <table className="w-full table-fixed border-separate border-spacing-0">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white uppercase tracking-wider text-xs shadow-md">
                    <th className="w-[200px] px-3 py-2 text-left font-medium tracking-wide border border-white/40 rounded-tl-lg">Agent Name</th>
                    <th className="w-[150px] px-3 py-2 text-left font-medium tracking-wide border border-t border-b border-white/40">Address 1</th>
                    <th className="w-[150px] px-3 py-2 text-left font-medium tracking-wide border border-t border-b border-white/40">Address 2</th>
                    <th className="w-[100px] px-3 py-2 text-left font-medium tracking-wide border border-t border-b border-white/40">City</th>
                    <th className="w-[120px] px-3 py-2 text-left font-medium tracking-wide border border-t border-b border-white/40">Telephone</th>
                    <th className="w-[120px] px-3 py-2 text-left font-medium tracking-wide border border-t border-b border-white/40">Contact</th>
                    <th className="w-[200px] px-3 py-2 text-left font-medium tracking-wide border border-t border-b border-white/40">Email</th>
                    <th className="w-[64px] px-3 py-2 text-center font-medium border border-t border-r border-b border-white/40 rounded-tr-lg">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-4 py-8 text-center text-gray-400">
                        {isLoading ? 'Loading agents...' : 'No agents found. Add one below.'}
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
                            value={item.agentName || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'agentName', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, agentName: e.target.value })}
                            className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                            placeholder="Agent name"
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
                            value={item.city || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'city', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, city: e.target.value })}
                            className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                            placeholder="City"
                          />
                        </td>
                        <td className="px-2 py-1 border-b border-gray-100">
                          <input
                            type="text"
                            value={item.telephone || ''}
                            onChange={(e) => handleTableInputChange(item.id, 'telephone', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, telephone: e.target.value })}
                            className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm
                                       focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white
                                       transition-all duration-200"
                            placeholder="Telephone"
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
                        <td className="px-2 py-1 border-b border-gray-100 text-center w-[64px]">
                          <button
                            onClick={() => handleDeleteAgent(item.id)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-red-500
                                       hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete agent"
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
        </div>

        {/* Add Agent Form */}
        <div className="border-t border-gray-200 bg-gray-50/50 px-3 py-2 flex-shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="md:col-span-2">
              <input
                type="text"
                name="agentName"
                value={formData.agentName}
                onChange={handleInputChange}
                placeholder="Agent name"
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
                autoComplete="off"
                onKeyDown={(e) => e.key === 'Enter' && handleAddAgent()}
              />
            </div>
            <div className="md:col-span-2">
              <input
                type="text"
                name="address1"
                value={formData.address1}
                onChange={handleInputChange}
                placeholder="Address 1"
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
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
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
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
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div>
              <input
                type="text"
                name="telephone"
                value={formData.telephone}
                onChange={handleInputChange}
                placeholder="Telephone"
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div>
              <input
                type="text"
                name="contact"
                value={formData.contact}
                onChange={handleInputChange}
                placeholder="Contact"
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
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
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                           transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleAddAgent}
                className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 w-full sm:w-auto
                           text-white text-sm font-medium shadow-lg shadow-blue-500/25
                           hover:from-blue-600 hover:to-indigo-700 active:scale-[0.98] transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Agent
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
