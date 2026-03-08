import { useState, useRef, useEffect, useCallback } from "react";
import Anthropic from "@anthropic-ai/sdk";
import { fmt, byMonth, groupSum, teamName } from "../utils/finance";

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

function buildDataContext(transactions, kpis, streams, periodLabel) {
  const revenue = transactions.filter(t => t.type === "Revenue");
  const expenses = transactions.filter(t => t.type === "Expense");

  const revByCat = groupSum(transactions, t => t.category, t => t.type === "Revenue");
  const expByCat = groupSum(transactions, t => t.category, t => t.type === "Expense");
  const teamData = groupSum(transactions, t => teamName(t.description), t => t.category === "Labor");
  const topClients = groupSum(transactions, t => t.description, t => t.category === "Sales" && t.type === "Revenue").slice(0, 10);
  const monthly = byMonth(transactions);

  const recentTx = [...transactions]
    .sort((a, b) => String(b.transactionDate).localeCompare(String(a.transactionDate)))
    .slice(0, 20)
    .map(t => `  - ${t.transactionDate}: ${t.type} | ${t.category} | ${t.description} | ${fmt(t.amount)}${t.notes ? ` | Notes: ${t.notes}` : ""}`);

  return `You are a financial analyst assistant for this company dashboard.
Current period filter: ${periodLabel}
Total transactions in view: ${kpis.count}

## Key Financial Metrics
- Total Revenue: ${fmt(kpis.revenue)}
- Total Expenses: ${fmt(kpis.expenses)}
- Net Income: ${fmt(kpis.net)} (${kpis.margin}% margin)
- Bank Balance (latest): ${fmt(kpis.balance)}

## Revenue Streams
- LTO Revenue (low-ticket offers): ${fmt(streams.lto)} (${kpis.revenue > 0 ? ((streams.lto / kpis.revenue) * 100).toFixed(1) : 0}%)
- Project Revenue (Build + Consulting): ${fmt(streams.project)} (${kpis.revenue > 0 ? ((streams.project / kpis.revenue) * 100).toFixed(1) : 0}%)
- Recurring Revenue (Continued Support): ${fmt(streams.recurring)} (${kpis.revenue > 0 ? ((streams.recurring / kpis.revenue) * 100).toFixed(1) : 0}%)
- Affiliate / Referral: ${fmt(streams.affiliate)} (${kpis.revenue > 0 ? ((streams.affiliate / kpis.revenue) * 100).toFixed(1) : 0}%)

## Revenue by Category
${revByCat.map(c => `  - ${c.name}: ${fmt(c.value)}`).join("\n") || "  (none)"}

## Expenses by Category
${expByCat.map(c => `  - ${c.name}: ${fmt(c.value)}`).join("\n") || "  (none)"}

## Top Clients by Revenue
${topClients.map((c, i) => `  ${i + 1}. ${c.name}: ${fmt(c.value)}`).join("\n") || "  (none)"}

## Team & Contractor Payments
${teamData.map(c => `  - ${c.name}: ${fmt(c.value)}`).join("\n") || "  (none)"}

## Monthly Revenue vs Expenses
${monthly.map(m => `  - ${m.month}: Revenue ${fmt(m.revenue)}, Expenses ${fmt(m.expenses)}, Net ${fmt(m.net)}`).join("\n") || "  (none)"}

## 20 Most Recent Transactions
${recentTx.join("\n") || "  (none)"}

Answer questions concisely and accurately using the data above. Use dollar amounts, percentages, and comparisons where helpful. If asked something not covered by the data, say so honestly.`;
}

export default function ChatBot({ transactions, kpis, streams, periodLabel }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const stop = useCallback(() => {
    streamRef.current?.controller?.abort();
    setStreaming(false);
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    if (!API_KEY) {
      setError("No VITE_ANTHROPIC_API_KEY set. Add it to your .env file.");
      return;
    }

    setError(null);
    setInput("");
    const userMsg = { role: "user", content: text };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);

    const assistantPlaceholder = { role: "assistant", content: "" };
    setMessages(prev => [...prev, assistantPlaceholder]);
    setStreaming(true);

    try {
      const client = new Anthropic({ apiKey: API_KEY, dangerouslyAllowBrowser: true });
      const systemPrompt = buildDataContext(transactions, kpis, streams, periodLabel);

      const apiMessages = updatedHistory.map(m => ({ role: m.role, content: m.content }));

      const stream = client.messages.stream({
        model: "claude-opus-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: apiMessages,
      });

      streamRef.current = stream;

      stream.on("text", (delta) => {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + delta,
          };
          return updated;
        });
      });

      await stream.finalMessage();
    } catch (err) {
      if (err.name === "AbortError") return;
      const msg = err instanceof Anthropic.APIError
        ? `API error ${err.status}: ${err.message}`
        : err.message;
      setError(msg);
      setMessages(prev => prev.slice(0, -1)); // remove empty assistant message
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, messages, transactions, kpis, streams, periodLabel]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center text-2xl"
        title="Ask Claude about your data"
      >
        {open ? "×" : "✦"}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: "520px" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white">
            <div>
              <p className="font-semibold text-sm">Claude — Financial Analyst</p>
              <p className="text-[11px] text-indigo-200">Ask anything about your dashboard data</p>
            </div>
            <button
              onClick={clearChat}
              className="text-indigo-200 hover:text-white text-xs transition-colors"
              title="Clear conversation"
            >
              Clear
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
            {messages.length === 0 && (
              <div className="text-gray-400 text-center mt-8 space-y-2">
                <p className="text-3xl">✦</p>
                <p className="font-medium text-gray-500">Ask me about your finances</p>
                <div className="space-y-1 text-xs text-left mt-4">
                  {[
                    "What's my net income this month?",
                    "Who are my top clients?",
                    "How are my recurring revenues trending?",
                    "What's my biggest expense category?",
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); inputRef.current?.focus(); }}
                      className="block w-full text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 transition-colors border border-gray-100"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                  {m.role === "assistant" && streaming && i === messages.length - 1 && (
                    <span className="inline-block w-1.5 h-4 bg-gray-400 ml-0.5 animate-pulse align-text-bottom" />
                  )}
                </div>
              </div>
            ))}

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="px-3 py-3 border-t border-gray-100 flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your data…"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 max-h-28 overflow-y-auto"
              style={{ minHeight: "38px" }}
              disabled={streaming}
            />
            {streaming ? (
              <button
                onClick={stop}
                className="shrink-0 w-9 h-9 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-colors"
                title="Stop"
              >
                ■
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim()}
                className="shrink-0 w-9 h-9 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center transition-colors"
                title="Send"
              >
                ↑
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
