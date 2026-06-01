export interface Account {
  id: string;
  name: string; // e.g., "Meezan Bank", "UBL", "Habib Metro", "Cash", etc.
  type: string; // "Bank", "Wallet", "Cash", "Credit Card"
  balance: number;
  accountNumber?: string;
  color: string; // Tailwind color class or hex (e.g., bg-emerald-500)
}

export type TransactionType = "income" | "expense" | "transfer";

export interface Transaction {
  id: string;
  accountId: string; // Source account (for transfers, where money comes from)
  toAccountId?: string; // Target account (for transfers)
  type: TransactionType;
  amount: number;
  category: string; // e.g., "Food", "Rent", "Salary", "Fuel", "Utilities", "Shopping", "Entertainment", "Medical", "Other"
  description: string;
  date: string; // ISO date format "YYYY-MM-DD" or full timestamp
}

export interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  status?: "pending" | "parsed" | "error";
  parsedTx?: Partial<Transaction>;
}

export interface CategoryBudget {
  category: string;
  limit: number;
  spent: number;
}

export interface Debt {
  id: string;
  person: string;
  amount: number;
  type: "receive" | "pay"; // receive (lainey hain), pay (dainey hain)
  date: string;
  notes: string;
  status: "pending" | "settled";
}

export interface ScheduledExpense {
  id: string;
  accountId: string;
  amount: number;
  category: string;
  description: string;
  date: string; // ISO format YYYY-MM-DD
  status: "pending" | "paid";
}


