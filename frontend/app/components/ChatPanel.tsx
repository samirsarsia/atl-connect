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
import { Message, Resource, formatBotResponse, getResourcesToShow } from "../lib/resources";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const CATEGORY_BUTTONS = [
  { label: "🍎 Food",      query: "I need help finding food near me" },
  { label: "🏠 Housing",   query: "I need help with housing or shelter" },
  { label: "💼 Jobs",      query: "I'm looking for job training and career help" },
  { label: "💰 Financial", query: "I need help with bills and financial assistance" },
  { label: "🏥 Health",    query: "I need affordable healthcare or a doctor" },
  { label: "⚖️ Legal",     query: "I need free legal help" },
];

interface ChatPanelProps {
  onResourcesChange: (resources: Resource[]) => void;
}

export default function ChatPanel({ onResourcesChange }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      content:
        "Hey there! I'm ATL Connect — I help Atlanta residents find community resources like food assistance, housing, job training, financial help, healthcare, and legal aid.\n\nTell me what you need help with, or tap a category above to get started. The more you share about your situation, the better I can help.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<
    { role: string; content: string }[]
  >([]);

  const chatBottomRef = useRef<HTMLDivElement>(null);

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
        body: JSON.stringify({ message, conversation_history: conversationHistory }),
      });

      const data = await res.json();
      const reply: string = data.reply;

      setMessages((prev) => [...prev, { role: "bot", content: reply }]);
      setConversationHistory((prev) => {
        const updated = [
          ...prev,
          { role: "user", content: message },
          { role: "assistant", content: reply },
        ];
        return updated.length > 20 ? updated.slice(-20) : updated;
      });

      onResourcesChange(getResourcesToShow(message, reply));
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content:
            "Sorry, I'm having trouble connecting right now. Please try again, or call 211 for immediate help.",
        },
      ]);
      onResourcesChange(getResourcesToShow(message, ""));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        bgcolor: "#16181f",
      }}
    >
      {/* Header */}
      <Box sx={{ px: 3, pt: 2.5, pb: 1.5, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography fontSize={28} lineHeight={1}>📍</Typography>
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{
              background: "linear-gradient(135deg, #60a5fa, #a78bfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            ATL Connect
          </Typography>
        </Box>
        <Typography variant="caption" color="text.disabled" sx={{ ml: "46px", display: "block", mt: 0.25 }}>
          Your AI guide to Atlanta community resources
        </Typography>
      </Box>

      {/* Category chips */}
      <Box
        sx={{
          display: "flex",
          gap: 1,
          px: 3,
          py: 1.5,
          overflowX: "auto",
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {CATEGORY_BUTTONS.map((btn) => (
          <Chip
            key={btn.label}
            label={btn.label}
            variant="outlined"
            size="small"
            onClick={() => sendMessage(btn.query)}
            sx={{ whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0 }}
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
          "&::-webkit-scrollbar": { width: "4px" },
          "&::-webkit-scrollbar-thumb": { bgcolor: "#2a2d37", borderRadius: "2px" },
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
                to:   { opacity: 1, transform: "translateY(0)" },
              },
            }}
          >
            {msg.role === "user" ? (
              <Box
                sx={{
                  bgcolor: "primary.main",
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
              <Paper
                variant="outlined"
                sx={{
                  borderRadius: "18px 18px 18px 4px",
                  px: 2,
                  py: 2,
                  borderColor: "divider",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: "primary.light",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "block",
                    mb: 0.5,
                  }}
                >
                  ATL Connect
                </Typography>
                <Box
                  sx={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "text.primary",
                    "& p": { mt: 1 },
                    "& strong": { color: "text.primary" },
                  }}
                  dangerouslySetInnerHTML={{ __html: formatBotResponse(msg.content) }}
                />
              </Paper>
            )}
          </Box>
        ))}

        {/* Typing indicator */}
        {loading && (
          <Box sx={{ alignSelf: "flex-start", maxWidth: "85%" }}>
            <Paper
              variant="outlined"
              sx={{ borderRadius: "18px 18px 18px 4px", px: 2, py: 2, borderColor: "divider" }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: "primary.light",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "block",
                  mb: 1,
                }}
              >
                ATL Connect
              </Typography>
              <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
                {[0, 1, 2].map((i) => (
                  <Box
                    key={i}
                    sx={{
                      width: 8,
                      height: 8,
                      bgcolor: "primary.main",
                      borderRadius: "50%",
                      animation: "bounce 1.4s infinite",
                      animationDelay: `${i * 0.2}s`,
                      "@keyframes bounce": {
                        "0%, 60%, 100%": { transform: "translateY(0)" },
                        "30%":           { transform: "translateY(-8px)" },
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

      {/* Input area */}
      <Divider />
      <Box sx={{ px: 3, pt: 2, pb: 2.5, flexShrink: 0 }}>
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
              },
            }}
          />
          <IconButton
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            sx={{
              bgcolor: "primary.main",
              color: "white",
              width: 42,
              height: 42,
              flexShrink: 0,
              borderRadius: "12px",
              "&:hover": { bgcolor: "primary.dark" },
              "&.Mui-disabled": { bgcolor: "#374151", color: "#6b7280" },
            }}
          >
            {loading ? (
              <CircularProgress size={18} sx={{ color: "white" }} />
            ) : (
              <SendIcon fontSize="small" />
            )}
          </IconButton>
        </Box>
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ display: "block", textAlign: "center", mt: 1.5, lineHeight: 1.4 }}
        >
          ATL Connect uses AI to match you with real Atlanta resources. Always verify details by calling ahead. For emergencies, dial 911.
        </Typography>
      </Box>
    </Box>
  );
}
