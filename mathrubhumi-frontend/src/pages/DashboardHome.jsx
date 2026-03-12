import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRightIcon,
  BookOpenIcon,
  BuildingOffice2Icon,
  BuildingStorefrontIcon,
  ChartBarSquareIcon,
  ClipboardDocumentListIcon,
  CreditCardIcon,
  FolderOpenIcon,
  Squares2X2Icon,
  TruckIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import api from "../utils/axiosInstance";
import { getSession } from "../utils/session";

const LIVE_COUNT_DEFINITIONS = [
  {
    key: "titles",
    label: "Titles",
    helper: "Books available across catalogue and stock workflows.",
    route: "/dashboard/title-master",
    endpoint: "/auth/title-search/",
    icon: BookOpenIcon,
    tint: "from-blue-500 to-indigo-600",
    softTint: "from-blue-500/10 to-indigo-500/5",
  },
  {
    key: "authors",
    label: "Authors",
    helper: "Writers and contributors mapped to your titles.",
    route: "/dashboard/author-master",
    endpoint: "/auth/author-master-search/",
    icon: UsersIcon,
    tint: "from-emerald-500 to-teal-600",
    softTint: "from-emerald-500/10 to-teal-500/5",
  },
  {
    key: "suppliers",
    label: "Suppliers",
    helper: "Vendors used for inward stock and purchase returns.",
    route: "/dashboard/supplier-master",
    endpoint: "/auth/supplier-master-search/",
    icon: BuildingStorefrontIcon,
    tint: "from-amber-500 to-orange-600",
    softTint: "from-amber-500/10 to-orange-500/5",
  },
  {
    key: "customers",
    label: "Credit Customers",
    helper: "Accounts used for billing, realisation, and reports.",
    route: "/dashboard/credit-customer-master",
    endpoint: "/auth/credit-customer-master-search/",
    icon: UserGroupIcon,
    tint: "from-fuchsia-500 to-rose-600",
    softTint: "from-fuchsia-500/10 to-rose-500/5",
  },
];

const WORKSPACE_SECTIONS = [
  {
    title: "Masters",
    count: 14,
    description: "Maintain catalogue, parties, and supporting reference data.",
    route: "/dashboard/title-master",
    icon: Squares2X2Icon,
    items: ["Titles", "Authors", "Publishers", "Suppliers"],
    cardClass: "from-blue-500/10 via-blue-500/5 to-cyan-500/10",
    iconClass: "from-blue-500 to-indigo-600",
  },
  {
    title: "Transactions",
    count: 7,
    description: "Handle billing, inward stock, returns, receipts, and remittances.",
    route: "/dashboard/sale-bill",
    icon: ClipboardDocumentListIcon,
    items: ["Sale Bill", "Goods Inward", "Returns", "Receipts"],
    cardClass: "from-emerald-500/10 via-emerald-500/5 to-teal-500/10",
    iconClass: "from-emerald-500 to-teal-600",
  },
  {
    title: "Reports",
    count: 17,
    description: "Generate sale, stock, and account statements by branch.",
    route: "/dashboard/daily-account-statement",
    icon: ChartBarSquareIcon,
    items: ["Sale Registers", "Stock Reports", "Account Statement", "Agent Analysis"],
    cardClass: "from-amber-500/10 via-amber-500/5 to-orange-500/10",
    iconClass: "from-amber-500 to-orange-600",
  },
];

const extractTotal = (payload) => {
  if (Array.isArray(payload)) {
    return payload.length;
  }

  if (payload && typeof payload === "object") {
    if (typeof payload.total === "number") {
      return payload.total;
    }
    if (Array.isArray(payload.results)) {
      return payload.results.length;
    }
  }

  return 0;
};

const formatCount = (value) => {
  if (value == null) {
    return "\u2014";
  }
  return new Intl.NumberFormat("en-IN").format(value);
};

const DashboardHome = () => {
  const navigate = useNavigate();
  const { user, branch } = getSession();
  const [counts, setCounts] = useState({});
  const [countsLoading, setCountsLoading] = useState(true);
  const [countsError, setCountsError] = useState("");

  useEffect(() => {
    let isActive = true;

    const loadCounts = async () => {
      setCountsLoading(true);
      setCountsError("");

      const results = await Promise.allSettled(
        LIVE_COUNT_DEFINITIONS.map((item) =>
          api.get(item.endpoint, {
            params: { page: 1, page_size: 1 },
          })
        )
      );

      if (!isActive) {
        return;
      }

      const nextCounts = {};
      let hasFailure = false;

      results.forEach((result, index) => {
        const { key } = LIVE_COUNT_DEFINITIONS[index];
        if (result.status === "fulfilled") {
          nextCounts[key] = extractTotal(result.value.data);
          return;
        }

        hasFailure = true;
        nextCounts[key] = null;
        console.error(`Failed to load dashboard count for ${key}:`, result.reason);
      });

      setCounts(nextCounts);
      setCountsError(hasFailure ? "Some live totals could not be loaded." : "");
      setCountsLoading(false);
    };

    loadCounts();

    return () => {
      isActive = false;
    };
  }, []);

  const now = new Date();
  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 17
        ? "Good afternoon"
        : "Good evening";
  const dateLabel = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const userName = user?.name || user?.email || "User";
  const userRole = user?.role || "Staff";
  const branchName = branch?.branches_nm || "Branch not selected";
  const totalModules = 14 + 7 + 17 + (user?.is_admin ? 1 : 0);

  const quickActions = [
    {
      label: "Create Sale Bill",
      description: "Start billing for customers or branch transfers.",
      route: "/dashboard/sale-bill",
      icon: CreditCardIcon,
      buttonClass: "from-blue-600 to-indigo-600",
    },
    {
      label: "Record Goods Inward",
      description: "Capture inward stock from suppliers and branches.",
      route: "/dashboard/goods-inward",
      icon: TruckIcon,
      buttonClass: "from-emerald-600 to-teal-600",
    },
    {
      label: "Maintain Titles",
      description: "Update catalogue, pricing, and title metadata.",
      route: "/dashboard/title-master",
      icon: BookOpenIcon,
      buttonClass: "from-amber-500 to-orange-600",
    },
    {
      label: user?.is_admin ? "Manage Users" : "Credit Customers",
      description: user?.is_admin
        ? "Control branch access and staff permissions."
        : "Open customer records used in billing and recovery.",
      route: user?.is_admin ? "/dashboard/users" : "/dashboard/credit-customer-master",
      icon: user?.is_admin ? BuildingOffice2Icon : UserGroupIcon,
      buttonClass: "from-fuchsia-600 to-rose-600",
    },
  ];

  const operationalLanes = [
    {
      title: "Sales and Billing",
      description: "Issue sale bills, process returns, and monitor customer-linked workflows.",
      icon: CreditCardIcon,
      iconClass: "from-blue-500 to-indigo-600",
      actions: [
        { label: "Open Sale Bill", route: "/dashboard/sale-bill" },
        { label: "Sale Bill Return", route: "/dashboard/sale-bill-return" },
      ],
    },
    {
      title: "Stock Movement",
      description: "Handle inward entries, supplier returns, and keep inventory records aligned.",
      icon: TruckIcon,
      iconClass: "from-emerald-500 to-teal-600",
      actions: [
        { label: "Goods Inward", route: "/dashboard/goods-inward" },
        { label: "Inward Return", route: "/dashboard/goods-inward-return" },
      ],
    },
    {
      title: "Reporting",
      description: "Generate branch-wise sales, stock, and daily accounting reports.",
      icon: FolderOpenIcon,
      iconClass: "from-amber-500 to-orange-600",
      actions: [
        { label: "Daily Account", route: "/dashboard/daily-account-statement" },
        { label: "Daily Stock", route: "/dashboard/daily-stock-statement" },
      ],
    },
  ];

  const topHighlights = [
    { label: "Logged branch", value: branchName },
    { label: "Access role", value: userRole },
    { label: "Modules available", value: `${totalModules}` },
    { label: "Idle sign-out", value: "30 minutes" },
  ];

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.14),_transparent_24%),linear-gradient(135deg,_#f8fafc_0%,_#eef4ff_45%,_#f8fafc_100%)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-slate-950 text-white shadow-[0_25px_80px_rgba(15,23,42,0.22)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.24),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.22),_transparent_35%)]" />
          <div className="absolute right-0 top-0 h-48 w-48 -translate-y-10 translate-x-10 rounded-full bg-white/10 blur-3xl" />
          <div className="relative grid gap-6 p-5 sm:p-8 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-blue-100/80">
                Mathrubhumi Books Workspace
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {greeting}, {userName}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                This dashboard is aligned to the actual branch operations in the project:
                catalogue maintenance, stock movement, billing, returns, and reporting.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-slate-100">
                  {dateLabel}
                </span>
                <span className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-sm text-cyan-100">
                  Branch: {branchName}
                </span>
                <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-sm text-emerald-100">
                  {userRole} access
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
              {topHighlights.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
                    {item.label}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                Live Master Snapshot
              </h2>
              <p className="text-sm text-slate-500">
                Totals are loaded from the existing master search endpoints, not hardcoded.
              </p>
            </div>
            {countsError && (
              <p className="text-sm font-medium text-amber-700">{countsError}</p>
            )}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {LIVE_COUNT_DEFINITIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.route)}
                className="group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div
                  className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-br ${item.softTint}`}
                />
                <div className="relative p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.tint} text-white shadow-lg`}
                    >
                      <item.icon className="h-6 w-6" />
                    </div>
                    <ArrowRightIcon className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-600" />
                  </div>
                  <p className="mt-5 text-sm font-medium text-slate-500">{item.label}</p>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                    {countsLoading ? (
                      <span className="inline-block h-8 w-20 animate-pulse rounded-xl bg-slate-200" />
                    ) : (
                      formatCount(counts[item.key])
                    )}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.helper}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
          <section className="rounded-[28px] border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                  Operational Lanes
                </h2>
                <p className="text-sm text-slate-500">
                  Key workflows grouped the way this application is actually used.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {operationalLanes.map((lane) => (
                <div
                  key={lane.title}
                  className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${lane.iconClass} text-white shadow-lg`}
                  >
                    <lane.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{lane.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{lane.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {lane.actions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => navigate(action.route)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                      >
                        {action.label}
                        <ArrowRightIcon className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:p-6">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              Quick Access
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Shortcuts to the actions users typically need first.
            </p>

            <div className="mt-5 grid gap-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.route)}
                  className="group rounded-3xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${action.buttonClass} text-white shadow-lg`}
                    >
                      <action.icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-slate-900">
                          {action.label}
                        </h3>
                        <ArrowRightIcon className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-600" />
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {action.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-[28px] border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                Workspace Coverage
              </h2>
              <p className="text-sm text-slate-500">
                A project-level summary of the modules already present in this app.
              </p>
            </div>
            <p className="text-sm font-medium text-slate-600">
              {totalModules} reachable screens in the signed-in workspace
            </p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {WORKSPACE_SECTIONS.map((section) => (
              <button
                key={section.title}
                type="button"
                onClick={() => navigate(section.route)}
                className={`group overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br ${section.cardClass} p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${section.iconClass} text-white shadow-lg`}
                  >
                    <section.icon className="h-6 w-6" />
                  </div>
                  <ArrowRightIcon className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-600" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">
                  {section.title}
                </h3>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
                  {section.count}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {section.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {section.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardHome;
