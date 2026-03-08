import { useState, useRef, useEffect, useCallback } from "react";
import Anthropic from "@anthropic-ai/sdk";
import { fmt, byMonth, groupSum, teamName } from "../utils/finance";

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

function buildDataContext(transactions, allTransactions, kpis, streams, periodLabel) {
  // Use allTransactions for full-history analysis, filtered transactions for current period KPIs
  const all = allTransactions && allTransactions.length > 0 ? allTransactions : transactions;

  const allRevByCat  = groupSum(all, t => t.category, t => t.type === "Revenue");
  const allExpByCat  = groupSum(all, t => t.category, t => t.type === "Expense");
  const allTeamData  = groupSum(all, t => teamName(t.description), t => t.category === "Labor");
  const allTopClients = groupSum(all, t => t.description, t => t.category === "Sales" && t.type === "Revenue").slice(0, 20);
  const allMonthly   = byMonth(all);

  const allRevenue  = all.filter(t => t.type === "Revenue").reduce((s, t) => s + Math.abs(t.amount), 0);
  const allExpenses = all.filter(t => t.type === "Expense").reduce((s, t) => s + Math.abs(t.amount), 0);

  // Build per-tab source summary
  const tabSources = [...new Set(all.map(t => t.source).filter(Boolean))];
  const tabSummaries = tabSources.map(src => {
    const tabTxs = all.filter(t => t.source === src);
    const rev = tabTxs.filter(t => t.type === "Revenue").reduce((s, t) => s + Math.abs(t.amount), 0);
    const exp = tabTxs.filter(t => t.type === "Expense").reduce((s, t) => s + Math.abs(t.amount), 0);
    return `  - "${src}": ${tabTxs.length} rows | Revenue ${fmt(rev)} | Expenses ${fmt(exp)}`;
  });

  // All transactions sorted by date (no cap — full dataset)
  const allTxLines = [...all]
    .sort((a, b) => String(b.transactionDate).localeCompare(String(a.transactionDate)))
    .map(t => `  ${t.transactionDate} | ${t.type} | ${t.category} | ${t.description} | ${fmt(t.amount)}${t.source ? ` | [${t.source}]` : ""}${t.notes ? ` | ${t.notes}` : ""}`);

  const isPeriodFiltered = periodLabel !== "All time";

  let periodSection = "";
  if (isPeriodFiltered) {
    const pRevByCat  = groupSum(transactions, t => t.category, t => t.type === "Revenue");
    const pExpByCat  = groupSum(transactions, t => t.category, t => t.type === "Expense");
    periodSection = `
## Current Period: ${periodLabel} (dashboard filter active)
- Revenue: ${fmt(kpis.revenue)} | Expenses: ${fmt(kpis.expenses)} | Net: ${fmt(kpis.net)} (${kpis.margin}% margin)
- Transactions: ${kpis.count}
### Period Revenue by Category
${pRevByCat.map(c => `  - ${c.name}: ${fmt(c.value)}`).join("\n") || "  (none)"}
### Period Expenses by Category
${pExpByCat.map(c => `  - ${c.name}: ${fmt(c.value)}`).join("\n") || "  (none)"}`;
  }

  return `You are a financial analyst assistant with access to ALL data from every tab of this company's spreadsheet.
Total transactions loaded: ${all.length} (across all tabs and all time)
Dashboard period filter: ${periodLabel}

## Spreadsheet Tabs Summary
${tabSummaries.join("\n") || "  (single sheet)"}

## All-Time Totals
- Total Revenue: ${fmt(allRevenue)}
- Total Expenses: ${fmt(allExpenses)}
- Net Income: ${fmt(allRevenue - allExpenses)}
- Bank Balance (latest): ${fmt(kpis.balance)}
${periodSection}

## All-Time Revenue by Category
${allRevByCat.map(c => `  - ${c.name}: ${fmt(c.value)}`).join("\n") || "  (none)"}

## All-Time Expenses by Category
${allExpByCat.map(c => `  - ${c.name}: ${fmt(c.value)}`).join("\n") || "  (none)"}

## Top Clients All Time (by Revenue)
${allTopClients.map((c, i) => `  ${i + 1}. ${c.name}: ${fmt(c.value)}`).join("\n") || "  (none)"}

## Team & Contractor Payments All Time
${allTeamData.map(c => `  - ${c.name}: ${fmt(c.value)}`).join("\n") || "  (none)"}

## Revenue Streams (All Time)
- LTO Revenue (low-ticket offers): ${fmt(streams.lto)}
- Project Revenue (Build + Consulting): ${fmt(streams.project)}
- Recurring Revenue (Continued Support): ${fmt(streams.recurring)}
- Affiliate / Referral: ${fmt(streams.affiliate)}

## Monthly History (All Time)
${allMonthly.map(m => `  - ${m.month}: Revenue ${fmt(m.revenue)}, Expenses ${fmt(m.expenses)}, Net ${fmt(m.net)}`).join("\n") || "  (none)"}

## All Transactions (newest first)
${allTxLines.join("\n") || "  (none)"}

Answer questions using the full dataset above. You have access to every transaction from every tab. Use exact figures, percentages, and month-by-month comparisons. If the user asks about a specific period, filter from the data above.`;
}

export default function ChatBot({ transactions, allTransactions, kpis, streams, periodLabel }) {
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
      const systemPrompt = buildDataContext(transactions, allTransactions, kpis, streams, periodLabel);

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
  }, [input, streaming, messages, transactions, allTransactions, kpis, streams, periodLabel]);

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
              <p className="text-[11px] text-indigo-200">Full spreadsheet access · all tabs · all time</p>
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
