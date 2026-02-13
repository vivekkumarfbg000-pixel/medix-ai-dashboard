import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Camera, X, RefreshCw, CheckCircle, Smartphone } from "lucide-react";
import { toast } from "sonner";

interface CameraCaptureProps {
    onCapture: (file: File) => void;
    trigger?: React.ReactNode;
    isOpen?: boolean;
    onClose?: () => void;
}

export const CameraCapture = ({ onCapture, trigger, isOpen: controlledIsOpen, onClose: controlledOnClose }: CameraCaptureProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [image, setImage] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Handle controlled vs uncontrolled state
    const show = controlledIsOpen !== undefined ? controlledIsOpen : isOpen;
    const close = () => {
        if (controlledOnClose) {
            controlledOnClose();
        } else {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        if (show) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [show, facingMode]);

    const startCamera = async () => {
        try {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            const constraints = {
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            };

            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(newStream);

            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
            }
        } catch (err) {
            console.error("Camera Error:", err);
            toast.error("Could not access camera. Please check permissions.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
        }
    };

    const captureParams = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;

            // Set canvas dimensions to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const context = canvas.getContext("2d");
            if (context) {
                // Draw video frame to canvas
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Convert to data URL
                const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
                setImage(dataUrl);
                stopCamera();
            }
        }
    };

    const retakeParams = () => {
        setImage(null);
        startCamera();
    };

    const confirmCapture = async () => {
        if (image) {
            try {
                // Convert data URL to File object
                const res = await fetch(image);
                const blob = await res.blob();
                const file = new File([blob], `camera-capture-${Date.now()}.jpg`, { type: "image/jpeg" });

                onCapture(file);
                close();
                setImage(null); // Reset for next time
            } catch (e) {
                console.error("Error creating file from image:", e);
                toast.error("Failed to process captured image.");
            }
        }
    };

    const switchCamera = () => {
        setFacingMode(prev => prev === "user" ? "environment" : "user");
    };

    return (
        <Dialog open={show} onOpenChange={(open) => !open && close()}>
            {trigger && <DialogTrigger asChild onClick={() => setIsOpen(true)}>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black border-zinc-800">
                <div className="relative h-[80vh] w-full flex flex-col bg-black">

                    {/* Header */}
                    <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-center bg-gradient-to-b from-black/70 to-transparent">
                        <span className="text-white font-medium flex items-center gap-2">
                            <Camera className="w-4 h-4" /> Camera
                        </span>
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={close}>
                            <X className="w-6 h-6" />
                        </Button>
                    </div>

                    {/* Main Viewport */}
                    <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-zinc-900">
                        {image ? (
                            <img src={image} alt="Captured" className="max-w-full max-h-full object-contain" />
                        ) : (
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="max-w-full max-h-full object-cover w-full h-full"
                            />
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                    </div>

                    {/* Controls */}
                    <div className="p-6 bg-zinc-900 flex justify-center items-center gap-8 pb-8">
                        {image ? (
                            <div className="flex w-full gap-4">
                                <Button variant="outline" onClick={retakeParams} className="flex-1 bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700">
                                    <RefreshCw className="w-4 h-4 mr-2" /> Retake
                                </Button>
                                <Button onClick={confirmCapture} className="flex-1 bg-green-600 hover:bg-green-700 text-white border-none">
                                    <CheckCircle className="w-4 h-4 mr-2" /> Use Photo
                                </Button>
                            </div>
                        ) : (
                            <>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full h-12 w-12 text-white bg-zinc-800 hover:bg-zinc-700"
                                    onClick={switchCamera}
                                >
                                    <Smartphone className="w-6 h-6" />
                                </Button>

                                <button
                                    onClick={captureParams}
                                    className="h-20 w-20 rounded-full border-4 border-white flex items-center justify-center p-1 focus:outline-none tap-highlight-transparent"
                                >
                                    <div className="h-full w-full rounded-full bg-white transition-transform active:scale-90" />
                                </button>

                                <div className="w-12" /> {/* Spacer to balance layout */}
                            </>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
