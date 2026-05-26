import { Account, Transaction } from "./types";

export const INITIAL_ACCOUNTS: Account[] = [
  {
    id: "meezan",
    name: "Meezan Bank",
    type: "Bank",
    balance: 45000,
    accountNumber: "0201-010345",
    color: "bg-emerald-850 border-emerald-700 text-white" // Islamic Green theme
  },
  {
    id: "ubl",
    name: "UBL Bank",
    type: "Bank",
    balance: 18500,
    accountNumber: "2204-987123",
    color: "bg-blue-700 border-blue-900 text-white" // Blue theme
  },
  {
    id: "habibmetro",
    name: "Habib Metro",
    type: "Bank",
    balance: 12000,
    accountNumber: "0219-556102",
    color: "bg-teal-600 border-teal-800 text-white" // Teal variant
  },
  {
    id: "cash",
    name: "Cash in Hand",
    type: "Cash",
    balance: 6500,
    color: "bg-amber-600 border-amber-800 text-white" // Amber theme
  }
];

export const AVAILABLE_BANKS = [
  { name: "Meezan Bank", type: "Bank", color: "bg-emerald-800 border-emerald-900 text-white" },
  { name: "UBL Bank", type: "Bank", color: "bg-blue-700 border-blue-900 text-white" },
  { name: "Habib Metro", type: "Bank", color: "bg-teal-600 border-teal-800 text-white" },
  { name: "HBL Bank", type: "Bank", color: "bg-emerald-600 border-emerald-800 text-white" },
  { name: "Bank Alfalah", type: "Bank", color: "bg-red-700 border-red-900 text-white" },
  { name: "Allied Bank", type: "Bank", color: "bg-orange-600 border-orange-850 text-white" },
  { name: "Faysal Bank", type: "Bank", color: "bg-blue-800 border-blue-950 text-white" },
  { name: "MCB Bank", type: "Bank", color: "bg-indigo-700 border-indigo-900 text-white" },
  { name: "Cash Wallet", type: "Cash", color: "bg-gray-700 border-gray-950 text-white" }
];

export const CATEGORIES = [
  "Salary",
  "Freelance",
  "Food & Dining",
  "Rent & Bills",
  "Fuel & Commute",
  "Utilities",
  "Shopping",
  "Entertainment",
  "Medical & Health",
  "Education",
  "Savings & Investments",
  "Other"
];

// Helper to assign a color based on category
export function getCategoryColor(category: string): string {
  switch (category) {
    case "Salary":
    case "Freelance":
      return "emerald";
    case "Food & Dining":
      return "orange";
    case "Rent & Bills":
      return "red";
    case "Fuel & Commute":
      return "amber";
    case "Utilities":
      return "indigo";
    case "Shopping":
      return "purple";
    case "Entertainment":
      return "rose";
    case "Medical & Health":
      return "pink";
    case "Education":
      return "violet";
    case "Savings & Investments":
      return "cyan";
    default:
      return "gray";
  }
}

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: "tx-1",
    accountId: "meezan",
    type: "income",
    amount: 120000,
    category: "Salary",
    description: "Monthly Salary Credited",
    date: "2026-05-01"
  },
  {
    id: "tx-2",
    accountId: "meezan",
    type: "expense",
    amount: 35000,
    category: "Rent & Bills",
    description: "Apartment Rent",
    date: "2026-05-02"
  },
  {
    id: "tx-3",
    accountId: "meezan",
    toAccountId: "cash",
    type: "transfer",
    amount: 5000,
    category: "Savings & Investments",
    description: "Atm Withdrawal to Cash",
    date: "2026-05-03"
  },
  {
    id: "tx-4",
    accountId: "cash",
    type: "expense",
    amount: 1500,
    category: "Food & Dining",
    description: "Kabab & Chai with friends",
    date: "2026-05-10"
  },
  {
    id: "tx-5",
    accountId: "ubl",
    type: "expense",
    amount: 2500,
    category: "Fuel & Commute",
    description: "Car Petrol Filling",
    date: "2026-05-20"
  },
  {
    id: "tx-6",
    accountId: "habibmetro",
    type: "income",
    amount: 15000,
    category: "Freelance",
    description: "UI Design Project freelance",
    date: "2026-05-23"
  }
];

export function formatPKR(val: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val);
}
