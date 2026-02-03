'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
    showError: (message: string) => void;
    showSuccess: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = ++toastId;
        setToasts(prev => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const showError = useCallback((message: string) => showToast(message, 'error'), [showToast]);
    const showSuccess = useCallback((message: string) => showToast(message, 'success'), [showToast]);

    const getToastStyle = (type: ToastType) => {
        switch (type) {
            case 'success': return 'bg-green-600 border-green-400';
            case 'error': return 'bg-red-600 border-red-400';
            case 'warning': return 'bg-yellow-600 border-yellow-400';
            default: return 'bg-blue-600 border-blue-400';
        }
    };

    const getToastIcon = (type: ToastType) => {
        switch (type) {
            case 'success': return '✓';
            case 'error': return '✕';
            case 'warning': return '⚠';
            default: return 'ℹ';
        }
    };

    return (
        <ToastContext.Provider value={{ showToast, showError, showSuccess }}>
            {children}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
                <AnimatePresence>
                    {toasts.map(toast => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, x: 100, scale: 0.8 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 100, scale: 0.8 }}
                            className={`px-4 py-3 rounded-lg border-2 text-white font-medium shadow-lg flex items-center gap-2 min-w-[200px] ${getToastStyle(toast.type)}`}
                        >
                            <span className="text-lg">{getToastIcon(toast.type)}</span>
                            <span>{toast.message}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}
