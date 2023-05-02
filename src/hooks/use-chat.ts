import { fetchEventSource } from "@fortaine/fetch-event-source";
import { useState, useMemo } from "react";
import { appConfig } from "../../config.browser";
import {config} from "../../config.edge";

const API_PATH = "https://api.openai.com/v1/chat/completions";
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
const {OPENAI_API_KEY,MODEL_INSTRUCTIONS} = config;
/**
 * A custom hook to handle the chat state and logic
 */
export function useChat() {

  const [currentChat, setCurrentChat] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<"idle" | "waiting" | "loading">("idle");

  // Lets us cancel the stream
  const abortController = useMemo(() => new AbortController(), []);

  /**
   * Cancels the current chat and adds the current chat to the history
   */
  function cancel() {
    setState("idle");
    abortController.abort();
    if (currentChat) {
      const newHistory = [
        ...chatHistory,
        { role: "user", content: currentChat } as const,
      ];

      setChatHistory(newHistory);
      setCurrentChat("");
    }
  }

  /**
   * Clears the chat history
   */

  function clear() {
    console.log("clear");
    setChatHistory([]);
  }

  /**
   * Sends a new message to the AI function and streams the response
   */
  const sendMessage = (message: string, chatHistory: Array<ChatMessage>) => {
    console.log();
    setState("waiting");
    let chatContent = "";
    const newHistory = [
      { role: "system", content: MODEL_INSTRUCTIONS },
      { role: "user", content: message }];
    const chatHistoryToDisplay = [
      ...chatHistory,
      { role: "user", content: message } as const,
    ];
  
    setChatHistory(chatHistoryToDisplay);
    const body = JSON.stringify({
      // Only send the most recent messages. This is also
      // done in the serverless function, but we do it here
      // to avoid sending too much data
      model: "gpt-3.5-turbo",
      stream: true,
      messages: newHistory.slice(-appConfig.historyLength),
      temperature: 1,
      max_tokens: 1000
    });

    // This is like an EventSource, but allows things like
    // POST requests and headers
    fetchEventSource(API_PATH, {
      body,
      method: "POST",
      signal: abortController.signal,
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
      },
      onclose: () => {
        setState("idle");
      },
      onopen: async () => {
        // The stream has opened and we should recieve
        // a delta event soon. This is normally almost instant.
        setCurrentChat("...");
      },
      onerror: (event) => {
        console.log(event);
        abortController.abort();
      },
      onmessage: (event) => {
        if (event.data == "[DONE]") {
          abortController.abort();
          // When it's done, we add the message to the history
          // and reset the current chat
          setChatHistory((curr) => [
            ...curr,
            { role: "assistant", content: chatContent } as const,
          ]);
          setCurrentChat(null);
          setState("idle");

        }
        else {
          const res = JSON.parse(event.data);
          const data = JSON.stringify(res?.choices[0]?.delta);

          setState("loading");
          const message = JSON.parse(data);
          if (message?.role === "assistant") {
            chatContent = "";
          }
          if (message.content) {
            chatContent += message.content;
            setCurrentChat(chatContent);
          }
        }
      },
    });
  };

  return { sendMessage, currentChat, chatHistory, cancel, clear, state };
}
