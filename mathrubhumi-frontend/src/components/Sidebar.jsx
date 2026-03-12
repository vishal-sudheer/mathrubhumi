import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeftOnRectangleIcon,
  ArrowsRightLeftIcon,
  Bars3Icon,
  BookOpenIcon,
  ChartBarSquareIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  HomeIcon,
  QuestionMarkCircleIcon,
  Squares2X2Icon,
  UserCircleIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Modal from "./Modal";
import { clearSession, getInitials, getSession } from "../utils/session";

const BASE_EXPANDED_MENUS = {
  Masters: false,
  Transactions: false,
  Reports: false,
  Utilities: false,
};

const SECTION_META = {
  Masters: {
    icon: Squares2X2Icon,
    summary: "Catalogue and party masters",
    iconClass: "from-sky-500 to-indigo-500",
    badgeClass: "border-sky-400/25 bg-sky-400/10 text-sky-100",
  },
  Transactions: {
    icon: ArrowsRightLeftIcon,
    summary: "Billing and stock movement",
    iconClass: "from-emerald-500 to-teal-500",
    badgeClass: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
  },
  Reports: {
    icon: ChartBarSquareIcon,
    summary: "Branch-wise reports and registers",
    iconClass: "from-amber-500 to-orange-500",
    badgeClass: "border-amber-400/25 bg-amber-400/10 text-amber-100",
  },
  Utilities: {
    icon: Cog6ToothIcon,
    summary: "Admin-only controls",
    iconClass: "from-fuchsia-500 to-rose-500",
    badgeClass: "border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100",
  },
};

const buildMenuStructure = (isAdmin) => ({
  Masters: [
    { label: "Categories", route: "/dashboard/categories-master" },
    { label: "Sub Categories", route: "/dashboard/sub-categories-master" },
    { label: "Publisher Maintenance", route: "/dashboard/publisher-master" },
    { label: "Author Maintenance", route: "/dashboard/author-master" },
    { label: "Title Maintenance", route: "/dashboard/title-master" },
    { label: "Pre Publication Books", route: "/dashboard/pp-books-master" },
    { label: "Places", route: "/dashboard/places-master" },
    { label: "Supplier Maintenance", route: "/dashboard/supplier-master" },
    { label: "Credit Customer Maintenance", route: "/dashboard/credit-customer-master" },
    { label: "Pre Publication Customers", route: "/dashboard/pp-customers-master" },
    { label: "Privilegers", route: "/dashboard/privilegers-master" },
    { label: "Agents", route: "/dashboard/agents-master" },
    { label: "Purchase Breakups", route: "/dashboard/purchase-breakups-master" },
    { label: "Royalty Recipients", route: "/dashboard/royalty-recipients-master" },
  ],
  Transactions: [
    { label: "Goods Inward", route: "/dashboard/goods-inward" },
    { label: "Sale Bill", route: "/dashboard/sale-bill" },
    { label: "Goods Inward Return", route: "/dashboard/goods-inward-return" },
    { label: "Sale Bill Return", route: "/dashboard/sale-bill-return" },
    { label: "P P Receipt Entry", route: "/dashboard/pp-receipt-entry" },
    { label: "Remittance Entry", route: "/dashboard/remittance-entry" },
    { label: "Credit Realisation Entry", route: "/dashboard/credit-realisation-entry" },
  ],
  Reports: [
    {
      division: "Sale Reports",
      items: [
        { label: "Author-Wise Title Sales", route: "/dashboard/author-wise-title-sales" },
        { label: "Credit-Customer Wise Sales", route: "/dashboard/credit-customer-wise-sales" },
        { label: "Bill-Wise Sale Register", route: "/dashboard/bill-wise-sale-register" },
        { label: "Date-Wise Sale Register", route: "/dashboard/date-wise-sale-register" },
        { label: "Type-Wise Sale Register", route: "/dashboard/type-wise-sale-register" },
        { label: "ABC Sale Register", route: "/dashboard/abc-sale-register" },
        { label: "Category Wise Sales", route: "/dashboard/category-wise-sales" },
        { label: "Sale Class Ratio", route: "/dashboard/sale-class-ratio" },
        { label: "Sales Agent-Wise", route: "/dashboard/sales-agent-wise" },
        { label: "Author-Publisher Sales", route: "/dashboard/author-publisher-sales" },
        { label: "Publisher-Author Wise Sales", route: "/dashboard/publisher-author-wise-sales" },
        { label: "Sub-Category Mode Product-Wise Sales", route: "/dashboard/sub-category-mode-product-wise-sales" },
        { label: "Category Publisher Author Wise Sales", route: "/dashboard/category-publisher-author-wise-sales" },
      ],
    },
    {
      division: "Purchase Reports",
      items: [],
    },
    {
      division: "Stock Reports",
      items: [
        { label: "Daily Stock Statement", route: "/dashboard/daily-stock-statement" },
        { label: "Sale and Stock", route: "/dashboard/sale-and-stock" },
      ],
    },
    {
      division: "P P Reports",
      items: [],
    },
    {
      division: "Miscellaneous Reports",
      items: [
        { label: "Daily Account Statement", route: "/dashboard/daily-account-statement" },
        { label: "CIAL Sale Register", route: "/dashboard/cial-sale-register" },
      ],
    },
  ],
  Utilities: isAdmin ? [{ label: "User Management", route: "/dashboard/users" }] : [],
});

const countMenuItems = (items) =>
  items.reduce((total, item) => total + (item.division ? item.items.length : 1), 0);

const getActiveState = (pathname, menuStructure) => {
  const expandedMenus = { ...BASE_EXPANDED_MENUS };
  const expandedReportDivisions = {};

  Object.entries(menuStructure).forEach(([menu, items]) => {
    let hasActiveItem = false;

    items.forEach((item) => {
      if (item.division) {
        const divisionActive = item.items.some((subItem) => pathname === subItem.route);
        if (divisionActive) {
          hasActiveItem = true;
          expandedReportDivisions[item.division] = true;
        }
        return;
      }

      if (pathname === item.route) {
        hasActiveItem = true;
      }
    });

    if (hasActiveItem) {
      expandedMenus[menu] = true;
    }
  });

  return { expandedMenus, expandedReportDivisions };
};

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { user: sessionUser, branch: sessionBranch } = getSession();
  const user = {
    name: sessionUser?.name || "User",
    email: sessionUser?.email || "",
    role: sessionUser?.role || "Staff",
    is_admin: Boolean(
      sessionUser?.is_admin || String(sessionUser?.role || "").toLowerCase() === "admin"
    ),
    initials: getInitials(sessionUser?.name || sessionUser?.email || "User"),
  };
  const branch = sessionBranch?.branches_nm ? sessionBranch : null;

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState(BASE_EXPANDED_MENUS);
  const [expandedReportDivisions, setExpandedReportDivisions] = useState({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const profileButtonRef = useRef(null);
  const profileMenuRef = useRef(null);

  const [modal, setModal] = useState({
    isOpen: false,
    message: "",
    type: "info",
    buttons: [],
  });

  const menuStructure = buildMenuStructure(user.is_admin);
  const visibleMenus = Object.entries(menuStructure).filter(([, items]) => items.length > 0);
  const dashboardHomeActive =
    location.pathname === "/dashboard" || location.pathname === "/dashboard/";

  useEffect(() => {
    const activeMenuStructure = buildMenuStructure(user.is_admin);
    const { expandedMenus: nextMenus, expandedReportDivisions: nextDivisions } =
      getActiveState(location.pathname, activeMenuStructure);

    setExpandedMenus((prev) => {
      const merged = { ...prev };
      Object.keys(nextMenus).forEach((key) => {
        if (nextMenus[key]) {
          merged[key] = true;
        }
      });
      return merged;
    });

    setExpandedReportDivisions((prev) => {
      const merged = { ...prev };
      Object.keys(nextDivisions).forEach((key) => {
        if (nextDivisions[key]) {
          merged[key] = true;
        }
      });
      return merged;
    });

    setUserMenuOpen(false);
    setMobileOpen(false);
  }, [location.pathname, user.is_admin]);

  useEffect(() => {
    if (!userMenuOpen) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    };

    const onMouseDown = (event) => {
      const button = profileButtonRef.current;
      const menu = profileMenuRef.current;

      if (!button || !menu) {
        return;
      }

      if (button.contains(event.target) || menu.contains(event.target)) {
        return;
      }

      setUserMenuOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    const onResize = () => {
      if (window.innerWidth >= 1280) {
        setMobileOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [mobileOpen]);

  const closeModal = () => {
    setModal({ isOpen: false, message: "", type: "info", buttons: [] });
  };

  const showModal = (
    message,
    type = "info",
    buttons = [
      {
        label: "OK",
        onClick: () => closeModal(),
        className: "bg-blue-500 hover:bg-blue-600",
      },
    ]
  ) => {
    setModal({ isOpen: true, message, type, buttons });
  };

  const performLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("lastActivityTs");
    clearSession();
    navigate("/");
    closeModal();
  };

  const handleLogout = () => {
    showModal("Log out?", "info", [
      { label: "Cancel", onClick: closeModal, className: "bg-gray-600 hover:bg-gray-700" },
      { label: "Confirm", onClick: performLogout, className: "bg-red-600 hover:bg-red-700" },
    ]);
  };

  const handleNavigate = (route) => {
    navigate(route);
    setUserMenuOpen(false);
    if (window.innerWidth < 1280) {
      setMobileOpen(false);
    }
  };

  const toggleSidebar = () => {
    setUserMenuOpen(false);
    setCollapsed((prev) => !prev);
  };

  const toggleMenu = (menu) => {
    if (collapsed && !mobileOpen) {
      setCollapsed(false);
      setExpandedMenus((prev) => ({ ...prev, [menu]: true }));
      return;
    }

    setExpandedMenus((prev) => ({ ...prev, [menu]: !prev[menu] }));
  };

  const toggleReportDivision = (division) => {
    setExpandedReportDivisions((prev) => ({ ...prev, [division]: !prev[division] }));
  };

  return (
    <>
      <Modal isOpen={modal.isOpen} message={modal.message} type={modal.type} buttons={modal.buttons} />

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/95 text-slate-900 shadow-lg backdrop-blur transition hover:bg-white xl:hidden"
        aria-label="Open sidebar"
      >
        <Bars3Icon className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm transition xl:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-label="Close sidebar backdrop"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen flex-col overflow-hidden border-r border-white/10 bg-[linear-gradient(180deg,#0f172a_0%,#12203d_38%,#0f1b33_100%)] text-slate-100 shadow-[0_24px_70px_rgba(15,23,42,0.42)] transition-all duration-300 ease-out xl:static xl:z-auto xl:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"
        } ${collapsed ? "xl:w-20" : "w-[min(88vw,22rem)] xl:w-[20rem]"}`}
      >
        <div className="border-b border-white/10 bg-gradient-to-b from-white/10 to-white/[0.03] px-3 pb-4 pt-4">
          <div
            className={`flex gap-3 ${
              collapsed
                ? "flex-col items-center"
                : "items-start justify-between"
            }`}
          >
            <button
              type="button"
              onClick={() => handleNavigate("/dashboard")}
              className={`flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] text-left shadow-sm transition hover:bg-white/[0.1] ${
                collapsed ? "justify-center p-2.5" : "flex-1 px-3 py-3"
              }`}
              title="Dashboard home"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-950/30">
                <BookOpenIcon className="h-6 w-6" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold tracking-wide text-white">
                    Mathrubhumi Books
                  </div>
                  <div className="truncate text-xs text-slate-300">
                    {branch?.branches_nm || "Operations workspace"}
                  </div>
                </div>
              )}
            </button>

            <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
              <button
                type="button"
                onClick={toggleSidebar}
                className="hidden xl:inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-slate-100 transition hover:bg-white/[0.12]"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <ChevronRightIcon className={`h-5 w-5 transition-transform ${collapsed ? "" : "rotate-180"}`} />
              </button>

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-slate-100 transition hover:bg-white/[0.12] xl:hidden"
                aria-label="Close sidebar"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {!collapsed && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-100">
                {user.role}
              </span>
              {branch?.branches_nm && (
                <span className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-100">
                  {branch.branches_nm}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 overscroll-contain">
          <button
            type="button"
            onClick={() => handleNavigate("/dashboard")}
            className={`group mb-3 flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
              dashboardHomeActive
                ? "border-sky-200/55 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 text-white shadow-[0_18px_38px_rgba(37,99,235,0.34)] ring-1 ring-sky-200/35"
                : "border-white/8 bg-white/[0.05] text-slate-200 hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
            } ${collapsed ? "justify-center" : ""}`}
            title="Dashboard Home"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${
                dashboardHomeActive
                  ? "bg-white/18 ring-1 ring-white/30 shadow-blue-950/30"
                  : "bg-gradient-to-br from-sky-500/90 to-indigo-500/90 shadow-sky-950/20"
              }`}
            >
              <HomeIcon className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold tracking-wide">Dashboard Home</div>
                <div className={`text-xs ${dashboardHomeActive ? "text-sky-100/90" : "text-slate-400"}`}>
                  Overview and quick actions
                </div>
              </div>
            )}
          </button>

          {visibleMenus.map(([menu, items]) => {
            const meta = SECTION_META[menu];
            const Icon = meta.icon;
            const itemCount = countMenuItems(items);
            const open = expandedMenus[menu];
            const active = items.some((item) =>
              item.division
                ? item.items.some((subItem) => location.pathname === subItem.route)
                : location.pathname === item.route
            );

            return (
              <div key={menu} className="mb-3">
                <button
                  type="button"
                  onClick={() => toggleMenu(menu)}
                  className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-sky-200/45 bg-gradient-to-r from-sky-500/35 via-blue-500/22 to-indigo-500/18 text-white shadow-[0_18px_34px_rgba(14,165,233,0.18)] ring-1 ring-sky-200/20"
                      : open
                        ? "border-white/14 bg-white/[0.10] text-white shadow-[0_16px_30px_rgba(15,23,42,0.24)]"
                      : "border-white/8 bg-white/[0.04] text-slate-200 hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
                  } ${collapsed ? "justify-center" : ""}`}
                  aria-expanded={open}
                  aria-label={`${menu} menu`}
                  title={collapsed ? menu : undefined}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${
                      active
                        ? "bg-white/18 ring-1 ring-white/25 shadow-sky-950/25"
                        : `bg-gradient-to-br ${meta.iconClass} shadow-slate-950/30`
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {!collapsed && (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold tracking-wide">{menu}</span>
                          <span
                            className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.badgeClass}`}
                          >
                            {itemCount}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400">{meta.summary}</div>
                      </div>

                      <ChevronRightIcon
                        className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                          open ? "rotate-90 text-white" : ""
                        }`}
                      />
                    </>
                  )}
                </button>

                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                    open && !collapsed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    {!collapsed && (
                      <div className="mt-2 space-y-2 rounded-2xl border border-white/8 bg-slate-950/25 p-2">
                        {items.map((item, index) => {
                          if (item.division) {
                            const divisionOpen = expandedReportDivisions[item.division];
                            const divisionActive = item.items.some(
                              (subItem) => location.pathname === subItem.route
                            );

                            return (
                              <div key={`${item.division}-${index}`} className="rounded-xl">
                                <button
                                  type="button"
                                  onClick={() => toggleReportDivision(item.division)}
                                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                                    divisionActive
                                      ? "border-sky-200/35 bg-gradient-to-r from-sky-500/28 to-indigo-500/16 text-white ring-1 ring-sky-200/15"
                                      : divisionOpen
                                        ? "border-white/10 bg-white/[0.07] text-white"
                                      : "border-transparent text-slate-300 hover:border-white/8 hover:bg-white/[0.04] hover:text-white"
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                                      {item.division}
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-slate-400">
                                      {item.items.length > 0 ? `${item.items.length} reports` : "No reports"}
                                    </div>
                                  </div>
                                  <ChevronRightIcon
                                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                                      divisionOpen ? "rotate-90 text-white" : ""
                                    }`}
                                  />
                                </button>

                                <div
                                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                    divisionOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                  }`}
                                >
                                  <div className="overflow-hidden">
                                    <div className="mt-1 space-y-1 pl-2">
                                      {item.items.length === 0 && (
                                        <div className="rounded-xl px-3 py-2 text-xs text-slate-400">
                                          No reports in this section yet.
                                        </div>
                                      )}

                                      {item.items.map((subItem) => {
                                        const activeSubItem = location.pathname === subItem.route;

                                        return (
                                          <button
                                            key={subItem.label}
                                            type="button"
                                            onClick={() => handleNavigate(subItem.route)}
                                            className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                                              activeSubItem
                                                ? "bg-gradient-to-r from-sky-500/40 via-blue-500/26 to-indigo-500/20 text-white shadow-[0_10px_24px_rgba(37,99,235,0.18),inset_0_0_0_1px_rgba(186,230,253,0.26)]"
                                                : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                                            }`}
                                          >
                                            <span
                                              className={`absolute inset-y-1 left-0 w-1 rounded-r-full ${
                                                activeSubItem ? "bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.85)]" : "bg-transparent"
                                              }`}
                                            />
                                            <span
                                              className={`h-2 w-2 shrink-0 rounded-full ${
                                                activeSubItem ? "bg-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.8)]" : "bg-slate-500"
                                              }`}
                                            />
                                            <span className={`min-w-0 flex-1 truncate ${activeSubItem ? "font-semibold" : ""}`}>
                                              {subItem.label}
                                            </span>
                                            <ChevronRightIcon
                                              className={`h-4 w-4 shrink-0 transition ${
                                                activeSubItem
                                                  ? "translate-x-0.5 text-sky-100"
                                                  : "text-slate-500 group-hover:translate-x-0.5 group-hover:text-slate-300"
                                              }`}
                                            />
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          const activeItem = location.pathname === item.route;

                          return (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => handleNavigate(item.route)}
                              className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                                activeItem
                                  ? "bg-gradient-to-r from-sky-500/40 via-blue-500/26 to-indigo-500/20 text-white shadow-[0_10px_24px_rgba(37,99,235,0.18),inset_0_0_0_1px_rgba(186,230,253,0.26)]"
                                  : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                              }`}
                            >
                              <span
                                className={`absolute inset-y-1 left-0 w-1 rounded-r-full ${
                                  activeItem ? "bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.85)]" : "bg-transparent"
                                }`}
                              />
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                  activeItem
                                    ? "bg-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.8)]"
                                    : "bg-slate-500"
                                }`}
                              />
                              <span className={`min-w-0 flex-1 truncate ${activeItem ? "font-semibold" : ""}`}>
                                {item.label}
                              </span>
                              <ChevronRightIcon
                                className={`h-4 w-4 shrink-0 transition ${
                                  activeItem
                                    ? "translate-x-0.5 text-sky-100"
                                    : "text-slate-500 group-hover:translate-x-0.5 group-hover:text-slate-300"
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="relative border-t border-white/10 bg-gradient-to-t from-white/[0.06] to-transparent p-3">
          <div
            className={`rounded-3xl border border-white/10 bg-white/[0.06] p-2 shadow-sm ${
              collapsed ? "xl:px-1.5" : ""
            }`}
          >
            <button
              ref={profileButtonRef}
              type="button"
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className={`flex w-full items-center gap-3 rounded-2xl transition hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                collapsed ? "justify-center p-2" : "px-3 py-2.5 text-left"
              }`}
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
              title={
                collapsed
                  ? `${user.name}${user.email ? ` • ${user.email}` : ""}${branch?.branches_nm ? ` • ${branch.branches_nm}` : ""}`
                  : undefined
              }
            >
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-sm font-semibold text-white shadow-lg shadow-slate-950/20">
                  {user.initials}
                </div>
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-slate-950"
                  title="Online"
                />
              </div>

              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-white">{user.name}</span>
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-slate-200">
                        {user.role}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-300/80">
                      {branch?.branches_nm || user.email || "Workspace user"}
                    </div>
                  </div>

                  <ChevronRightIcon
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                      userMenuOpen ? "rotate-90 text-white" : ""
                    }`}
                  />
                </>
              )}
            </button>
          </div>

          <div
            className={`absolute bottom-[4.5rem] left-3 right-3 origin-bottom transition-all duration-200 ${
              userMenuOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
            }`}
          >
            <div
              ref={profileMenuRef}
              className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.95))] text-slate-900 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur-xl"
            >
              <div className="h-1.5 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500" />

              <div className="px-4 pb-4 pt-4">
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg shadow-blue-950/15">
                      <UserCircleIcon className="h-7 w-7" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold text-slate-900">{user.name}</div>
                      <div className="truncate text-sm text-slate-500">{user.email || "—"}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm">
                          {user.role}
                        </span>
                        {branch?.branches_nm && (
                          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 shadow-sm">
                            {branch.branches_nm}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        Access
                      </div>
                      <div className="mt-1 text-sm font-medium text-emerald-900">{user.role}</div>
                    </div>
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                        Branch
                      </div>
                      <div className="mt-1 truncate text-sm font-medium text-sky-900">
                        {branch?.branches_nm || "Workspace user"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200/80 bg-slate-50/85 px-3 py-3">
                {user.is_admin && (
                  <button
                    type="button"
                    onClick={() => handleNavigate("/dashboard/users")}
                    className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-white hover:text-slate-900 hover:shadow-sm"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                      <UsersIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <div>Manage users</div>
                      <div className="text-xs font-normal text-slate-500">
                        Control access and branch assignments
                      </div>
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm font-medium text-rose-700 transition hover:border-rose-200 hover:bg-white hover:text-rose-800 hover:shadow-sm"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                    <ArrowLeftOnRectangleIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div>Logout</div>
                    <div className="text-xs font-normal text-rose-500">
                      End the current session safely
                    </div>
                  </div>
                </button>

                <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-500 shadow-sm">
                  <div className="flex items-start gap-2">
                    <QuestionMarkCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                    Session expires after 30 minutes of inactivity.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
