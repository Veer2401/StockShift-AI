export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin";
  avatar?: string;
  companyName?: string;
  state?: string;
  city?: string;
  onboardingCompleted?: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unitCost: number;
  sellPrice: number;
  reorderPoint: number;
  location: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  itemId: string;
  itemName: string;
  type: "in" | "out";
  quantity: number;
  date: string;
  performedBy: string;
  notes?: string;
}

export interface FinancialSummary {
  month: string;
  revenue: number;
  costs: number;
  profit: number;
  itemsSold: number;
  itemsPurchased: number;
}

export interface CostEntry {
  id: string;
  date: string;
  category: string;
  amount: number;
  description?: string;
  relatedItemId?: string;
}

export interface CategorySpending {
  category: string;
  amount: number;
  budget: number;
}

export interface AiRecommendation {
  id: string;
  itemId: string;
  itemName: string;
  currentStock: number;
  recommendedStock: number;
  changePercent: number;
  rationale: string;
  timeHorizon: "30d" | "60d" | "90d";
  confidence: "low" | "medium" | "high";
  createdAt: string;
}

export interface YearlyForecastSummary {
  year: number;
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
}

export interface ReportConfig {
  id: string;
  title: string;
  description: string;
  type: "valuation" | "movement" | "financial";
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson?: string;
  email: string;
  phone?: string;
  address?: string;
  leadTimeDays: number;
  minOrderQty: number;
  paymentTerms?: string;
  notes?: string;
  createdAt?: string;
}

export interface PurchaseOrderItem {
  itemId: string;
  itemName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId?: string;
  vendorName: string;
  status: "draft" | "sent" | "received" | "cancelled";
  totalAmount: number;
  items: PurchaseOrderItem[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}
