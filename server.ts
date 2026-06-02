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

// Helper function to call Gemini model with automatic retries on transient errors
async function generateContentWithRetry(client: any, model: string, contents: any, config: any, maxRetries = 2): Promise<any> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await client.models.generateContent({ model, contents, config });
    } catch (err: any) {
      attempt++;
      const errStr = String(err?.message || err || "").toLowerCase();
      const isTransient = errStr.includes("503") || errStr.includes("unavailable") || errStr.includes("overloaded") || errStr.includes("demand");
      if (isTransient && attempt < maxRetries) {
        // Log clean retry message without full scary API trace so system logs remain clean
        console.log(`[Gemini Info] Model ${model} returned transient code (503/busy). Retrying attempt ${attempt + 1}/${maxRetries} in 150ms...`);
        await new Promise(resolve => setTimeout(resolve, 150));
        continue;
      }
      throw err;
    }
  }
}

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

CRITICAL ROUTING RULES (DECISION TREE):
Before doing anything, analyze the user's message to decide which ACTION is requested:

1. schedule_expense:
   - Use this ACTION if the user wants to SCHEDULE an expense for a future date, plans to pay a bill/rent in the future, or uses keywords like "schedule", "shedule", "laga do", "is date ko dena hai", "rent dena hai 5 ko", "bill 10 tarikh ko pay krna hai".
   - You MUST populate "scheduledExpense" inside the JSON response.
   - Example 1: "K-Electric bill of 8500 schedule krdo 10 date ko" -> action: "schedule_expense"
   - Example 2: "Meezan se rent 12000 schedule kr do" -> action: "schedule_expense"
   - Example 3: "schedule 3500 mobile load on 2026-06-15" -> action: "schedule_expense"
   - Example 4: "wifi bill schedule kr do" -> action: "schedule_expense"
   - Example 5: "mizaan se rent 22000 schedule kardo key 5 tarikh ko dena hai" -> action: "schedule_expense"
   - CRITICAL: "schedule_expense" does NOT deduct any balance today. It only schedules a reminder/plan. Do NOT use "add_transaction" for future planning or "schedule" requests.

2. confirm_schedule:
   - Use this ACTION if the user indicates they are confirming, paying, or settling an already scheduled expense.
   - Example: "StormFiber broadband pay/confirm krdo", "KE-electric confirm kr do", "K-Electric pay/confirm kr do", "scheduled rent mark as paid/confirm".
   - You MUST populate "confirmSchedule" inside the JSON response.

3. add_transaction:
   - ONLY use this ACTION if the transaction HAS ALREADY HAPPENED or is an immediate instant payment statement.
   - Key indicators: past tense in Urdu/English, e.g., "nikaley", "nikale", "expense kiya", "spent", "received", "added", "transfer kar diya", "pay kiya".
   - Example: "Meezan bank se grocery k liye 500 nikaley" -> action: "add_transaction", transaction: { ... }
   - Example: "Salary received 50k in UBL" -> action: "add_transaction"
   - Example: "Transfer 1000 from Meezan to Cash" -> action: "add_transaction"

4. add_debt or settle_debt:
   - Use this if they are lending/borrowing money ("lene hain" / "dene hain") or clearing a debt ("clear hogaye", "de diye").

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
- CRITICAL PRIORITIZATION rule: If the user says "schedule" or uses Urdu terms like "schedule krdo", "shedule", "laga do", "dena hai is tarikh ko", you MUST set action to "schedule_expense" and populate the "scheduledExpense" block. Do NOT set action to "add_transaction" or "add_debt" for these requests. Instantly deducting money is ONLY done if they say something actually happened (e.g. "ho gaya hay", "pay kar diya") or confirm a scheduled bill.
- If mapping to expense category, only use EXACT names from: ${(categories || []).join(", ")}. For example, if user mentions fuel/petrol, map it to "Fuel Expenses"; if they mention mobile balance, map to "Mobile Loads"; if they mention food or restaurant, map to "Foods & Drink Expenses"; if bills, map to "Bills"; if family/home, use "Family Expenses" or "Home Expenses".
- If it is not an action (e.g. asking for report or plan), set action to "none", transaction to null, debt to null, settleDebt to null, scheduledExpense to null, confirmSchedule to null.`;

    const userPrompt = `User Message: "${message}"\n\nPlease respond according to the instructions in JSON format.`;

    const modelConfig = {
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
    };

    let response;
    try {
      response = await generateContentWithRetry(client, "gemini-3.5-flash", userPrompt, modelConfig, 2);
    } catch (primaryErr: any) {
      console.log(`[Gemini Info] Switching to fallback model due to busy state or: ${primaryErr?.message || primaryErr}`);
      try {
        response = await generateContentWithRetry(client, "gemini-3.1-flash-lite", userPrompt, modelConfig, 2);
      } catch (fallbackErr: any) {
        console.warn("[Gemini Info] Busy fallback triggered.");
        throw fallbackErr;
      }
    }

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
