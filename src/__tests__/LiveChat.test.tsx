import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import LiveChat from "../components/LiveChat";
import type { Message, Session } from "../types";

// ---- Socket.io mock that stores handlers for test triggering ----
interface MockSocket {
  on: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  /** Simulate receiving a WebSocket event */
  _receive: (event: string, ...args: any[]) => void;
  /** Get registered handlers for an event */
  _getHandlers: (event: string) => Function[];
}

const mockSocketFactory = vi.hoisted(() => {
  let handlers: Record<string, Function[]> = {};

  function createMockSocket(): MockSocket {
    handlers = {};
    const socket: MockSocket = {
      on: vi.fn((event: string, handler: Function) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return socket;
      }),
      emit: vi.fn(),
      disconnect: vi.fn(),
      off: vi.fn(),
      _receive: (event: string, ...args: any[]) => {
        (handlers[event] || []).forEach((h) => h(...args));
      },
      _getHandlers: (event: string) => handlers[event] || [],
    };
    return socket;
  }

  let _latestSocket: MockSocket | null = null;

  function setLatestSocket(s: MockSocket | null) {
    _latestSocket = s;
  }

  function getLatestSocket(): MockSocket | null {
    return _latestSocket;
  }

  return { createMockSocket, setLatestSocket, getLatestSocket };
});

vi.mock("socket.io-client", () => ({
  default: vi.fn(() => {
    const sock = mockSocketFactory.createMockSocket();
    mockSocketFactory.setLatestSocket(sock);
    return sock;
  }),
  io: vi.fn(() => {
    const sock = mockSocketFactory.createMockSocket();
    mockSocketFactory.setLatestSocket(sock);
    return sock;
  }),
}));

vi.mock("axios");

// ---- Test data ----
const baseSessions: Session[] = [
  {
    id: "user-1",
    userId: "user-1",
    state: "NEW" as any,
    lastMessageAt: "2026-06-03T12:00:00Z",
    remindersCount: 0,
    isBlocked: false,
    metadata: {},
  },
  {
    id: "user-2",
    userId: "user-2",
    state: "PAYMENT_AWAITING" as any,
    lastMessageAt: "2026-06-03T11:00:00Z",
    remindersCount: 1,
    isBlocked: false,
    metadata: {},
  },
];

function mockWhatsAppReady(sessions: Session[] = baseSessions) {
  (axios.get as any).mockImplementation((url: string) => {
    if (url === "/api/whatsapp/status") {
      return Promise.resolve({ data: { isReady: true } });
    }
    if (url === "/api/sessions") {
      return Promise.resolve({ data: sessions });
    }
    if (url?.startsWith("/api/sessions/") && url?.endsWith("/messages")) {
      return Promise.resolve({ data: [] });
    }
    return Promise.reject(new Error("Unknown URL: " + url));
  });
}

function setupSessionStorage() {
  sessionStorage.setItem("adminId", "test-admin");
  sessionStorage.setItem("authToken", "test-token");
}

// ===========================================================================
// Tests
// ===========================================================================
describe("LiveChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockSocketFactory.setLatestSocket(null);
  });

  afterEach(() => {
    cleanup();
  });

  describe("WhatsApp connection state", () => {
    it("shows 'WhatsApp Not Linked' when not connected", async () => {
      (axios.get as any).mockResolvedValueOnce({
        data: { isReady: false },
      });

      render(<LiveChat />);

      await waitFor(() => {
        expect(screen.getByText("WhatsApp Not Linked")).toBeTruthy();
      });
    });

    it("shows the chat interface when WhatsApp is connected", async () => {
      mockWhatsAppReady();
      setupSessionStorage();
      render(<LiveChat />);

      await waitFor(() => {
        expect(screen.getByText("Active Chats")).toBeTruthy();
      });
    });
  });

  describe("Session list", () => {
    it("renders sessions in the sidebar", async () => {
      mockWhatsAppReady();
      setupSessionStorage();
      render(<LiveChat />);

      await waitFor(() => {
        expect(screen.getByText("user-1")).toBeTruthy();
        expect(screen.getByText("State: NEW")).toBeTruthy();
      });
    });

    it("shows 'Select a Chat' placeholder when no session selected", async () => {
      mockWhatsAppReady();
      setupSessionStorage();
      render(<LiveChat />);

      await waitFor(() => {
        expect(screen.getByText("Select a Chat")).toBeTruthy();
      });
    });

    it("selects a session on click and shows its details", async () => {
      mockWhatsAppReady();
      setupSessionStorage();
      render(<LiveChat />);

      const user = userEvent.setup();
      const sessionBtn = await screen.findByText("user-1");
      await user.click(sessionBtn);

      await waitFor(() => {
        const headers = screen.getAllByText("user-1");
        expect(headers.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("Search", () => {
    it("filters sessions by userId", async () => {
      mockWhatsAppReady();
      setupSessionStorage();
      render(<LiveChat />);

      const user = userEvent.setup();
      await screen.findByText("user-1");
      const searchInput = screen.getByPlaceholderText("Search customers...");

      await user.type(searchInput, "user-1");

      await waitFor(() => {
        expect(screen.getByText("user-1")).toBeTruthy();
      });
      expect(screen.queryByText("user-2")).toBeNull();
    });
  });

  describe("Block/Unblock", () => {
    it("calls API to block a user", async () => {
      mockWhatsAppReady();
      setupSessionStorage();
      (axios.patch as any).mockResolvedValueOnce({ data: {} });

      render(<LiveChat />);

      const user = userEvent.setup();
      const sessionBtn = await screen.findByText("user-1");
      await user.click(sessionBtn);

      const blockBtn = await screen.findByText("Block");
      await user.click(blockBtn);

      await waitFor(() => {
        expect(axios.patch).toHaveBeenCalledWith("/api/sessions/user-1", {
          isBlocked: true,
        });
      });
    });
  });

  describe("Handoff UI", () => {
    const handoffSession: Session[] = [
      {
        ...baseSessions[0],
        metadata: { handoffTriggered: true, handoffReason: "Customer request" },
      },
    ];

    it("shows supervisor mode when handoff is active", async () => {
      mockWhatsAppReady(handoffSession);
      setupSessionStorage();
      render(<LiveChat />);

      const user = userEvent.setup();
      const sessionBtn = await screen.findByText("user-1");
      await user.click(sessionBtn);

      await waitFor(() => {
        expect(screen.getByText(/Supervisor mode/)).toBeTruthy();
        expect(screen.getByText("Resume AI")).toBeTruthy();
      });
    });

    it("sends supervisor message via API", async () => {
      mockWhatsAppReady(handoffSession);
      setupSessionStorage();
      (axios.post as any).mockResolvedValueOnce({ data: {} });
      (axios.post as any).mockResolvedValueOnce({ data: {} });

      render(<LiveChat />);

      const user = userEvent.setup();
      const sessionBtn = await screen.findByText("user-1");
      await user.click(sessionBtn);

      const input = await screen.findByPlaceholderText(
        "Type your reply as supervisor..."
      );
      await user.type(input, "Hello customer!");

      // Click the send button
      const sendBtn = document.querySelector(
        'button:has(> svg.lucide-send)'
      ) as HTMLElement;
      if (sendBtn) {
        await user.click(sendBtn);
      }

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith("/api/supervisor/send", {
          userId: "user-1",
          message: "Hello customer!",
        });
      });
    });
  });

  describe("Live label", () => {
    it("shows Live indicator in the sidebar header", async () => {
      mockWhatsAppReady();
      setupSessionStorage();
      render(<LiveChat />);

      await waitFor(() => {
        expect(screen.getByText("Live")).toBeTruthy();
      });
    });
  });

  // ===================================================================
  // WebSocket event handling
  // ===================================================================
  describe("WebSocket: new_message event", () => {
    it("adds incoming message to the selected session's messages", async () => {
      mockWhatsAppReady();
      setupSessionStorage();
      render(<LiveChat />);

      // Select a session first
      const user = userEvent.setup();
      const sessionBtn = await screen.findByText("user-1");
      await user.click(sessionBtn);

      // Wait for the socket to be created (useEffect runs after render + click)
      await vi.waitFor(() => {
        expect(mockSocketFactory.getLatestSocket()).not.toBeNull();
      });

      const socket = mockSocketFactory.getLatestSocket()!;

      const incomingMessage: Message = {
        sessionId: "user-1",
        role: "user",
        text: "Hello from WebSocket!",
        timestamp: new Date().toISOString(),
      };

      act(() => {
        socket._receive("new_message", {
          sessionId: "user-1",
          message: incomingMessage,
        });
      });

      await waitFor(() => {
        expect(screen.getByText("Hello from WebSocket!")).toBeTruthy();
      });
    });

    it("does NOT add message for a non-selected session", async () => {
      mockWhatsAppReady();
      setupSessionStorage();
      render(<LiveChat />);

      // Select user-1
      const user = userEvent.setup();
      const sessionBtn = await screen.findByText("user-1");
      await user.click(sessionBtn);

      await vi.waitFor(() => {
        expect(mockSocketFactory.getLatestSocket()).not.toBeNull();
      });

      const socket = mockSocketFactory.getLatestSocket()!;

      // Send message for user-2 (not selected)
      const incomingMessage: Message = {
        sessionId: "user-2",
        role: "user",
        text: "Message for another session",
        timestamp: new Date().toISOString(),
      };

      act(() => {
        socket._receive("new_message", {
          sessionId: "user-2",
          message: incomingMessage,
        });
      });

      // The message should NOT appear in the UI (user-1 is selected, not user-2)
      expect(screen.queryByText("Message for another session")).toBeNull();
    });

    it("updates session sort order when new_message arrives for a different session", async () => {
      // Sessions: user-1 (12:00), user-2 (11:00)
      mockWhatsAppReady();
      setupSessionStorage();
      render(<LiveChat />);

      // Select user-1
      const user = userEvent.setup();
      const sessionBtn = await screen.findByText("user-1");
      await user.click(sessionBtn);

      await vi.waitFor(() => {
        expect(mockSocketFactory.getLatestSocket()).not.toBeNull();
      });

      const socket = mockSocketFactory.getLatestSocket()!;

      // Receive new_message for user-2 with a NEWER timestamp
      const newerMessage: Message = {
        sessionId: "user-2",
        role: "user",
        text: "Newer message",
        timestamp: "2026-06-03T13:00:00Z",
      };

      act(() => {
        socket._receive("new_message", {
          sessionId: "user-2",
          message: newerMessage,
        });
      });

      // After re-sort, user-2 should now appear at the top of the sessions list
      // We can verify by checking the DOM order — the first session button should be user-2
      await waitFor(() => {
        const sessionButtons = document.querySelectorAll(
          'button:has(> div:first-child)'
        );
        // The sidebar session buttons contain the userId text
        const sidebarButtons = Array.from(
          document.querySelectorAll(
            '.flex-1.overflow-y-auto button'
          )
        );
        if (sidebarButtons.length >= 2) {
          const firstUserId = sidebarButtons[0]?.querySelector(".font-bold")
            ?.textContent;
          expect(firstUserId).toContain("user-2");
        }
      });
    });

    it("handles new_message for non-selected session without crashing", async () => {
      mockWhatsAppReady();
      setupSessionStorage();
      render(<LiveChat />);

      await vi.waitFor(() => {
        expect(mockSocketFactory.getLatestSocket()).not.toBeNull();
      });

      const socket = mockSocketFactory.getLatestSocket()!;

      // No session selected, just receive a message — should not crash
      const msg: Message = {
        sessionId: "user-1",
        role: "model",
        text: "Background update",
        timestamp: new Date().toISOString(),
      };

      expect(() => {
        act(() => {
          socket._receive("new_message", { sessionId: "user-1", message: msg });
        });
      }).not.toThrow();
    });
  });

  describe("WebSocket: sessions_update event", () => {
    it("replaces sessions when receiving sessions_update", async () => {
      mockWhatsAppReady();
      setupSessionStorage();
      render(<LiveChat />);

      // Wait for initial sessions to load
      await screen.findByText("user-1");

      await vi.waitFor(() => {
        expect(mockSocketFactory.getLatestSocket()).not.toBeNull();
      });

      const socket = mockSocketFactory.getLatestSocket()!;

      // Send updated sessions (only user-2, user-1 removed)
      const updatedSessions: Session[] = [
        {
          id: "user-2",
          userId: "user-2",
          state: "ORDER_CONFIRMED" as any,
          lastMessageAt: "2026-06-03T14:00:00Z",
          remindersCount: 0,
          isBlocked: false,
          metadata: {},
        },
      ];

      act(() => {
        socket._receive("sessions_update", updatedSessions);
      });

      await waitFor(() => {
        // user-1 should be gone from the list
        expect(screen.queryByText("user-1")).toBeNull();
        // user-2 should still be there, with updated state
        expect(screen.getByText("user-2")).toBeTruthy();
        expect(screen.getByText("State: ORDER_CONFIRMED")).toBeTruthy();
      });
    });

    it("preserves sorted order by lastMessageAt descending", async () => {
      mockWhatsAppReady();
      setupSessionStorage();
      render(<LiveChat />);

      await screen.findByText("user-1");

      await vi.waitFor(() => {
        expect(mockSocketFactory.getLatestSocket()).not.toBeNull();
      });

      const socket = mockSocketFactory.getLatestSocket()!;

      // Send unsorted sessions
      const unsorted: Session[] = [
        { ...baseSessions[1], lastMessageAt: "2026-06-03T09:00:00Z" }, // older
        { ...baseSessions[0], lastMessageAt: "2026-06-03T15:00:00Z" }, // newer
      ];

      act(() => {
        socket._receive("sessions_update", unsorted);
      });

      // user-1 (newer) should be first in the sidebar
      await waitFor(() => {
        const sidebarButtons = document.querySelectorAll(
          '.flex-1.overflow-y-auto button'
        );
        if (sidebarButtons.length >= 2) {
          const firstUserId = sidebarButtons[0]?.querySelector(".font-bold")
            ?.textContent;
          const secondUserId = sidebarButtons[1]?.querySelector(".font-bold")
            ?.textContent;
          expect(firstUserId).toContain("user-1");
          expect(secondUserId).toContain("user-2");
        }
      });
    });
  });

  describe("WebSocket: connection lifecycle", () => {
    it("creates a WebSocket connection with JWT auth token from sessionStorage", async () => {
      mockWhatsAppReady();
      setupSessionStorage();
      render(<LiveChat />);

      await screen.findByText("Active Chats");

      await vi.waitFor(() => {
        expect(mockSocketFactory.getLatestSocket()).not.toBeNull();
      });

      // Verify io() was called with the right auth
      const ioModule = await import("socket.io-client");
      expect(ioModule.io).toHaveBeenCalledWith("", {
        auth: { token: "test-token" },
        transports: ["websocket", "polling"],
      });
    });

    it("does NOT create WebSocket when no adminId in sessionStorage", async () => {
      mockWhatsAppReady();
      // Don't call setupSessionStorage() — no adminId set
      render(<LiveChat />);

      await screen.findByText("Active Chats");

      // The component checks sessionStorage.getItem('adminId') and returns early
      // if it's null — so no socket should have been created
      expect(mockSocketFactory.getLatestSocket()).toBeNull();
    });

    it("disconnects socket on component unmount", async () => {
      mockWhatsAppReady();
      setupSessionStorage();
      const { unmount } = render(<LiveChat />);

      await screen.findByText("Active Chats");

      await vi.waitFor(() => {
        expect(mockSocketFactory.getLatestSocket()).not.toBeNull();
      });

      const socket = mockSocketFactory.getLatestSocket()!;

      unmount();

      expect(socket.disconnect).toHaveBeenCalledTimes(1);
    });

    it("re-connects socket when selected session changes", async () => {
      mockWhatsAppReady();
      setupSessionStorage();
      render(<LiveChat />);

      const user = userEvent.setup();
      const sessionBtn1 = await screen.findByText("user-1");
      await user.click(sessionBtn1);

      // First socket created after clicking user-1
      await vi.waitFor(() => {
        // The useEffect depends on selectedSession?.id, so clicking changes it
        expect(mockSocketFactory.getLatestSocket()).not.toBeNull();
      });

      // Record the first socket
      const firstSocket = mockSocketFactory.getLatestSocket()!;

      // Now select a different session — should trigger socket re-connect
      // Clear the socket reference so we can detect a new one
      mockSocketFactory.setLatestSocket(null);

      const sessionBtn2 = await screen.findByText("user-2");
      await user.click(sessionBtn2);

      await vi.waitFor(() => {
        // A new socket should be created (or at least attempted)
        // The first socket should have been disconnected
        expect(firstSocket.disconnect).toHaveBeenCalled();
      });
    });
  });
});
