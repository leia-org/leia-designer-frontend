import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  UserCircleIcon,
  SparklesIcon,
  PaperAirplaneIcon,
  InformationCircleIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
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
  <div className="flex items-center space-x-1">
    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDuration: "0.6s" }}></div>
    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDuration: "0.6s", animationDelay: "0.2s" }}></div>
    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDuration: "0.6s", animationDelay: "0.4s" }}></div>
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
  const [showInstructions, setShowInstructions] = useState(true); // Default to open as requested
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
      const newHeight = Math.min(textarea.scrollHeight, 100);
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
    requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [messages, scrollToBottom]);

  useEffect(() => {
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
        errorMessage = axiosError.response?.data?.message || errorMessage;
      }
      toast.error(errorMessage, { position: "bottom-right", autoClose: 3000 });
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
    <div className="flex flex-col h-[calc(100vh-64px)] bg-white relative">
      <ToastContainer />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2">
          {problemDescription && (
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${showInstructions
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
            >
              <InformationCircleIcon className="w-4 h-4" />
              {showInstructions ? "Hide Instructions" : "Show Instructions"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {transcription && (
            <button
              onClick={handleSaveTranscription}
              disabled={savingTranscription || messages.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {savingTranscription ? (
                <ArrowPathIcon className="animate-spin h-3.5 w-3.5" />
              ) : (
                <ArrowDownTrayIcon className="w-3.5 h-3.5" />
              )}
              Save Transcription
            </button>
          )}
          <button
            onClick={handleFinishConversation}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
          >
            <XMarkIcon className="w-3.5 h-3.5" />
            End Session
          </button>
        </div>
      </div>

      {/* Instructions Panel (Collapsible) */}
      {showInstructions && problemDescription && (
        <div className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100">
          <div className="max-w-3xl mx-auto">
            <h4 className="text-sm font-semibold text-indigo-900 mb-1">Activity Instructions</h4>
            <p className="text-sm text-indigo-800/80 leading-relaxed whitespace-pre-wrap">{problemDescription}</p>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div
        ref={chatMessagesRef}
        className="flex-1 overflow-y-auto px-6 py-6 scroll-smooth"
      >
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                <SparklesIcon className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-gray-900 font-medium">Start the conversation</h3>
              <p className="text-gray-500 text-sm mt-1 max-w-sm">
                Say hello to begin your session. AI responses will appear here.
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 ${msg.isLeia ? "" : "flex-row-reverse"
                }`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.isLeia ? "bg-indigo-100/50 text-indigo-600" : "bg-gray-900 text-white"
                  }`}
              >
                {msg.isLeia ? (
                  <SparklesIcon className="w-4 h-4" />
                ) : (
                  <UserCircleIcon className="w-5 h-5" />
                )}
              </div>

              <div
                className={`max-w-[75%] px-5 py-3.5 text-sm leading-relaxed shadow-sm ${msg.isLeia
                  ? "bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-tl-sm"
                  : "bg-gray-900 text-white rounded-2xl rounded-tr-sm"
                  }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}

          {sendingMessage && (
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100/50 flex items-center justify-center text-indigo-600">
                <SparklesIcon className="w-4 h-4" />
              </div>
              <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
                <TypingAnimation />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area (Floating) */}
      <div className="px-6 pb-6 pt-2 bg-transparent">
        <div className="max-w-3xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 bg-white rounded-[26px] shadow-sm border border-gray-200 pl-6 pr-2 py-2 ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-gray-900/10 transition-all"
          >
            <textarea
              ref={inputRef}
              value={newMessageText}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta lo que quieras"
              className="flex-1 w-full bg-transparent border-none focus:ring-0 outline-none text-[15px] text-gray-900 placeholder:text-gray-400/80 resize-none max-h-[100px] min-h-[24px] py-2"
              rows={1}
            />
            <button
              type="submit"
              disabled={!newMessageText.trim() || sendingMessage}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {sendingMessage ? (
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" />
              ) : (
                <PaperAirplaneIcon className="w-5 h-5 -ml-0.5" />
              )}
            </button>
          </form>
          <div className="mt-2 text-center">
            <p className="text-[10px] text-gray-400">
              Press Enter to send, Shift + Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
