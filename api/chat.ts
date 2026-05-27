import { GoogleGenAI } from "@google/genai";

// Cache client
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    ai = new GoogleGenAI({
      apiKey: apiKey || ""
    });
  }
  return ai;
}

export default async function handler(req: any, res: any) {
  // Set CORS headers for Vercel compatibility
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, accounts, categories, currentTime } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const client = getGeminiClient();
    
    // Construct formatting and prompt context
    const accountsDescription = (accounts || []).map((acc: any) => 
      `- ID: "${acc.id}", Name: "${acc.name}", Type: "${acc.type}", Balance: Rs. ${acc.balance}`
    ).join("\n");

    const systemInstruction = `You are a helpful Urdu and English Roman-Urdu financial voice and text bot for a personal wallet tracker.
The current UTC date is ${currentTime || new Date().toISOString().split('T')[0]}.

You have two potential objectives:
1. Parse transactions: If the user indicates they spent, received, or transferred money (e.g., "Meezan bank se grocery k liye 500 nikaley", "Salary received 50k in UBL", "Transfer 1000 from Meezan to Cash", "habib metro mai 200 expense kiya"), detect it and format it.
2. Financial advice / Saving Plans: If the user asks about investments, financial plans, saving paths (e.g., "Meri Income k hisaab sy savings plans btao"), calculate their active balance, review their statements, and formulate customized saving advice.

The user's active Bank/Cash accounts are:
${accountsDescription}

The available spending/income categories are:
${(categories || []).join(", ")}

You MUST output your response strictly as a single JSON object. Do not include markdown codeblocks or other formatting headers.
The JSON structure must match this:
{
  "responseText": "Your natural language response in Roman Urdu (or English if the user asked in English). Be brief, polite, and clear. Mention exactly what action was taken or summarize your customized financial savings advice using bullet points. Use direct and simple words.",
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

    const userPrompt = `User Message: "${message}"\n\nPlease respond according to the instructions in JSON format.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
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
      replyObj = {
        responseText: replyRaw,
        action: "none",
        transaction: null
      };
    }

    return res.status(200).json(replyObj);
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ 
      error: "AI processing error", 
      message: error.message || "Something went wrong"
    });
  }
}
