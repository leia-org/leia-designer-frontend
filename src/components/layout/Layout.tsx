import React from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface LayoutProps {
    children: React.ReactNode;
    title?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, title }) => {
    return (
        <div className="min-h-screen bg-gray-50">
            <Sidebar />
            <div className="ml-64 min-h-screen flex flex-col">
                {title && <Header title={title} />}
                <main className="flex-1">
                    {children}
                </main>
            </div>
        </div>
    );
};
