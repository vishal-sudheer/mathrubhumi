import React, { useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { Routes, Route, useNavigate } from "react-router-dom";
import DashboardHome from "./DashboardHome";
import SaleBill from "./Transactions/SaleBill";
import GoodsInward from "./Transactions/GoodsInward";
import SaleBillReturn from "./Transactions/SaleBillReturn";
import PPReceiptEntry from "./Transactions/PPReceiptEntry";
import RemittanceEntry from "./Transactions/RemittanceEntry";
import CreditRealisationEntry from "./Transactions/CreditRealisationEntry";
import GoodsInwardReturn from "./Transactions/GoodsInwardReturn";
import CategoriesMaster from "./Masters/CategoriesMaster";
import SubCategoriesMaster from "./Masters/SubCategoriesMaster";
import PublisherMaster from "./Masters/PublisherMaster";
import AuthorMaster from "./Masters/AuthorMaster";
import TitleMaster from "./Masters/TitleMaster";
import PPBooksMaster from "./Masters/PPBooksMaster";
import PlacesMaster from "./Masters/PlacesMaster";
import SupplierMaster from "./Masters/SupplierMaster";
import CreditCustomerMaster from "./Masters/CreditCustomerMaster";
import PPCustomersMaster from "./Masters/PPCustomersMaster";
import PrivilegersMaster from "./Masters/PrivilegersMaster";
import AgentsMaster from "./Masters/AgentsMaster";
import PurchaseBreakupsMaster from "./Masters/PurchaseBreakupsMaster";
import RoyaltyRecipientsMaster from "./Masters/RoyaltyRecipientsMaster";
import UserManagement from "./Admin/UserManagement";
import BillWiseSaleRegister from "./Reports/BillWiseSaleRegister";
import CialSaleRegister from "./Reports/CialSaleRegister";
import DailyAccountStatement from "./Reports/DailyAccountStatement";
import AbcSaleRegister from "./Reports/AbcSaleRegister";
import SalesAgentWise from "./Reports/SalesAgentWise";
import DailyStockStatement from "./Reports/DailyStockStatement";
import SaleAndStock from "./Reports/SaleAndStock";
import AuthorPublisherSales from "./Reports/AuthorPublisherSales";
import AuthorWiseTitleSales from "./Reports/AuthorWiseTitleSales";
import CreditCustomerWiseSales from "./Reports/CreditCustomerWiseSales";
import CategoryPublisherAuthorWiseSales from "./Reports/CategoryPublisherAuthorWiseSales";
import CategoryWiseSales from "./Reports/CategoryWiseSales";
import SaleClassRatio from "./Reports/SaleClassRatio";
import PublisherAuthorWiseSales from "./Reports/PublisherAuthorWiseSales";
import TypeWiseSaleRegister from "./Reports/TypeWiseSaleRegister";
import SubCategoryModeProductWiseSales from "./Reports/SubCategoryModeProductWiseSales";
import DateWiseSaleRegister from "./Reports/DateWiseSaleRegister";

const Dashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem("access")) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-auto pt-16 xl:pt-0">
        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="goods-inward" element={<GoodsInward />} />
          <Route path="sale-bill" element={<SaleBill />} />
          <Route path="goods-inward-return" element={<GoodsInwardReturn />} />
          <Route path="sale-bill-return" element={<SaleBillReturn />} />
          <Route path="pp-receipt-entry" element={<PPReceiptEntry />} />
          <Route path="remittance-entry" element={<RemittanceEntry />} />
          <Route path="credit-realisation-entry" element={<CreditRealisationEntry />} />
          <Route path="categories-master" element={<CategoriesMaster />} />
          <Route path="sub-categories-master" element={<SubCategoriesMaster />} />
          <Route path="publisher-master" element={<PublisherMaster />} />
          <Route path="author-master" element={<AuthorMaster />} />
          <Route path="title-master" element={<TitleMaster />} />
          <Route path="pp-books-master" element={<PPBooksMaster />} />
          <Route path="places-master" element={<PlacesMaster />} />
          <Route path="supplier-master" element={<SupplierMaster />} />
          <Route path="credit-customer-master" element={<CreditCustomerMaster />} />
          <Route path="pp-customers-master" element={<PPCustomersMaster />} />
          <Route path="privilegers-master" element={<PrivilegersMaster />} />
          <Route path="agents-master" element={<AgentsMaster />} />
          <Route path="purchase-breakups-master" element={<PurchaseBreakupsMaster />} />
          <Route path="royalty-recipients-master" element={<RoyaltyRecipientsMaster />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="bill-wise-sale-register" element={<BillWiseSaleRegister />} />
          <Route path="cial-sale-register" element={<CialSaleRegister />} />
          <Route path="daily-account-statement" element={<DailyAccountStatement />} />
          <Route path="abc-sale-register" element={<AbcSaleRegister />} />
          <Route path="sales-agent-wise" element={<SalesAgentWise />} />
          <Route path="daily-stock-statement" element={<DailyStockStatement />} />
          <Route path="sale-and-stock" element={<SaleAndStock />} />
          <Route path="author-publisher-sales" element={<AuthorPublisherSales />} />
          <Route path="author-wise-title-sales" element={<AuthorWiseTitleSales />} />
          <Route path="credit-customer-wise-sales" element={<CreditCustomerWiseSales />} />
          <Route path="category-publisher-author-wise-sales" element={<CategoryPublisherAuthorWiseSales />} />
          <Route path="category-wise-sales" element={<CategoryWiseSales />} />
          <Route path="sale-class-ratio" element={<SaleClassRatio />} />
          <Route path="publisher-author-wise-sales" element={<PublisherAuthorWiseSales />} />
          <Route path="type-wise-sale-register" element={<TypeWiseSaleRegister />} />
          <Route path="sub-category-mode-product-wise-sales" element={<SubCategoryModeProductWiseSales />} />
          <Route path="date-wise-sale-register" element={<DateWiseSaleRegister />} />
        </Routes>
      </main>
    </div>
  );
};

export default Dashboard;
