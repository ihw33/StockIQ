"use client";

import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import { ChatWindow, ChatCommand } from "./chat-window";
import { PanelLeftClose, PanelLeftOpen, MessageSquare } from "lucide-react";
import { useEffect, useCallback } from "react";


import { Button } from "@/components/ui/button";

interface WarRoomLayoutProps {
    children: React.ReactNode;
    onChatCommand?: (command: ChatCommand) => void;
    currentSymbol?: string;
    currentName?: string;
}

export function WarRoomLayout({ children, onChatCommand, currentSymbol, currentName }: WarRoomLayoutProps) {
    const [isChatOpen, setIsChatOpen] = useState(false); // Default closed/peek mode

    // Toggle Chat
    const toggleChat = useCallback(() => setIsChatOpen(prev => !prev), []);

    // Shortcut Listener (Cmd + /)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === '/') {
                e.preventDefault();
                toggleChat();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleChat]);

    return (
        <div className="relative flex h-[calc(100vh-4rem)] overflow-hidden bg-background">

            {/* Main Content (Full Width) */}
            <div className="flex-1 overflow-hidden relative z-0" onClick={() => isChatOpen && setIsChatOpen(false)}>
                <div className="h-full overflow-auto p-4">
                    {children}
                </div>
            </div>

            {/* Chat Panel (Right Side Slide-in) */}
            <div
                className={cn(
                    "fixed top-[4rem] right-0 bottom-0 z-50 transition-transform duration-300 ease-in-out bg-slate-950 border-l border-slate-800 shadow-2xl",
                    isChatOpen ? "translate-x-0" : "translate-x-[calc(100%-40px)]" // 40px visible for 'Peek'
                )}
                style={{ width: '50%' }}
            >
                {/* Peek Tab (Visible when closed) */}
                {!isChatOpen && (
                    <div
                        className="absolute left-0 top-0 bottom-0 w-[40px] flex flex-col items-center pt-4 cursor-pointer hover:bg-slate-800 transition-colors"
                        onClick={() => setIsChatOpen(true)}
                    >
                        <MessageSquare className="w-5 h-5 text-slate-400 mb-2" />
                        <span className="text-[10px] text-slate-500 writing-vertical-rl rotate-180 tracking-widest uppercase">
                            AI Chat
                        </span>
                    </div>
                )}

                {/* Chat Window Content */}
                <div className="h-full w-full">
                    {/* Close Button Inside Chat */}
                    {isChatOpen && (
                        <div className="absolute top-4 right-4 z-50">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-white"
                                onClick={() => setIsChatOpen(false)}
                            >
                                <PanelLeftClose className="w-4 h-4 rotate-180" /> {/* Rotate icon since it's on right now */}
                            </Button>
                        </div>
                    )}
                    <ChatWindow
                        onCommand={onChatCommand}
                        isOpen={isChatOpen}
                        currentSymbol={currentSymbol}
                        currentName={currentName}
                    />
                </div>
            </div>

        </div>
    );
}

