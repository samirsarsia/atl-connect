"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Chip,
  Divider,
  CircularProgress,
  Paper,
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

/**
 * Extract every address the bot mentioned by parsing its Google Maps links.
 * The AI formats addresses as: [Label](https://www.google.com/maps/search/?api=1&query=Full+Address+Atlanta+GA)
 */
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
  { emoji: "🍎", label: "Food",      query: "I need help finding food near me" },
  { emoji: "🏠", label: "Housing",   query: "I need help with housing or shelter" },
  { emoji: "💼", label: "Jobs",      query: "I'm looking for job training and career help" },
  { emoji: "💰", label: "Financial", query: "I need help with bills and financial assistance" },
  { emoji: "🏥", label: "Health",    query: "I need affordable healthcare or a doctor" },
  { emoji: "⚖️", label: "Legal",     query: "I need free legal help" },
];

const CATEGORY_CHIPS = CATEGORY_CARDS.map((c) => ({ label: `${c.emoji} ${c.label}`, query: c.query }));

function formatBotResponse(text: string): string {
  // Markdown links → clickable <a> tags
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, url) => {
    const safe = url.replace(/"/g, "%22");
    const isMaps = url.includes("google.com/maps");
    const prefix = isMaps ? "📍 " : "";
    const color = isMaps ? "#34d399" : "#60a5fa";
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer" style="color:${color};text-decoration:underline;">${prefix}${label}</a>`;
  });

  // Phone numbers (xxx) xxx-xxxx → tappable tel links
  text = text.replace(/(\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4})/g, (match) => {
    const digits = match.replace(/\D/g, "");
    return `<a href="tel:+1${digits}" style="color:#60a5fa;text-decoration:underline;">📞 ${match}</a>`;
  });

  // 211 / 2-1-1 → tel link
  text = text.replace(/\b(2-1-1|211)\b/g, '<a href="tel:211" style="color:#60a5fa;text-decoration:underline;">📞 211</a>');

  // Bold
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Paragraphs
  return text
    .split("\n\n")
    .map((p) => `<p style="margin-top:8px">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

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
        // Combine backend live_resources with every address the bot linked to in its reply
        const fromReply = extractMapsAddresses(reply);
        const backendLive: LiveResource[] = data.live_resources ?? [];
        // Deduplicate by address
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
          content:
            "Sorry, I'm having trouble connecting right now. Please try again, or call 211 for immediate help.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Gradient shared by header badge and bot avatar
  const atlGradient = "linear-gradient(135deg, #3b82f6, #8b5cf6)";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: "#111318" }}>

      {/* ── Header ── */}
      <Box
        sx={{
          px: 3,
          pt: 2,
          pb: 1.5,
          borderBottom: "1px solid #1e2130",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {/* ATL badge */}
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "10px",
              background: atlGradient,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 13,
              color: "white",
              letterSpacing: "0.02em",
              flexShrink: 0,
            }}
          >
            ATL
          </Box>
          <Box>
            <Typography fontWeight={700} fontSize={16} color="#e4e4e7" lineHeight={1.2}>
              ATL Connect
            </Typography>
            <Typography fontSize={11} color="#52525b" lineHeight={1.2}>
              Community Resource Navigator
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {/* Live dot */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: "#22c55e",
                animation: "pulse 2s infinite",
                "@keyframes pulse": {
                  "0%, 100%": { opacity: 1 },
                  "50%": { opacity: 0.4 },
                },
              }}
            />
            <Typography fontSize={12} color="#22c55e" fontWeight={500}>
              Live
            </Typography>
          </Box>

        </Box>
      </Box>

      {/* ── Welcome screen (before first message) ── */}
      {!hasStarted && (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            px: 3,
            pb: 4,
            gap: 3,
          }}
        >
          <Box sx={{ textAlign: "center" }}>
            <Typography fontSize={48} lineHeight={1} mb={1.5}>
              📍
            </Typography>
            <Typography fontSize={24} fontWeight={700} color="#e4e4e7" mb={1}>
              How can I help you today?
            </Typography>
            <Typography fontSize={14} color="#71717a" maxWidth={400} mx="auto">
              Describe your situation and I'll connect you with real Atlanta community resources.
            </Typography>
          </Box>

          {/* 3-column card grid */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 1.5,
              width: "100%",
              maxWidth: 560,
            }}
          >
            {CATEGORY_CARDS.map((card) => (
              <Box
                key={card.label}
                onClick={() => sendMessage(card.query)}
                sx={{
                  bgcolor: "#1a1c24",
                  border: "1px solid #2a2d3a",
                  borderRadius: "12px",
                  px: 2,
                  py: 2,
                  cursor: "pointer",
                  transition: "border-color 0.15s, background 0.15s",
                  "&:hover": {
                    borderColor: "#3b82f6",
                    bgcolor: "#1e2130",
                  },
                  textAlign: "center",
                }}
              >
                <Typography fontSize={24} lineHeight={1} mb={0.75}>
                  {card.emoji}
                </Typography>
                <Typography fontSize={13} fontWeight={600} color="#e4e4e7">
                  {card.label}
                </Typography>
              </Box>
            ))}
          </Box>

          <Typography fontSize={12} color="#52525b" fontStyle="italic">
            🌎 Hablo español también — escríbeme en español.
          </Typography>
        </Box>
      )}

      {/* ── Chat area (after first message) ── */}
      {hasStarted && (
        <>
          {/* Category chips bar */}
          <Box
            sx={{
              display: "flex",
              gap: 1,
              px: 3,
              py: 1.25,
              overflowX: "auto",
              borderBottom: "1px solid #1e2130",
              flexShrink: 0,
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
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
                  fontSize: 12,
                  borderColor: "#2a2d3a",
                  color: "#94a3b8",
                  "&:hover": { borderColor: "#3b82f6", color: "#60a5fa" },
                }}
              />
            ))}
          </Box>

          {/* Messages */}
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              px: 3,
              py: 2.5,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {messages.map((msg, i) => (
              <Box
                key={i}
                sx={{
                  maxWidth: "85%",
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  animation: "fadeIn 0.3s ease",
                  "@keyframes fadeIn": {
                    from: { opacity: 0, transform: "translateY(8px)" },
                    to: { opacity: 1, transform: "translateY(0)" },
                  },
                }}
              >
                {msg.role === "user" ? (
                  <Box
                    sx={{
                      bgcolor: "#3b82f6",
                      color: "white",
                      borderRadius: "18px 18px 4px 18px",
                      px: 2,
                      py: 1.5,
                      fontSize: 14,
                      lineHeight: 1.6,
                    }}
                  >
                    {msg.content}
                  </Box>
                ) : (
                  <Box>
                    {/* ATL avatar + label */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: "8px",
                          background: atlGradient,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "white",
                          flexShrink: 0,
                        }}
                      >
                        ATL
                      </Box>
                      <Typography fontSize={12} fontWeight={600} color="#94a3b8">
                        ATL Connect
                      </Typography>
                    </Box>
                    <Paper
                      variant="outlined"
                      sx={{
                        borderRadius: "4px 18px 18px 18px",
                        px: 2,
                        py: 2,
                        borderColor: "#2a2d3a",
                        bgcolor: "#1a1c24",
                      }}
                    >
                      <Box
                        sx={{
                          fontSize: 14,
                          lineHeight: 1.6,
                          color: "#d4d4d8",
                          "& p": { mt: 1, "&:first-of-type": { mt: 0 } },
                          "& strong": { color: "#e4e4e7" },
                          "& a": { textDecoration: "underline" },
                        }}
                        dangerouslySetInnerHTML={{ __html: formatBotResponse(msg.content) }}
                      />
                    </Paper>
                  </Box>
                )}
              </Box>
            ))}

            {/* Typing indicator */}
            {loading && (
              <Box sx={{ alignSelf: "flex-start", maxWidth: "85%" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: "8px",
                      background: atlGradient,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "white",
                      flexShrink: 0,
                    }}
                  >
                    ATL
                  </Box>
                  <Typography fontSize={12} fontWeight={600} color="#94a3b8">
                    ATL Connect
                  </Typography>
                </Box>
                <Paper
                  variant="outlined"
                  sx={{ borderRadius: "4px 18px 18px 18px", px: 2, py: 2, borderColor: "#2a2d3a", bgcolor: "#1a1c24" }}
                >
                  <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
                    {[0, 1, 2].map((j) => (
                      <Box
                        key={j}
                        sx={{
                          width: 8,
                          height: 8,
                          bgcolor: "#3b82f6",
                          borderRadius: "50%",
                          animation: "bounce 1.4s infinite",
                          animationDelay: `${j * 0.2}s`,
                          "@keyframes bounce": {
                            "0%, 60%, 100%": { transform: "translateY(0)" },
                            "30%": { transform: "translateY(-8px)" },
                          },
                        }}
                      />
                    ))}
                  </Box>
                </Paper>
              </Box>
            )}

            <div ref={chatBottomRef} />
          </Box>
        </>
      )}

      {/* ── Input area (always visible) ── */}
      <Divider sx={{ borderColor: "#1e2130" }} />
      <Box sx={{ px: 3, pt: 2, pb: 1.5, flexShrink: 0 }}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
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
                borderRadius: "12px",
                fontSize: 14,
                bgcolor: "#1a1c24",
                "& fieldset": { borderColor: "#2a2d3a" },
                "&:hover fieldset": { borderColor: "#3b82f6" },
                "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
              },
              "& input": { color: "#e4e4e7" },
              "& input::placeholder": { color: "#52525b" },
            }}
          />
          <IconButton
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            sx={{
              bgcolor: "#3b82f6",
              color: "white",
              width: 42,
              height: 42,
              flexShrink: 0,
              borderRadius: "12px",
              "&:hover": { bgcolor: "#2563eb" },
              "&.Mui-disabled": { bgcolor: "#1e2130", color: "#374151" },
            }}
          >
            {loading ? (
              <CircularProgress size={18} sx={{ color: "white" }} />
            ) : (
              <SendIcon fontSize="small" />
            )}
          </IconButton>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mt: 1.25,
          }}
        >
          <Typography fontSize={11} color="#3f3f46">
            📍 Addresses link to Google Maps · 📞 Phone numbers are tappable · For emergencies, dial 911
          </Typography>
          <Typography fontSize={11} color="#3f3f46" flexShrink={0} ml={1}>
            Data verified March 2026
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
