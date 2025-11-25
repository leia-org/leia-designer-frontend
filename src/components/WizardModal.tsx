import React, { useState, useRef, useEffect } from 'react';
import { XMarkIcon, PaperAirplaneIcon, SparklesIcon, ArrowPathIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import api from '../lib/axios';
import type { Problem, Persona, Behaviour } from '../models/Leia';
import { motion, AnimatePresence } from "motion/react";

interface WizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectProblem: (problem: Problem) => void;
    context?: {
        persona: Persona | null;
        behaviour: Behaviour | null;
    };
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    type?: 'text' | 'found' | 'generated';
    data?: any;
}

const ThinkingGradient = () => (
    <motion.div
        initial={{ filter: "hue-rotate(0deg)" }}
        animate={{
            filter: "hue-rotate(360deg)"
        }}
        className="absolute -inset-[100%]"
        style={{
            background: "linear-gradient(45deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6)",
            backgroundSize: "200% 200%",
        }}
        transition={{
            filter: { duration: 3, repeat: Infinity, ease: "linear" }
        }}
    />
);



export const WizardModal: React.FC<WizardModalProps> = ({ isOpen, onClose, onSelectProblem, context }) => {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Hello! I can help you find or create a Problem for your LEIA. Tell me what you need.' }
    ]);
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [threadId, setThreadId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    if (!isOpen) return null;

    const handleSendMessage = async () => {
        if (!query.trim()) return;

        const userMessage: Message = { role: 'user', content: query };
        setMessages(prev => [...prev, userMessage]);
        setQuery('');
        setIsLoading(true);

        try {
            const response = await api.post('/api/v1/wizard/chat', {
                message: userMessage.content,
                context: context,
                threadId: threadId
            });

            if (response.data.threadId) {
                setThreadId(response.data.threadId);
            }


            const assistantMessage: Message = {
                role: 'assistant',
                content: response.data.message,
                type: response.data.type,
                data: response.data.data
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error processing your request.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePersonalize = async (problem: Problem) => {
        setIsLoading(true);
        try {
            // Get the original query from the first message
            const originalQuery = messages.find(m => m.role === 'user')?.content || '';

            // Send the problem to the backend to initialize a refinement thread via chat endpoint
            const response = await api.post('/api/v1/wizard/chat', {
                message: "Personalize this problem", // Dummy message to satisfy validation
                context,
                problem,
                originalQuery
            });

            if (response.data.threadId) {
                setThreadId(response.data.threadId);
            }

            const assistantMessage: Message = {
                role: 'assistant',
                content: response.data.message || `Okay, let's personalize "${problem.metadata.name}". What would you like to change?`,
                type: 'generated', // Treat as generated so it shows up as the single focus
                data: response.data.data // The problem object
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error personalizing problem:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I could not start the personalization process.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="relative w-full max-w-4xl h-[80vh] pointer-events-auto flex flex-col">
                            {/* Animated Border Background */}
                            <AnimatePresence>
                                {isLoading && (
                                    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-2xl">
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0, transition: { duration: 0.5 } }}
                                            className="absolute inset-0"
                                            style={{
                                                mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                                WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                                maskComposite: "exclude",
                                                WebkitMaskComposite: "xor",
                                                padding: "3px",
                                            }}
                                        >
                                            <ThinkingGradient />
                                        </motion.div>
                                    </div>
                                )}
                            </AnimatePresence>

                            {/* Modal Content */}
                            <div className="relative z-10 bg-white w-full h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100">
                                {/* Header */}
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 rounded-lg">
                                            <SparklesIcon className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-semibold text-gray-900">Problem Designer</h2>
                                            <p className="text-sm text-gray-500">AI-powered assistant to help you define your problem</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                                    >
                                        <XMarkIcon className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Chat Area */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
                                    {messages.map((msg, idx) => {
                                        const isLastAssistantMessage = msg.role === 'assistant' && idx === messages.length - 1 && !isLoading;

                                        return (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.3 }}
                                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} relative`}
                                            >
                                                <div className={`relative max-w-[80%] rounded-2xl px-5 py-3 shadow-sm overflow-hidden ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                                                    {/* Gradient Overlay for New Assistant Message */}
                                                    {isLastAssistantMessage && (
                                                        <>
                                                            <motion.div
                                                                initial={{ opacity: 1 }}
                                                                animate={{ opacity: 0 }}
                                                                transition={{ duration: 0.5, delay: 2.5 }} // Keep visible until skeleton finishes
                                                                className="absolute inset-0 z-20 pointer-events-none"
                                                                style={{
                                                                    mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                                                    WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                                                    maskComposite: "exclude",
                                                                    WebkitMaskComposite: "xor",
                                                                    padding: "3px",
                                                                }}
                                                            >
                                                                <ThinkingGradient />
                                                            </motion.div>

                                                            {/* Skeleton Overlay */}
                                                            <div className="flex flex-col w-full h-full absolute inset-0 px-5 py-3 z-30 pointer-events-none overflow-hidden">
                                                                {msg.content.split('\n').map((paragraph, pIdx) => (
                                                                    <motion.div
                                                                        key={pIdx}
                                                                        initial={{ clipPath: "inset(0 0 0 0)" }}
                                                                        animate={{ clipPath: "inset(0 0 0 100%)" }}
                                                                        transition={{
                                                                            duration: 1.0,
                                                                            delay: 1.0 + (pIdx * 0.3), // Stagger paragraphs
                                                                            ease: "easeInOut"
                                                                        }}
                                                                        className={`relative w-full ${paragraph.length === 0 ? 'min-h-[1.625rem]' : ''}`}
                                                                    >
                                                                        <span className="bg-gray-200 text-transparent rounded box-decoration-clone leading-relaxed">
                                                                            {paragraph || '\u00A0'}
                                                                        </span>
                                                                    </motion.div>
                                                                ))}

                                                                {/* Cover the rest of the space */}
                                                                <motion.div
                                                                    initial={{ opacity: 1 }}
                                                                    animate={{ opacity: 0 }}
                                                                    transition={{ delay: 2.5, duration: 0.2 }}
                                                                />
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* Message Content */}
                                                    <div className="relative z-0">
                                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                                                        {/* Generated Problem Card */}
                                                        {msg.type === 'generated' && msg.data && !Array.isArray(msg.data) && (
                                                            <motion.div
                                                                initial={{ opacity: 0, marginTop: 0 }}
                                                                animate={{ opacity: 1, marginTop: 16 }}
                                                                transition={{ delay: 0.6 }}
                                                                className="bg-gray-50 rounded-xl p-4 border border-gray-200 mt-4"
                                                            >
                                                                <div className="flex items-start justify-between mb-3">
                                                                    <div>
                                                                        <h3 className="font-semibold text-gray-900">{msg.data.metadata.name}</h3>
                                                                        <span className="text-xs text-gray-500">v{typeof msg.data.metadata.version === 'string' ? msg.data.metadata.version : `${msg.data.metadata.version.major}.${msg.data.metadata.version.minor}.${msg.data.metadata.version.patch}`}</span>
                                                                    </div>
                                                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                                                                        <CheckCircleIcon className="w-3 h-3" />
                                                                        Generated
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm text-gray-600 mb-4 line-clamp-3">{msg.data.spec.description}</p>

                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => {
                                                                            onSelectProblem(msg.data as Problem);
                                                                            onClose();
                                                                        }}
                                                                        className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow"
                                                                    >
                                                                        Use this Problem
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handlePersonalize(msg.data as Problem)}
                                                                        className="px-3 py-2 bg-white text-gray-700 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                                                                    >
                                                                        Personalize
                                                                    </button>
                                                                </div>
                                                            </motion.div>
                                                        )}

                                                        {/* Found Problems List */}
                                                        {msg.type === 'found' && Array.isArray(msg.data) && (
                                                            <div className="mt-4 space-y-3">
                                                                {msg.data.map((problem: Problem, pIdx: number) => (
                                                                    <motion.div
                                                                        key={problem.id || pIdx}
                                                                        initial={{ opacity: 0, y: 10 }}
                                                                        animate={{ opacity: 1, y: 0 }}
                                                                        transition={{ delay: 0.6 + (pIdx * 0.1) }}
                                                                        className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-blue-300 transition-colors"
                                                                    >
                                                                        <div className="flex items-start justify-between mb-2">
                                                                            <div>
                                                                                <h3 className="font-semibold text-gray-900">{problem.metadata.name}</h3>
                                                                                <span className="text-xs text-gray-500">v{typeof problem.metadata.version === 'string' ? problem.metadata.version : `${problem.metadata.version.major}.${problem.metadata.version.minor}.${problem.metadata.version.patch}`}</span>
                                                                            </div>
                                                                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex items-center gap-1">
                                                                                <SparklesIcon className="w-3 h-3" />
                                                                                Found
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{problem.spec.description}</p>

                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                onClick={() => {
                                                                                    onSelectProblem(problem);
                                                                                    onClose();
                                                                                }}
                                                                                className="flex-1 px-3 py-1.5 bg-white text-blue-600 border border-blue-200 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors"
                                                                            >
                                                                                Select
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handlePersonalize(problem)}
                                                                                className="px-3 py-1.5 bg-white text-gray-700 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                                                                            >
                                                                                Personalize
                                                                            </button>
                                                                        </div>
                                                                    </motion.div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                    {isLoading && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex justify-start"
                                        >
                                            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm flex items-center gap-2">
                                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        </motion.div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input Area */}
                                <div className="p-4 bg-white border-t border-gray-100">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                            placeholder="Describe your problem (e.g., 'I need a system for managing library loans...')"
                                            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder-gray-400"
                                            disabled={isLoading}
                                        />
                                        <button
                                            onClick={handleSendMessage}
                                            disabled={isLoading || !query.trim()}
                                            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-95"
                                        >
                                            {isLoading ? (
                                                <ArrowPathIcon className="w-6 h-6 animate-spin" />
                                            ) : (
                                                <PaperAirplaneIcon className="w-6 h-6" />
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-xs text-center text-gray-400 mt-3">
                                        LEIA AI can make mistakes. Review generated problems before using them.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
