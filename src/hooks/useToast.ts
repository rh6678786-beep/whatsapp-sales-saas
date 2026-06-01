import { toast } from "react-hot-toast";

export function useToast() {
  return {
    success: (message: string) => toast.success(message, {
      duration: 3000,
      position: "top-right",
      style: {
        background: "#18181b",
        color: "#fff",
        borderRadius: "12px",
        fontSize: "14px",
        fontWeight: "600",
      },
      iconTheme: { primary: "#22c55e", secondary: "#fff" },
    }),
    error: (message: string) => toast.error(message, {
      duration: 4000,
      position: "top-right",
      style: {
        background: "#18181b",
        color: "#fff",
        borderRadius: "12px",
        fontSize: "14px",
        fontWeight: "600",
      },
      iconTheme: { primary: "#ef4444", secondary: "#fff" },
    }),
    loading: (message: string) => toast.loading(message, {
      position: "top-right",
      style: {
        background: "#18181b",
        color: "#fff",
        borderRadius: "12px",
        fontSize: "14px",
        fontWeight: "600",
      },
    }),
    dismiss: (id?: string) => toast.dismiss(id),
    custom: (message: string, icon?: string) => toast(message, {
      duration: 3000,
      position: "top-right",
      icon: icon || "✅",
      style: {
        background: "#18181b",
        color: "#fff",
        borderRadius: "12px",
        fontSize: "14px",
        fontWeight: "600",
      },
    }),
  };
}
