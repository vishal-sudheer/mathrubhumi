// src/pages/Masters/TitleMaster.jsx
import React, { useState, useEffect } from 'react';
import { TrashIcon } from '@heroicons/react/24/solid';
import Modal from '../../components/Modal';
import PageHeader from '../../components/PageHeader';
import api from '../../utils/axiosInstance';

export default function TitleMaster() {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    sapCode: '',
    tax: '',
    titleMal: '',
    location: '',
    language: '',
    isbnNo: '',
    roLevel: '',
    dnLevel: '',
    category: '',
    subCategory: '',
    author: '',
    publisher: '',
    translator: '',
    mrp: '',
    authorId: null,
    publisherId: null,
    translatorId: null,
    categoryId: null,
    subCategoryId: null
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // --- Suggestions for the TOP FORM ---
  const [suggestions, setSuggestions] = useState({
    author: [],
    publisher: [],
    translator: [],
    category: [],
    subCategory: []
  });
  const [showSuggestions, setShowSuggestions] = useState({
    author: false,
    publisher: false,
    translator: false,
    category: false,
    subCategory: false
  });
  const [highlightedIndex, setHighlightedIndex] = useState({
    author: -1,
    publisher: -1,
    translator: -1,
    category: -1,
    subCategory: -1
  });

  // --- Suggestions for TABLE CELLS (per-row, per-field) ---
  // keys are `${rowId}:${field}`
  const [rowSuggestions, setRowSuggestions] = useState({});
  const [rowShowSuggestions, setRowShowSuggestions] = useState({});
  const [rowHighlightedIndex, setRowHighlightedIndex] = useState({});

  const suggestableFields = ['author', 'publisher', 'translator', 'category', 'subCategory'];
  const endpointFor = (field) => {
    if (field === 'publisher') return '/auth/publisher-search/';
    if (field === 'category') return '/auth/category-search/';
    if (field === 'subCategory') return '/auth/sub-category-search/';
    // author and translator use authors endpoint
    return '/auth/author-search/';
  };
  const labelFor = (field, row) => {
    if (field === 'publisher') return row.publisher_nm;
    if (field === 'category') return row.category_nm;
    if (field === 'subCategory') return row.sub_category_nm;
    // author or translator
    return row.author_nm;
  };
  const idFieldFor = (field) => {
    if (field === 'publisher') return 'publisherId';
    if (field === 'category') return 'categoryId';
    if (field === 'subCategory') return 'subCategoryId';
    if (field === 'translator') return 'translatorId';
    return 'authorId';
  };
  const emptyIdFor = (field) => (field === 'publisher' || field === 'translator' ? null : 0);
  const fieldLabel = (field) => {
    if (field === 'subCategory') return 'Sub-Category';
    return field.charAt(0).toUpperCase() + field.slice(1);
  };
  const resolveFieldId = async (field, value, existingId) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return { id: emptyIdFor(field) };
    if (existingId != null && existingId !== 0) return { id: existingId };

    const endpoint = endpointFor(field);
    const response = await api.get(`${endpoint}?q=${encodeURIComponent(trimmed)}`);
    const list = Array.isArray(response.data) ? response.data : [];
    const normalized = trimmed.toLowerCase();
    const match = list.find(
      (item) => (labelFor(field, item) || '').trim().toLowerCase() === normalized
    );
    if (!match) {
      return {
        error: `Unable to find ${fieldLabel(field)} "${trimmed}". Please select from suggestions or add it in the relevant master.`
      };
    }
    return { id: match.id };
  };

  const [modal, setModal] = useState({
    isOpen: false,
    message: '',
    type: 'info',
    buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
  });
  const [deleteTitleId, setDeleteTitleId] = useState(null);

  useEffect(() => {
    fetchAllTitles();
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

  /* ---------------- TOP FORM handlers ---------------- */
  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    console.log(`Input changed: ${name} = ${value}`);
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (suggestableFields.includes(name)) {
        next[idFieldFor(name)] = null;
      }
      return next;
    });

    if (['author', 'publisher', 'translator', 'category', 'subCategory'].includes(name)) {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        setSuggestions((prev) => ({ ...prev, [name]: [] }));
        setShowSuggestions((prev) => ({ ...prev, [name]: false }));
        setHighlightedIndex((prev) => ({ ...prev, [name]: -1 }));
      } else {
        try {
          const endpoint = endpointFor(name);
          const response = await api.get(`${endpoint}?q=${encodeURIComponent(trimmed)}`);
          console.log(`Suggestions for ${name}:`, response.data);
          if (response.data && response.data.length > 0) {
            setSuggestions((prev) => ({ ...prev, [name]: response.data }));
            setShowSuggestions((prev) => ({ ...prev, [name]: true }));
            setHighlightedIndex((prev) => ({ ...prev, [name]: -1 }));
          } else {
            setSuggestions((prev) => ({ ...prev, [name]: [] }));
            setShowSuggestions((prev) => ({ ...prev, [name]: false }));
            setHighlightedIndex((prev) => ({ ...prev, [name]: -1 }));
          }
        } catch (error) {
          console.error(`Error fetching ${name} suggestions:`, error);
          setModal({
            isOpen: true,
            message: `Failed to fetch ${name} suggestions: ${error.message}`,
            type: 'error',
            buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
          });
          setSuggestions((prev) => ({ ...prev, [name]: [] }));
          setShowSuggestions((prev) => ({ ...prev, [name]: false }));
          setHighlightedIndex((prev) => ({ ...prev, [name]: -1 }));
        }
      }
    }
  };

  const handleSuggestionClick = (field, suggestion) => {
    let value = '';
    if (field === 'publisher') value = suggestion.publisher_nm;
    else if (field === 'category') value = suggestion.category_nm;
    else if (field === 'subCategory') value = suggestion.sub_category_nm;
    else value = suggestion.author_nm;

    console.log(`Suggestion selected for ${field}:`, value);
    setFormData((prev) => ({ ...prev, [field]: value, [idFieldFor(field)]: suggestion.id }));
    setSuggestions((prev) => ({ ...prev, [field]: [] }));
    setShowSuggestions((prev) => ({ ...prev, [field]: false }));
    setHighlightedIndex((prev) => ({ ...prev, [field]: -1 }));
  };

  const handleKeyDown = (e, field) => {
    if (showSuggestions[field] && suggestions[field].length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const newIndex = prev[field] < suggestions[field].length - 1 ? prev[field] + 1 : 0;
          const el = document.getElementById(`${field}-suggestion-${newIndex}`);
          if (el) el.scrollIntoView({ block: 'nearest' });
          return { ...prev, [field]: newIndex };
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const newIndex = prev[field] > 0 ? prev[field] - 1 : suggestions[field].length - 1;
          const el = document.getElementById(`${field}-suggestion-${newIndex}`);
          if (el) el.scrollIntoView({ block: 'nearest' });
          return { ...prev, [field]: newIndex };
        });
      } else if (e.key === 'Enter' && highlightedIndex[field] >= 0) {
        e.preventDefault();
        handleSuggestionClick(field, suggestions[field][highlightedIndex[field]]);
      } else if (e.key === 'Escape') {
        setShowSuggestions((prev) => ({ ...prev, [field]: false }));
        setSuggestions((prev) => ({ ...prev, [field]: [] }));
        setHighlightedIndex((prev) => ({ ...prev, [field]: -1 }));
      }
    }
  };

  /* ---------------- TABLE handlers ---------------- */
  const handleTableInputChange = async (id, field, value) => {
    console.log(`Table input changed: id=${id}, field=${field}, value=${value}`);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, [field]: value };
        if (suggestableFields.includes(field)) {
          next[idFieldFor(field)] = null;
        }
        return next;
      })
    );

    // Autocomplete for suggestable table fields
    if (suggestableFields.includes(field)) {
      const key = `${id}:${field}`;
      const trimmed = (value || '').trim();
      if (trimmed.length === 0) {
        setRowSuggestions((prev) => ({ ...prev, [key]: [] }));
        setRowShowSuggestions((prev) => ({ ...prev, [key]: false }));
        setRowHighlightedIndex((prev) => ({ ...prev, [key]: -1 }));
        return;
      }
      try {
        const endpoint = endpointFor(field);
        const res = await api.get(`${endpoint}?q=${encodeURIComponent(trimmed)}`);
        const arr = Array.isArray(res.data) ? res.data : [];
        setRowSuggestions((prev) => ({ ...prev, [key]: arr }));
        setRowShowSuggestions((prev) => ({ ...prev, [key]: arr.length > 0 }));
        setRowHighlightedIndex((prev) => ({ ...prev, [key]: -1 }));
      } catch (error) {
        console.error(`Error fetching suggestions for row ${id} field ${field}:`, error);
        setRowSuggestions((prev) => ({ ...prev, [key]: [] }));
        setRowShowSuggestions((prev) => ({ ...prev, [key]: false }));
        setRowHighlightedIndex((prev) => ({ ...prev, [key]: -1 }));
      }
    }
  };

  const handleRowSuggestionClick = (rowId, field, suggestion) => {
    const key = `${rowId}:${field}`;
    const value = labelFor(field, suggestion) || '';
    const idField = idFieldFor(field);
    const currentRow = items.find((it) => it.id === rowId);
    const nextRow = currentRow ? { ...currentRow, [field]: value, [idField]: suggestion.id } : null;
    setItems((prev) =>
      prev.map((it) => (it.id === rowId ? { ...it, [field]: value, [idField]: suggestion.id } : it))
    );
    setRowSuggestions((prev) => ({ ...prev, [key]: [] }));
    setRowShowSuggestions((prev) => ({ ...prev, [key]: false }));
    setRowHighlightedIndex((prev) => ({ ...prev, [key]: -1 }));
    if (nextRow) {
      handleTableUpdate(rowId, nextRow, field);
    }
  };

  const handleRowKeyDown = (e, row, field) => {
    const key = `${row.id}:${field}`;
    const list = rowSuggestions[key] || [];
    const show = rowShowSuggestions[key];
    const hi = rowHighlightedIndex[key] ?? -1;

    if (show && list.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = hi < list.length - 1 ? hi + 1 : 0;
        setRowHighlightedIndex((prev) => ({ ...prev, [key]: next }));
        const el = document.getElementById(`row-sug-${key}-${next}`);
        if (el) el.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = hi > 0 ? hi - 1 : list.length - 1;
        setRowHighlightedIndex((prev) => ({ ...prev, [key]: next }));
        const el = document.getElementById(`row-sug-${key}-${next}`);
        if (el) el.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'Enter' && hi >= 0) {
        e.preventDefault();
        handleRowSuggestionClick(row.id, field, list[hi]);
        return;
      }
      if (e.key === 'Escape') {
        setRowShowSuggestions((prev) => ({ ...prev, [key]: false }));
        setRowSuggestions((prev) => ({ ...prev, [key]: [] }));
        setRowHighlightedIndex((prev) => ({ ...prev, [key]: -1 }));
        return;
      }
    }

    // If no suggestions open or none selected, Enter triggers update
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTableUpdate(row.id, { ...row, [field]: e.currentTarget.value }, field);
    }
  };

  const handleTableUpdate = async (id, updatedItem, changedField = null) => {
    console.log(`Updating item: id=${id}, data=`, updatedItem);
    const currentRow = items.find((item) => item.id === id);
    const saved = currentRow?.saved || updatedItem.saved || {};
    const revertRow = () => {
      if (!currentRow?.saved) return;
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...currentRow, ...currentRow.saved, saved: currentRow.saved } : item))
      );
    };

    // Resolve IDs only for the field being edited; use saved IDs for the rest
    let author_id = saved.authorId ?? emptyIdFor('author');
    let publisher_id = saved.publisherId ?? emptyIdFor('publisher');
    let translator_id = saved.translatorId ?? emptyIdFor('translator');
    let category_id = saved.categoryId ?? emptyIdFor('category');
    let sub_category_id = saved.subCategoryId ?? emptyIdFor('subCategory');
    const resolveOrShowError = async (field, value, existingId) => {
      const result = await resolveFieldId(field, value, existingId);
      if (result.error) {
        setModal({
          isOpen: true,
          message: result.error,
          type: 'error',
          buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
        });
        return null;
      }
      return result.id;
    };
    try {
      if (changedField && suggestableFields.includes(changedField)) {
        if (changedField === 'author') {
          const nextAuthorId = await resolveOrShowError('author', updatedItem.author, updatedItem.authorId);
          if (nextAuthorId == null) {
            revertRow();
            return;
          }
          author_id = nextAuthorId;
        }
        if (changedField === 'publisher') {
          const nextPublisherId = await resolveOrShowError('publisher', updatedItem.publisher, updatedItem.publisherId);
          if (nextPublisherId == null) {
            revertRow();
            return;
          }
          publisher_id = nextPublisherId;
        }
        if (changedField === 'translator') {
          const nextTranslatorId = await resolveOrShowError('translator', updatedItem.translator, updatedItem.translatorId);
          if (nextTranslatorId == null) {
            revertRow();
            return;
          }
          translator_id = nextTranslatorId;
        }
        if (changedField === 'category') {
          const nextCategoryId = await resolveOrShowError('category', updatedItem.category, updatedItem.categoryId);
          if (nextCategoryId == null) {
            revertRow();
            return;
          }
          category_id = nextCategoryId;
        }
        if (changedField === 'subCategory') {
          const nextSubCategoryId = await resolveOrShowError('subCategory', updatedItem.subCategory, updatedItem.subCategoryId);
          if (nextSubCategoryId == null) {
            revertRow();
            return;
          }
          sub_category_id = nextSubCategoryId;
        }
      } else if (changedField == null) {
        // Fallback: resolve all suggestable fields if no specific field is provided
        const nextAuthorId = await resolveOrShowError('author', updatedItem.author, updatedItem.authorId ?? saved.authorId);
        if (nextAuthorId == null) {
          revertRow();
          return;
        }
        author_id = nextAuthorId;

        const nextPublisherId = await resolveOrShowError('publisher', updatedItem.publisher, updatedItem.publisherId ?? saved.publisherId);
        if (nextPublisherId == null) {
          revertRow();
          return;
        }
        publisher_id = nextPublisherId;

        const nextTranslatorId = await resolveOrShowError('translator', updatedItem.translator, updatedItem.translatorId ?? saved.translatorId);
        if (nextTranslatorId == null) {
          revertRow();
          return;
        }
        translator_id = nextTranslatorId;

        const nextCategoryId = await resolveOrShowError('category', updatedItem.category, updatedItem.categoryId ?? saved.categoryId);
        if (nextCategoryId == null) {
          revertRow();
          return;
        }
        category_id = nextCategoryId;

        const nextSubCategoryId = await resolveOrShowError('subCategory', updatedItem.subCategory, updatedItem.subCategoryId ?? saved.subCategoryId);
        if (nextSubCategoryId == null) {
          revertRow();
          return;
        }
        sub_category_id = nextSubCategoryId;
      }
    } catch (error) {
      console.error('Error fetching IDs for update:', error);
      setModal({
        isOpen: true,
        message: `Failed to fetch IDs for update: ${error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      return;
    }

    const language_id = updatedItem.language === 'English' ? 0 : updatedItem.language === 'Malayalam' ? 1 : 0;
    const location_id =
      updatedItem.location === 'Location1' ? 0 :
        updatedItem.location === 'Location2' ? 1 :
          updatedItem.location === 'Location3' ? 2 : 0;

    const payload = {
      id: id,
      title: updatedItem.title,
      author_id,
      language_id,
      title_m: updatedItem.titleMal || null,
      rate: parseFloat(updatedItem.mrp) || 0.00,
      stock: parseFloat(updatedItem.stock) || 0.00,
      tax: parseFloat(updatedItem.tax) || 0.00,
      isbn: updatedItem.isbnNo || null,
      publisher_id,
      translator_id,
      category_id,
      sub_category_id,
      ro_level: parseInt(updatedItem.roLevel) || 0,
      ro_quantity: parseInt(updatedItem.roQuantity) || 0,
      dn_level: parseInt(updatedItem.dnLevel) || 0,
      sap_code: updatedItem.sapCode || null,
      location_id
    };

    console.log('Update payload:', payload);

    try {
      const response = await api.put(`/auth/title-update/${id}/`, payload);
      console.log('Title updated:', response.data);
      const nextRowBase = currentRow || updatedItem;
      const nextRow = {
        ...nextRowBase,
        ...updatedItem,
        author: changedField === 'author' ? updatedItem.author : (saved.author ?? nextRowBase.author),
        publisher: changedField === 'publisher' ? updatedItem.publisher : (saved.publisher ?? nextRowBase.publisher),
        translator: changedField === 'translator' ? updatedItem.translator : (saved.translator ?? nextRowBase.translator),
        category: changedField === 'category' ? updatedItem.category : (saved.category ?? nextRowBase.category),
        subCategory: changedField === 'subCategory' ? updatedItem.subCategory : (saved.subCategory ?? nextRowBase.subCategory),
        authorId: author_id,
        publisherId: publisher_id,
        translatorId: translator_id,
        categoryId: category_id,
        subCategoryId: sub_category_id,
        stock: payload.stock,
        roQuantity: payload.ro_quantity
      };
      const nextSaved = {
        title: nextRow.title,
        language: nextRow.language,
        titleMal: nextRow.titleMal,
        mrp: nextRow.mrp,
        tax: nextRow.tax,
        isbnNo: nextRow.isbnNo,
        roLevel: nextRow.roLevel,
        dnLevel: nextRow.dnLevel,
        sapCode: nextRow.sapCode,
        location: nextRow.location,
        author: nextRow.author,
        authorId: nextRow.authorId,
        publisher: nextRow.publisher,
        publisherId: nextRow.publisherId,
        translator: nextRow.translator,
        translatorId: nextRow.translatorId,
        category: nextRow.category,
        categoryId: nextRow.categoryId,
        subCategory: nextRow.subCategory,
        subCategoryId: nextRow.subCategoryId,
        stock: nextRow.stock,
        roQuantity: nextRow.roQuantity
      };
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...nextRow, saved: nextSaved } : item))
      );
      setModal({
        isOpen: true,
        message: 'Title updated successfully!',
        type: 'success',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
    } catch (error) {
      console.error('Error updating title:', error);
      setModal({
        isOpen: true,
        message: `Failed to update title: ${error.response?.data?.error || error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
    }
  };

  const handleAddItem = async () => {
    if (!formData.code || !formData.title) {
      console.log('Validation failed: code or title is empty');
      setModal({
        isOpen: true,
        message: 'Please fill Code and Title fields',
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      return;
    }

    // Resolve IDs for author, publisher, translator, category, subCategory
    let author_id = 0, publisher_id = null, translator_id = null, category_id = 0, sub_category_id = 0;
    const resolveOrShowError = async (field, value, existingId) => {
      const result = await resolveFieldId(field, value, existingId);
      if (result.error) {
        setModal({
          isOpen: true,
          message: result.error,
          type: 'error',
          buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
        });
        return null;
      }
      return result.id;
    };
    try {
      const nextAuthorId = await resolveOrShowError('author', formData.author, formData.authorId);
      if (nextAuthorId == null) return;
      author_id = nextAuthorId;

      const nextPublisherId = await resolveOrShowError('publisher', formData.publisher, formData.publisherId);
      if (nextPublisherId == null) return;
      publisher_id = nextPublisherId;

      const nextTranslatorId = await resolveOrShowError('translator', formData.translator, formData.translatorId);
      if (nextTranslatorId == null) return;
      translator_id = nextTranslatorId;

      const nextCategoryId = await resolveOrShowError('category', formData.category, formData.categoryId);
      if (nextCategoryId == null) return;
      category_id = nextCategoryId;

      const nextSubCategoryId = await resolveOrShowError('subCategory', formData.subCategory, formData.subCategoryId);
      if (nextSubCategoryId == null) return;
      sub_category_id = nextSubCategoryId;
    } catch (error) {
      console.error('Error fetching IDs:', error);
      setModal({
        isOpen: true,
        message: `Failed to fetch IDs: ${error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      return;
    }

    const language_id = formData.language === 'English' ? 0 : formData.language === 'Malayalam' ? 1 : 0;
    const location_id =
      formData.location === 'Location1' ? 0 :
        formData.location === 'Location2' ? 1 :
          formData.location === 'Location3' ? 2 : 0;

    const payload = {
      id: parseInt(formData.code),
      title: formData.title,
      author_id,
      language_id,
      title_m: formData.titleMal || null,
      rate: parseFloat(formData.mrp) || 0.00,
      stock: 0.000,
      tax: parseFloat(formData.tax) || 0.00,
      isbn: formData.isbnNo || null,
      publisher_id,
      translator_id,
      category_id,
      sub_category_id,
      ro_level: parseInt(formData.roLevel) || 0,
      ro_quantity: 0,
      dn_level: parseInt(formData.dnLevel) || 0,
      sap_code: formData.sapCode || null,
      location_id
    };

    console.log('Form data on submit:', formData);
    console.log('Payload for API:', payload);

    try {
      const response = await api.post('/auth/title-create/', payload);
      console.log('Title created:', response.data);
      setModal({
        isOpen: true,
        message: 'Title added successfully!',
        type: 'success',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      if (page === 1) {
        fetchAllTitles({ page: 1, pageSize });
      } else {
        setPage(1);
      }
    } catch (error) {
      console.error('Error creating title:', error);
      setModal({
        isOpen: true,
        message: `Failed to add title: ${error.response?.data?.error || error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
      return;
    }

    setFormData({
      code: '',
      title: '',
      sapCode: '',
      tax: '',
      titleMal: '',
      location: '',
      language: '',
      isbnNo: '',
      roLevel: '',
      dnLevel: '',
      category: '',
      subCategory: '',
      author: '',
      publisher: '',
      translator: '',
      mrp: '',
      authorId: null,
      publisherId: null,
      translatorId: null,
      categoryId: null,
      subCategoryId: null
    });
    setSuggestions({ author: [], publisher: [], translator: [], category: [], subCategory: [] });
    setShowSuggestions({ author: false, publisher: false, translator: false, category: false, subCategory: false });
    setHighlightedIndex({ author: -1, publisher: -1, translator: -1, category: -1, subCategory: -1 });
  };

  const fetchAllTitles = async (options = {}) => {
    const pageToUse = options.page ?? page;
    const pageSizeToUse = options.pageSize ?? pageSize;
    const queryToUse = options.query ?? searchQuery;
    const trimmedQuery = (queryToUse || '').trim();

    setIsLoading(true);
    try {
      const response = await api.get('/auth/title-search/', {
        params: {
          page: pageToUse,
          page_size: pageSizeToUse,
          ...(trimmedQuery.length >= 2 ? { q: trimmedQuery } : {})
        }
      });
      console.log('Titles fetched:', response.data);
      const payload = response.data || {};
      const results = Array.isArray(payload) ? payload : (payload.results || []);
      const total = Array.isArray(payload) ? results.length : (payload.total ?? results.length);
      const nextTotalPages = Math.max(1, Math.ceil(total / pageSizeToUse));

      if (pageToUse > nextTotalPages) {
        setTotalCount(total);
        setPage(nextTotalPages);
        return;
      }

      const fetchedItems = results.map((item) => {
        const nextItem = {
          id: item.id,
          code: item.id?.toString() || '',
          title: item.title || '',
          sapCode: item.sap_code || '',
          tax: item.tax != null ? item.tax.toString() : '',
          titleMal: item.title_m || '',
          location:
            item.location_id === 0 ? 'Location1' :
              item.location_id === 1 ? 'Location2' :
                item.location_id === 2 ? 'Location3' : '',
          language:
            item.language_id === 0 ? 'English' :
              item.language_id === 1 ? 'Malayalam' : '',
          isbnNo: item.isbn || '',
          roLevel: item.ro_level != null ? item.ro_level.toString() : '',
          dnLevel: item.dn_level != null ? item.dn_level.toString() : '',
          category: item.category_nm || '',
          subCategory: item.sub_category_nm || '',
          author: item.author_nm || '',
          publisher: item.publisher_nm || '',
          translator: item.translator_nm || '',
          mrp: item.rate != null ? item.rate.toString() : '',
          authorId: item.author_id ?? 0,
          publisherId: item.publisher_id ?? null,
          translatorId: item.translator_id ?? null,
          categoryId: item.category_id ?? 0,
          subCategoryId: item.sub_category_id ?? 0,
          stock: item.stock ?? 0,
          roQuantity: item.ro_quantity ?? 0
        };
        return { ...nextItem, saved: { ...nextItem } };
      });
      setItems(fetchedItems);
      setTotalCount(total);
      console.log('Updated items state:', fetchedItems);
    } catch (error) {
      console.error('Error fetching titles:', error);
      setModal({
        isOpen: true,
        message: `Failed to load titles: ${error.response?.data?.error || error.message}`,
        type: 'error',
        buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = (id) => {
    console.log(`Deleting item: id=${id}`);
    setDeleteTitleId(id);
    setModal({
      isOpen: true,
      message: 'Are you sure you want to delete this title?',
      type: 'warning',
      buttons: [
        {
          label: 'Delete',
          onClick: async () => {
            try {
              await api.delete(`/auth/title-delete/${id}/`);
              await fetchAllTitles({ page, pageSize });
              setModal({
                isOpen: true,
                message: 'Title deleted successfully!',
                type: 'success',
                buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
              });
            } catch (error) {
              setModal({
                isOpen: true,
                message: `Failed to delete title: ${error.response?.data?.error || error.message}`,
                type: 'error',
                buttons: [{ label: 'OK', onClick: () => setModal((prev) => ({ ...prev, isOpen: false })), className: 'bg-blue-500 hover:bg-blue-600' }]
              });
            }
            setDeleteTitleId(null);
          },
          className: 'bg-red-500 hover:bg-red-600'
        },
        {
          label: 'Cancel',
          onClick: () => {
            setModal((prev) => ({ ...prev, isOpen: false }));
            setDeleteTitleId(null);
          },
          className: 'bg-gray-500 hover:bg-gray-600'
        }
      ]
    });
  };

  const titleIcon = (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a2 2 0 012-2h8a2 2 0 012 2v14l-5-3-5 3V5z" />
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
          icon={titleIcon}
          title="Title Master"
          subtitle="Manage titles and metadata"
          compact
        />
      </div>

      <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-3 flex-1 min-h-0 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-700">Titles</span>
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
                  placeholder="Title"
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
            <div className="min-w-[2150px]">
              <table className="w-full table-fixed border-separate border-spacing-0">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white uppercase tracking-wider text-xs shadow-md">
                    <th className="w-[100px] px-3 py-2 text-left font-medium tracking-wide border border-white/40 rounded-tl-lg">Code</th>
                    <th className="w-[350px] px-3 py-2 text-left font-medium tracking-wide border border-t border-b border-white/40">Title</th>
                    <th className="w-[120px] px-3 py-2 text-left font-medium tracking-wide border border-t border-b border-white/40">Language</th>
                    <th className="w-[200px] px-3 py-2 text-left font-medium tracking-wide border border-t border-b border-white/40">Author</th>
                    <th className="w-[200px] px-3 py-2 text-left font-medium tracking-wide border border-t border-b border-white/40">Publisher</th>
                    <th className="w-[200px] px-3 py-2 text-left font-medium tracking-wide border border-t border-b border-white/40">Translator</th>
                    <th className="w-[120px] px-3 py-2 text-left font-medium tracking-wide border border-t border-b border-white/40">Category</th>
                    <th className="w-[175px] px-3 py-2 text-left font-medium tracking-wide border border-t border-b border-white/40">Sub-Category</th>
                    <th className="w-[120px] px-3 py-2 text-left font-medium tracking-wide border border-t border-b border-white/40">ISBN No.</th>
                    <th className="w-[100px] px-3 py-2 text-left font-medium tracking-wide border border-t border-b border-white/40">R O Level</th>
                    <th className="w-[100px] px-3 py-2 text-left font-medium tracking-wide border border-t border-b border-white/40">Dn Level</th>
                    <th className="w-[300px] px-3 py-2 text-left font-medium tracking-wide border border-t border-b border-white/40">Title (Mal)</th>
                    <th className="w-[64px] px-3 py-2 text-center font-medium border border-t border-r border-b border-white/40 rounded-tr-lg">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="13" className="px-4 py-8 text-center text-gray-400">
                        {isLoading ? 'Loading titles...' : 'No titles found. Add one below.'}
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => {
                      const keyFor = (field) => `${item.id}:${field}`;
                      return (
                        <tr key={item.id} className="hover:bg-blue-50/50 transition-colors animate-fade-in" style={{ animationDelay: `${index * 30}ms` }}>
                          <td className="px-2 py-1 border-b border-gray-100 w-[100px]">
                            <input
                              type="text"
                              value={item.code || ''}
                              readOnly
                              className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-100 text-gray-500 text-sm cursor-not-allowed"
                            />
                          </td>
                          <td className="px-2 py-1 border-b border-gray-100 w-[300px]">
                            <input
                              type="text"
                              value={item.title || ''}
                              onChange={(e) => handleTableInputChange(item.id, 'title', e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, title: e.target.value }, 'title')}
                              onBlur={(e) => handleTableUpdate(item.id, { ...item, title: e.target.value }, 'title')}
                              className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white transition-all duration-200"
                            />
                          </td>
                          <td className="px-2 py-1 border-b border-gray-100 w-[120px]">
                            <input
                              type="text"
                              value={item.language || ''}
                              onChange={(e) => handleTableInputChange(item.id, 'language', e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, language: e.target.value }, 'language')}
                              onBlur={(e) => handleTableUpdate(item.id, { ...item, language: e.target.value }, 'language')}
                              className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white transition-all duration-200"
                            />
                          </td>

                          {/* Author (suggestion) */}
                          <td className="px-2 py-1 border-b border-gray-100 w-[150px]">
                            <div className="relative">
                              <input
                                type="text"
                                value={item.author || ''}
                                onChange={(e) => handleTableInputChange(item.id, 'author', e.target.value)}
                                onKeyDown={(e) => handleRowKeyDown(e, item, 'author')}
                                onBlur={(e) => handleTableUpdate(item.id, { ...item, author: e.target.value }, 'author')}
                                className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white transition-all duration-200"
                                autoComplete="off"
                              />
                              {rowShowSuggestions[keyFor('author')] &&
                                (rowSuggestions[keyFor('author')] || []).length > 0 &&
                                (item.author || '').trim() && (
                                  <ul className="absolute z-20 bg-white border mt-1 w-full shadow-md rounded-lg text-sm max-h-48 overflow-y-auto">
                                    {(rowSuggestions[keyFor('author')] || []).map((sug, i) => (
                                      <li
                                        key={`${sug.id}-author-${i}`}
                                        id={`row-sug-${keyFor('author')}-${i}`}
                                        className={`px-3 py-1 cursor-pointer ${(rowHighlightedIndex[keyFor('author')] ?? -1) === i ? 'bg-gray-200' : 'hover:bg-gray-100'
                                          }`}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          handleRowSuggestionClick(item.id, 'author', sug);
                                        }}
                                      >
                                        {sug.author_nm}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                            </div>
                          </td>

                          {/* Publisher (suggestion) */}
                          <td className="px-2 py-1 border-b border-gray-100 w-[150px]">
                            <div className="relative">
                              <input
                                type="text"
                                value={item.publisher || ''}
                                onChange={(e) => handleTableInputChange(item.id, 'publisher', e.target.value)}
                                onKeyDown={(e) => handleRowKeyDown(e, item, 'publisher')}
                                onBlur={(e) => handleTableUpdate(item.id, { ...item, publisher: e.target.value }, 'publisher')}
                                className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white transition-all duration-200"
                                autoComplete="off"
                              />
                              {rowShowSuggestions[keyFor('publisher')] &&
                                (rowSuggestions[keyFor('publisher')] || []).length > 0 &&
                                (item.publisher || '').trim() && (
                                  <ul className="absolute z-20 bg-white border mt-1 w-full shadow-md rounded-lg text-sm max-h-48 overflow-y-auto">
                                    {(rowSuggestions[keyFor('publisher')] || []).map((sug, i) => (
                                      <li
                                        key={`${sug.id}-publisher-${i}`}
                                        id={`row-sug-${keyFor('publisher')}-${i}`}
                                        className={`px-3 py-1 cursor-pointer ${(rowHighlightedIndex[keyFor('publisher')] ?? -1) === i ? 'bg-gray-200' : 'hover:bg-gray-100'
                                          }`}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          handleRowSuggestionClick(item.id, 'publisher', sug);
                                        }}
                                      >
                                        {sug.publisher_nm}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                            </div>
                          </td>

                          {/* Translator (suggestion) */}
                          <td className="px-2 py-1 border-b border-gray-100 w-[150px]">
                            <div className="relative">
                              <input
                                type="text"
                                value={item.translator || ''}
                                onChange={(e) => handleTableInputChange(item.id, 'translator', e.target.value)}
                                onKeyDown={(e) => handleRowKeyDown(e, item, 'translator')}
                                onBlur={(e) => handleTableUpdate(item.id, { ...item, translator: e.target.value }, 'translator')}
                                className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white transition-all duration-200"
                                autoComplete="off"
                              />
                              {rowShowSuggestions[keyFor('translator')] &&
                                (rowSuggestions[keyFor('translator')] || []).length > 0 &&
                                (item.translator || '').trim() && (
                                  <ul className="absolute z-20 bg-white border mt-1 w-full shadow-md rounded-lg text-sm max-h-48 overflow-y-auto">
                                    {(rowSuggestions[keyFor('translator')] || []).map((sug, i) => (
                                      <li
                                        key={`${sug.id}-translator-${i}`}
                                        id={`row-sug-${keyFor('translator')}-${i}`}
                                        className={`px-3 py-1 cursor-pointer ${(rowHighlightedIndex[keyFor('translator')] ?? -1) === i ? 'bg-gray-200' : 'hover:bg-gray-100'
                                          }`}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          handleRowSuggestionClick(item.id, 'translator', sug);
                                        }}
                                      >
                                        {sug.author_nm}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                            </div>
                          </td>

                          {/* Category (suggestion) */}
                          <td className="px-2 py-1 border-b border-gray-100 w-[120px]">
                            <div className="relative">
                              <input
                                type="text"
                                value={item.category || ''}
                                onChange={(e) => handleTableInputChange(item.id, 'category', e.target.value)}
                                onKeyDown={(e) => handleRowKeyDown(e, item, 'category')}
                                onBlur={(e) => handleTableUpdate(item.id, { ...item, category: e.target.value }, 'category')}
                                className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white transition-all duration-200"
                                autoComplete="off"
                              />
                              {rowShowSuggestions[keyFor('category')] &&
                                (rowSuggestions[keyFor('category')] || []).length > 0 &&
                                (item.category || '').trim() && (
                                  <ul className="absolute z-20 bg-white border mt-1 w-full shadow-md rounded-lg text-sm max-h-48 overflow-y-auto">
                                    {(rowSuggestions[keyFor('category')] || []).map((sug, i) => (
                                      <li
                                        key={`${sug.id}-category-${i}`}
                                        id={`row-sug-${keyFor('category')}-${i}`}
                                        className={`px-3 py-1 cursor-pointer ${(rowHighlightedIndex[keyFor('category')] ?? -1) === i ? 'bg-gray-200' : 'hover:bg-gray-100'
                                          }`}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          handleRowSuggestionClick(item.id, 'category', sug);
                                        }}
                                      >
                                        {sug.category_nm}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                            </div>
                          </td>

                          {/* Sub-Category (suggestion) */}
                          <td className="px-2 py-1 border-b border-gray-100 w-[120px]">
                            <div className="relative">
                              <input
                                type="text"
                                value={item.subCategory || ''}
                                onChange={(e) => handleTableInputChange(item.id, 'subCategory', e.target.value)}
                                onKeyDown={(e) => handleRowKeyDown(e, item, 'subCategory')}
                                onBlur={(e) => handleTableUpdate(item.id, { ...item, subCategory: e.target.value }, 'subCategory')}
                                className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white transition-all duration-200"
                                autoComplete="off"
                              />
                              {rowShowSuggestions[keyFor('subCategory')] &&
                                (rowSuggestions[keyFor('subCategory')] || []).length > 0 &&
                                (item.subCategory || '').trim() && (
                                  <ul className="absolute z-20 bg-white border mt-1 w-full shadow-md rounded-lg text-sm max-h-48 overflow-y-auto">
                                    {(rowSuggestions[keyFor('subCategory')] || []).map((sug, i) => (
                                      <li
                                        key={`${sug.id}-subcategory-${i}`}
                                        id={`row-sug-${keyFor('subCategory')}-${i}`}
                                        className={`px-3 py-1 cursor-pointer ${(rowHighlightedIndex[keyFor('subCategory')] ?? -1) === i ? 'bg-gray-200' : 'hover:bg-gray-100'
                                          }`}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          handleRowSuggestionClick(item.id, 'subCategory', sug);
                                        }}
                                      >
                                        {sug.sub_category_nm}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                            </div>
                          </td>

                          <td className="px-2 py-1 border-b border-gray-100 w-[120px]">
                            <input
                              type="text"
                              value={item.isbnNo || ''}
                              onChange={(e) => handleTableInputChange(item.id, 'isbnNo', e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, isbnNo: e.target.value }, 'isbnNo')}
                              onBlur={(e) => handleTableUpdate(item.id, { ...item, isbnNo: e.target.value }, 'isbnNo')}
                              className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white transition-all duration-200"
                            />
                          </td>
                          <td className="px-2 py-1 border-b border-gray-100 w-[100px]">
                            <input
                              type="number"
                              value={item.roLevel || ''}
                              onChange={(e) => handleTableInputChange(item.id, 'roLevel', e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, roLevel: e.target.value }, 'roLevel')}
                              onBlur={(e) => handleTableUpdate(item.id, { ...item, roLevel: e.target.value }, 'roLevel')}
                              className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white transition-all duration-200"
                            />
                          </td>
                          <td className="px-2 py-1 border-b border-gray-100 w-[100px]">
                            <input
                              type="number"
                              value={item.dnLevel || ''}
                              onChange={(e) => handleTableInputChange(item.id, 'dnLevel', e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, dnLevel: e.target.value }, 'dnLevel')}
                              onBlur={(e) => handleTableUpdate(item.id, { ...item, dnLevel: e.target.value }, 'dnLevel')}
                              className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white transition-all duration-200"
                            />
                          </td>
                          <td className="px-2 py-1 border-b border-gray-100 w-[300px]">
                            <input
                              type="text"
                              value={item.titleMal || ''}
                              onChange={(e) => handleTableInputChange(item.id, 'titleMal', e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleTableUpdate(item.id, { ...item, titleMal: e.target.value }, 'titleMal')}
                              onBlur={(e) => handleTableUpdate(item.id, { ...item, titleMal: e.target.value }, 'titleMal')}
                              className="w-full px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400/60 focus:border-blue-400 focus:bg-white transition-all duration-200"
                            />
                          </td>
                          <td className="px-2 py-1 border-b border-gray-100 text-center w-[64px]">
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Delete item"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 bg-gray-50/50 px-3 py-2 flex-shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2">
            <div>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                placeholder="Code"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                         transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Title"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                         transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div>
              <input
                type="text"
                name="sapCode"
                value={formData.sapCode}
                onChange={handleInputChange}
                placeholder="SAP Code"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                         transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div>
              <input
                type="number"
                name="tax"
                value={formData.tax}
                onChange={handleInputChange}
                placeholder="Tax %"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                         transition-all duration-200 input-premium"
                step="0.01"
                autoComplete="off"
              />
            </div>
            <div>
              <select
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                         transition-all duration-200 input-premium"
              >
                <option value="" disabled>Location</option>
                <option value="Location1">Location1</option>
                <option value="Location2">Location2</option>
                <option value="Location3">Location3</option>
              </select>
            </div>
            <div>
              <select
                name="language"
                value={formData.language}
                onChange={handleInputChange}
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                         transition-all duration-200 input-premium"
              >
                <option value="" disabled>Language</option>
                <option value="English">English</option>
                <option value="Malayalam">Malayalam</option>
              </select>
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <input
                type="text"
                name="titleMal"
                value={formData.titleMal}
                onChange={handleInputChange}
                placeholder="Title (Mal)"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                         transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div>
              <input
                type="text"
                name="isbnNo"
                value={formData.isbnNo}
                onChange={handleInputChange}
                placeholder="ISBN No."
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                         transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div>
              <input
                type="number"
                name="roLevel"
                value={formData.roLevel}
                onChange={handleInputChange}
                placeholder="R O Level"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                         transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>
            <div>
              <input
                type="number"
                name="dnLevel"
                value={formData.dnLevel}
                onChange={handleInputChange}
                placeholder="Dn Level"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                         transition-all duration-200 input-premium"
                autoComplete="off"
              />
            </div>

            <div className="relative">
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                onKeyDown={(e) => handleKeyDown(e, 'category')}
                placeholder="Category"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                         transition-all duration-200 input-premium"
                autoComplete="off"
              />
              {showSuggestions.category && suggestions.category.length > 0 && formData.category.trim() && (
                <ul className="absolute z-10 bg-white border bottom-full mb-1 w-full shadow-md rounded-lg text-sm max-h-48 overflow-y-auto">
                  {suggestions.category.map((suggestion, index) => (
                    <li
                      key={suggestion.id}
                      id={`category-suggestion-${index}`}
                      className={`px-3 py-1 cursor-pointer ${highlightedIndex.category === index ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSuggestionClick('category', suggestion);
                      }}
                    >
                      {suggestion.category_nm}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="relative md:col-span-2 lg:col-span-2">
              <input
                type="text"
                name="subCategory"
                value={formData.subCategory}
                onChange={handleInputChange}
                onKeyDown={(e) => handleKeyDown(e, 'subCategory')}
                placeholder="Sub-Category"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                         transition-all duration-200 input-premium"
                autoComplete="off"
              />
              {showSuggestions.subCategory && suggestions.subCategory.length > 0 && formData.subCategory.trim() && (
                <ul className="absolute z-10 bg-white border bottom-full mb-1 w-full shadow-md rounded-lg text-sm max-h-48 overflow-y-auto">
                  {suggestions.subCategory.map((suggestion, index) => (
                    <li
                      key={suggestion.id}
                      id={`subCategory-suggestion-${index}`}
                      className={`px-3 py-1 cursor-pointer ${highlightedIndex.subCategory === index ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSuggestionClick('subCategory', suggestion);
                      }}
                    >
                      {suggestion.sub_category_nm}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="relative md:col-span-2 lg:col-span-2">
              <input
                type="text"
                name="author"
                value={formData.author}
                onChange={handleInputChange}
                onKeyDown={(e) => handleKeyDown(e, 'author')}
                placeholder="Author"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                         transition-all duration-200 input-premium"
                autoComplete="off"
              />
              {showSuggestions.author && suggestions.author.length > 0 && formData.author.trim() && (
                <ul className="absolute z-10 bg-white border bottom-full mb-1 w-full shadow-md rounded-lg text-sm max-h-48 overflow-y-auto">
                  {suggestions.author.map((suggestion, index) => (
                    <li
                      key={suggestion.id}
                      id={`author-suggestion-${index}`}
                      className={`px-3 py-1 cursor-pointer ${highlightedIndex.author === index ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSuggestionClick('author', suggestion);
                      }}
                    >
                      {suggestion.author_nm}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="relative md:col-span-2 lg:col-span-2">
              <input
                type="text"
                name="publisher"
                value={formData.publisher}
                onChange={handleInputChange}
                onKeyDown={(e) => handleKeyDown(e, 'publisher')}
                placeholder="Publisher"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                         transition-all duration-200 input-premium"
                autoComplete="off"
              />
              {showSuggestions.publisher && suggestions.publisher.length > 0 && formData.publisher.trim() && (
                <ul className="absolute z-10 bg-white border bottom-full mb-1 w-full shadow-md rounded-lg text-sm max-h-48 overflow-y-auto">
                  {suggestions.publisher.map((suggestion, index) => (
                    <li
                      key={suggestion.id}
                      id={`publisher-suggestion-${index}`}
                      className={`px-3 py-1 cursor-pointer ${highlightedIndex.publisher === index ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSuggestionClick('publisher', suggestion);
                      }}
                    >
                      {suggestion.publisher_nm}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="relative md:col-span-2 lg:col-span-2">
              <input
                type="text"
                name="translator"
                value={formData.translator}
                onChange={handleInputChange}
                onKeyDown={(e) => handleKeyDown(e, 'translator')}
                placeholder="Translator"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                         transition-all duration-200 input-premium"
                autoComplete="off"
              />
              {showSuggestions.translator && suggestions.translator.length > 0 && formData.translator.trim() && (
                <ul className="absolute z-10 bg-white border bottom-full mb-1 w-full shadow-md rounded-lg text-sm max-h-48 overflow-y-auto">
                  {suggestions.translator.map((suggestion, index) => (
                    <li
                      key={suggestion.id}
                      id={`translator-suggestion-${index}`}
                      className={`px-3 py-1 cursor-pointer ${highlightedIndex.translator === index ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSuggestionClick('translator', suggestion);
                      }}
                    >
                      {suggestion.author_nm}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <input
                type="number"
                name="mrp"
                value={formData.mrp}
                onChange={handleInputChange}
                placeholder="MRP"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400
                         transition-all duration-200 input-premium"
                step="0.01"
                autoComplete="off"
              />
            </div>

            <div className="flex justify-end md:col-span-2 lg:col-span-1">
              <button
                onClick={handleAddItem}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 w-full sm:w-auto
                         text-white text-sm font-medium shadow-lg shadow-blue-500/25
                         hover:from-blue-600 hover:to-indigo-700 active:scale-[0.98] transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Title
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
