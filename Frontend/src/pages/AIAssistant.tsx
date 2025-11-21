import React, { useEffect, useRef, useState, useCallback } from "react";
import { FiSend, FiRefreshCw, FiSearch, FiX, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import api, { getChatAnswer, getVendors, getChatVendorSummary } from "../services/api";
import { useUser } from "../contexts/UserContext";
import { useToast } from "../hooks/use-toast";

type ChatSource = { rank: number; vendor_name?: string; similarity?: number; content_excerpt?: string };
type ChatMessage = {
  id: string;
  sender: "user" | "assistant" | "error";
  text: string;
  time: string;
  sources?: ChatSource[];
  vendorName?: string | null;
};

const AIAssistant: React.FC = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // Vendor selection & readiness state
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [vendorError, setVendorError] = useState<string>("");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedVendorName, setSelectedVendorName] = useState("");
  const [vendorReady, setVendorReady] = useState(false);
  const [vendorStatusMsg, setVendorStatusMsg] = useState("Select a vendor to begin.");
  const { userId: USER_ID, email: userEmail, hasGoogleConnection, loading: userLoading, error: userError } = useUser();
  const { toast } = useToast();
  // Effective user id fallback: context userId -> localStorage tempUserId -> env VITE_USER_ID
  const resolveUserId = () => {
    return (
      USER_ID ||
      localStorage.getItem("tempUserId") ||
      (import.meta as any).env?.VITE_USER_ID ||
      ""
    );
  };

  // manualUserId already initialized above to avoid initial render flicker

  // Removed manualUserId persistence (handled in UserContext now)
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isTyping]);

  // Load vendors when user & drive connection available
  const loadVendors = async () => {
    const effectiveUserId = resolveUserId();
    if (effectiveUserId && !USER_ID) {
      console.log('[AIAssistant] Using fallback user id', effectiveUserId);
      // Persist for subsequent sessions if came from env
      localStorage.setItem('tempUserId', effectiveUserId);
    }
    if (hasGoogleConnection === false) {
      setVendorError("Drive not connected");
      setVendorStatusMsg("Drive not connected");
      return;
    }
    if (!effectiveUserId) {
      setVendorError("Missing user id");
      setVendorStatusMsg("User missing");
      return;
    }
    // Validate Mongo ObjectId format similar to Vendors.tsx logic
    if (!/^[a-f0-9]{24}$/i.test(effectiveUserId)) {
      setVendorError("Invalid User ID format");
      setVendorStatusMsg("Invalid user id");
      toast({
        title: "⚠️ Invalid User ID Format",
        description: "User ID must be a 24-char hex ObjectId.",
        variant: "destructive"
      });
      return;
    }
    setVendorError("");
    setVendorStatusMsg("Loading vendors...");
    try {
      const { data, response } = await api.getVendors(effectiveUserId);
      console.log("[AIAssistant] getVendors response status", response.status, "payload:", data);
      if (!response.ok) {
        const msg = (data as any).message || (data as any).details || `HTTP ${response.status}`;
        throw new Error(msg);
      }
      const incoming = data.vendors || [];
      setVendors(incoming);
      console.log("[AIAssistant] vendors stored in state count=", incoming.length, incoming);
      if (data.total > 0) {
        setVendorStatusMsg(`Loaded ${data.total} vendor${data.total === 1 ? '' : 's'}`);
        toast({
          title: "✓ Vendors Loaded",
          description: `Found ${data.total} vendor ${data.total === 1 ? 'folder' : 'folders'} in Drive`,
        });
      } else {
        setVendorError("No vendor folders found");
        setVendorStatusMsg("No vendors found");
        toast({
          title: "No Vendors Found",
          description: "Sync emails first to create vendor folders.",
          variant: "destructive",
        });
      }
    } catch (e:any) {
      console.error("[AIAssistant] vendor load error", e);
      const errMsg = e.message || "Failed to load vendors";
      setVendorError(errMsg);
      setVendorStatusMsg("Load failed");
      toast({
        title: "⚠️ Unable to Load Vendors",
        description: errMsg,
        variant: "destructive",
      });
    }
  };

  useEffect(() => { if (USER_ID && hasGoogleConnection) loadVendors(); }, [USER_ID, hasGoogleConnection]);
  useEffect(() => {
    console.log('[AIAssistant] Preconditions', { USER_ID, hasGoogleConnection });
    if (!USER_ID) console.warn('[AIAssistant] USER_ID missing; vendor load skipped');
    if (hasGoogleConnection === false) console.warn('[AIAssistant] Drive not connected; vendor load skipped');
  }, [USER_ID, hasGoogleConnection]);

  // Auto-select first vendor once list arrives (if none chosen yet)
  useEffect(() => {
    if (!selectedVendorName && vendors.length > 0) {
      const first = vendors[0];
      setSelectedVendorId(first.id);
      setSelectedVendorName(first.name);
      setVendorReady(false);
      setVendorStatusMsg("Checking vendor knowledge...");
      console.log("[AIAssistant] Auto-selected first vendor:", first);
    }
  }, [vendors, selectedVendorName]);

  // If "All Vendors" selected skip polling and mark ready
  useEffect(() => {
    if (selectedVendorName === 'ALL') {
      setVendorReady(true);
      setVendorStatusMsg('Querying across all vendors');
    }
  }, [selectedVendorName]);

  // Poll selected vendor readiness (skip for ALL)
  useEffect(() => {
    if (!selectedVendorName || selectedVendorName === 'ALL') return; // skip polling for aggregate
    let timer: any;
    const poll = async () => {
      try {
        const { data } = await getChatVendorSummary(selectedVendorName);
        console.log("[AIAssistant] vendor summary poll", selectedVendorName, data);
        const chunks = data.vendor_info?.total_chunks || 0;
        if (chunks > 0) {
          setVendorReady(true);
          setVendorStatusMsg(`Knowledge ready (${chunks} chunks)`);
          return;
        } else {
          setVendorReady(false);
          setVendorStatusMsg("Indexing knowledge...");
        }
      } catch {
        setVendorReady(false);
        setVendorStatusMsg("Waiting for indexing...");
        console.warn("[AIAssistant] vendor summary poll failed for", selectedVendorName);
      }
      timer = setTimeout(poll, 5000);
    };
    poll();
    return () => timer && clearTimeout(timer);
  }, [selectedVendorName]);

  const formatTime = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const pushMessage = (partial: Omit<ChatMessage, "id" | "time"> & { time?: string }) => {
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      time: partial.time || formatTime(),
      ...partial,
    };
    setMessages((prev) => [...prev, msg]);
  };

  // Centralized API base now handled inside services/api.ts (getChatAnswer)

  const handleSend = async () => {
    const value = input.trim();
    if (!value || isTyping) return;
    if (hasGoogleConnection === false) {
      pushMessage({ sender: "error", text: "Assistant disabled: Google Drive disconnected." });
      return;
    }
    // Require vendor selection for scoped chat; else early guidance.
    if (!selectedVendorName) {
      pushMessage({ sender: "error", text: "Please select a vendor first." });
      return;
    }
    if (!vendorReady) {
      pushMessage({ sender: "error", text: "Vendor knowledge still indexing; try again shortly." });
      return;
    }

    pushMessage({ sender: "user", text: value });
    setInput("");
    setIsTyping(true);

    try {
      const effectiveUserId = resolveUserId();
      const { data, response } = await getChatAnswer(value, selectedVendorName === 'ALL' ? undefined : selectedVendorName, effectiveUserId);
      if (!response.ok || data.success === false) {
        pushMessage({ sender: "error", text: data.message || `Error: HTTP ${response.status}` });
      } else {
        pushMessage({
          sender: "assistant",
            text: data.answer || "(No answer returned)",
            sources: (data.sources || []).map((s: any, idx: number) => ({
              rank: s.rank ?? idx + 1,
              vendor_name: s.vendor_name || s.vendor || data.vendor_name,
              similarity: s.similarity,
              content_excerpt: s.content_excerpt || s.chunk || s.text,
            })),
            vendorName: data.vendor_name ?? null,
        });
      }
    } catch (e: any) {
      pushMessage({ sender: "error", text: `Error: ${e.message}` });
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setIsTyping(false);
    setSearchQuery("");
    setIsSearchOpen(false);
  };

  // Render message text with search highlighting & clickable links.
  const renderMessageText = (text: string, globalIndex: number) => {
    const urlRegex = /https?:\/\/[^\s)]+/g;
    const segments: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = urlRegex.exec(text)) !== null) {
      const urlStart = match.index;
      const urlEnd = urlRegex.lastIndex;
      const before = text.slice(lastIndex, urlStart);
      if (before) segments.push(applySearchHighlight(before, globalIndex));
      const url = match[0].replace(/[.,;!?)]$/,''); // trim trailing punctuation
      segments.push(
        <a
          key={`url-${urlStart}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-violet-400 hover:text-violet-300 break-all"
        >
          {url}
        </a>
      );
      lastIndex = urlEnd;
    }
    const tail = text.slice(lastIndex);
    if (tail) segments.push(applySearchHighlight(tail, globalIndex));
    return <>{segments}</>;
  };

  const applySearchHighlight = (text: string, globalIndex: number) => {
    const q = searchQuery.trim();
    if (!q) return text;
    const lower = text.toLowerCase();
    const qLower = q.toLowerCase();
    const nodes: React.ReactNode[] = [];
    let idx = 0;
    let match = lower.indexOf(qLower);
    let occurrence = 0;
    while (match !== -1) {
      if (match > idx) nodes.push(text.slice(idx, match));
      const fragment = text.slice(match, match + q.length);
      const isActive = globalIndex === activeMatchIndex && occurrence === 0;
      nodes.push(
        <mark
          key={`hl-${match}-${occurrence}`}
          className={`rounded px-0.5 ${isActive ? 'bg-violet-500 text-white' : 'bg-violet-300/70 text-violet-900'}`}
        >{fragment}</mark>
      );
      idx = match + q.length;
      occurrence += 1;
      match = lower.indexOf(qLower, idx);
    }
    if (idx < text.length) nodes.push(text.slice(idx));
    return <>{nodes}</>;
  };

  const matchedMessageIndices = messages
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => searchQuery.trim() && m.text.toLowerCase().includes(searchQuery.toLowerCase()))
    .map(({ i }) => i);

  const totalMatches = matchedMessageIndices.length;

  useEffect(() => {
    // reset active when query changes
    setActiveMatchIndex(0);
  }, [searchQuery]);

  const gotoNextMatch = () => {
    if (!totalMatches) return;
    setActiveMatchIndex((prev) => (prev + 1) % totalMatches);
  };
  const gotoPrevMatch = () => {
    if (!totalMatches) return;
    setActiveMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches);
  };

  useEffect(() => {
    // Auto scroll to active match
    if (!searchQuery.trim() || !totalMatches) return;
    const targetMessageIndex = matchedMessageIndices[activeMatchIndex];
    const el = document.getElementById(`msg-${targetMessageIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeMatchIndex, searchQuery, totalMatches]);

  const grouped = useCallback(() => {
    // Group messages by sender adjacency for bubble stacking aesthetic
    const groups: { sender: ChatMessage["sender"]; items: ChatMessage[] }[] = [];
    for (const msg of messages) {
      const last = groups[groups.length - 1];
      if (last && last.sender === msg.sender) {
        last.items.push(msg);
      } else {
        groups.push({ sender: msg.sender, items: [msg] });
      }
    }
    return groups;
  }, [messages]);

  return (
    // Full height below top navbar, ChatGPT-style
    <div className="flex flex-col h-[calc(100vh-64px)] bg-background text-foreground overflow-hidden">
      {/* Header - fixed at top */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-background via-background to-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-none">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-center shadow-sm">
            <span className="text-xs font-semibold text-white">AI</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">VendorIQ Assistant</h1>
            <p className="text-xs text-muted-foreground">
              Ask questions about invoices, vendors, and analytics.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* UserId input removed; rely on env VITE_USER_ID or localStorage vendorIQ_userId */}
          {/* Vendor selection controls */}
          {/* <button
            type="button"
            onClick={loadVendors}
            className="text-xs rounded-md border px-2 py-1 bg-muted hover:bg-muted/70"
            disabled={!USER_ID || hasGoogleConnection === false}
          >Refresh Vendors</button> */}
          <select
            value={selectedVendorId}
            onFocus={() => { if (!vendors.length && !vendorError) loadVendors(); }}
            onChange={(e) => {
              const vid = e.target.value;
              setSelectedVendorId(vid);
              if (vid === 'ALL') {
                setSelectedVendorName('ALL');
                setVendorReady(true);
                setVendorStatusMsg('Querying across all vendors');
              } else {
                const v = vendors.find(v => v.id === vid);
                setSelectedVendorName(v?.name || "");
                setVendorReady(false);
                setVendorStatusMsg("Checking vendor knowledge...");
              }
            }}
            className="text-xs rounded-md border px-2 py-1 bg-background focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <option value="">{vendors.length ? "Select vendor..." : (vendorError ? vendorError : (hasGoogleConnection === false ? 'Drive not connected' : 'Loading vendors...'))}</option>
            {vendors.length > 1 && <option value="ALL">All Vendors</option>}
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <div className="hidden sm:block text-[10px] text-muted-foreground max-w-[150px] truncate" title={vendorStatusMsg}>{vendorStatusMsg}</div>
          {vendorError && <div className="text-[10px] text-red-500" title={vendorError}>{vendorError}</div>}
          {!vendorError && !vendors.length && hasGoogleConnection && USER_ID && (
            <div className="text-[10px] text-yellow-600" title="No vendor folders discovered">No vendors found</div>
          )}
          {userEmail && (
            <div className={`text-[10px] ${hasGoogleConnection ? 'text-green-600' : 'text-yellow-600'} max-w-[140px] truncate`} title={hasGoogleConnection ? 'Drive connected' : 'Drive not connected'}>{userEmail}</div>
          )}
          {userError && <div className="text-[10px] text-red-500" title={userError}>{userError}</div>}
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <FiRefreshCw className="h-3.5 w-3.5" />
            <span>New chat</span>
          </button>
        </div>
      </header>
      {hasGoogleConnection === false && (
        <div className="flex-none bg-yellow-100 text-yellow-800 text-xs px-6 py-2 border-b border-yellow-300">
          Google account disconnected. Reconnect to enable Assistant queries.
        </div>
      )}

      {/* Search area with WhatsApp-style icon toggle */}
      <div className="flex-none border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
        {isSearchOpen ? (
          <div className="px-6 py-2 space-y-1">
            <div className="flex items-center gap-2">
              <FiSearch className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages"
                className="flex-1 rounded-full border bg-muted px-3 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:bg-background transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-full border bg-background text-muted-foreground hover:bg-muted transition"
                  aria-label="Clear search"
                >
                  <FiX className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => { setIsSearchOpen(false); setSearchQuery(""); }}
                className="inline-flex items-center justify-center h-7 w-7 rounded-full border bg-background text-muted-foreground hover:bg-muted transition"
                aria-label="Close search"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>
            {searchQuery && (
              <p className="text-[10px] text-muted-foreground px-2">
                {messages.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase())).length} match(es)
              </p>
            )}
          </div>
        ) : (
          <div className="px-6 py-2 flex justify-end">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <FiSearch className="h-4 w-4" />
              <span>Search</span>
            </button>
          </div>
        )}
      </div>
      {/* Body - only this middle area scrolls */}
      <main className="flex-1 flex flex-col min-h-0">
        {/* Messages area (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-8 pb-4 sm:px-8 sm:pt-10 sm:pb-6 space-y-6 scroll-smooth" role="log" aria-live="polite">
          {messages.length === 0 && !isTyping && (
            <div className="h-full flex flex-col items-center justify-start text-center text-muted-foreground gap-3">
              <h2 className="text-2xl font-semibold">How can I help you today?</h2>
              {!selectedVendorName && (
                <p className="max-w-md text-sm">
                  {hasGoogleConnection === false ? 'Connect Google Drive to list vendors.' : 'Select a vendor above to begin.'}
                </p>
              )}
              {selectedVendorName && !vendorReady && (
                <p className="max-w-md text-sm flex items-center gap-2">
                  <span className="inline-flex h-3 w-3 rounded-full bg-violet-500 animate-pulse" /> Indexing knowledge for <span className="font-semibold">{selectedVendorName}</span>...
                </p>
              )}
              {selectedVendorName && vendorReady && (
                <div className="flex flex-col items-center gap-2">
                  <p className="max-w-md text-sm text-center">Chatting about <span className="font-semibold">{selectedVendorName}</span>. Try asking:</p>
                  <div className="flex gap-2 flex-wrap justify-center">
                    {[
                      'Show invoice totals trend',
                      'List large invoices',
                      'Full detail of vendor ' + selectedVendorName,
                      'Recent invoices for ' + selectedVendorName,
                    ].map(s => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
                        className="text-xs px-3 py-1 rounded-full border bg-muted hover:bg-muted/70 transition"
                      >{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {vendors.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {vendors.length > 1 && (
                    <button
                      onClick={() => {
                        setSelectedVendorId('ALL');
                        setSelectedVendorName('ALL');
                        setVendorReady(true);
                        setVendorStatusMsg('Querying across all vendors');
                      }}
                      className={`text-xs px-3 py-1 rounded-full border transition ${selectedVendorName === 'ALL' ? 'bg-violet-600 text-white border-transparent' : 'bg-muted hover:bg-muted/70'}`}
                    >All Vendors</button>
                  )}
                  {vendors.map(v => (
                    <button
                      key={v.id}
                      onClick={() => {
                        setSelectedVendorId(v.id);
                        setSelectedVendorName(v.name);
                        setVendorReady(false);
                        setVendorStatusMsg('Checking vendor knowledge...');
                      }}
                      className={`text-xs px-3 py-1 rounded-full border transition ${selectedVendorId === v.id ? 'bg-violet-600 text-white border-transparent' : 'bg-muted hover:bg-muted/70'}`}
                    >{v.name}</button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-4 flex-wrap justify-center">
                {[
                  "Top 5 vendors by spend",
                  "Explain invoice anomalies",
                  "Summarize vendor performance",
                  "Show monthly spend trend",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-xs px-3 py-1 rounded-full border bg-muted hover:bg-muted/70 transition disabled:opacity-40"
                    disabled={!selectedVendorName || !vendorReady}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {grouped().map((group, gi) => (
            <div key={gi} className={`flex w-full ${group.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div className="flex flex-col gap-1 max-w-[80%]">
                {group.sender === "assistant" && (
                  <div className="hidden sm:flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 text-[10px] font-semibold text-white shadow" aria-hidden>
                    AI
                  </div>
                )}
                {group.sender === "error" && (
                  <div className="hidden sm:flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-semibold text-white shadow" aria-hidden>
                    !
                  </div>
                )}
                {group.items
                  .filter(m => !searchQuery.trim() || m.text.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((m, mi) => {
                    const globalIndex = messages.indexOf(m);
                    return (
                      <div
                        id={`msg-${globalIndex}`}
                        key={m.id}
                        className={`rounded-2xl px-3 py-2 text-sm shadow-sm border animate-in fade-in slide-in-from-bottom-1 ${
                          group.sender === "user"
                            ? "bg-primary text-primary-foreground border-primary/40 rounded-br-sm"
                            : group.sender === "assistant"
                              ? "bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 text-white border-transparent rounded-bl-sm"
                              : "bg-red-600 text-white border-red-700 rounded-bl-sm"
                        } ${mi === 0 && group.sender === "assistant" ? "mt-1" : ""}`}
                      >
                        <p className="whitespace-pre-wrap break-words">{renderMessageText(m.text, matchedMessageIndices.indexOf(globalIndex))}</p>
                        {m.vendorName && group.sender === "assistant" && (
                          <p className="mt-2 text-[10px] font-medium opacity-80">Vendor: {m.vendorName || "(auto-detected)"}</p>
                        )}
                        <span className="mt-1 block text-[10px] text-white/70 text-right">
                          {m.time}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex w-full justify-start animate-in fade-in slide-in-from-bottom-1">
              <div className="flex max-w-[80%] items-end gap-2">
                <div className="hidden sm:flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 text-[10px] font-semibold text-white">
                  AI
                </div>
                <div className="rounded-2xl px-3 py-2 text-sm bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 text-white border border-transparent rounded-bl-sm">
                  <div className="flex gap-1 items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:240ms]" />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Composer - fixed at bottom inside this layout */}
        <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3 sm:px-6 flex-none">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <div className="flex items-center gap-2">
              {searchQuery && matchedMessageIndices.length > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <button
                    type="button"
                    onClick={gotoPrevMatch}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-full border bg-background hover:bg-muted transition"
                    aria-label="Previous match"
                  >
                    <FiChevronLeft className="h-4 w-4" />
                  </button>
                  <span>
                    {activeMatchIndex + 1}/{totalMatches}
                  </span>
                  <button
                    type="button"
                    onClick={gotoNextMatch}
                    className="h-7 w-7 inline-flex items-center justify-center rounded-full border bg-background hover:bg-muted transition"
                    aria-label="Next match"
                  >
                    <FiChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder="Ask VendorIQ anything about your invoices or vendors..."
              disabled={hasGoogleConnection === false}
              className="flex-1 resize-none rounded-xl border bg-muted px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:bg-background transition-colors leading-relaxed disabled:opacity-40"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || !selectedVendorName || !vendorReady || hasGoogleConnection === false}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition shadow"
            >
              <FiSend className="h-5 w-5" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AIAssistant;