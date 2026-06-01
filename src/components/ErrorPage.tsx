import { AlertTriangle, Home, ArrowLeft, RefreshCw } from "lucide-react";

interface ErrorPageProps {
  type: "404" | "500" | "403";
  message?: string;
}

const config = {
  "404": {
    code: "404",
    title: "Page Not Found",
    description: "This page doesn't exist or has been moved.",
    emoji: "🔍",
    gradient: "from-amber-400 to-orange-500",
  },
  "500": {
    code: "500",
    title: "Server Error",
    description: "Something went wrong on our end. Please try again.",
    emoji: "⚡",
    gradient: "from-red-400 to-rose-500",
  },
  "403": {
    code: "403",
    title: "Access Denied",
    description: "You don't have permission to access this page.",
    emoji: "🔒",
    gradient: "from-violet-400 to-purple-500",
  },
};

export default function ErrorPage({ type, message }: ErrorPageProps) {
  const c = config[type];

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="relative inline-flex mb-8">
          <div className={`w-24 h-24 bg-gradient-to-br ${c.gradient} rounded-[2.5rem] flex items-center justify-center shadow-2xl`}>
            <span className="text-4xl">{c.emoji}</span>
          </div>
          <div className="absolute -top-3 -right-3 w-12 h-12 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center shadow-lg border border-zinc-200 dark:border-zinc-800">
            <AlertTriangle className="w-5 h-5 text-zinc-500" />
          </div>
        </div>

        <h1 className="text-7xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight">{c.code}</h1>
        <h2 className="text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-3">{c.title}</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">{message || c.description}</p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
          <button
            onClick={() => window.location.hash = "#/dashboard"}
            className="flex items-center gap-2 px-5 py-2.5 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-xl text-sm font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <Home className="w-4 h-4" /> Home
          </button>
        </div>
      </div>
    </div>
  );
}
