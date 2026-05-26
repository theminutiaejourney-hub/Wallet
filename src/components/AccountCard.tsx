import React, { useState } from "react";
import { Account } from "../types";
import { AVAILABLE_BANKS, formatPKR } from "../data";
import { Plus, Landmark, PiggyBank, CreditCard, X } from "lucide-react";

interface AccountCardProps {
  accounts: Account[];
  onAddAccount: (account: Account) => void;
  onSelectAccount: (accountId: string) => void;
  selectedAccountId: string | null;
}

export default function AccountCard({
  accounts,
  onAddAccount,
  onSelectAccount,
  selectedAccountId,
}: AccountCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [bankIndex, setBankIndex] = useState(0);
  const [balanceInput, setBalanceInput] = useState("5000");
  const [accountNumber, setAccountNumber] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bank = AVAILABLE_BANKS[bankIndex];
    if (!bank) return;

    const newAcc: Account = {
      id: `acc-${Date.now()}`,
      name: bank.name,
      type: bank.type,
      balance: parseFloat(balanceInput) || 0,
      accountNumber: accountNumber || "Direct Balance",
      color: bank.color
    };

    onAddAccount(newAcc);
    setIsOpen(false);
    setBalanceInput("5000");
    setAccountNumber("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-stone-800">Bank Accounts</h2>
          <p className="text-xs text-stone-500">Add 8 to 10 banks to manage your budget</p>
        </div>
        
        {accounts.length < 10 ? (
          <button
            id="btn-add-account"
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 transition-colors text-white font-medium text-xs rounded-lg shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Account
          </button>
        ) : (
          <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 font-medium">
            Max Limit Reached (10)
          </span>
        )}
      </div>

      {/* Accounts Horizontal Scroll or Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {accounts.map((acc) => {
          const isSelected = selectedAccountId === acc.id;
          return (
            <div
              id={`acc-card-${acc.id}`}
              key={acc.id}
              onClick={() => onSelectAccount(acc.id)}
              className={`relative cursor-pointer select-none rounded-xl border p-4 transition-all duration-300 ${acc.color} ${
                isSelected 
                  ? "ring-3 ring-emerald-500/40 ring-offset-2 scale-[1.01]" 
                  : "hover:shadow-md hover:scale-[1.005]"
              }`}
            >
              {/* Card Watermark Icon */}
              <div className="absolute right-3 top-3 opacity-15">
                {acc.type === "Bank" ? (
                  <Landmark className="w-12 h-12" />
                ) : acc.type === "Cash" ? (
                  <PiggyBank className="w-12 h-12" />
                ) : (
                  <CreditCard className="w-12 h-12" />
                )}
              </div>

              <div className="flex flex-col justify-between h-24">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display font-bold text-sm tracking-wide">{acc.name}</h3>
                    <p className="text-[10px] opacity-75 font-mono">
                      {acc.accountNumber || "Personal Cash"}
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-black/20 backdrop-blur-xs font-semibold rounded-full uppercase">
                    {acc.type}
                  </span>
                </div>

                <div>
                  <div className="text-[10px] opacity-75 uppercase tracking-wider font-medium">Balance</div>
                  <div className="text-xl font-display font-semibold tracking-tight font-mono">
                    {formatPKR(acc.balance)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Account Add Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/55 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden border border-stone-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h3 className="font-display font-semibold text-stone-800">Add Bank Account</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">Select Bank brand</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 border border-stone-200 rounded-lg">
                  {AVAILABLE_BANKS.map((b, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setBankIndex(i)}
                      className={`text-left p-2.5 rounded-lg text-xs leading-tight transition-colors ${
                        bankIndex === i
                          ? "bg-emerald-50 border border-emerald-500 font-semibold text-emerald-800"
                          : "hover:bg-stone-50 border border-stone-100"
                      }`}
                    >
                      <div>{b.name}</div>
                      <span className="text-[9px] text-stone-400 font-normal">{b.type}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Starting Account Balance (PKR)</label>
                <input
                  type="number"
                  required
                  value={balanceInput}
                  onChange={(e) => setBalanceInput(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Account Number / Memo (Optional)</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 021-0421-492"
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  Create Account Wallet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
