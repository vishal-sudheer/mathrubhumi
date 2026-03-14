import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowPathIcon,
  BuildingOffice2Icon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import api from "../utils/axiosInstance";
import { setSession } from "../utils/session";

const INPUT_CLASS =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10";

function StatusNotice({ tone = "danger", children }) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm ${toneClass}`} role="alert">
      <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const branchBoxRef = useRef(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchesErr, setBranchesErr] = useState("");
  const [branchQuery, setBranchQuery] = useState("");
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      setBranchesLoading(true);
      setBranchesErr("");

      try {
        const res = await api.get("auth/branches/");
        const list = Array.isArray(res.data) ? res.data : [];
        if (!alive) return;

        setBranches(list);
        if (list.length === 1) {
          setBranchId(String(list[0].id));
          setBranchQuery(list[0].branches_nm || "");
        }
      } catch (_) {
        if (!alive) return;
        setBranchesErr("Unable to load branches. Please refresh and try again.");
      } finally {
        if (!alive) return;
        setBranchesLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const selectedBranch = useMemo(() => {
    const id = Number(branchId);
    if (!id) return null;
    return branches.find((branch) => Number(branch.id) === id) || null;
  }, [branchId, branches]);

  const filteredBranches = useMemo(() => {
    const query = branchQuery.trim().toLowerCase();
    if (!query) return branches;
    return branches.filter((branch) =>
      String(branch.branches_nm || "").toLowerCase().includes(query)
    );
  }, [branches, branchQuery]);

  const suggestions = useMemo(() => {
    const selectedId = Number(branchId);
    return filteredBranches.filter((branch) => Number(branch.id) !== selectedId).slice(0, 50);
  }, [filteredBranches, branchId]);

  useEffect(() => {
    if (!branchPickerOpen) return;
    setActiveSuggestionIndex(0);
  }, [branchPickerOpen, branchQuery]);

  useEffect(() => {
    if (!branchPickerOpen) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") setBranchPickerOpen(false);
    };

    const onMouseDown = (event) => {
      const box = branchBoxRef.current;
      if (!box) return;
      if (!box.contains(event.target)) setBranchPickerOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [branchPickerOpen]);

  const selectBranch = (branch) => {
    if (!branch?.id) return;
    setBranchId(String(branch.id));
    setBranchQuery(branch.branches_nm || "");
    setBranchPickerOpen(false);
  };

  const onBranchKeyDown = (event) => {
    if (!branchPickerOpen) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((index) => Math.min(index + 1, Math.max(0, suggestions.length - 1)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter" && suggestions[activeSuggestionIndex]) {
      event.preventDefault();
      selectBranch(suggestions[activeSuggestionIndex]);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const response = await api.post("auth/login/", {
        email,
        password,
        branch_id: Number(branchId),
      });

      localStorage.setItem("access", response.data.access);
      localStorage.setItem("refresh", response.data.refresh);

      if (response.data.user && response.data.branch) {
        setSession({ user: response.data.user, branch: response.data.branch });
      } else if (selectedBranch) {
        setSession({ user: response.data.user || null, branch: selectedBranch });
      }

      navigate("/dashboard");
    } catch (error) {
      const detail = error?.response?.data?.detail;
      const branchErr = error?.response?.data?.branch_id;
      if (Array.isArray(branchErr) && branchErr[0]) setErr(String(branchErr[0]));
      else setErr(String(detail || "Sign in failed. Check email, password, and branch."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.28),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(99,102,241,0.22),_transparent_24%),linear-gradient(180deg,_#eef4ff_0%,_#f8fbff_48%,_#edf2ff_100%)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-8rem] h-64 w-64 rounded-full bg-blue-300/30 blur-3xl" />
        <div className="absolute right-[-6rem] top-20 h-72 w-72 rounded-full bg-indigo-300/20 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-1/3 h-72 w-72 rounded-full bg-cyan-200/30 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-5 rounded-[36px] border border-white/60 bg-white/55 p-3 shadow-[0_30px_120px_rgba(148,163,184,0.2)] backdrop-blur-xl lg:grid-cols-[minmax(280px,0.82fr)_minmax(0,1fr)] lg:p-4">
          <section className="relative overflow-hidden rounded-[28px] bg-slate-950 text-white shadow-[0_28px_90px_rgba(15,23,42,0.28)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.28),_transparent_28%),radial-gradient(circle_at_80%_25%,_rgba(34,211,238,0.18),_transparent_24%)]" />
            <div className="relative flex h-full flex-col justify-between p-6 sm:p-7">
              <div>
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
                    <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        d="M4.75 6.75A2.75 2.75 0 0 1 7.5 4h9A2.75 2.75 0 0 1 19.25 6.75v10.5A2.75 2.75 0 0 1 16.5 20h-9a2.75 2.75 0 0 1-2.75-2.75V6.75ZM8 7.5h3.75a2.25 2.25 0 0 1 1.59.66L16 10.82V16.5a.75.75 0 0 1-.75.75H8A.75.75 0 0 1 7.25 16.5v-8.25A.75.75 0 0 1 8 7.5Zm4.75.18V10a.75.75 0 0 0 .75.75h2.32"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xl font-semibold tracking-tight sm:text-2xl">Mathrubhumi Books</div>
                    <div className="mt-1 text-sm text-slate-300">Publishing and branch operations workspace</div>
                  </div>
                </div>

                <h1 className="mt-8 text-3xl font-semibold tracking-tight text-white sm:text-[2.6rem] sm:leading-tight">
                  Sign in and continue your work.
                </h1>
                <p className="mt-4 max-w-sm text-sm leading-7 text-slate-300 sm:text-base">
                  Select the branch, enter your credentials, and open the dashboard in the right workspace context.
                </p>
              </div>

              <div className="mt-8 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-blue-100">
                    Branch-based access
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-blue-100">
                    30 min timeout
                  </span>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/10 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheckIcon className="mt-0.5 h-5 w-5 text-blue-100" />
                    <div>
                      <div className="text-sm font-medium text-white">
                        {selectedBranch ? selectedBranch.branches_nm : "Choose a branch to begin"}
                      </div>
                      <div className="mt-1 text-sm text-slate-300">
                        {branchesLoading
                          ? "Loading available branches."
                          : `${branches.length} branch${branches.length === 1 ? "" : "es"} available for sign-in.`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col justify-center rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_24px_90px_rgba(148,163,184,0.18)] sm:p-6 lg:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Secure Login</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[2rem]">
                  Access your branch workspace
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Use your assigned email, password, and branch.
                </p>
              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                <LockClosedIcon className="h-7 w-7" />
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-600">
              {selectedBranch ? (
                <>
                  Selected branch: <span className="font-medium text-slate-800">{selectedBranch.branches_nm}</span>
                </>
              ) : (
                "Choose the branch you want to work in before continuing."
              )}
            </div>

            <div className="mt-6 space-y-3">
              {err ? <StatusNotice>{err}</StatusNotice> : null}
              {branchesErr ? <StatusNotice tone="warning">{branchesErr}</StatusNotice> : null}
            </div>

            <form onSubmit={handleLogin} className="mt-6 space-y-5">
              <div className="grid gap-5">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <UserCircleIcon className="h-5 w-5" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      className={`${INPUT_CLASS} pl-12`}
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="branch" className="text-sm font-medium text-slate-700">
                      Branch
                    </label>
                    <div className="text-xs text-slate-500">
                      {branchesLoading ? "Loading..." : `${branches.length} available`}
                    </div>
                  </div>

                  <div className="relative" ref={branchBoxRef}>
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <BuildingOffice2Icon className="h-5 w-5" />
                    </div>
                    <input
                      id="branch"
                      className={`${INPUT_CLASS} pl-12 pr-24`}
                      value={branchQuery}
                      onChange={(event) => {
                        setBranchQuery(event.target.value);
                        setBranchId("");
                        setBranchPickerOpen(true);
                      }}
                      onFocus={() => setBranchPickerOpen(true)}
                      onKeyDown={onBranchKeyDown}
                      placeholder={branchesLoading ? "Loading branches..." : "Search and select a branch"}
                      disabled={branchesLoading}
                      role="combobox"
                      aria-expanded={branchPickerOpen}
                      aria-controls="branch-suggestions"
                      aria-autocomplete="list"
                      autoComplete="off"
                      required
                    />

                    <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
                      {branchQuery ? (
                        <button
                          type="button"
                          onClick={() => {
                            setBranchQuery("");
                            setBranchId("");
                            setBranchPickerOpen(true);
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Clear branch"
                          disabled={branchesLoading}
                        >
                          <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setBranchPickerOpen((state) => !state)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Toggle branch list"
                        disabled={branchesLoading}
                      >
                        <ChevronDownIcon className={`h-5 w-5 transition-transform ${branchPickerOpen ? "rotate-180" : ""}`} />
                      </button>
                    </div>

                    {branchPickerOpen && !branchesLoading ? (
                      <div
                        className="absolute z-20 mt-2 w-full overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.14)]"
                        onMouseDown={(event) => event.preventDefault()}
                      >
                        <div className="max-h-64 overflow-auto" id="branch-suggestions" role="listbox">
                          {suggestions.length === 0 ? (
                            <div className="px-4 py-4 text-sm text-slate-500">
                              {branchQuery.trim() ? "No branches found." : "Type to search branches."}
                            </div>
                          ) : (
                            <ul className="divide-y divide-slate-100">
                              {suggestions.map((branch, index) => {
                                const active = index === activeSuggestionIndex;
                                return (
                                  <li key={branch.id} role="option" aria-selected={active}>
                                    <button
                                      type="button"
                                      onClick={() => selectBranch(branch)}
                                      className={`w-full px-4 py-3 text-left transition ${
                                        active ? "bg-blue-50" : "hover:bg-slate-50"
                                      }`}
                                    >
                                      <div className="text-sm font-medium text-slate-900">{branch.branches_nm}</div>
                                      <div className="mt-0.5 text-[11px] text-slate-500">Branch #{branch.id}</div>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/90 px-4 py-2.5">
                          <div className="text-[11px] text-slate-500">
                            Showing {Math.min(suggestions.length, 50)} of {filteredBranches.length}
                          </div>
                          <button
                            type="button"
                            className="text-[11px] font-medium text-slate-700 transition hover:text-slate-900"
                            onClick={() => setBranchPickerOpen(false)}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <LockClosedIcon className="h-5 w-5" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      className={`${INPUT_CLASS} pl-12 pr-12`}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((state) => !state)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition hover:text-slate-700"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-600">
                Your session expires after 30 minutes of inactivity. Unauthorized use of this workspace is prohibited.
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={loading || branchesLoading || !branchId}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
