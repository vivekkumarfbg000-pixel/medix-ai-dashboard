import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Html5Qrcode } from "html5-qrcode";
import { ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScannerModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onScan: (barcode: string) => void;
}

export function ScannerModal({ open, onOpenChange, onScan }: ScannerModalProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        if (open) {
            startScanner();
        } else {
            stopScanner();
        }

        return () => stopScanner();
    }, [open]);

    const startScanner = async () => {
        try {
            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode("reader");
            }
            
            await scannerRef.current.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 150 },
                },
                (decodedText) => {
                    // Success callback
                    onScan(decodedText);
                    // Optionally close after scan
                    // onOpenChange(false);
                },
                (errorMessage) => {
                    // Ignore constant stream of errors when no code is visible
                }
            );
            setIsScanning(true);
        } catch (err) {
            console.error("Error starting scanner:", err);
            setIsScanning(false);
        }
    };

    const stopScanner = () => {
        if (scannerRef.current && isScanning) {
            scannerRef.current.stop().then(() => {
                scannerRef.current?.clear();
                setIsScanning(false);
            }).catch(console.error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="glass-card sm:max-w-md p-0 overflow-hidden bg-slate-950 border-slate-800">
                <DialogHeader className="p-4 border-b border-slate-800 bg-slate-900/50">
                    <DialogTitle className="flex items-center gap-2 text-white">
                        <ScanLine className="w-5 h-5 text-cyan-400" /> 
                        Scan Barcode/QR
                    </DialogTitle>
                </DialogHeader>
                <div className="relative w-full aspect-square bg-black">
                    <div id="reader" className="w-full h-full" />
                    
                    {/* Overlay reticle */}
                    <div className="absolute inset-0 pointer-events-none border-[40px] border-black/50">
                        <div className="w-full h-full border-2 border-cyan-500 rounded relative">
                            {/* Scanning laser animation */}
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_8px_2px_rgba(6,182,212,0.5)] animate-pulse" 
                                 style={{ animation: 'scan 2s ease-in-out infinite' }} />
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-slate-900 flex justify-end">
                    <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => onOpenChange(false)}>
                        <X className="w-4 h-4 mr-2" /> Cancel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Add CSS keyframes for scan line to global CSS or inline style
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes scan {
            0% { top: 0; }
            50% { top: 100%; }
            100% { top: 0; }
        }
    `;
    document.head.appendChild(style);
}
