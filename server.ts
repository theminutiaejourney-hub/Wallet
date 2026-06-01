import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize GoogleGenAI client lazily or safely
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY environment variable is not set. AI Features will require a key.");
    }
    ai = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY_FOR_BUILD",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return ai;
}

app.use(express.json());

// API Endpoints FIRST

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// AI Assistant Chat endpoint
app.post("/api/chat", async (req, res) => {
  const { message, accounts, categories, transactions, debts, scheduledExpenses, currentTime } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const client = getGeminiClient();
    
    // Construct formatting and prompt context
    const accountsDescription = (accounts || []).map((acc: any) => 
      `- ID: "${acc.id}", Name: "${acc.name}", Type: "${acc.type}", Balance: Rs. ${acc.balance}`
    ).join("\n");

    // Map transaction history to human readable sentences
    const accountsMap = new Map((accounts || []).map((acc: any) => [acc.id, acc.name]));
    const transactionsDescription = (transactions || []).map((tx: any) => {
      const fromAcc = accountsMap.get(tx.accountId) || tx.accountId || "Unknown";
      const toAcc = tx.toAccountId ? (accountsMap.get(tx.toAccountId) || tx.toAccountId) : null;
      const transferStr = toAcc ? ` from ${fromAcc} to ${toAcc}` : ` (Account/Bank: ${fromAcc})`;
      return `- Date: ${tx.date}, Type: ${tx.type}, Amount: Rs. ${tx.amount}, Category: "${tx.category}", Description: "${tx.description}"${transferStr}`;
    }).join("\n");

    // Map debt history
    const debtsDescription = (debts || []).map((d: any) => 
      `- Person: "${d.person}", Amount: Rs. ${d.amount}, Type: "${d.type}" (${d.type === "receive" ? "Lene hain / To Receive" : "Dene hain / To Pay"}), Date: ${d.date}, Status: "${d.status}", Notes: "${d.notes}"`
    ).join("\n");

    // Map scheduled expenses list
    const scheduledExpensesDescription = (scheduledExpenses || []).map((s: any) =>
      `- ID: "${s.id}", Account: "${accountsMap.get(s.accountId) || s.accountId}", Amount: Rs. ${s.amount}, Category: "${s.category}", Description: "${s.description}", Date: ${s.date}`
    ).join("\n");

    const systemInstruction = `You are a helpful Urdu and English Roman-Urdu financial voice and text bot for a personal wallet tracker.
The current UTC date is ${currentTime || new Date().toISOString().split('T')[0]}.

You have five potential objectives:
1. Parse transactions: If the user indicates they spent, received, or transferred money (e.g., "Meezan bank se grocery k liye 500 nikaley", "Salary received 50k in UBL", "Transfer 1000 from Meezan to Cash", "habib metro mai 200 expense kiya"), detect it and format it. Ensure you select the closest custom category from the list. DO NOT use this if the user asks to schedule, plan for a future date, or if they mention "schedule" or "is date/tarikh ko pay karna hai".
2. Financial advice / Saving Plans: If the user asks about investments, financial plans, saving paths (e.g., "Meri Income k hisaab sy savings plans btao"), calculate their active balance, review their statements, and formulate customized saving advice.
3. Query Past Transactions, Category Expense & History: If the user asks about past spendings, top categories, specific date records, category-wise breakdown (e.g., "Meri past transactions ko mdnzar rkh k btao", "pichle 2 hafte pehle k records do", "Sabse zyada expense kis cheez pe hua?", "meray past records mien fuel pur kitney paisay lagay?", "kis category may kitna expense hua hai?", "home expenses kitnay hain?"), read the user's transaction records from the list provided below, parse the dates/amounts, calculate category sums, and list them beautifully and warmly in sorted order with dates/amounts.
4. Record and Manage Debts/Credits (Udhaar Ledger / Lene-Dene Tracker): If the user says they have to receive money (e.g., "Ahmad se 5000 lene hain notes: biryani", "Ali se 2000 lene hain", "Mene Zaid se 500 lene hain") or pay money (e.g., "Bhai ko 1000 dene hain milk supply k", "Umar ko 15000 dene hain rent", "Asad ko 400 pay karne hain petrol"), or settle a debt (e.g., "Ali k saare paise clear hogaye/mil gaye", "Asad ko paise de diye"), detect it and output action "add_debt" or "settle_debt".
5. Schedule and Confirm Future Expenses (Schedule Panel): If the user wants to schedule an expense for a future date (e.g., "K-Electric bill of 8500 schedule krdo 10 date ko", "Meezan se rent 12000 schedule kr do", "schedule 3500 mobile load on 2026-06-15", "wifi bill schedule kr do", "is date ko pay krna hai"), or confirm/pay a scheduled item (e.g. "StormFiber broadband pay/confirm krdo", "KE-electric confirm kr do", "K-Electric pay/confirm kr do", "scheduled rent mark as paid/confirm"), parse and detect it. Set action to "schedule_expense" or "confirm_schedule" accordingly.

The user's active Bank/Cash accounts are:
${accountsDescription}

The available spending/income categories are:
${(categories || []).join(", ")}

The user's past transaction records (always reference this for history queries):
${transactionsDescription || "No past transactions recorded yet."}

The user's active Debts (Udhaar Ledger - Lene/Dene records):
${debtsDescription || "No pending debts recorded yet."}

The user's pending Scheduled Expenses:
${scheduledExpensesDescription || "No pending scheduled expenses currently."}

You MUST output your response strictly as a single JSON object. Do not include markdown codeblocks or other formatting headers.
The JSON structure must match this:
{
  "responseText": "Your natural language response in Roman Urdu (or English if the user asked in English). Be brief, polite, and clear. Mention exactly what action was taken (e.g., Scheduled, Confirmed, Created).",
  "action": "add_transaction" or "add_debt" or "settle_debt" or "schedule_expense" or "confirm_schedule" or "none",
  "transaction": {
    "type": "income" or "expense" or "transfer",
    "amount": status numeric amount value,
    "category": "one of the available categories that best fits",
    "description": "short title of transaction (e.g. Tea, Rent, Salary)",
    "accountId": "the ID of the source account",
    "toAccountId": "the ID of the target account (only required for transfers)"
  },
  "debt": {
    "person": "Name of the person (e.g. Omar, Ahmad)",
    "amount": numeric amount value,
    "type": "receive" (for lene hain) or "pay" (for dene hain),
    "notes": "notes/description explaining what the Udhaar is for",
    "date": null or "YYYY-MM-DD"
  },
  "settleDebt": {
    "person": "Name of the person whose debt should be marked settled"
  },
  "scheduledExpense": {
    "accountId": "ID of the account to use (e.g., 'meezan', 'ubl', 'cash', 'habibmetro')",
    "amount": numeric amount value,
    "category": "one of the categories",
    "description": "short custom description e.g. 'StormFiber Broadband' or 'K-Electric Bill'",
    "date": "YYYY-MM-DD for the future payment date"
  },
  "confirmSchedule": {
    "description": "short matching text to confirm the scheduled expense (e.g. 'StormFiber' or 'K-Electric')"
  }
}

Guidelines for parsing:
- CRITICAL PRIORITIZATION rule: If the user says "schedule" or uses Pakistani Urdu terms like "schedule krdo", "rent/bill is date ko dena hai" or mentions future scheduling, you MUST set action to "schedule_expense" and populate the "scheduledExpense" block. Do NOT set action to "add_transaction" or "add_debt" for these requests. Instantly deducting money is ONLY done if they say something actually happened (e.g. "ho gaya hay", "pay kar diya") or confirm a scheduled bill.
- If mapping to expense category, only use EXACT names from: ${(categories || []).join(", ")}. For example, if user mentions fuel/petrol, map it to "Fuel Expenses"; if they mention mobile balance, map to "Mobile Loads"; if they mention food or restaurant, map to "Foods & Drink Expenses"; if bills, map to "Bills"; if family/home, use "Family Expenses" or "Home Expenses".
- If it is not an action (e.g. asking for report or plan), set action to "none", transaction to null, debt to null, settleDebt to null, scheduledExpense to null, confirmSchedule to null.`;

    const userPrompt = `User Message: "${message}"\n\nPlease respond according to the instructions in JSON format.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            responseText: { 
              type: Type.STRING, 
              description: "Short, warm response in Roman Urdu or English detailing exactly what action was taken." 
            },
            action: { 
              type: Type.STRING, 
              enum: ["add_transaction", "add_debt", "settle_debt", "schedule_expense", "confirm_schedule", "none"],
              description: "Parsed action. Choose 'schedule_expense' to queue a future expense without deducting money today. Choose 'add_transaction' ONLY if it already happened or was instantly paid."
            },
            transaction: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ["income", "expense", "transfer"] },
                amount: { type: Type.NUMBER },
                category: { type: Type.STRING },
                description: { type: Type.STRING },
                accountId: { type: Type.STRING },
                toAccountId: { type: Type.STRING }
              }
            },
            debt: {
              type: Type.OBJECT,
              properties: {
                person: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                type: { type: Type.STRING, enum: ["receive", "pay"] },
                notes: { type: Type.STRING },
                date: { type: Type.STRING }
              }
            },
            settleDebt: {
              type: Type.OBJECT,
              properties: {
                person: { type: Type.STRING }
              }
            },
            scheduledExpense: {
              type: Type.OBJECT,
              properties: {
                accountId: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                category: { type: Type.STRING },
                description: { type: Type.STRING },
                date: { type: Type.STRING }
              }
            },
            confirmSchedule: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING }
              }
            }
          },
          required: ["responseText", "action"]
        }
      }
    });

    const replyRaw = response.text || "{}";
    let replyObj;
    try {
      replyObj = JSON.parse(replyRaw.trim());
    } catch (parseError) {
      console.error("Failed to parse AI JSON response, raw text was:", replyRaw);
      // Fallback
      replyObj = {
        responseText: replyRaw,
        action: "none",
        transaction: null
      };
    }

    return res.json(replyObj);
  } catch (error: any) {
    console.error("Gemini API Error in server.ts:", error);
    const errStr = String(error?.message || error).toLowerCase();
    
    // Check if it is a quota or rate limit error
    const isQuotaExceeded = errStr.includes("quota") || errStr.includes("limit") || errStr.includes("429") || errStr.includes("resource_exhausted");
    
    let friendlyReply = "Maazrat, AI service main thora masla aya hai. Aap apny transactions ko neechay manual inputs k zariye add kar saktay hain.";
    if (isQuotaExceeded) {
       friendlyReply = "Aapka daily free AI quota mukammal ho gaya hai ya bohot zyada requests send ho chuki hain. Baraye meherbani thori der baad dobara koshish karein ya phir transactions ko niche manual input box se khud add karein.";
    }
    
    return res.json({ 
      responseText: friendlyReply, 
      action: "none",
      transaction: null
    });
  }
});

// Vite Middleware/Asset serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware loaded.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log(`Serving static files from ${distPath}`);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express Wallet Server running on http://localhost:${PORT}`);
  });
}

if (process.env.VERCEL !== "1") {
  startServer();
}

export default app;
