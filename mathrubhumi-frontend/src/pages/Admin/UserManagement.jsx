import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  CheckBadgeIcon,
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserCircleIcon,
  UserPlusIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Modal from "../../components/Modal";
import PageHeader from "../../components/PageHeader";
import api from "../../utils/axiosInstance";
import { getSession } from "../../utils/session";

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm transition focus:border-blue-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10";

const SECONDARY_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60";

const roleBadgeClass = (role) => {
  if (String(role).toLowerCase() === "manager") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (String(role).toLowerCase() === "admin") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-700";
};

const statusBadgeClass = (active) =>
  active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700";

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${roleBadgeClass(role)}`}>
      {role || "Staff"}
    </span>
  );
}

function StatusBadge({ active }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(active)}`}>
      {active ? "Active" : "Disabled"}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, helper, iconClass }) {
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</div>
          <div className="mt-2 text-[2rem] font-semibold tracking-tight text-slate-900 leading-none">{value}</div>
          <div className="mt-2 text-xs leading-5 text-slate-500">{helper}</div>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function BranchPickerSection({
  label,
  query,
  setQuery,
  pickerOpen,
  setPickerOpen,
  onKeyDown,
  placeholder,
  suggestions,
  filteredCount,
  loading,
  addBranch,
  selectedIds,
  removeBranchId,
  branchNameById,
  activeSuggestionIndex,
  selectAll,
  clearAll,
  helperText,
  errorText,
  inputId,
  suggestionId,
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-slate-700" htmlFor={inputId}>
          {label}
        </label>
        <div className="text-xs text-slate-500">{selectedIds.length} selected</div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <MagnifyingGlassIcon className="h-4.5 w-4.5 text-slate-400" />
          </div>
          <input
            id={inputId}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPickerOpen(true);
            }}
            onFocus={() => setPickerOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={`${INPUT_CLASS} pl-10`}
            disabled={loading}
            role="combobox"
            aria-expanded={pickerOpen}
            aria-controls={suggestionId}
            aria-autocomplete="list"
          />

          {pickerOpen && !loading && (
            <div
              className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60"
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="max-h-64 overflow-auto" id={suggestionId} role="listbox">
                {suggestions.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-600">
                    {query.trim() ? "No branches found." : "Type to search branches."}
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {suggestions.map((branch, index) => {
                      const active = index === activeSuggestionIndex;
                      return (
                        <li key={branch.id} role="option" aria-selected={active}>
                          <button
                            type="button"
                            onClick={() => addBranch(branch)}
                            className={`w-full px-4 py-3 text-left transition ${
                              active ? "bg-blue-50" : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="text-sm font-medium text-slate-900">{branch.branches_nm}</div>
                            <div className="text-xs text-slate-500">#{branch.id}</div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-2">
                <div className="text-xs text-slate-500">
                  Showing {Math.min(suggestions.length, 50)} of {filteredCount}
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="text-xs font-medium text-slate-700 transition hover:text-slate-900"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={selectAll} className={SECONDARY_BUTTON_CLASS} disabled={loading}>
            Select all
          </button>
          <button
            type="button"
            onClick={clearAll}
            className={SECONDARY_BUTTON_CLASS}
            disabled={selectedIds.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-2.5">
        {selectedIds.length === 0 ? (
          <div className="text-sm text-slate-600">No branches selected.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedIds
              .slice()
              .sort((a, b) => Number(a) - Number(b))
              .map((branchId) => (
                <span
                  key={branchId}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm"
                  title={branchNameById.get(Number(branchId)) || `Branch #${branchId}`}
                >
                  <span className="max-w-[220px] truncate">
                    {branchNameById.get(Number(branchId)) || `Branch #${branchId}`}
                  </span>
                  <button
                    type="button"
                    className="text-slate-400 transition hover:text-slate-700"
                    onClick={() => removeBranchId(branchId)}
                    aria-label="Remove branch"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </span>
              ))}
          </div>
        )}
      </div>

      {(helperText || errorText) && (
        <div className={`text-xs ${errorText ? "text-rose-600" : "text-slate-500"}`}>
          {errorText || helperText}
        </div>
      )}
    </div>
  );
}

export default function UserManagement() {
  const { user } = getSession();
  const isAdmin = Boolean(user?.is_admin || String(user?.role || "").toLowerCase() === "admin");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [users, setUsers] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [branchQuery, setBranchQuery] = useState("");
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [actionMenuUserId, setActionMenuUserId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    name: "",
    email: "",
    role: "Manager",
    branchIds: [],
  });
  const [editBranchQuery, setEditBranchQuery] = useState("");
  const [editPickerOpen, setEditPickerOpen] = useState(false);
  const [editActiveSuggestionIndex, setEditActiveSuggestionIndex] = useState(0);
  const [userQuery, setUserQuery] = useState("");
  const [activeMobilePanel, setActiveMobilePanel] = useState("users");

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "Manager",
    branchIds: [],
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");

  const canSubmit = useMemo(() => {
    if (!form.name.trim() || !form.email.trim() || !form.password) return false;
    if (form.password !== form.confirmPassword) return false;
    if (!["Manager", "Staff"].includes(form.role)) return false;
    if (!Array.isArray(form.branchIds) || form.branchIds.length === 0) return false;
    return true;
  }, [form]);

  const branchNameById = useMemo(() => {
    const map = new Map();
    for (const branch of branches) {
      map.set(Number(branch.id), branch.branches_nm);
    }
    return map;
  }, [branches]);

  const filteredBranches = useMemo(() => {
    const query = branchQuery.trim().toLowerCase();
    if (!query) return branches;
    return branches.filter((branch) =>
      String(branch.branches_nm || "").toLowerCase().includes(query)
    );
  }, [branches, branchQuery]);

  const editFilteredBranches = useMemo(() => {
    if (!editOpen) return [];
    const query = editBranchQuery.trim().toLowerCase();
    if (!query) return branches;
    return branches.filter((branch) =>
      String(branch.branches_nm || "").toLowerCase().includes(query)
    );
  }, [branches, editBranchQuery, editOpen]);

  const suggestions = useMemo(() => {
    const selected = new Set((form.branchIds || []).map((x) => Number(x)));
    return filteredBranches.filter((branch) => !selected.has(Number(branch.id))).slice(0, 50);
  }, [filteredBranches, form.branchIds]);

  const editSuggestions = useMemo(() => {
    if (!editOpen) return [];
    const selected = new Set((editForm.branchIds || []).map((x) => Number(x)));
    return editFilteredBranches.filter((branch) => !selected.has(Number(branch.id))).slice(0, 50);
  }, [editFilteredBranches, editForm.branchIds, editOpen]);

  const filteredUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase();
    if (!query) return users;

    return users.filter((entry) => {
      const branchNames = Array.isArray(entry.branch_ids)
        ? entry.branch_ids.map((id) => branchNameById.get(Number(id)) || "").join(" ")
        : "";

      return [entry.name, entry.email, entry.role, branchNames]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [users, userQuery, branchNameById]);

  const totalUsers = users.length;
  const activeUsers = users.filter((entry) => entry.is_active).length;
  const managerUsers = users.filter(
    (entry) => String(entry.role || "").toLowerCase() === "manager"
  ).length;
  const branchCoverage = new Set(
    users.flatMap((entry) =>
      Array.isArray(entry.branch_ids) ? entry.branch_ids.map((id) => Number(id)) : []
    )
  ).size;

  useEffect(() => {
    if (!branchPickerOpen) return;
    setActiveSuggestionIndex(0);
  }, [branchPickerOpen, branchQuery]);

  useEffect(() => {
    if (!editPickerOpen) return;
    setEditActiveSuggestionIndex(0);
  }, [editPickerOpen, editBranchQuery]);

  useEffect(() => {
    if (!actionMenuUserId) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setActionMenuUserId(null);
    };
    const onMouseDown = (event) => {
      if (event.target.closest("[data-user-actions-root]")) return;
      setActionMenuUserId(null);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [actionMenuUserId]);

  const loadUsers = async () => {
    setLoading(true);
    setErr("");
    try {
      const response = await api.get("auth/admin/users/");
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (_) {
      setErr("Unable to load users.");
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    setBranchesLoading(true);
    try {
      const response = await api.get("auth/branches/");
      setBranches(Array.isArray(response.data) ? response.data : []);
    } catch (_) {
      setErr("Unable to load branches.");
    } finally {
      setBranchesLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadBranches();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const resetCreateForm = () => {
    setForm({
      name: "",
      email: "",
      role: "Manager",
      branchIds: [],
      password: "",
      confirmPassword: "",
    });
    setBranchQuery("");
    setBranchPickerOpen(false);
    setShowPassword(false);
  };

  const onCreate = async (event) => {
    event.preventDefault();
    setErr("");
    setSuccess("");

    if (!canSubmit) {
      setErr("Please fill all fields correctly.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("auth/admin/users/", {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        branch_ids: form.branchIds.map((value) => Number(value)),
        password: form.password,
      });
      setSuccess("User created successfully.");
      resetCreateForm();
      await loadUsers();
    } catch (error) {
      const apiErr = error?.response?.data?.error;
      if (Array.isArray(apiErr)) setErr(apiErr.join(" "));
      else setErr(String(apiErr || "User creation failed."));
    } finally {
      setSubmitting(false);
    }
  };

  const addBranch = (branch) => {
    const branchId = Number(branch?.id);
    if (!branchId) return;
    setForm((currentForm) => {
      const current = Array.isArray(currentForm.branchIds) ? currentForm.branchIds : [];
      if (current.includes(branchId)) return currentForm;
      return { ...currentForm, branchIds: [...current, branchId] };
    });
    setBranchQuery("");
  };

  const removeBranchId = (branchId) => {
    setForm((currentForm) => {
      const current = Array.isArray(currentForm.branchIds) ? currentForm.branchIds : [];
      return { ...currentForm, branchIds: current.filter((value) => Number(value) !== Number(branchId)) };
    });
  };

  const openEdit = (entry) => {
    setErr("");
    setSuccess("");
    setActionMenuUserId(null);
    setEditForm({
      id: entry.id,
      name: entry.name || "",
      email: entry.email || "",
      role: entry.role === "Staff" ? "Staff" : "Manager",
      branchIds: Array.isArray(entry.branch_ids) ? entry.branch_ids.map((value) => Number(value)) : [],
    });
    setEditBranchQuery("");
    setEditPickerOpen(false);
    setEditOpen(true);
  };

  const addEditBranch = (branch) => {
    const branchId = Number(branch?.id);
    if (!branchId) return;
    setEditForm((currentForm) => {
      const current = Array.isArray(currentForm.branchIds) ? currentForm.branchIds : [];
      if (current.includes(branchId)) return currentForm;
      return { ...currentForm, branchIds: [...current, branchId] };
    });
    setEditBranchQuery("");
  };

  const removeEditBranchId = (branchId) => {
    setEditForm((currentForm) => {
      const current = Array.isArray(currentForm.branchIds) ? currentForm.branchIds : [];
      return { ...currentForm, branchIds: current.filter((value) => Number(value) !== Number(branchId)) };
    });
  };

  const onEditBranchKeyDown = (event) => {
    if (!editPickerOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setEditPickerOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setEditActiveSuggestionIndex((index) =>
        Math.min(index + 1, Math.max(0, editSuggestions.length - 1))
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setEditActiveSuggestionIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter" && editSuggestions[editActiveSuggestionIndex]) {
      event.preventDefault();
      addEditBranch(editSuggestions[editActiveSuggestionIndex]);
    }
  };

  const onBranchKeyDown = (event) => {
    if (!branchPickerOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setBranchPickerOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((index) =>
        Math.min(index + 1, Math.max(0, suggestions.length - 1))
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter" && suggestions[activeSuggestionIndex]) {
      event.preventDefault();
      addBranch(suggestions[activeSuggestionIndex]);
    }
  };

  const saveEdit = async () => {
    setErr("");
    setSuccess("");
    if (!editForm.id) return;

    if (!editForm.name.trim()) {
      setErr("Name is required.");
      return;
    }
    if (!["Manager", "Staff"].includes(editForm.role)) {
      setErr("Role must be Manager or Staff.");
      return;
    }
    if (!Array.isArray(editForm.branchIds) || editForm.branchIds.length === 0) {
      setErr("Select at least one branch.");
      return;
    }

    setEditSubmitting(true);
    try {
      await api.patch(`auth/admin/users/${editForm.id}/`, {
        name: editForm.name.trim(),
        role: editForm.role,
        branch_ids: editForm.branchIds.map((value) => Number(value)),
      });
      setSuccess("User updated successfully.");
      setEditOpen(false);
      await loadUsers();
    } catch (error) {
      const apiErr = error?.response?.data?.error;
      if (Array.isArray(apiErr)) setErr(apiErr.join(" "));
      else setErr(String(apiErr || "Update failed."));
    } finally {
      setEditSubmitting(false);
    }
  };

  const confirmDelete = (entry) => {
    setErr("");
    setSuccess("");
    setActionMenuUserId(null);
    setDeleteTarget(entry);
  };

  const doDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleteSubmitting(true);
    setErr("");
    setSuccess("");
    try {
      await api.delete(`auth/admin/users/${deleteTarget.id}/`);
      setSuccess("User deleted successfully.");
      setDeleteTarget(null);
      await loadUsers();
    } catch (error) {
      const apiErr = error?.response?.data?.error;
      if (Array.isArray(apiErr)) setErr(apiErr.join(" "));
      else setErr(String(apiErr || "Delete failed."));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-full overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-3 sm:p-4 xl:p-5">
        <div className="mx-auto max-w-3xl rounded-3xl border border-rose-200 bg-white/90 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <ShieldCheckIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Access denied</h1>
              <p className="mt-2 text-sm text-slate-600">
                Admin permissions are required to manage user accounts and branch access.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const userManagementIcon = <UsersIcon className="h-6 w-6" />;

  return (
    <div className="min-h-full overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-3 sm:p-4 xl:p-5">
      <Modal
        isOpen={Boolean(deleteTarget)}
        type="warning"
        message={
          deleteTarget
            ? `Delete ${deleteTarget.name} (${deleteTarget.email})? This will disable the account and remove branch access.`
            : ""
        }
        buttons={[
          {
            label: "Cancel",
            onClick: () => setDeleteTarget(null),
            className: "bg-gray-600 hover:bg-gray-700",
          },
          {
            label: deleteSubmitting ? "Deleting..." : "Delete",
            onClick: doDelete,
            className: "bg-red-600 hover:bg-red-700",
          },
        ]}
      />

      <Modal
        isOpen={editOpen}
        type="info"
        message="Edit user account"
        size="lg"
        contentClassName="bg-slate-50/70"
        buttons={[
          {
            label: "Cancel",
            onClick: () => setEditOpen(false),
            className: "bg-gray-600 hover:bg-gray-700",
          },
          {
            label: editSubmitting ? "Saving..." : "Save changes",
            onClick: saveEdit,
            className: "bg-blue-600 hover:bg-blue-700",
          },
        ]}
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                <PencilSquareIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">User details</div>
                <div className="mt-1 text-sm text-slate-500">
                  Update role and branch access without changing the account email.
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="edit-name">
                Name
              </label>
              <input
                id="edit-name"
                value={editForm.name}
                onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                className={INPUT_CLASS}
                autoComplete="name"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="edit-email">
                Email
              </label>
              <input
                id="edit-email"
                value={editForm.email}
                disabled
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-3 text-slate-500"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="edit-role">
                Role
              </label>
              <select
                id="edit-role"
                value={editForm.role}
                onChange={(event) => setEditForm((current) => ({ ...current, role: event.target.value }))}
                className={INPUT_CLASS}
              >
                <option value="Manager">Manager</option>
                <option value="Staff">Staff</option>
              </select>
            </div>
          </div>

          <BranchPickerSection
            label="Allowed branches"
            query={editBranchQuery}
            setQuery={setEditBranchQuery}
            pickerOpen={editPickerOpen}
            setPickerOpen={setEditPickerOpen}
            onKeyDown={onEditBranchKeyDown}
            placeholder={branchesLoading ? "Loading branches..." : "Search and add branches"}
            suggestions={editSuggestions}
            filteredCount={editFilteredBranches.length}
            loading={branchesLoading}
            addBranch={addEditBranch}
            selectedIds={editForm.branchIds}
            removeBranchId={removeEditBranchId}
            branchNameById={branchNameById}
            activeSuggestionIndex={editActiveSuggestionIndex}
            selectAll={() =>
              setEditForm((current) => ({
                ...current,
                branchIds: branches.map((branch) => Number(branch.id)),
              }))
            }
            clearAll={() => setEditForm((current) => ({ ...current, branchIds: [] }))}
            helperText="Assign one or more branches to control where this user can work."
            errorText={editForm.branchIds.length === 0 ? "Select at least one branch." : ""}
            inputId="edit-branches"
            suggestionId="edit-branch-suggestions"
          />
        </div>
      </Modal>

      <div className="mx-auto flex min-h-full max-w-7xl flex-col">
        <PageHeader
          icon={userManagementIcon}
          title="User Management"
          subtitle="Create, search, and manage Manager and Staff accounts with branch-level access."
          compact
        >
          <button
            type="button"
            onClick={loadUsers}
            className={`${SECONDARY_BUTTON_CLASS} hidden sm:inline-flex`}
            disabled={loading}
          >
            <ArrowPathIcon className="mr-2 h-4 w-4" />
            Refresh
          </button>
        </PageHeader>

        <div className="mb-3 grid flex-shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={UsersIcon}
            label="Total Users"
            value={totalUsers}
            helper="All staff accounts in the workspace"
            iconClass="from-blue-500 to-indigo-600"
          />
          <StatCard
            icon={CheckBadgeIcon}
            label="Active Accounts"
            value={activeUsers}
            helper="Accounts currently enabled for login"
            iconClass="from-emerald-500 to-teal-600"
          />
          <StatCard
            icon={BriefcaseIcon}
            label="Managers"
            value={managerUsers}
            helper="Users with broader operational control"
            iconClass="from-amber-500 to-orange-600"
          />
          <StatCard
            icon={BuildingOffice2Icon}
            label="Branch Coverage"
            value={branchCoverage}
            helper="Unique branches assigned across user access"
            iconClass="from-fuchsia-500 to-rose-600"
          />
        </div>

        {(err || success) && (
          <div
            className={`mb-4 rounded-2xl border px-4 py-3 shadow-sm ${
              err
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
            role="status"
          >
            {err || success}
          </div>
        )}

        <div className="mb-3 flex-shrink-0 xl:hidden">
          <div className="inline-flex rounded-2xl border border-slate-200 bg-white/85 p-1 shadow-sm backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setActiveMobilePanel("users")}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeMobilePanel === "users"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Users
            </button>
            <button
              type="button"
              onClick={() => setActiveMobilePanel("create")}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeMobilePanel === "create"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Create
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 xl:grid xl:grid-cols-[minmax(340px,0.92fr)_minmax(0,1.38fr)] xl:items-start xl:gap-5">
          <div
            className={`flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.35)] backdrop-blur-sm xl:self-start ${
              activeMobilePanel === "create" ? "flex" : "hidden"
            } xl:flex`}
          >
            <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-white px-4 py-3 sm:px-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Create User
                  </div>
                  <div className="mt-1 text-[1.35rem] font-semibold leading-tight text-slate-900">
                    Add a new Manager or Staff account
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    Passwords are still validated by the server policy.
                  </div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                  <UserPlusIcon className="h-5 w-5" />
                </div>
              </div>
            </div>

            <form onSubmit={onCreate} className="space-y-3.5 px-4 pb-6 pt-4 sm:px-5 sm:pb-7">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="name">
                    Name
                  </label>
                  <input
                    id="name"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    className={INPUT_CLASS}
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    className={INPUT_CLASS}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="role">
                    Role
                  </label>
                  <select
                    id="role"
                    value={form.role}
                    onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                    className={INPUT_CLASS}
                  >
                    <option value="Manager">Manager</option>
                    <option value="Staff">Staff</option>
                  </select>
                </div>
              </div>

              <BranchPickerSection
                label="Allowed branches"
                query={branchQuery}
                setQuery={setBranchQuery}
                pickerOpen={branchPickerOpen}
                setPickerOpen={setBranchPickerOpen}
                onKeyDown={onBranchKeyDown}
                placeholder={branchesLoading ? "Loading branches..." : "Search and add branches"}
                suggestions={suggestions}
                filteredCount={filteredBranches.length}
                loading={branchesLoading}
                addBranch={addBranch}
                selectedIds={form.branchIds}
                removeBranchId={removeBranchId}
                branchNameById={branchNameById}
                activeSuggestionIndex={activeSuggestionIndex}
                selectAll={() =>
                  setForm((current) => ({
                    ...current,
                    branchIds: branches.map((branch) => Number(branch.id)),
                  }))
                }
                clearAll={() => setForm((current) => ({ ...current, branchIds: [] }))}
                helperText="Branch assignments decide where the user can operate."
                errorText={!branchesLoading && form.branchIds.length === 0 ? "Select at least one branch." : ""}
                inputId="create-branches"
                suggestionId="create-branch-suggestions"
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="password">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, password: event.target.value }))
                      }
                      className={`${INPUT_CLASS} pr-11`}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((state) => !state)}
                      className="absolute inset-y-0 right-0 px-3 text-slate-500 transition hover:text-slate-700"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18M10.585 10.585A2 2 0 0 0 12 14a2 2 0 0 0 1.415-3.415M9.88 5.515A9.99 9.99 0 0 1 12 5c5.523 0 10 4.477 10 7 0 1.052-.485 2.053-1.339 2.97M6.16 6.16C4.09 7.263 2.61 8.96 2 12c0 2.523 4.477 7 10 7 1.228 0 2.403-.196 3.49-.557" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7C20.268 16.057 16.477 19 12 19S3.732 16.057 2.458 12Z" />
                          <circle cx="12" cy="12" r="3" strokeWidth="2" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="confirmPassword">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, confirmPassword: event.target.value }))
                    }
                    className={INPUT_CLASS}
                    autoComplete="new-password"
                    required
                  />
                  {form.password &&
                    form.confirmPassword &&
                    form.password !== form.confirmPassword && (
                      <div className="text-xs text-rose-600">Passwords do not match.</div>
                    )}
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                <button type="submit" disabled={submitting || !canSubmit} className={PRIMARY_BUTTON_CLASS}>
                  {submitting ? "Creating..." : "Create user"}
                </button>
                <button
                  type="button"
                  onClick={resetCreateForm}
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={submitting}
                >
                  Reset
                </button>
              </div>
            </form>
          </div>

          <div
            className={`min-h-0 flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.35)] backdrop-blur-sm ${
              activeMobilePanel === "users" ? "flex" : "hidden"
            } xl:flex`}
          >
            <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-white px-4 py-3.5 sm:px-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Existing Users
                  </div>
                  <div className="mt-1.5 text-lg font-semibold text-slate-900 sm:text-xl">
                    Review and maintain user accounts
                  </div>
                  <div className="mt-1 text-xs text-slate-500 sm:text-sm">
                    {loading ? "Loading users..." : `${filteredUsers.length} visible of ${users.length} total users`}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative min-w-0 sm:w-72">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <MagnifyingGlassIcon className="h-4.5 w-4.5 text-slate-400" />
                    </div>
                    <input
                      value={userQuery}
                      onChange={(event) => setUserQuery(event.target.value)}
                      placeholder="Search name, email, role, or branch"
                      className={`${INPUT_CLASS} pl-10`}
                    />
                  </div>

                  <button type="button" onClick={loadUsers} className={SECONDARY_BUTTON_CLASS} disabled={loading}>
                    <ArrowPathIcon className="mr-2 h-4 w-4" />
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            <div className="block min-h-0 flex-1 space-y-4 overflow-auto p-4 lg:hidden">
              {filteredUsers.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                      <UserCircleIcon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">{entry.name}</div>
                          <div className="truncate text-sm text-slate-500">{entry.email}</div>
                        </div>

                        {String(entry.role || "").toLowerCase() === "admin" ? (
                          <RoleBadge role={entry.role} />
                        ) : (
                          <div className="relative inline-flex" data-user-actions-root>
                            <button
                              type="button"
                              onClick={() =>
                                setActionMenuUserId((current) => (current === entry.id ? null : entry.id))
                              }
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                              aria-label="User actions"
                            >
                              <EllipsisVerticalIcon className="h-5 w-5" />
                            </button>

                            {actionMenuUserId === entry.id && (
                              <div className="absolute right-0 top-11 z-10 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                                <button
                                  type="button"
                                  onClick={() => openEdit(entry)}
                                  className="flex w-full items-center gap-2 px-3 py-3 text-sm text-slate-700 transition hover:bg-slate-50"
                                >
                                  <PencilSquareIcon className="h-4 w-4" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => confirmDelete(entry)}
                                  className="flex w-full items-center gap-2 px-3 py-3 text-sm text-rose-700 transition hover:bg-rose-50"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <RoleBadge role={entry.role} />
                        <StatusBadge active={entry.is_active} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Branch access
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Array.isArray(entry.branch_ids) && entry.branch_ids.length > 0 ? (
                        entry.branch_ids.map((branchId) => (
                          <span
                            key={branchId}
                            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
                            title={branchNameById.get(Number(branchId)) || `Branch #${branchId}`}
                          >
                            {branchNameById.get(Number(branchId)) || `#${branchId}`}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">No branches assigned.</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {!loading && filteredUsers.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No users match the current search.
                </div>
              )}
            </div>

            <div className="hidden min-h-0 flex-1 lg:block lg:overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">Role</th>
                    <th className="px-4 py-3 text-left font-medium">Branches</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((entry) => (
                    <tr key={entry.id} className="transition hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{entry.name}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{entry.email}</td>
                      <td className="px-4 py-3">
                        <RoleBadge role={entry.role} />
                      </td>
                      <td className="px-4 py-3">
                        {Array.isArray(entry.branch_ids) && entry.branch_ids.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {entry.branch_ids.slice(0, 3).map((branchId) => (
                              <span
                                key={branchId}
                                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700"
                                title={branchNameById.get(Number(branchId)) || `Branch #${branchId}`}
                              >
                                {branchNameById.get(Number(branchId)) || `#${branchId}`}
                              </span>
                            ))}
                            {entry.branch_ids.length > 3 && (
                              <span className="text-xs text-slate-500">+{entry.branch_ids.length - 3} more</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge active={entry.is_active} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {String(entry.role || "").toLowerCase() === "admin" ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <div className="relative inline-flex" data-user-actions-root>
                            <button
                              type="button"
                              onClick={() =>
                                setActionMenuUserId((current) => (current === entry.id ? null : entry.id))
                              }
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                              aria-label="User actions"
                            >
                              <EllipsisVerticalIcon className="h-5 w-5" />
                            </button>

                            {actionMenuUserId === entry.id && (
                              <div className="absolute right-0 top-11 z-10 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                                <button
                                  type="button"
                                  onClick={() => openEdit(entry)}
                                  className="flex w-full items-center gap-2 px-3 py-3 text-sm text-slate-700 transition hover:bg-slate-50"
                                >
                                  <PencilSquareIcon className="h-4 w-4" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => confirmDelete(entry)}
                                  className="flex w-full items-center gap-2 px-3 py-3 text-sm text-rose-700 transition hover:bg-rose-50"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}

                  {!loading && filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No users match the current search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
