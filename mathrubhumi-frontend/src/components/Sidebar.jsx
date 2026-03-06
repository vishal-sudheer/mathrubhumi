import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Modal from "./Modal";
import { clearSession, getInitials, getSession } from "../utils/session";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { user: sessionUser, branch: sessionBranch } = getSession();
  const user = {
    name: sessionUser?.name || "User",
    email: sessionUser?.email || "",
    role: sessionUser?.role || "Staff",
    is_admin: Boolean(sessionUser?.is_admin || String(sessionUser?.role || "").toLowerCase() === "admin"),
    initials: getInitials(sessionUser?.name || sessionUser?.email || "User"),
  };
  const branch = sessionBranch?.branches_nm ? sessionBranch : null;

  const [collapsed, setCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({
    Masters: false,
    Transactions: false,
    Reports: false,
    Utilities: false,
    Window: false,
    Help: false,
  });
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

  const toggleMenu = (menu) => {
    setExpandedMenus((prev) => ({ ...prev, [menu]: !prev[menu] }));
  };

  const toggleReportDivision = (division) => {
    setExpandedReportDivisions((prev) => ({ ...prev, [division]: !prev[division] }));
  };

  useEffect(() => {
    if (!userMenuOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };

    const onMouseDown = (e) => {
      const btn = profileButtonRef.current;
      const menu = profileMenuRef.current;
      if (!btn || !menu) return;
      if (btn.contains(e.target) || menu.contains(e.target)) return;
      setUserMenuOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [userMenuOpen]);

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

  const closeModal = () => {
    setModal({ isOpen: false, message: "", type: "info", buttons: [] });
  };

  const performLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("lastActivityTs");
    clearSession();
    navigate("/");
    closeModal();
  };

  const toggleSidebar = () => {
    setCollapsed((prev) => !prev);
    setUserMenuOpen(false);
  };

  const menuStructure = {
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
          { label: "CIAL Sale Register", route: "/dashboard/cial-sale-register" },
        ],
      },
    ],
    Utilities: user.is_admin ? [{ label: "User Management", route: "/dashboard/users" }] : [],
    Window: [],
    Help: [],
  };

  const menuIcons = {
    Masters: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    Transactions: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    Reports: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    Utilities: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      </svg>
    ),
    Window: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
      </svg>
    ),
    Help: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const handleLogout = () => {
    showModal("Log out?", "info", [
      { label: "Cancel", onClick: closeModal, className: "bg-gray-600 hover:bg-gray-700" },
      { label: "Confirm", onClick: performLogout, className: "bg-red-600 hover:bg-red-700" },
    ]);
  };

  return (
    <div
      className={`relative h-screen ${collapsed ? "w-16" : "w-64 md:w-72"} flex flex-col transition-all duration-300 ease-in-out
      bg-gradient-to-b from-blue-800 via-blue-900 to-blue-950 text-slate-100
      border-r border-white/10 shadow-[inset_-1px_0_0_rgba(255,255,255,0.05)] overflow-hidden`}
    >
      <Modal isOpen={modal.isOpen} message={modal.message} type={modal.type} buttons={modal.buttons} />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
        <span className="font-semibold text-base tracking-wide">
          {collapsed ? (
            <svg className="w-6 h-6 text-slate-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          ) : (
            "Control Panel"
          )}
        </span>
        <button
          onClick={toggleSidebar}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-100 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition"
          aria-label={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M6 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* Dashboard Home */}
      <div
        onClick={() => navigate("/dashboard")}
        className={`mx-3 my-3 rounded-xl border border-white/10 bg-white/5 hover:bg-blue-800/40
        shadow-sm transition cursor-pointer ${collapsed ? "py-3" : "px-4 py-3"}`}
        title="Dashboard Home"
        aria-label="Dashboard Home"
      >
        {collapsed ? (
          <svg className="w-6 h-6 mx-auto text-slate-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7m-9 5v6h4v-6m-6 0h6" />
          </svg>
        ) : (
          <span className="flex items-center">
            <svg className="w-5 h-5 mr-3 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7m-9 5v6h4v-6m-6 0h6" />
            </svg>
            <span className="text-sm font-medium tracking-wide">Dashboard Home</span>
          </span>
        )}
      </div>

      {/* Menus */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 overscroll-contain">
        {Object.keys(menuStructure).map((menu) => {
          const open = expandedMenus[menu];
          return (
            <div key={menu} className="mb-1.5">
              <div
                className={`flex items-center justify-between rounded-xl px-3 py-3 cursor-pointer
                border transition-all duration-300 group
                ${open 
                  ? "bg-blue-600/20 border-blue-400/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] text-white" 
                  : "bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10 text-slate-200 hover:text-white"}`}
                onClick={() => toggleMenu(menu)}
                aria-expanded={open}
                aria-label={`${menu} menu`}
              >
                <span className="flex items-center">
                  <span className={`transition-colors duration-300 ${open ? "text-blue-300" : "text-slate-300 group-hover:text-blue-200"}`}>{menuIcons[menu]}</span>
                  {!collapsed && (
                    <span className="ml-3 text-sm font-medium tracking-wide">{menu}</span>
                  )}
                </span>
                {!collapsed && (
                  <svg
                    className={`w-4 h-4 transition-all duration-300 ${open ? "rotate-90 text-blue-300" : "text-slate-400 group-hover:text-slate-200"}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>

              {/* Animated submenu with scroll */}
              <div
                className={`grid transition-[grid-template-rows,opacity,transform] duration-300 ease-in-out
                ${open && !collapsed ? "grid-rows-[1fr] opacity-100 translate-y-0" : "grid-rows-[0fr] opacity-0 -translate-y-2"}`}
              >
                <div className="overflow-hidden">
                {!collapsed && (
                  <ul className="mt-2 mb-2 ml-[22px] relative before:absolute before:inset-y-0 before:left-[3px] before:w-px before:bg-gradient-to-b before:from-blue-400/40 before:via-blue-400/10 before:to-transparent rounded-xl bg-black/10 backdrop-blur-md max-h-[40rem] overflow-y-auto scrollbar-thin scrollbar-thumb-blue-500/40 scrollbar-track-transparent py-1.5 shadow-inner">
                    {menuStructure[menu].length === 0 && (
                      <li className="px-3 py-2 text-xs text-slate-300">No items</li>
                    )}
                    {menuStructure[menu].map((item, idx) => {
                      if (item.division) {
                        const isDivisionExpanded = expandedReportDivisions[item.division];
                        return (
                          <div key={item.division || idx} className="mb-1 first:mt-1">
                            <div
                              className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded-lg mx-2 transition-all duration-200 select-none ${isDivisionExpanded ? "bg-blue-900/40 text-blue-100 border border-blue-500/10" : "hover:bg-white/5 text-blue-200/80 border border-transparent"}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleReportDivision(item.division);
                              }}
                            >
                              <span className="text-[11px] font-bold uppercase tracking-wider">
                                {item.division}
                              </span>
                              <svg
                                className={`w-3.5 h-3.5 transition-all duration-300 ${isDivisionExpanded ? "rotate-90 text-blue-300" : "text-blue-300/60"}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                            <div
                              className={`grid transition-[grid-template-rows,opacity,transform] duration-300 ease-in-out ${isDivisionExpanded ? "grid-rows-[1fr] opacity-100 translate-y-0" : "grid-rows-[0fr] opacity-0 -translate-y-1"}`}
                            >
                              <div className="overflow-hidden">
                              {item.items.length === 0 && (
                                <div className="px-5 py-2 text-[11px] text-slate-400 italic">No reports</div>
                              )}
                              {item.items.map((subItem) => (
                                <li
                                  key={subItem.label}
                                  onClick={() => navigate(subItem.route)}
                                  className={`group relative flex items-center gap-3 px-3 py-1.5 min-h-[32px] text-[12px] font-medium rounded-lg mx-3 my-0.5 cursor-pointer transition-all duration-200 pl-4
                                  ${location.pathname === subItem.route
                                    ? "text-white bg-blue-500/15" 
                                    : "text-slate-400 hover:text-white hover:bg-blue-500/5"}`}
                                >
                                  {/* Active State Indicator Strip */}
                                  <span className={`absolute -left-[3px] w-[3px] rounded-r-full transition-all duration-300 top-1/2 -translate-y-1/2 shadow-[0_0_6px_rgba(96,165,250,0.6)]
                                    ${location.pathname === subItem.route ? "bg-blue-400 h-[60%] opacity-100" : "bg-blue-400 h-0 opacity-0 group-hover:h-[40%] group-hover:opacity-100"}`} />
                                  
                                  {/* Replaced dot with a chevron-like dash icon */}
                                  <span className={`flex-shrink-0 relative z-10 transition-all duration-300
                                    ${location.pathname === subItem.route ? "text-blue-400 translate-x-1" : "text-slate-500/60 group-hover:text-blue-400 group-hover:translate-x-0.5"}`}>
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                    </svg>
                                  </span>
                                  
                                  <span className={`truncate transition-transform duration-200 ${location.pathname === subItem.route ? "translate-x-1 font-semibold" : "group-hover:translate-x-0.5"}`}>{subItem.label}</span>
                                </li>
                              ))}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <li
                          key={item.label}
                          onClick={() => navigate(item.route)}
                          className={`group relative flex items-center gap-3 px-3 py-2 min-h-[36px] text-[13px] font-medium rounded-lg mx-2 my-0.5 cursor-pointer transition-all duration-200
                          ${location.pathname === item.route
                            ? "text-white bg-blue-500/15" 
                            : "text-slate-300 hover:text-white hover:bg-blue-500/5"}`}
                        >
                          {/* Active State Indicator Strip */}
                          <span className={`absolute -left-[5px] w-[5px] rounded-r-full transition-all duration-300 top-1/2 -translate-y-1/2 shadow-[0_0_8px_rgba(96,165,250,0.6)]
                            ${location.pathname === item.route ? "bg-blue-400 h-[60%] opacity-100" : "bg-blue-400 h-0 opacity-0 group-hover:h-[40%] group-hover:opacity-100"}`} />
                          
                          {/* Replaced dot with a stylish icon */}
                          <span className={`flex-shrink-0 relative z-10 transition-all duration-300
                            ${location.pathname === item.route ? "text-blue-400 translate-x-1" : "text-slate-500/60 group-hover:text-blue-400 group-hover:translate-x-0.5"}`}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                          
                          <span className={`truncate transition-transform duration-200 ${location.pathname === item.route ? "translate-x-1 font-semibold" : "group-hover:translate-x-0.5"}`}>{item.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Profile Footer */}
      <div className="relative p-3 border-t border-white/10 bg-white/5 backdrop-blur-sm">
        <div className={`rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 shadow-sm ${collapsed ? "p-1.5" : "p-2"}`}>
          <button
            ref={profileButtonRef}
            onClick={() => setUserMenuOpen((s) => !s)}
            className={`w-full rounded-xl ${collapsed ? "p-2 justify-center" : "px-3 py-2"} transition flex items-center gap-3
              hover:bg-blue-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400`}
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
            title={
              collapsed
                ? `${user.name}${user.email ? ` • ${user.email}` : ""}${branch?.branches_nm ? ` • ${branch.branches_nm}` : ""}`
                : undefined
            }
          >
            {/* Avatar */}
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white text-xs font-semibold shadow ring-1 ring-white/20">
                {user.initials}
              </div>
              <span
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-blue-950/80"
                title="Online"
              />
            </div>

            {!collapsed && (
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-100">{user.name}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-blue-100">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${String(user.role).toLowerCase() === "admin"
                        ? "bg-emerald-400"
                        : String(user.role).toLowerCase() === "manager"
                          ? "bg-sky-400"
                          : "bg-slate-300"
                        }`}
                    />
                    {user.role}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-300/80 min-w-0">
                  <span className="truncate">{user.email || "—"}</span>
                  {branch?.branches_nm && (
                    <>
                      <span className="text-slate-400/60">•</span>
                      <span className="truncate">{branch.branches_nm}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {!collapsed && (
              <div className="flex items-center">
                <div className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
                  <svg
                    className={`h-4 w-4 transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}
          </button>
        </div>

        {/* Drop-up menu (stays within sidebar) */}
        <div
          className={`absolute left-3 right-3 bottom-16 transition-all duration-200 origin-bottom
            ${userMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}
        >
          <div
            ref={profileMenuRef}
            className="rounded-2xl border border-white/10 bg-blue-950/90 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-4 border-b border-white/10">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-slate-100 ring-1 ring-white/10">
                  <span className="text-xs font-semibold">{user.initials}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-100 truncate">{user.name}</div>
                  <div className="text-xs text-slate-300/80 truncate">{user.email || "—"}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-blue-100">
                      {user.role}
                    </span>
                    {branch?.branches_nm && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-blue-100/90">
                        <svg className="h-3.5 w-3.5 text-blue-200/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 6h10M7 14h10M5 18h14" />
                        </svg>
                        <span className="truncate max-w-[180px]">{branch.branches_nm}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <ul className="py-2">
              {user.is_admin && (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      navigate("/dashboard/users");
                      setUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-100 hover:bg-blue-900/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Manage users
                  </button>
                </li>
              )}
              <li className="border-t border-white/10 my-1" />
              <li>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-rose-200 hover:bg-rose-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h3a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
