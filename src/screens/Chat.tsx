import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import { UserCircleIcon } from "@heroicons/react/24/solid";
import { ArrowDownTrayIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/shared/Header";
import api from "../lib/axios";
import { toast, ToastContainer } from "react-toastify";
import type { LeiaConfig } from "../models/Experiment";

interface NavigationState {
  preset?: {
    persona?: unknown;
    problem?: unknown;
    behaviour?: unknown;
  };
  save?: {
    currentStep: number;
    leiaConfig: {
      persona: unknown | null;
      problem: unknown | null;
      behaviour: unknown | null;
    };
    leiaConfigSnapShot: unknown | null;
    customizations: {
      leia: { name: string; version: string };
      persona?: { name: string; version: string };
      problem?: { name: string; version: string };
      behaviour?: { name: string; version: string };
    };
  };
  problemDescription?: string;
  experimentTranscription?: {
    experimentId: string;
    leiaConfigId: string;
    leiaConfig: LeiaConfig;
  };
}

const TypingAnimation = () => (
  <div className="flex items-center space-x-1.5">
    <div
      className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
      style={{ animationDuration: "0.6s" }}
    ></div>
    <div
      className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
      style={{ animationDuration: "0.6s", animationDelay: "0.2s" }}
    ></div>
    <div
      className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
      style={{ animationDuration: "0.6s", animationDelay: "0.4s" }}
    ></div>
  </div>
);

interface Message {
  text: string;
  timestamp: Date;
  isLeia: boolean;
}

export const Chat = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [problemDescription, setProblemDescription] = useState<string>("");
  const [savingTranscription, setSavingTranscription] = useState(false);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [transcription, setTranscription] = useState(false);
  const [experimentId, setExperimentId] = useState<string | null>(null);
  const [leiaConfigId, setLeiaConfigId] = useState<string | null>(null);
  const [leiaConfig, setLeiaConfig] = useState<LeiaConfig | null>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTo({
        top: chatMessagesRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  const handleTextareaResize = () => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 150);
      textarea.style.height = `${newHeight}px`;
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessageText(e.target.value);
    handleTextareaResize();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sessionMessages") ?? "{}";
      const { sessionId: storedId, messages: storedArr } = JSON.parse(raw);
      setMessages(
        storedId === sessionId && Array.isArray(storedArr) ? storedArr : []
      );
    } catch {
      setMessages([]);
    }
  }, [sessionId]);

  useEffect(() => {
    const navigationState = location.state as NavigationState;
    if (navigationState?.problemDescription) {
      setProblemDescription(navigationState.problemDescription);
    }

    if (navigationState?.experimentTranscription) {
      setTranscription(true);
      setExperimentId(navigationState.experimentTranscription.experimentId);
      setLeiaConfigId(navigationState.experimentTranscription.leiaConfigId);
      setLeiaConfig(navigationState.experimentTranscription.leiaConfig);
    }
  }, [location.state]);

  useEffect(() => {
    // Usar requestAnimationFrame para asegurar que el DOM se haya actualizado
    requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [messages, scrollToBottom]);

  useEffect(() => {
    // Hacer scroll cuando aparece el indicador de "typing"
    if (sendingMessage) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [sendingMessage, scrollToBottom]);

  const addMessage = (newMessage: Message) => {
    setMessages((prev) => {
      const next = [...prev, newMessage];
      localStorage.setItem(
        "sessionMessages",
        JSON.stringify({ sessionId, messages: next })
      );
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const messageText = newMessageText.trim();
    if (!messageText) return;

    setNewMessageText("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    const newMessage: Message = {
      text: messageText,
      timestamp: new Date(),
      isLeia: false,
    };

    addMessage(newMessage);
    setSendingMessage(true);

    try {
      const response = await api.post(`/api/v1/runner/${sessionId}/messages`, {
        message: messageText,
      });

      if (response.status === 200) {
        const leiaMessage: Message = {
          text: response.data.message,
          timestamp: new Date(),
          isLeia: true,
        };
        addMessage(leiaMessage);
      }
    } catch {
      const leiaMessage: Message = {
        text: "Your message is taking a bit longer to send. Retry?",
        timestamp: new Date(),
        isLeia: true,
      };
      addMessage(leiaMessage);
    } finally {
      localStorage.setItem(
        "sessionMessages",
        JSON.stringify({ sessionId, messages })
      );
      setSendingMessage(false);
    }
  };

  const handleSaveTranscription = async () => {
    console.log("Saving transcription...", messages);
    // Validar que existan mensajes
    if (messages.length === 0) {
      toast.error("No messages to save as transcription");
      return;
    }

    if (!transcription) {
      toast.error("Transcription option is not enabled");
      return;
    }

    if (!experimentId || !leiaConfigId || !leiaConfig) {
      toast.error("Missing experiment or LEIA configuration information");
      return;
    }

    const update = {
      leia:
        typeof leiaConfig.leia === "string"
          ? leiaConfig.leia
          : leiaConfig.leia.id,
      configuration: {
        mode: leiaConfig.configuration.mode,
        data: {
          ...leiaConfig.configuration.data,
          link: undefined,
          messages: messages,
        },
      },
    };

    try {
      setSavingTranscription(true);
      await api.put(
        `/api/v1/experiments/${experimentId}/leias/${leiaConfigId}`,
        update
      );
      toast.success("Transcription added successfully", {
        position: "bottom-right",
        autoClose: 3000,
      });
    } catch (error) {
      let errorMessage = "Failed to add transcription";

      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { status?: number; data?: { message?: string } };
        };
        if (
          axiosError.response?.status === 409 ||
          axiosError.response?.status === 404 ||
          axiosError.response?.status === 400
        ) {
          errorMessage = axiosError.response.data?.message || errorMessage;
        }
      }

      toast.error(errorMessage, {
        position: "bottom-right",
        autoClose: 3000,
      });
    } finally {
      setSavingTranscription(false);
    }
  };

  const handleFinishConversation = async () => {
    const navigationState = location.state as NavigationState;
    if (navigationState?.save) {
      navigate("/create", {
        state: { save: navigationState.save } as NavigationState,
      });
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      <Header
        title="Chat"
        description="Test and interact with a LEIA configuration"
        showNavigation={false}
        rightContent={
          <div className="flex gap-2">
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="px-4 py-1.5 text-sm text-blue-600 bg-white border border-blue-600 rounded-md hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {showInstructions ? "Hide Instructions" : "Instructions"}
            </button>
            {transcription && (
              <button
                onClick={handleSaveTranscription}
                disabled={savingTranscription || messages.length === 0}
                className="px-4 py-1.5 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {savingTranscription ? (
                  <>
                    <ArrowPathIcon className="animate-spin h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  <>
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    Save Transcription
                  </>
                )}
              </button>
            )}
            <button
              onClick={handleFinishConversation}
              className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Finish Conversation
            </button>
          </div>
        }
      />
      <ToastContainer />

      {showInstructions && problemDescription && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Instructions
            </h3>
            <p className="text-sm text-blue-800 whitespace-pre-wrap">
              {problemDescription}
            </p>
          </div>
        </div>
      )}

      <div
        ref={chatMessagesRef}
        className="flex-1 overflow-y-auto px-4 pb-24 scroll-smooth"
      >
        <div className="max-w-3xl mx-auto space-y-4 py-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-end gap-2 ${
                msg.isLeia ? "flex-row" : "flex-row-reverse"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  msg.isLeia ? "bg-blue-50" : "bg-blue-600"
                }`}
              >
                {msg.isLeia ? (
                  <UserCircleIcon className="w-5 h-5 text-blue-700" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-5 h-5 text-white"
                  >
                    <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                  </svg>
                )}
              </div>
              <div
                className={`max-w-[80%] px-4 py-2 ${
                  msg.isLeia
                    ? "bg-white border border-gray-200 text-gray-900 rounded-t-2xl rounded-r-2xl rounded-bl-md"
                    : "bg-blue-600 text-white rounded-t-2xl rounded-l-2xl rounded-br-md"
                }`}
              >
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                  {msg.text}
                </p>
              </div>
            </div>
          ))}
          {sendingMessage && (
            <div className="flex items-end gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                <UserCircleIcon className="w-5 h-5 text-blue-700" />
              </div>
              <div className="min-w-[60px] bg-white border border-gray-200 rounded-t-2xl rounded-r-2xl rounded-bl-md px-4 py-3">
                <TypingAnimation />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-[72px] left-0 right-0 h-24 pointer-events-none"></div>

      <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="flex gap-2 bg-white rounded-lg p-3 shadow-[0_0_10px_rgba(0,0,0,0.1)] hover:shadow-[0_0_15px_rgba(0,0,0,0.15)] transition-all"
          >
            <textarea
              ref={inputRef}
              value={newMessageText}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Shift+Enter for new line)"
              className="flex-1 px-2 py-1.5 bg-transparent border-none focus:outline-none text-[15px] resize-none overflow-y-auto"
              style={{ minHeight: "40px", maxHeight: "150px" }}
              rows={1}
            />
            <button
              type="submit"
              disabled={!newMessageText.trim()}
              className="px-5 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
