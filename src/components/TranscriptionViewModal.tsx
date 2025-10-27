import React, { useRef, useEffect } from "react";
import { UserCircleIcon } from "@heroicons/react/24/solid";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface Message {
  text: string;
  timestamp: Date | string;
  isLeia: boolean;
}

interface TranscriptionViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  title?: string;
}

export const TranscriptionViewModal: React.FC<TranscriptionViewModalProps> = ({
  isOpen,
  onClose,
  messages,
  title = "Transcription Messages",
}) => {
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Messages Container */}
        <div
          ref={chatMessagesRef}
          className="flex-1 overflow-y-auto px-4 scroll-smooth"
        >
          <div className="max-w-3xl mx-auto space-y-4 py-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <UserCircleIcon className="w-16 h-16 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No messages
                </h3>
                <p className="text-gray-500">
                  This transcription doesn't contain any messages yet.
                </p>
              </div>
            ) : (
              messages.map((msg, index) => (
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
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>{messages.length} messages in this transcription</span>
          </div>
        </div>
      </div>
    </div>
  );
};
