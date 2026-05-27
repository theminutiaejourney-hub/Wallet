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
  const { message, history, accounts, categories, transactions, currentTime } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const client = getGeminiClient();
    
    // Construct formatting and prompt context
    const accountsDescription = accounts.map((acc: any) => 
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

    const systemInstruction = `You are a helpful Urdu and English Roman-Urdu financial voice and text bot for a personal wallet tracker.
The current UTC date is ${currentTime || new Date().toISOString().split('T')[0]}.

You have three potential objectives:
1. Parse transactions: If the user indicates they spent, received, or transferred money (e.g., "Meezan bank se grocery k liye 500 nikaley", "Salary received 50k in UBL", "Transfer 1000 from Meezan to Cash", "habib metro mai 200 expense kiya"), detect it and format it.
2. Financial advice / Saving Plans: If the user asks about investments, financial plans, saving paths (e.g., "Meri Income k hisaab sy savings plans btao"), calculate their active balance, review their statements, and formulate customized saving advice.
3. Query Past Transactions & History: If the user asks about past spendings, top categories, specific date records, or general wallet history (e.g., "Meri past transactions ko mdnzar rkh k btao", "pichle 2 hafte pehle k records do", "Sabse zyada expense kis cheez pe hua?", "meray past records mien fuel pur kitney paisay lagay?"), read the user's transaction records from the list provided below, parse the dates/amounts, and perform the calculations or list them. Mention details clearly in Roman Urdu/English with dates and amounts.

The user's active Bank/Cash accounts are:
${accountsDescription}

The available spending/income categories are:
${categories.join(", ")}

The user's past transaction records (always reference this for history queries):
${transactionsDescription || "No past transactions recorded yet."}

You MUST output your response strictly as a single JSON object. Do not include markdown codeblocks or other formatting headers.
The JSON structure must match this:
{
  "responseText": "Your natural language response in Roman Urdu (or English if the user asked in English). Be brief, polite, and clear. If they asked to add/parse a transaction, mention exactly what action was taken. If they asked about past history or questions, perform calculations or lists, and output them beautifully and warmly. If they asked for advice, summarize your customized financial savings advice using bullet points. Use direct and simple words.",
  "action": "add_transaction" or "none",
  "transaction": {
    "type": "income" or "expense" or "transfer",
    "amount": status numeric amount value,
    "category": "one of the available categories that best fits",
    "description": "short title of transaction (e.g. Tea, Rent, Salary)",
    "accountId": "the ID of the source account",
    "toAccountId": "the ID of the target account (only required for transfers)"
  }
}

Guidelines for parsing transactions:
- If the user specifies a bank name like "Meezan" or "UBL", match it to the closest account ID from the list. If they do not specify an account, default to Account ID of Cash or the first account.
- If the user type is a transfer, both accountId (from) and toAccountId (to) must be identified.
- Ensure the amount is a clear parsing of numbers.
- If it is not a transaction (e.g. asking for an investment plan), set action to "none" and transaction to null. In responseText, provide a comprehensive, detailed saving and visual budget plan with steps (e.g. 50/30/20 rule, target to save Rs. X, UBL savings accounts, Meezan Halal mutual funds, etc.) adapted directly to the user's balances.`;

    // Process chat history to conform to Gemini's expectations if we can or just use contents directly
    // Let's pass the prompt to generateContent
    const userPrompt = `User Message: "${message}"\n\nPlease respond according to the instructions in JSON format.`;

    const response = await client.models.generateContent({
      model: "gemini-flash-latest",
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
    console.error("Gemini API Error:", error);
    return res.status(500).json({ 
      error: "AI processing error", 
      message: error.message || "Something went wrong"
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
