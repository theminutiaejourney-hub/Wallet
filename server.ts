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
  const { message, accounts, categories, transactions, debts, currentTime } = req.body;

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

    const systemInstruction = `You are a helpful Urdu and English Roman-Urdu financial voice and text bot for a personal wallet tracker.
The current UTC date is ${currentTime || new Date().toISOString().split('T')[0]}.

You have four potential objectives:
1. Parse transactions: If the user indicates they spent, received, or transferred money (e.g., "Meezan bank se grocery k liye 500 nikaley", "Salary received 50k in UBL", "Transfer 1000 from Meezan to Cash", "habib metro mai 200 expense kiya"), detect it and format it. Ensure you select the closest custom category from the list.
2. Financial advice / Saving Plans: If the user asks about investments, financial plans, saving paths (e.g., "Meri Income k hisaab sy savings plans btao"), calculate their active balance, review their statements, and formulate customized saving advice.
3. Query Past Transactions, Category Expense & History: If the user asks about past spendings, top categories, specific date records, category-wise breakdown (e.g., "Meri past transactions ko mdnzar rkh k btao", "pichle 2 hafte pehle k records do", "Sabse zyada expense kis cheez pe hua?", "meray past records mien fuel pur kitney paisay lagay?", "kis category may kitna expense hua hai?", "home expenses kitnay hain?"), read the user's transaction records from the list provided below, parse the dates/amounts, calculate category sums, and list them beautifully and warmly in sorted order with dates/amounts.
4. Record and Manage Debts/Credits (Udhaar Ledger / Lene-Dene Tracker): If the user says they have to receive money (e.g., "Ahmad se 5000 lene hain notes: biryani", "Ali se 2000 lene hain", "Mene Zaid se 500 lene hain") or pay money (e.g., "Bhai ko 1000 dene hain milk supply k", "Umar ko 15000 dene hain rent", "Asad ko 400 pay karne hain petrol"), or settle a debt (e.g., "Ali k saare paise clear hogaye/mil gaye", "Asad ko paise de diye"), detect it and output action "add_debt" or "settle_debt".

The user's active Bank/Cash accounts are:
${accountsDescription}

The available spending/income categories are:
${(categories || []).join(", ")}

The user's past transaction records (always reference this for history queries):
${transactionsDescription || "No past transactions recorded yet."}

The user's active Debts (Udhaar Ledger - Lene/Dene records):
${debtsDescription || "No pending debts recorded yet."}

You MUST output your response strictly as a single JSON object. Do not include markdown codeblocks or other formatting headers.
The JSON structure must match this:
{
  "responseText": "Your natural language response in Roman Urdu (or English if the user asked in English). Be brief, polite, and clear. If they asked to add/parse a transaction or debt, mention exactly what action was taken. If they asked about past history, performing category expense summaries, or listing records, do the math from the records provided and output them beautifully, warmly, and clearly.",
  "action": "add_transaction" or "add_debt" or "settle_debt" or "none",
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
    "date": null or "YYYY-MM-DD (target date mentioned, or default to current date if none mentioned)"
  },
  "settleDebt": {
    "person": "Name of the person whose debt should be marked settled"
  }
}

Guidelines for parsing:
- If mapping to expense category, only use EXACT names from: ${(categories || []).join(", ")}. For example, if user mentions fuel/petrol, map it to "Fuel Expenses"; if they mention mobile balance, map to "Mobile Loads"; if they mention food or restaurant, map to "Foods & Drink Expenses"; if bills, map to "Bills"; if family/home, use "Family Expenses" or "Home Expenses".
- If it is not an action (e.g. asking for report or plan), set action to "none", transaction to null, debt to null, settleDebt to null.`;

    const userPrompt = `User Message: "${message}"\n\nPlease respond according to the instructions in JSON format.`;

    const response = await client.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json"
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
