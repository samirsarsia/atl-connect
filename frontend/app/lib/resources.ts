export type Category =
  | "food"
  | "housing"
  | "jobs"
  | "health"
  | "financial"
  | "legal"
  | "emergency"
  | "default";

export interface Resource {
  name: string;
  category: Category;
  lat: number;
  lng: number;
  address: string;
  phone: string;
  hours: string;
}

export interface Message {
  role: "user" | "bot";
  content: string;
}

export const CATEGORY_COLORS: Record<Category, { color: string; emoji: string }> = {
  food:      { color: "#f97316", emoji: "🍎" },
  housing:   { color: "#a78bfa", emoji: "🏠" },
  jobs:      { color: "#34d399", emoji: "💼" },
  health:    { color: "#f43f5e", emoji: "🏥" },
  financial: { color: "#fbbf24", emoji: "💰" },
  legal:     { color: "#60a5fa", emoji: "⚖️" },
  emergency: { color: "#f43f5e", emoji: "🚨" },
  default:   { color: "#60a5fa", emoji: "📍" },
};

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food:      ["food", "grocer", "meal", "hunger", "eat", "pantry", "kitchen", "snap", "nutrition"],
  housing:   ["housing", "shelter", "home", "evict", "rent", "homeless", "apartment", "motel"],
  jobs:      ["job", "employ", "work", "career", "train", "resume", "hire", "labor", "workforce"],
  health:    ["health", "doctor", "clinic", "medical", "mental", "dental", "hospital", "prescri"],
  financial: ["financial", "bill", "utility", "money", "assist", "benefit", "cash", "income", "pay"],
  legal:     ["legal", "law", "attorney", "court", "eviction", "rights", "counsel"],
};

export const DEMO_RESOURCES: Resource[] = [
  { name: "Atlanta Community Food Bank",     category: "food",      lat: 33.7553, lng: -84.4344, address: "3400 N Desert Dr, East Point, GA", phone: "(404) 892-9822", hours: "Mon–Fri 8am–5pm" },
  { name: "Gateway Center (Shelter)",        category: "housing",   lat: 33.7492, lng: -84.3987, address: "275 Pryor St SW, Atlanta, GA",     phone: "(404) 215-6600", hours: "24/7" },
  { name: "Goodwill Career Center – Downtown",category: "jobs",     lat: 33.7553, lng: -84.3895, address: "979 Donald Lee Hollowell Pkwy",    phone: "(404) 420-0282", hours: "Mon–Fri 8am–5pm" },
  { name: "Grady Memorial Hospital – ER",    category: "health",    lat: 33.7539, lng: -84.3826, address: "80 Jesse Hill Jr Dr SE",           phone: "(404) 616-4307", hours: "24/7" },
  { name: "United Way 211 Hotline",          category: "financial", lat: 33.7611, lng: -84.3819, address: "40 Courtland St NE, Atlanta, GA",  phone: "211",            hours: "24/7" },
  { name: "Atlanta Legal Aid Society",       category: "legal",     lat: 33.7489, lng: -84.3905, address: "151 Spring St NW, Atlanta, GA",    phone: "(404) 524-5811", hours: "Mon–Fri 9am–5pm" },
  { name: "West End Food Pantry",            category: "food",      lat: 33.7355, lng: -84.4172, address: "1000 Oak St SW, Atlanta, GA",      phone: "(404) 753-5777", hours: "Tue & Thu 10am–1pm" },
  { name: "Atlanta Mission – Men's Shelter", category: "housing",   lat: 33.7564, lng: -84.3978, address: "382 Luckie St NW, Atlanta, GA",    phone: "(404) 688-7210", hours: "Check-in 4pm" },
  { name: "Georgia Dept of Labor – Atlanta", category: "jobs",      lat: 33.7491, lng: -84.3872, address: "148 Andrew Young Intl Blvd",       phone: "(404) 232-3001", hours: "Mon–Fri 8am–4:30pm" },
  { name: "Morehouse Healthcare Clinic",     category: "health",    lat: 33.7487, lng: -84.4151, address: "75 Piedmont Ave NE",               phone: "(404) 756-1000", hours: "Mon–Fri 8am–5pm" },
];

export function getResourcesToShow(userMessage: string, botReply: string): Resource[] {
  const combined = (userMessage + " " + botReply).toLowerCase();
  const matchedCats = new Set<string>();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => combined.includes(kw))) matchedCats.add(cat);
  }
  if (matchedCats.size === 0) return [];
  return DEMO_RESOURCES.filter((r) => matchedCats.has(r.category));
}

export function formatBotResponse(text: string): string {
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/^(\d+)\.\s/gm, "<br><strong>$1.</strong> ");
  return text
    .split("\n\n")
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}
