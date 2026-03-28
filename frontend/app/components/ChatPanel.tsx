"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Chip,
  CircularProgress,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Message {
  role: "user" | "bot";
  content: string;
}

export interface LiveResource {
  name: string;
  address: string;
}

function extractMapsAddresses(reply: string): LiveResource[] {
  const pattern = /\[([^\]]+)\]\(https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=([^)]+)\)/g;
  const seen = new Set<string>();
  const results: LiveResource[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(reply)) !== null) {
    const name = m[1].replace(/^📍\s*/, "").trim();
    const address = decodeURIComponent(m[2].replace(/\+/g, " "))
      .replace(/\s+Atlanta\s+GA$/i, "")
      .trim();
    if (address && !seen.has(address.toLowerCase())) {
      seen.add(address.toLowerCase());
      results.push({ name, address });
    }
  }
  return results;
}

interface ChatPanelProps {
  userLat?: number | null;
  userLng?: number | null;
  onResourcesCited?: (names: string[], liveResources: LiveResource[]) => void;
}

const CATEGORY_CARDS = [
  { emoji: "🍎", label: "Food", query: "I need help finding food near me" },
  { emoji: "🏠", label: "Housing", query: "I need help with housing or shelter" },
  { emoji: "💼", label: "Jobs", query: "I'm looking for job training and career help" },
  { emoji: "💰", label: "Financial", query: "I need help with bills and financial assistance" },
  { emoji: "🏥", label: "Health", query: "I need affordable healthcare or a doctor" },
  { emoji: "⚖️", label: "Legal", query: "I need free legal help" },
];

const CATEGORY_CHIPS = CATEGORY_CARDS.map((c) => ({ label: `${c.emoji} ${c.label}`, query: c.query }));

function formatBotResponse(text: string): string {
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, url) => {
    const safe = url.replace(/"/g, "%22");
    const isMaps = url.includes("google.com/maps");
    const prefix = isMaps ? "📍 " : "";
    const color = isMaps ? "#059669" : "#2563eb";
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer" style="color:${color};text-decoration:underline;">${prefix}${label}</a>`;
  });

  text = text.replace(/(\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4})/g, (match) => {
    const digits = match.replace(/\D/g, "");
    return `<a href="tel:+1${digits}" style="color:#2563eb;text-decoration:underline;">📞 ${match}</a>`;
  });

  text = text.replace(/\b(2-1-1|211)\b/g, '<a href="tel:211" style="color:#2563eb;text-decoration:underline;">📞 211</a>');
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  return text
    .split("\n\n")
    .map((p) => `<p style="margin-top:8px">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

// Light glass — bright frosted white
const glass = {
  background: "rgba(255,255,255,0.75)",
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  border: "1px solid rgba(0,0,0,0.08)",
};

export default function ChatPanel({ userLat, userLng, onResourcesCited }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const hasStarted = messages.length > 0;

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text?: string) {
    const message = (text ?? input).trim();
    if (!message || loading) return;

    setInput("");
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: message }]);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversation_history: conversationHistory,
          user_lat: userLat ?? null,
          user_lng: userLng ?? null,
        }),
      });

      const data = await res.json();
      const reply: string = data.reply;

      setMessages((prev) => [...prev, { role: "bot", content: reply }]);
      if (onResourcesCited) {
        const fromReply = extractMapsAddresses(reply);
        const backendLive: LiveResource[] = data.live_resources ?? [];
        const seen = new Set(backendLive.map((r) => r.address.toLowerCase()));
        const merged = [
          ...backendLive,
          ...fromReply.filter((r) => !seen.has(r.address.toLowerCase())),
        ];
        onResourcesCited(data.resources_cited ?? [], merged);
      }
      setConversationHistory((prev) => {
        const updated = [
          ...prev,
          { role: "user", content: message },
          { role: "assistant", content: reply },
        ];
        return updated.length > 20 ? updated.slice(-20) : updated;
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: "Sorry, I'm having trouble connecting right now. Please try again, or call 211 for immediate help.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const atlGradient = "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)";

  return (
    // No border-radius — panel fills its container edge-to-edge
    <Box sx={{
      ...glass,
      borderRadius: 0,
      display: "flex",
      flexDirection: "column",
      height: "100%",
      boxShadow: "-4px 0 32px rgba(0,0,0,0.12)",
      overflow: "hidden",
    }}>

      {/* ── Header ── */}
      <Box sx={{
        px: 2.5,
        pt: 2,
        pb: 1.75,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        background: "rgba(255,255,255,0.5)",
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: atlGradient,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 11,
            color: "white",
            letterSpacing: "0.04em",
            flexShrink: 0,
            boxShadow: "0 0 0 2px rgba(124,58,237,0.25), 0 4px 16px rgba(37,99,235,0.25)",
          }}>
            ATL
          </Box>
          <Box>
            <Typography fontWeight={700} fontSize={15} color="#0f172a" lineHeight={1.2}>
              ATL Connect
            </Typography>
            <Typography fontSize={11} color="#64748b" lineHeight={1.3}>
              Community Resource Navigator
            </Typography>
          </Box>
        </Box>

        {/* Live pill */}
        <Box sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 1.25,
          py: 0.5,
          borderRadius: "99px",
          background: "rgba(22,163,74,0.08)",
          border: "1px solid rgba(22,163,74,0.25)",
        }}>
          <Box sx={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            bgcolor: "#16a34a",
            animation: "livePulse 2s infinite",
            "@keyframes livePulse": {
              "0%, 100%": { opacity: 1, transform: "scale(1)" },
              "50%": { opacity: 0.5, transform: "scale(0.85)" },
            },
          }} />
          <Typography fontSize={11} color="#16a34a" fontWeight={700}>
            Live
          </Typography>
        </Box>
      </Box>

      {/* ── Welcome screen ── */}
      {!hasStarted && (
        <Box sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          px: 3,
          pb: 3,
          gap: 3,
        }}>
          <Box sx={{ textAlign: "center" }}>
            <Typography fontSize={44} lineHeight={1} mb={1.5}>📍</Typography>
            <Typography fontSize={22} fontWeight={700} color="#0f172a" mb={0.875} letterSpacing="-0.02em">
              How can I help you today?
            </Typography>
            <Typography fontSize={13.5} color="#475569" maxWidth={380} mx="auto" lineHeight={1.6}>
              Describe your situation and I'll connect you with real Atlanta community resources.
            </Typography>
          </Box>

          {/* 3-column card grid */}
          <Box sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 1.25,
            width: "100%",
            maxWidth: 560,
          }}>
            {CATEGORY_CARDS.map((card) => (
              <Box
                key={card.label}
                onClick={() => sendMessage(card.query)}
                sx={{
                  background: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(0,0,0,0.09)",
                  borderRadius: "14px",
                  px: 1.5,
                  py: 1.75,
                  cursor: "pointer",
                  backdropFilter: "blur(8px)",
                  transition: "all 0.18s ease",
                  "&:hover": {
                    background: "rgba(37,99,235,0.07)",
                    borderColor: "rgba(37,99,235,0.35)",
                    transform: "translateY(-2px)",
                    boxShadow: "0 8px 24px rgba(37,99,235,0.12)",
                  },
                  "&:active": { transform: "translateY(0)" },
                  textAlign: "center",
                }}
              >
                <Typography fontSize={22} lineHeight={1} mb={0.625}>{card.emoji}</Typography>
                <Typography fontSize={12.5} fontWeight={600} color="#1e293b">{card.label}</Typography>
              </Box>
            ))}
          </Box>

          <Typography fontSize={12} color="#94a3b8" fontStyle="italic">
            🌎 Hablo español también — escríbeme en español.
          </Typography>
        </Box>
      )}

      {/* ── Chat area ── */}
      {hasStarted && (
        <>
          {/* Category chips */}
          <Box sx={{
            display: "flex",
            gap: 0.875,
            px: 2.5,
            py: 1.25,
            overflowX: "auto",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            flexShrink: 0,
            background: "rgba(255,255,255,0.4)",
            "&::-webkit-scrollbar": { display: "none" },
          }}>
            {CATEGORY_CHIPS.map((btn) => (
              <Chip
                key={btn.label}
                label={btn.label}
                variant="outlined"
                size="small"
                onClick={() => sendMessage(btn.query)}
                sx={{
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  flexShrink: 0,
                  fontSize: 11.5,
                  height: 28,
                  borderColor: "rgba(0,0,0,0.12)",
                  color: "#334155",
                  background: "rgba(255,255,255,0.6)",
                  backdropFilter: "blur(8px)",
                  transition: "all 0.15s",
                  "&:hover": {
                    borderColor: "rgba(37,99,235,0.5)",
                    color: "#1e40af",
                    background: "rgba(37,99,235,0.08)",
                  },
                }}
              />
            ))}
          </Box>

          {/* Messages */}
          <Box sx={{
            flex: 1,
            overflowY: "auto",
            px: 2.5,
            py: 2.5,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            "&::-webkit-scrollbar": { width: 4 },
            "&::-webkit-scrollbar-track": { background: "transparent" },
            "&::-webkit-scrollbar-thumb": { background: "rgba(0,0,0,0.12)", borderRadius: 4 },
          }}>
            {messages.map((msg, i) => (
              <Box
                key={i}
                sx={{
                  maxWidth: "85%",
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  animation: "fadeSlide 0.28s ease",
                  "@keyframes fadeSlide": {
                    from: { opacity: 0, transform: "translateY(10px)" },
                    to: { opacity: 1, transform: "translateY(0)" },
                  },
                }}
              >
                {msg.role === "user" ? (
                  <Box sx={{
                    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                    color: "white",
                    borderRadius: "18px 18px 5px 18px",
                    px: 2,
                    py: 1.375,
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    boxShadow: "0 4px 16px rgba(37,99,235,0.25)",
                  }}>
                    {msg.content}
                  </Box>
                ) : (
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.875, mb: 0.75 }}>
                      <Box sx={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: atlGradient,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9,
                        fontWeight: 800,
                        color: "white",
                        flexShrink: 0,
                        boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
                      }}>
                        ATL
                      </Box>
                      <Typography fontSize={11.5} fontWeight={600} color="#64748b">
                        ATL Connect
                      </Typography>
                    </Box>
                    <Box sx={{
                      background: "rgba(255,255,255,0.80)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: "5px 18px 18px 18px",
                      px: 2,
                      py: 1.75,
                      boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
                    }}>
                      <Box
                        sx={{
                          fontSize: 13.5,
                          lineHeight: 1.65,
                          color: "#1e293b",
                          "& p": { mt: 1, "&:first-of-type": { mt: 0 } },
                          "& strong": { color: "#0f172a", fontWeight: 700 },
                          "& a": { textDecoration: "underline" },
                        }}
                        dangerouslySetInnerHTML={{ __html: formatBotResponse(msg.content) }}
                      />
                    </Box>
                  </Box>
                )}
              </Box>
            ))}

            {/* Typing indicator */}
            {loading && (
              <Box sx={{ alignSelf: "flex-start", maxWidth: "85%" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.875, mb: 0.75 }}>
                  <Box sx={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: atlGradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    fontWeight: 800,
                    color: "white",
                    flexShrink: 0,
                  }}>ATL</Box>
                  <Typography fontSize={11.5} fontWeight={600} color="#64748b">ATL Connect</Typography>
                </Box>
                <Box sx={{
                  background: "rgba(255,255,255,0.80)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: "5px 18px 18px 18px",
                  px: 2,
                  py: 1.75,
                }}>
                  <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
                    {[0, 1, 2].map((j) => (
                      <Box key={j} sx={{
                        width: 7,
                        height: 7,
                        bgcolor: "#2563eb",
                        borderRadius: "50%",
                        animation: "bounce 1.4s infinite",
                        animationDelay: `${j * 0.2}s`,
                        "@keyframes bounce": {
                          "0%, 60%, 100%": { transform: "translateY(0)", opacity: 0.5 },
                          "30%": { transform: "translateY(-7px)", opacity: 1 },
                        },
                      }} />
                    ))}
                  </Box>
                </Box>
              </Box>
            )}

            <div ref={chatBottomRef} />
          </Box>
        </>
      )}

      {/* ── Input area ── */}
      <Box sx={{
        px: 2.5,
        pt: 1.5,
        pb: 1.5,
        flexShrink: 0,
        borderTop: "1px solid rgba(0,0,0,0.07)",
        background: "rgba(255,255,255,0.5)",
      }}>
        <Box sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
          <TextField
            fullWidth
            size="small"
            variant="outlined"
            placeholder="Tell me what you need help with..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "99px",
                fontSize: 13.5,
                background: "rgba(255,255,255,0.8)",
                backdropFilter: "blur(12px)",
                "& fieldset": { borderColor: "rgba(0,0,0,0.13)", borderRadius: "99px" },
                "&:hover fieldset": { borderColor: "rgba(37,99,235,0.45)" },
                "&.Mui-focused fieldset": { borderColor: "#2563eb" },
              },
              "& input": { color: "#0f172a", px: 2 },
              "& input::placeholder": { color: "#94a3b8" },
            }}
          />
          <IconButton
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            sx={{
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "white",
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: "50%",
              boxShadow: "0 4px 16px rgba(37,99,235,0.30)",
              transition: "all 0.18s ease",
              "&:hover": {
                background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                boxShadow: "0 6px 20px rgba(37,99,235,0.45)",
                transform: "scale(1.06)",
              },
              "&:active": { transform: "scale(0.95)" },
              "&.Mui-disabled": {
                background: "rgba(0,0,0,0.08)",
                color: "#94a3b8",
                boxShadow: "none",
              },
            }}
          >
            {loading ? (
              <CircularProgress size={16} sx={{ color: "rgba(255,255,255,0.5)" }} />
            ) : (
              <SendIcon sx={{ fontSize: 17 }} />
            )}
          </IconButton>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "center", mt: 1 }}>
          <Typography fontSize={10.5} color="#94a3b8" textAlign="center">
            📍 Addresses link to Maps · 📞 Tap numbers to call · Emergencies: 911
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
