import React, { useState, useEffect, useRef } from "react";
import { Account, Transaction, ChatMessage } from "./types";
import { INITIAL_ACCOUNTS, INITIAL_TRANSACTIONS, CATEGORIES, formatPKR, getCategoryColor } from "./data";
import { 
  Plus, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowLeftRight, 
  Wallet, 
  Sparkles, 
  MessageSquare, 
  Calendar, 
  ChevronRight, 
  Search, 
  Filter, 
  RefreshCw, 
  Info, 
  X, 
  ChevronDown, 
  TrendingUp, 
  Lightbulb, 
  Mic, 
  Send 
} from "lucide-react";

export default function App() {
  // ---- state management ----
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const saved = localStorage.getItem("wall_accounts");
    return saved ? JSON.parse(saved) : INITIAL_ACCOUNTS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem("wall_transactions");
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "accounts" | "transactions" | "ai">("overview");
  const [timeFilter, setTimeFilter] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  
  // chat state
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const defaultMessages: ChatMessage[] = [
      {
        id: "msg-1",
        sender: "bot",
        text: "Assalam-o-Alaikum! Main aapka personal finance AI assistant hoon. 🇵🇰\n\nAap Roman Urdu ya English me likh sakte hain, jaise:\n• *\"Salary received 50k in UBL bank\"*\n• *\"Meezan se petrol k liye 2500 ka expense add karo\"*\n• *\"Meri income k hisab se best savings plan kiya hai?\"*",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
    return defaultMessages;
  });
  const [isAiLoading, setIsAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Manual Transaction Modal State
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [txType, setTxType] = useState<"income" | "expense" | "transfer">("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txCategory, setTxCategory] = useState("Food & Dining");
  const [txDescription, setTxDescription] = useState("");
  const [txAccountId, setTxAccountId] = useState(accounts[0]?.id || "");
  const [txToAccountId, setTxToAccountId] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);

  // Account creation quick variables
  const [isAddAccOpen, setIsAddAccOpen] = useState(false);
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState("Bank");
  const [newAccBalance, setNewAccBalance] = useState("");
  const [newAccNumber, setNewAccNumber] = useState("");

  // Account editing variables
  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [editAccName, setEditAccName] = useState("");
  const [editAccType, setEditAccType] = useState("Bank");
  const [editAccBalance, setEditAccBalance] = useState("");
  const [editAccNumber, setEditAccNumber] = useState("");

  // Saving Advisor targeted Plan calculations
  const [planOpen, setPlanOpen] = useState(false);
  const [savingTarget, setSavingTarget] = useState("50,000");
  const [savingTargetDuration, setSavingTargetDuration] = useState("6");
  const [customPlanReply, setCustomPlanReply] = useState<string | null>(null);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem("wall_accounts", JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem("wall_transactions", JSON.stringify(transactions));
  }, [transactions]);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ---- calculation helpers ----
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  // Filtering transactions by visual tab/time duration
  const getFilteredTransactions = () => {
    let list = [...transactions];
    if (selectedAccountId) {
      list = list.filter(t => t.accountId === selectedAccountId || t.toAccountId === selectedAccountId);
    }

    const now = new Date();
    return list.filter(t => {
      const txDateObj = new Date(t.date);
      const diffTime = Math.abs(now.getTime() - txDateObj.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (timeFilter === "daily") {
        return diffDays <= 1 || t.date === now.toISOString().split("T")[0];
      } else if (timeFilter === "weekly") {
        return diffDays <= 7;
      } else if (timeFilter === "monthly") {
        return diffDays <= 30;
      } else {
        return diffDays <= 365;
      }
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const filteredTxs = getFilteredTransactions();

  // Metrics specifically for the currently filtered set of transactions
  const totalIncome = filteredTxs
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = filteredTxs
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  // Net Savings
  const netSavings = totalIncome - totalExpense;

  // Manual Transaction creation
  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(txAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    // Apply ledger adjustments
    const updatedAccounts = accounts.map(acc => {
      if (txType === "income" && acc.id === txAccountId) {
        return { ...acc, balance: acc.balance + amountNum };
      }
      if (txType === "expense" && acc.id === txAccountId) {
        return { ...acc, balance: acc.balance - amountNum };
      }
      if (txType === "transfer") {
        if (acc.id === txAccountId) {
          return { ...acc, balance: acc.balance - amountNum };
        }
        if (acc.id === txToAccountId) {
          return { ...acc, balance: acc.balance + amountNum };
        }
      }
      return acc;
    });

    const newTx: Transaction = {
      id: `manual-tx-${Date.now()}`,
      accountId: txAccountId,
      toAccountId: txType === "transfer" ? txToAccountId : undefined,
      type: txType,
      amount: amountNum,
      category: txCategory,
      description: txDescription || `${txType} transaction`,
      date: txDate
    };

    setAccounts(updatedAccounts);
    setTransactions([newTx, ...transactions]);
    setIsAddTxOpen(false);

    // reset fields
    setTxAmount("");
    setTxDescription("");
  };

  // Remove single transaction
  const handleDeleteTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    // Reverse ledger balance adjustments
    const updatedAccounts = accounts.map(acc => {
      if (tx.type === "income" && acc.id === tx.accountId) {
        return { ...acc, balance: acc.balance - tx.amount };
      }
      if (tx.type === "expense" && acc.id === tx.accountId) {
        return { ...acc, balance: acc.balance + tx.amount };
      }
      if (tx.type === "transfer") {
        if (acc.id === tx.accountId) {
          return { ...acc, balance: acc.balance + tx.amount };
        }
        if (acc.id === tx.toAccountId) {
          return { ...acc, balance: acc.balance - tx.amount };
        }
      }
      return acc;
    });

    setAccounts(updatedAccounts);
    setTransactions(transactions.filter(t => t.id !== id));
  };

  // Add individual Bank Account custom
  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const balNum = parseFloat(newAccBalance) || 0;
    if (!newAccName.trim()) return;

    const tailwindColors = [
      "bg-stone-800 border-stone-700 text-stone-100",
      "bg-indigo-900 border-indigo-950 text-indigo-50",
      "bg-emerald-900 border-emerald-950 text-emerald-50",
      "text-stone-900 bg-white border-stone-200"
    ];

    const randomColor = tailwindColors[accounts.length % tailwindColors.length];

    const newAcc: Account = {
      id: `acc-${Date.now()}`,
      name: newAccName,
      type: newAccType,
      balance: balNum,
      accountNumber: newAccNumber || "Personal Core",
      color: randomColor
    };

    setAccounts([...accounts, newAcc]);
    setIsAddAccOpen(false);
    setNewAccName("");
    setNewAccBalance("");
    setNewAccNumber("");
  };

  // Save changes to an existing account
  const handleSaveAccountEdit = (id: string) => {
    const balNum = parseFloat(editAccBalance) || 0;
    if (!editAccName.trim()) return;

    setAccounts(accounts.map(acc => {
      if (acc.id === id) {
        return {
          ...acc,
          name: editAccName,
          type: editAccType,
          balance: balNum,
          accountNumber: editAccNumber || "Personal Core"
        };
      }
      return acc;
    }));
    setEditingAccId(null);
  };

  // Delete an existings bank/wallet account
  const handleDeleteAccount = (id: string) => {
    if (accounts.length <= 1) {
      return;
    }
    setAccounts(accounts.filter(acc => acc.id !== id));
    if (txAccountId === id) {
      const remaining = accounts.filter(acc => acc.id !== id);
      if (remaining.length > 0) {
        setTxAccountId(remaining[0].id);
      }
    }
  };

  // AI chat callout
  const handleSendAiChat = async (inputStr?: string) => {
    const textToSend = inputStr || chatInput;
    if (!textToSend.trim()) return;

    // Add user message to stack
    const userMsg: ChatMessage = {
      id: `user-msg-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    if (!inputStr) {
      setChatInput("");
    }
    setIsAiLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          accounts: accounts,
          categories: CATEGORIES,
          currentTime: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error("API call failed");
      }

      const data = await response.json();
      
      // Update states if Gemini performed a structured action
      if (data.action === "add_transaction" && data.transaction) {
        const parsed = data.transaction;
        const amt = parseFloat(parsed.amount);

        if (amt > 0) {
          // Identify account by close matching
          let selectedId = accounts[0]?.id;
          if (parsed.accountId) {
            const matched = accounts.find(a => 
              a.id.toLowerCase() === parsed.accountId.toLowerCase() ||
              a.name.toLowerCase().includes(parsed.accountId.toLowerCase())
            );
            if (matched) selectedId = matched.id;
          }

          let toSelectedId = undefined;
          if (parsed.toAccountId) {
            const matchedTo = accounts.find(a => 
              a.id.toLowerCase() === parsed.toAccountId.toLowerCase() ||
              a.name.toLowerCase().includes(parsed.toAccountId.toLowerCase())
            );
            if (matchedTo) toSelectedId = matchedTo.id;
          }

          // Generate state changes
          const updated = accounts.map(acc => {
            if (parsed.type === "income" && acc.id === selectedId) {
              return { ...acc, balance: acc.balance + amt };
            }
            if (parsed.type === "expense" && acc.id === selectedId) {
              return { ...acc, balance: acc.balance - amt };
            }
            if (parsed.type === "transfer") {
              if (acc.id === selectedId) {
                return { ...acc, balance: acc.balance - amt };
              }
              if (toSelectedId && acc.id === toSelectedId) {
                return { ...acc, balance: acc.balance + amt };
              }
            }
            return acc;
          });

          const newParsedTx: Transaction = {
            id: `ai-tx-${Date.now()}`,
            accountId: selectedId,
            toAccountId: toSelectedId,
            type: parsed.type,
            amount: amt,
            category: parsed.category || "Other",
            description: parsed.description || "AI processed transaction",
            date: new Date().toISOString().split("T")[0]
          };

          setAccounts(updated);
          setTransactions(prev => [newParsedTx, ...prev]);
        }
      }

      const botMsg: ChatMessage = {
        id: `bot-msg-${Date.now()}`,
        sender: "bot",
        text: data.responseText || "Main samjh nahi saka, maziid tafseel btaen.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        parsedTx: data.transaction || undefined
      };

      setChatMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      console.error(err);
      const errMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        sender: "bot",
        text: "Kuch masla pesh aaya. Baraye meherbani internet connection check karein ya direct manual input use karein.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: "error"
      };
      setChatMessages(prev => [...prev, errMsg]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Triggering the specific personalized savings plans requested by user "best saving plan k hisab se"
  const fetchSavingPlan = async () => {
    const budgetPrompt = `Meri monthly income or expense ratios ko review karke customized Pakistan savings plan generate karein. 
Target savings: Rs. ${savingTarget} PKR duration k liye: ${savingTargetDuration} months. 
Mery pas total balance abhi Rs. ${totalBalance} PKR hai. 
Kuch real halal mutual funds (like Meezan Rozana Amdani Fund, Al-Meezan etc) or banks k rates k refer k sath short pointers bnayen. Custom structure btao.`;
    
    setCustomPlanReply(null);
    setPlanOpen(true);
    setIsAiLoading(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: budgetPrompt,
          accounts: accounts,
          categories: CATEGORIES,
          currentTime: new Date().toISOString()
        })
      });

      const resJson = await resp.json();
      setCustomPlanReply(resJson.responseText);
    } catch {
      setCustomPlanReply("Asaan aur personalized plan fetch karny mai error aya. Plz try again later.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Simple clean report calculation (Category chart data)
  const categorySummary = CATEGORIES.map(cat => {
    const spent = filteredTxs
      .filter(t => t.category === cat && t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    return { name: cat, value: spent };
  }).filter(c => c.value > 0);

  const totalSpentOnCategories = categorySummary.reduce((sum, c) => sum + c.value, 0);

  // Quick prompt suggestions
  const PROMPT_SUGGESTIONS = [
    "Habib Metro may 200 ka expense tea ka add karo",
    "Meezan se 500 nikal k cash mai transfer kardo",
    "UBL bank se Freelance income aayi 45000 PKR",
    "Mujhy UBL saving plan rates explain karo",
    "Mery budget k hisab se best financial savings plan kiya hai?"
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1B] flex flex-col font-sans transition-all duration-300">
      
      {/* Top Banner Status Bar - Pure, humble title */}
      <div className="bg-stone-900 text-stone-300 text-xs px-6 py-2 flex items-center justify-between font-mono tracking-tight z-10 border-b border-stone-800">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>AIS SERVER SECURE STATUS: ONLINE</span>
        </div>
        <div className="flex items-center gap-4">
          <span>PORT: 3000</span>
          <span>CURRENCY: PKR (Rs.)</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-32px)] overflow-hidden">
        
        {/* Left Sidebar Navigation */}
        <aside id="sidebar" className="w-full md:w-64 bg-white border-r border-[#E5E7EB] flex flex-col shrink-0">
          <div className="p-6">
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm">
                W
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight font-display text-stone-900 leading-tight">AI Wallet app</h1>
                <p className="text-[10px] text-stone-400 font-medium">PKR Multi-Bank Ledger</p>
              </div>
            </div>

            <nav className="space-y-1.5">
              <button
                id="btn-tab-overview"
                onClick={() => setActiveTab("overview")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-200 ${
                  activeTab === "overview"
                    ? "bg-blue-50 text-blue-600 shadow-xs"
                    : "text-stone-600 hover:bg-stone-50"
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>Overview Dashboard</span>
              </button>

              <button
                id="btn-tab-accounts"
                onClick={() => setActiveTab("accounts")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-200 ${
                  activeTab === "accounts"
                    ? "bg-blue-50 text-blue-600 shadow-xs"
                    : "text-stone-600 hover:bg-stone-50"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>All Banks & Wallets</span>
                <span className="ml-auto bg-stone-100 text-stone-600 text-[10px] px-1.5 py-0.5 rounded-md font-mono">
                  {accounts.length}
                </span>
              </button>

              <button
                id="btn-tab-transactions"
                onClick={() => setActiveTab("transactions")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-200 ${
                  activeTab === "transactions"
                    ? "bg-blue-50 text-blue-600 shadow-xs"
                    : "text-stone-600 hover:bg-stone-50"
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Transactions Core</span>
                <span className="ml-auto bg-stone-100 text-stone-600 text-[10px] px-1.5 py-0.5 rounded-md font-mono">
                  {transactions.length}
                </span>
              </button>

              <button
                id="btn-tab-ai"
                onClick={() => setActiveTab("ai")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-200 ${
                  activeTab === "ai"
                    ? "bg-emerald-50 text-emerald-700 shadow-xs"
                    : "text-stone-600 hover:bg-stone-50"
                }`}
              >
                <Sparkles className="w-4 h-4 text-emerald-600 animate-bounce" />
                <span>Gemini Savings Expert</span>
                <span className="ml-auto bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                  Active
                </span>
              </button>
            </nav>
          </div>

          <div className="mt-auto p-4 border-t border-[#E5E7EB]">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-4 rounded-xl relative overflow-hidden shadow-xs">
              <div className="absolute right-[-20px] bottom-[-20px] w-20 h-20 bg-white/10 rounded-full"></div>
              <p className="text-[10px] uppercase tracking-widest font-extrabold opacity-75 mb-1.5">AI Smart Advisor</p>
              <p className="text-xs leading-relaxed font-normal mb-3">
                Do you want to plan your future savings or Hajj plans based on your income streams?
              </p>
              <button 
                id="btn-load-plan-quick"
                onClick={fetchSavingPlan}
                className="w-full py-1.5 bg-white text-stone-900 hover:bg-stone-50 active:scale-95 transition-all text-[11px] font-bold rounded-lg shadow-xs"
              >
                Launch Pakistan Saving Plan
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Pane */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          
          {/* Main Top Header bar */}
          <header className="h-16 bg-white border-b border-[#E5E7EB] px-8 flex items-center justify-between shrink-0">
            <div>
              <h2 className="font-display font-bold text-stone-800 text-base flex items-center gap-2 uppercase tracking-wide">
                <span>{activeTab === "overview" && "Dashboard Overview"}</span>
                <span>{activeTab === "accounts" && "Linked Accounts & Banks"}</span>
                <span>{activeTab === "transactions" && "Financial Ledger records"}</span>
                <span>{activeTab === "ai" && "Gemini Savings AI Advisor"}</span>
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-400 font-mono font-medium">
                {new Date().toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" 
                alt="Account Holder Avatar" 
                className="w-8 h-8 rounded-full border border-stone-200"
              />
            </div>
          </header>

          <div className="p-6 space-y-6">
            
            {/* 4 Multi-Account Stats Metrics Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative transition-all hover:border-stone-300">
                <p className="text-[10px] text-stone-400 mb-1 font-bold uppercase tracking-wider font-mono">Net Assets / Total Balance</p>
                <p className="text-2xl font-bold font-display text-stone-900 tracking-tight">{formatPKR(totalBalance)}</p>
                <div className="text-[10px] text-stone-500 mt-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                  <span>Calculated across {accounts.length} account types</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative transition-all hover:border-stone-300">
                <p className="text-[10px] text-stone-400 mb-1 font-bold uppercase tracking-wider font-mono">Income this Period ({timeFilter})</p>
                <p className="text-2xl font-bold font-display text-blue-600 tracking-tight">{formatPKR(totalIncome)}</p>
                <div className="text-[10px] text-emerald-600 mt-2 font-semibold font-mono">
                  Active earnings
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative transition-all hover:border-stone-300">
                <p className="text-[10px] text-stone-400 mb-1 font-bold uppercase tracking-wider font-mono">Total Expense ({timeFilter})</p>
                <p className="text-2xl font-bold font-display text-red-500 tracking-tight">{formatPKR(totalExpense)}</p>
                <div className="text-[10px] text-stone-500 mt-2 font-mono">
                  {totalIncome > 0 ? `${Math.round((totalExpense / totalIncome) * 100)}% of income used` : "No income recorded"}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative transition-all hover:border-stone-300">
                <p className="text-[10px] text-stone-400 mb-1 font-bold uppercase tracking-wider font-mono">Net Period Savings</p>
                <p className={`text-2xl font-bold font-display tracking-tight ${netSavings >= 0 ? "text-emerald-700" : "text-yellow-600"}`}>
                  {formatPKR(netSavings)}
                </p>
                <div className="text-[10px] text-stone-500 mt-2">
                  Target threshold active
                </div>
              </div>
            </div>

            {/* Interval Filtering Selector tabs */}
            <div className="bg-white p-3 rounded-xl border border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500 font-medium">Record Duration Filter:</span>
                <div className="flex bg-stone-100 p-1 rounded-lg">
                  {["daily", "weekly", "monthly", "yearly"].map((f) => (
                    <button
                      id={`btn-filter-${f}`}
                      key={f}
                      onClick={() => setTimeFilter(f as any)}
                      className={`px-3 py-1 text-xs capitalize font-semibold rounded-md transition-all ${
                        timeFilter === f 
                          ? "bg-white text-stone-950 shadow-xs" 
                          : "text-stone-500 hover:text-stone-900"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  id="btn-open-tx-modal"
                  onClick={() => setIsAddTxOpen(true)}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add New Record manually
                </button>
              </div>
            </div>

            {/* TAB CONTENTS */}

            {/* tab 1: OVERVIEW */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left pane: Bank Accounts quick stats list */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase font-extrabold tracking-widest text-stone-400 font-mono">Accounts & Wallets ({accounts.length})</h3>
                    <button 
                      id="btn-quick-acc-toggle"
                      onClick={() => setIsAddAccOpen(true)}
                      className="text-xs text-blue-600 font-bold hover:underline"
                    >
                      + Add account
                    </button>
                  </div>

                  <div className="space-y-3">
                    {accounts.map(acc => {
                      const isSelected = selectedAccountId === acc.id;
                      return (
                        <div
                          id={`quick-acc-card-${acc.id}`}
                          key={acc.id}
                          onClick={() => setSelectedAccountId(isSelected ? null : acc.id)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer ${
                            isSelected 
                              ? "bg-stone-900 text-white border-stone-900 shadow-sm"
                              : "bg-white hover:bg-stone-50 border-stone-200"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                                acc.type === "Bank" 
                                  ? "bg-blue-100 text-blue-800" 
                                  : acc.type === "Outside of Wallet"
                                    ? "bg-purple-100 text-purple-800 font-mono"
                                    : "bg-emerald-100 text-emerald-800"
                              }`}>
                                {acc.name.substring(0,2).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-xs font-bold leading-none">{acc.name}</p>
                                <span className={`text-[9px] ${isSelected ? "text-stone-400" : "text-stone-500"}`}>{acc.accountNumber || "Personal Cash"}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-extrabold font-mono">{formatPKR(acc.balance)}</p>
                              <span className="text-[8px] uppercase font-bold text-stone-400">{acc.type}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedAccountId && (
                    <button
                      id="btn-clear-selection"
                      onClick={() => setSelectedAccountId(null)}
                      className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs rounded-lg transition-colors"
                    >
                      Clear Account Selection Filter
                    </button>
                  )}
                </div>

                {/* Right: Spending Chart or interactive SVG Visualizer */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-xs">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-sm font-bold text-stone-800">Visual Expense Analysis (By category)</h3>
                        <p className="text-xs text-stone-500">Categorized Pakistan wallet streams</p>
                      </div>
                      <span className="text-xs font-mono font-bold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full">
                        {categorySummary.length} Active spending sectors
                      </span>
                    </div>

                    {categorySummary.length === 0 ? (
                      <div className="h-44 flex flex-col items-center justify-center text-stone-400 space-y-2 border border-dashed border-stone-200 rounded-xl">
                        <Info className="w-8 h-8 opacity-40" />
                        <p className="text-xs">Umm, koi transaction nahi mili is time filter me.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Interactive simple CSS layout bar graph */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            {categorySummary.map((item, idx) => {
                              const percentage = totalSpentOnCategories > 0 
                                ? Math.round((item.value / totalSpentOnCategories) * 100) 
                                : 0;
                              return (
                                <div key={idx} className="space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span className="font-semibold text-stone-700">{item.name}</span>
                                    <span className="font-mono text-stone-600 font-medium">{formatPKR(item.value)} ({percentage}%)</span>
                                  </div>
                                  <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full bg-blue-600 rounded-full`}
                                      style={{ width: `${percentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* SVG Donut Visual representation */}
                          <div className="flex flex-col items-center justify-center pt-2">
                            <svg className="w-36 h-36" viewBox="0 0 100 100">
                              <circle
                                cx="50"
                                cy="50"
                                r="40"
                                fill="transparent"
                                stroke="#f5f5f4"
                                strokeWidth="12"
                              />
                              {/* Overlay simple dynamic arc or nice presentation */}
                              <circle
                                cx="50"
                                cy="50"
                                r="40"
                                fill="transparent"
                                stroke="#2563eb"
                                strokeWidth="12"
                                strokeDasharray="180 251"
                                strokeDashoffset="-15"
                                className="transition-all duration-1000"
                              />
                            </svg>
                            <div className="text-center mt-2">
                              <p className="text-[11px] font-bold text-stone-700">Total Spent Analyzed</p>
                              <p className="text-sm font-bold text-blue-600 font-mono">{formatPKR(totalSpentOnCategories)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick-look at the recent transactions log */}
                  <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-xs uppercase font-extrabold tracking-widest text-stone-400 font-mono">Recent Records ({filteredTxs.length})</h3>
                      <button 
                        onClick={() => setActiveTab("transactions")}
                        className="text-xs text-stone-500 font-semibold hover:text-stone-900"
                      >
                        View Statement
                      </button>
                    </div>

                    <div className="divide-y divide-stone-100 max-h-80 overflow-y-auto">
                      {filteredTxs.length === 0 ? (
                        <p className="text-xs text-stone-400 py-6 text-center">Is account or duration me koi records nahi hain.</p>
                      ) : (
                        filteredTxs.slice(0, 5).map(t => {
                          const accName = accounts.find(a => a.id === t.accountId)?.name || "Wallet";
                          const toAccName = t.toAccountId ? (accounts.find(a => a.id === t.toAccountId)?.name || "Target Account") : "";
                          return (
                            <div key={t.id} className="py-3.5 flex items-center justify-between hover:bg-stone-50 rounded-xl px-2 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  t.type === "income" 
                                    ? "bg-emerald-55 text-emerald-800" 
                                    : t.type === "expense" 
                                      ? "bg-red-50 text-red-800"
                                      : "bg-amber-100 text-amber-800"
                                }`}>
                                  {t.type === "income" && <ArrowDownLeft className="w-4 h-4" />}
                                  {t.type === "expense" && <ArrowUpRight className="w-4 h-4" />}
                                  {t.type === "transfer" && <ArrowLeftRight className="w-4 h-4" />}
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-stone-800 leading-tight">{t.description}</p>
                                  <span className="text-[9px] text-stone-500 flex items-center gap-1">
                                    <span className="font-semibold text-blue-600 uppercase bg-blue-50 px-1.5 py-0.5 rounded-sm">{t.category}</span>
                                    <span>•</span>
                                    <span>{accName} {t.type === "transfer" && `→ ${toAccName}`}</span>
                                  </span>
                                </div>
                              </div>

                              <div className="text-right">
                                <p className={`text-xs font-bold font-mono ${
                                  t.type === "income" ? "text-emerald-700" : t.type === "expense" ? "text-red-700" : "text-amber-700"
                                }`}>
                                  {t.type === "income" ? "+" : "-"} {formatPKR(t.amount)}
                                </p>
                                <span className="text-[9px] text-stone-400">{t.date}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* tab 2: ACCOUNTS */}
            {activeTab === "accounts" && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-stone-200">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="font-display font-bold text-stone-900 text-base">Your Bank Core</h3>
                      <p className="text-xs text-stone-500">Manage starting limits and credentials</p>
                    </div>
                    <button
                      id="btn-add-acc-page"
                      onClick={() => setIsAddAccOpen(true)}
                      className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-xs"
                    >
                      + Add New Bank / Wallet
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {accounts.map(acc => {
                      const isEditing = editingAccId === acc.id;
                      return (
                        <div key={acc.id} className="p-5 bg-[#F9FAFB] rounded-2xl border border-stone-200 relative flex flex-col justify-between">
                          {isEditing ? (
                            <div className="space-y-3">
                              <span className="text-[10px] text-blue-600 uppercase font-mono font-bold block mb-1">Edit Account Details</span>
                              
                              <div>
                                <label className="block text-[9px] font-bold text-stone-500 uppercase">Account Name</label>
                                <input
                                  type="text"
                                  value={editAccName}
                                  onChange={(e) => setEditAccName(e.target.value)}
                                  className="w-full text-xs font-semibold p-1.5 border border-stone-200 rounded focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                                />
                              </div>

                              <div>
                                <label className="block text-[9px] font-bold text-stone-500 uppercase">Account Number / Memo</label>
                                <input
                                  type="text"
                                  value={editAccNumber}
                                  onChange={(e) => setEditAccNumber(e.target.value)}
                                  className="w-full text-xs font-mono p-1.5 border border-stone-200 rounded focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[9px] font-bold text-stone-500 uppercase">Account Type</label>
                                  <select
                                    value={editAccType}
                                    onChange={(e) => setEditAccType(e.target.value)}
                                    className="w-full text-xs font-semibold p-1.5 bg-white border border-stone-200 rounded"
                                  >
                                    <option value="Bank">Bank</option>
                                    <option value="Wallet">Wallet</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Outside of Wallet">Outside of Wallet</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-stone-500 uppercase">Balance (PKR)</label>
                                  <input
                                    type="number"
                                    value={editAccBalance}
                                    onChange={(e) => setEditAccBalance(e.target.value)}
                                    className="w-full text-xs font-bold font-mono p-1.5 border border-stone-200 rounded focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                                  />
                                </div>
                              </div>

                              <div className="flex gap-1.5 pt-2">
                                <button
                                  onClick={() => handleSaveAccountEdit(acc.id)}
                                  className="flex-1 py-1.5 bg-stone-900 hover:bg-stone-850 text-white rounded text-xs font-bold transition-all"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingAccId(null)}
                                  className="py-1.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded text-xs transition-all"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col justify-between h-full">
                              <div>
                                <div className="flex justify-between items-start">
                                  <div>
                                    <span className="text-[9px] text-stone-400 uppercase font-mono font-bold block mb-1">Account reference</span>
                                    <h4 className="text-sm font-bold text-stone-900 leading-tight">{acc.name}</h4>
                                    <p className="text-[10px] text-stone-500 font-mono mt-0.5">{acc.accountNumber}</p>
                                  </div>
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                    acc.type === "Bank" 
                                      ? "bg-blue-100 text-blue-800" 
                                      : acc.type === "Outside of Wallet"
                                        ? "bg-purple-100 text-purple-800"
                                        : "bg-emerald-100 text-emerald-800"
                                  }`}>
                                    {acc.type}
                                  </span>
                                </div>

                                <div className="my-4">
                                  <span className="text-[10px] text-stone-400 uppercase font-bold tracking-wider block">Current Balance</span>
                                  <p className="text-xl font-extrabold text-stone-950 font-mono leading-none mt-1">{formatPKR(acc.balance)}</p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between border-t border-stone-200 pt-2.5 mt-2">
                                <button
                                  onClick={() => {
                                    setEditingAccId(acc.id);
                                    setEditAccName(acc.name);
                                    setEditAccBalance(acc.balance.toString());
                                    setEditAccNumber(acc.accountNumber || "");
                                    setEditAccType(acc.type);
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 hover:underline align-middle"
                                >
                                  Edit Details
                                </button>
                                {accounts.length > 1 && (
                                  <button
                                    onClick={() => handleDeleteAccount(acc.id)}
                                    className="text-xs text-red-500 hover:text-red-700 font-semibold p-1 hover:bg-red-50 rounded"
                                    title="Delete this account"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* tab 3: TRANSACTIONS RECORD */}
            {activeTab === "transactions" && (
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="font-display font-bold text-stone-900 text-base">Ledger Statement Book</h3>
                    <p className="text-xs text-stone-500">Full audit statement logs</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-stone-600 border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 text-[#1A1A1B] uppercase font-bold tracking-wider bg-stone-50 text-[10px]">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Description</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Source Account</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filteredTxs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-10 text-stone-400">
                            No ledger journal elements exist for current constraints.
                          </td>
                        </tr>
                      ) : (
                        filteredTxs.map(t => {
                          const originAcc = accounts.find(a => a.id === t.accountId);
                          const targetAcc = t.toAccountId ? accounts.find(a => a.id === t.toAccountId) : null;
                          return (
                            <tr key={t.id} className="hover:bg-stone-50 transition-colors">
                              <td className="py-3 px-4 font-mono text-stone-500">{t.date}</td>
                              <td className="py-3 px-4 font-bold text-stone-800">{t.description}</td>
                              <td className="py-3 px-4">
                                <span className="bg-stone-100 text-stone-800 px-2 py-0.5 rounded-full font-semibold font-mono text-[10px]">
                                  {t.category}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-stone-800">{originAcc?.name || "Unknown"}</span>
                                  {targetAcc && (
                                    <>
                                      <span className="text-stone-400">→</span>
                                      <span className="font-semibold text-blue-600">{targetAcc.name}</span>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`uppercase text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                  t.type === "income" 
                                    ? "bg-emerald-100 text-emerald-800" 
                                    : t.type === "expense" 
                                      ? "bg-red-100 text-red-800"
                                      : "bg-amber-100 text-amber-800"
                                }`}>
                                  {t.type}
                                </span>
                              </td>
                              <td className={`py-3 px-4 text-right font-bold font-mono ${
                                t.type === "income" ? "text-emerald-700" : t.type === "expense" ? "text-red-700" : "text-amber-700"
                              }`}>
                                {t.type === "income" ? "+" : "-"} {formatPKR(t.amount)}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  id={`btn-del-${t.id}`}
                                  onClick={() => handleDeleteTransaction(t.id)}
                                  className="p-1 rounded-sm text-stone-400 hover:text-red-600 hover:bg-stone-200 transition-colors"
                                  title="Delete record"
                                >
                                  <Trash2 className="w-4 h-4" />
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
            )}

            {/* tab 4: AI SAVINGS ASSISTANT & CHATBOT */}
            {activeTab === "ai" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left panel: Saving Goals & Custom Advisor triggers */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
                    <h4 className="font-display font-bold text-stone-900 text-sm">Pakistan Saving Plans & Rates</h4>
                    <p className="text-xs text-stone-500">Calculate targets based on Islamic banking / Mutual funds index rates</p>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-stone-600 mb-1">How much do you want to save? (PKR)</label>
                        <input 
                          type="text" 
                          value={savingTarget}
                          onChange={(e) => setSavingTarget(e.target.value)}
                          className="w-full text-xs font-semibold p-2.5 border border-stone-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono"
                          placeholder="e.g., 50,000"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-stone-600 mb-1">Time period duration (Months)</label>
                        <select 
                          value={savingTargetDuration}
                          onChange={(e) => setSavingTargetDuration(e.target.value)}
                          className="w-full text-xs font-semibold p-2.5 bg-white border border-stone-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                        >
                          <option value="3">3 Months</option>
                          <option value="6">6 Months (Recommended)</option>
                          <option value="12">12 Months (1 Year)</option>
                          <option value="24">24 Months (2 Years)</option>
                        </select>
                      </div>

                      <button
                        id="btn-calculate-saving-plan"
                        onClick={fetchSavingPlan}
                        className="w-full py-2.5 bg-emerald-600 font-semibold hover:bg-emerald-700 text-white rounded-lg transition-colors text-xs flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Analyze Best Advisor Plan
                      </button>
                    </div>
                  </div>

                  <div className="bg-emerald-900 text-emerald-50 p-5 rounded-2xl">
                    <h5 className="font-semibold text-xs uppercase tracking-widest leading-none mb-1 text-emerald-300 font-mono">Real-time Rates Guide</h5>
                    <p className="text-[11px] leading-relaxed font-normal my-2">
                      Meezan bank Al Meezan Mutual funds yield approximately 18% to 22% expected annual halal return. 
                      UBL savings accounts provide 19.5% return. Use this knowledge to build targets.
                    </p>
                  </div>
                </div>

                {/* Right panel: Active Chatbot space */}
                <div className="lg:col-span-8 flex flex-col h-[500px] bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
                  <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <div>
                        <span className="text-xs font-bold text-stone-800 block">Gemini Personal Finance Assistant</span>
                        <span className="text-[9px] text-stone-400 font-medium">Auto-parses Urdu/English to create records</span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold font-mono">
                      Meezan/UBL Expert
                    </span>
                  </div>

                  {/* Message container */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {chatMessages.map((msg, i) => (
                      <div 
                        key={i} 
                        className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                          msg.sender === "user" 
                            ? "bg-blue-600 text-white font-medium rounded-tr-sm" 
                            : "bg-stone-100 text-stone-800 rounded-tl-sm border border-stone-250"
                        }`}>
                          <p className="whitespace-pre-line">{msg.text}</p>
                          
                          {/* Rich parsing cards */}
                          {msg.parsedTx && (
                            <div className="mt-3 bg-white text-stone-900 border border-stone-200 p-2.5 rounded-lg shadow-2xs space-y-1">
                              <span className="text-[9px] text-[#2563eb] bg-blue-50 px-1.5 py-0.5 rounded-full font-bold">
                                DETECTED ACTION
                              </span>
                              <div className="flex items-center justify-between">
                                <div className="text-[10px] font-bold">
                                  {msg.parsedTx.type?.toUpperCase()}: {msg.parsedTx.description}
                                </div>
                                <div className="text-xs font-bold text-emerald-600 font-mono">
                                  {formatPKR(msg.parsedTx.amount || 0)}
                                </div>
                              </div>
                              <div className="text-[10px] text-stone-500">
                                Category: {msg.parsedTx.category} | Source: {accounts.find(a => a.id === msg.parsedTx?.accountId)?.name || "Default Wallet"}
                              </div>
                            </div>
                          )}

                          <span className="text-[8px] opacity-60 block mt-1.5 text-right uppercase">
                            {msg.timestamp}
                          </span>
                        </div>
                      </div>
                    ))}

                    {isAiLoading && (
                      <div className="flex justify-start">
                        <div className="bg-stone-100 text-stone-500 rounded-2xl p-4 text-xs rounded-tl-sm flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-500 animate-bounce"></span>
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-500 animate-bounce delay-100"></span>
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-500 animate-bounce delay-200"></span>
                          <span>Soch raha hai...</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Suggestion tags scrollbar */}
                  <div className="bg-stone-50 px-5 py-2 border-t border-stone-100 overflow-x-auto flex gap-1.5 shrink-0">
                    {PROMPT_SUGGESTIONS.map((s, i) => (
                      <button
                        id={`btn-suggest-${i}`}
                        key={i}
                        onClick={() => handleSendAiChat(s)}
                        className="text-[10px] font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-200 shrink-0 bg-stone-100 px-2.5 py-1 rounded-full transition-all"
                      >
                        "{s}"
                      </button>
                    ))}
                  </div>

                  {/* Input area */}
                  <div className="p-3 border-t border-stone-200 flex items-center gap-2 shrink-0">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendAiChat();
                      }}
                      className="flex-1 p-3 text-xs border border-stone-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Ask the AI, or record a transaction dynamically..."
                    />
                    <button
                      id="btn-send-chat"
                      onClick={() => handleSendAiChat()}
                      className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom AI Quick assistant container as featured in theme mock */}
            <div className="bg-stone-900 text-stone-100 p-6 rounded-3xl relative overflow-hidden shadow-md">
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1">
                  <h3 className="text-base font-bold mb-2 flex items-center gap-2 text-white font-display">
                    <span className="text-emerald-500">✨</span> Roman Urdu / English AI Quick Input
                  </h3>
                  <p className="text-xs text-stone-300 max-w-lg leading-relaxed">
                    Simply text or record: <strong className="text-emerald-300">"Meezan bank se grocery k liye 500 nikaley"</strong> or <strong className="text-emerald-300">"Habib Metro may 200 expense tea ka"</strong>. Your transactions will be parsed and ledger balance calculated on the fly.
                  </p>
                </div>
                <div className="w-full max-w-md">
                  <div className="relative flex items-center">
                    <input 
                      id="quick-talk-input"
                      type="text" 
                      placeholder="Talk to your wallet ledger..." 
                      className="w-full bg-white text-stone-900 border-0 rounded-full py-4 px-6 pr-12 text-xs shadow-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = (e.target as HTMLInputElement).value;
                          if (val) {
                            setActiveTab("ai");
                            handleSendAiChat(val);
                            (e.target as HTMLInputElement).value = "";
                          }
                        }
                      }}
                    />
                    <button 
                      onClick={() => {
                        const val = (document.getElementById("quick-talk-input") as HTMLInputElement)?.value;
                        if (val) {
                          setActiveTab("ai");
                          handleSendAiChat(val);
                          (document.getElementById("quick-talk-input") as HTMLInputElement).value = "";
                        }
                      }}
                      className="absolute right-4 bg-emerald-600 text-white p-2 rounded-full hover:bg-emerald-700 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[9px] text-center mt-3 text-stone-400 font-medium italic">
                    Try entering: "How much did I spend in current monthly period?"
                  </p>
                </div>
              </div>
              <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>
            </div>

          </div>
        </main>
      </div>

      {/* MODAL: ADD MANUAL TRANSACTION */}
      {isAddTxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md border border-stone-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex justify-between items-center">
              <h3 className="font-display font-bold text-stone-800 text-sm">Add Financial Transaction</h3>
              <button 
                onClick={() => setIsAddTxOpen(false)}
                className="text-stone-400 hover:text-stone-700 hover:bg-stone-50 p-1.5 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="p-5 space-y-4">
              <div className="flex gap-1.5 bg-stone-100 p-1 rounded-xl">
                {(["income", "expense", "transfer"] as const).map(type => (
                  <button
                    id={`btn-tx-${type}`}
                    type="button"
                    key={type}
                    onClick={() => setTxType(type)}
                    className={`flex-1 py-2 text-center text-xs font-bold rounded-lg uppercase tracking-wider transition-all ${
                      txType === type 
                        ? "bg-white text-stone-900 shadow-xs" 
                        : "text-stone-400 hover:text-stone-800"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">Amount (PKR)</label>
                  <input
                    type="number"
                    required
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    className="w-full text-xs font-semibold p-2.5 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                    placeholder="e.g. 1500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full text-xs font-semibold p-2.5 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    {txType === "transfer" ? "Source Account" : "Account Ledger"}
                  </label>
                  <select
                    value={txAccountId}
                    onChange={(e) => setTxAccountId(e.target.value)}
                    className="w-full text-xs font-semibold p-2.5 bg-white border border-stone-200 rounded-lg"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (Rs. {acc.balance})</option>
                    ))}
                  </select>
                </div>

                {txType === "transfer" ? (
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Target Account</label>
                    <select
                      value={txToAccountId}
                      onChange={(e) => setTxToAccountId(e.target.value)}
                      className="w-full text-xs font-semibold p-2.5 bg-white border border-stone-200 rounded-lg"
                    >
                      <option value="">Select target...</option>
                      {accounts.filter(a => a.id !== txAccountId).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} (Rs. {acc.balance})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Category</label>
                    <select
                      value={txCategory}
                      onChange={(e) => setTxCategory(e.target.value)}
                      className="w-full text-xs font-semibold p-2.5 bg-white border border-stone-200 rounded-lg"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">Memo / Description</label>
                <input
                  type="text"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. Samosa, petrol, laundry"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-850 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Post Ledger entry
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD BANK ACCOUNT */}
      {isAddAccOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-sm border border-stone-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex justify-between items-center">
              <h3 className="font-display font-bold text-stone-800 text-sm">Open New bank connection</h3>
              <button 
                onClick={() => setIsAddAccOpen(false)}
                className="text-stone-400 hover:text-stone-700 hover:bg-stone-50 p-1.5 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">Bank or Wallet Name</label>
                <input
                  type="text"
                  required
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. Meezan Bank, Habib Metro"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">Core account Type</label>
                  <select
                    value={newAccType}
                    onChange={(e) => setNewAccType(e.target.value)}
                    className="w-full text-xs font-semibold p-2.5 bg-white border border-stone-200 rounded-lg"
                  >
                    <option value="Bank">Bank Account</option>
                    <option value="Wallet">Digital Wallet</option>
                    <option value="Cash">Cash in Hand</option>
                    <option value="Outside of Wallet">Outside of Wallet (Loan/Lent to Friends)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">Starting Book Limit (PKR)</label>
                  <input
                    type="number"
                    required
                    value={newAccBalance}
                    onChange={(e) => setNewAccBalance(e.target.value)}
                    className="w-full text-xs font-semibold p-2.5 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-mono"
                    placeholder="e.g. 25000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">Account Number / Memo (Optional)</label>
                <input
                  type="text"
                  value={newAccNumber}
                  onChange={(e) => setNewAccNumber(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g. 0524-11025-021"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
              >
                Create Account connection
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TARGETED PLAN ADVISOR DRAWER / LIGHTBOX */}
      {planOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/45 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50 shrink-0">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-emerald-600" />
                <h3 className="font-display font-bold text-stone-900 text-sm">Personalised saving Plan calculation</h3>
              </div>
              <button 
                onClick={() => setPlanOpen(false)}
                className="text-stone-400 hover:text-stone-700 hover:bg-stone-100 p-1.5 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="bg-stone-55 p-4 rounded-xl space-y-2 border border-stone-200">
                <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wide block">Current Context</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Net Assets: <strong className="text-stone-900">{formatPKR(totalBalance)}</strong></div>
                  <div>Period savings: <span className="text-emerald-700 font-bold">{formatPKR(netSavings)}</span></div>
                  <div>Target Amount: <span className="font-bold">Rs. {savingTarget} PKR</span></div>
                  <div>Target Duration: <span className="font-bold">{savingTargetDuration} Months</span></div>
                </div>
              </div>

              {customPlanReply ? (
                <div className="space-y-3">
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 font-bold px-2 py-0.5 rounded-full">
                    ADVISOR PATH GENERATED BY GEMINI
                  </span>
                  <div className="text-xs text-stone-700 leading-relaxed whitespace-pre-line bg-stone-50 p-4 border border-stone-100 rounded-xl">
                    {customPlanReply}
                  </div>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-stone-500 font-medium">Gemini is researching local mutual fund indices & formulating your savings rules...</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-stone-100 bg-stone-50 flex justify-end shrink-0">
              <button 
                onClick={() => setPlanOpen(false)}
                className="px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-850 font-bold text-xs"
              >
                Close Plan View
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
