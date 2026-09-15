"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import type { ChatMessage } from "@/lib/ai/chat";
import {
  ChatSession,
  StoredMessage,
  createMessage,
  createSession,
  deriveTitle,
  toApiMessages,
} from "@/lib/chat/types";
import { loadSessions, saveSessions } from "@/lib/chat/storage";

interface State {
  sessions: ChatSession[];
  activeId: string | null;
}

type Action =
  | { type: "hydrate"; sessions: ChatSession[] }
  | { type: "addSession"; session: ChatSession }
  | { type: "select"; id: string }
  | { type: "appendMessage"; sessionId: string; message: StoredMessage }
  | { type: "remove"; id: string }
  | { type: "clearAll" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return { sessions: action.sessions, activeId: action.sessions[0]?.id ?? null };
    case "addSession":
      return {
        sessions: [action.session, ...state.sessions],
        activeId: action.session.id,
      };
    case "select":
      return { ...state, activeId: action.id };
    case "appendMessage": {
      const sessions = state.sessions.map((s) => {
        if (s.id !== action.sessionId) return s;
        const messages = [...s.messages, action.message];
        return {
          ...s,
          messages,
          title: deriveTitle(messages),
          updatedAt: Date.now(),
        };
      });
      return { ...state, sessions };
    }
    case "remove": {
      const sessions = state.sessions.filter((s) => s.id !== action.id);
      const activeId =
        state.activeId === action.id
          ? (sessions[0]?.id ?? null)
          : state.activeId;
      return { sessions, activeId };
    }
    case "clearAll":
      return { sessions: [], activeId: null };
    default:
      return state;
  }
}

/** クライアントから /api/chat を呼び出し、応答テキストを返す。 */
async function postChat(messages: ChatMessage[]): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.reply as string;
}

/**
 * チャット履歴の状態管理フック。
 * - 会話は複数セッションとして localStorage に永続化する。
 * - 送信時は「選択中セッションの全履歴」を API に渡すため、
 *   AI は過去のやり取りを踏まえて回答する。
 */
export function useChatHistory() {
  const [state, dispatch] = useReducer(reducer, { sessions: [], activeId: null });
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    dispatch({ type: "hydrate", sessions: loadSessions() });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveSessions(state.sessions);
  }, [state.sessions, hydrated]);

  const sessions = useMemo(
    () => [...state.sessions].sort((a, b) => b.updatedAt - a.updatedAt),
    [state.sessions],
  );

  const activeSession = useMemo(
    () => state.sessions.find((s) => s.id === state.activeId) ?? null,
    [state.sessions, state.activeId],
  );

  const newChat = useCallback(() => {
    dispatch({ type: "addSession", session: createSession() });
  }, []);

  const selectChat = useCallback((id: string) => {
    dispatch({ type: "select", id });
  }, []);

  const deleteChat = useCallback((id: string) => {
    dispatch({ type: "remove", id });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: "clearAll" });
  }, []);

  /**
   * メッセージを送信する。選択中セッションがなければ自動生成する。
   * 失敗時は送信したユーザー発話を残したまま例外を投げる（呼び出し側で通知）。
   */
  const sendMessage = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (text === "" || loading) return;

      let target = state.sessions.find((s) => s.id === state.activeId) ?? null;
      if (!target) {
        target = createSession();
        dispatch({ type: "addSession", session: target });
      }

      const userMessage = createMessage("user", text);
      const apiMessages = toApiMessages([...target.messages, userMessage]);
      dispatch({ type: "appendMessage", sessionId: target.id, message: userMessage });

      setLoading(true);
      try {
        const reply = await postChat(apiMessages);
        dispatch({
          type: "appendMessage",
          sessionId: target.id,
          message: createMessage("assistant", reply),
        });
      } finally {
        setLoading(false);
      }
    },
    [loading, state.sessions, state.activeId],
  );

  return {
    sessions,
    activeSession,
    activeId: state.activeId,
    hydrated,
    loading,
    sendMessage,
    newChat,
    selectChat,
    deleteChat,
    clearAll,
  };
}
