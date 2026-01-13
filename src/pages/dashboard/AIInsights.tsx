import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Search,
  Activity,
  AlertTriangle,
  Info,
  FileText,
  Plus,
  X,
  Bot,
  IndianRupee,
  TrendingUp,
  ShieldAlert,
  Stethoscope,
  Brain,
  MessageSquare,
  CheckCircle,
  AlertOctagon
} from "lucide-react";
import { drugService, ClinicalDrugInfo, InteractionResult } from "@/services/drugService";
import { aiService } from "@/services/aiService";
import VoiceInput from "@/components/common/VoiceInput";

const AIInsights = () => {
  const [activeTab, setActiveTab] = useState("chat"); // Default to Chat as requested

  // Smart Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Drug Info State
  const [drugInfo, setDrugInfo] = useState<ClinicalDrugInfo | null>(null);

  // Interaction Matrix State
  const [interactionDrugs, setInteractionDrugs] = useState<string[]>([]);
  const [interactionQuery, setInteractionQuery] = useState("");
  const [interactionResults, setInteractionResults] = useState<InteractionResult[]>([]);
  const [analyzingMatrix, setAnalyzingMatrix] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'bot', text: string, sources?: string[], image?: string | null }[]>([
    { role: 'bot', text: "Hello! I'm your Clinical Pharmacist Assistant. I can help with drug interactions, dosage verification, or finding high-margin substitutes. How can I assist you today?" }
  ]);
  const [currentChatInfo, setCurrentChatInfo] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // --- Handlers ---
  const handleSearch = async () => {
    if (!searchQuery) return;
    setLoading(true);
    try {
      const info = await drugService.searchDrug(searchQuery);
      setDrugInfo(info);
      if (info) toast.success(`Found: ${info.name}`);
      else toast.error("Drug not found.");
    } catch (e) { toast.error("Search failed"); }
    finally { setLoading(false); }
  };

  const handleAddInteractionDrug = () => {
    if (interactionQuery && !interactionDrugs.includes(interactionQuery)) {
      setInteractionDrugs([...interactionDrugs, interactionQuery]);
      setInteractionQuery("");
    }
  };

  const handleRemoveInteractionDrug = (drug: string) => {
    setInteractionDrugs(interactionDrugs.filter(d => d !== drug));
  };

  const analyzeInteractions = async () => {
    if (interactionDrugs.length < 2) return toast.error("Need 2+ drugs");
    setAnalyzingMatrix(true);
    try {
      const results = await drugService.checkInteractions(interactionDrugs);
      setInteractionResults(results);
    } catch (e) { toast.error("Analysis failed"); }
    finally { setAnalyzingMatrix(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleChat = async () => {
    if (!currentChatInfo && !selectedImage) return;

    const userMsg = currentChatInfo;
    const userImage = selectedImage;

    setChatMessages(prev => [...prev, {
      role: 'user',
      text: userMsg || (userImage ? "Analyzed Document" : ""),
      image: userImage
    }]);

    setCurrentChatInfo("");
    setSelectedImage(null);
    setChatLoading(true);

    try {
      const response = await aiService.chatWithAgent(userMsg, userImage || undefined);
      setChatMessages(prev => [...prev, {
        role: 'bot',
        text: response.reply,
        sources: response.sources
      }]);
    } catch (err) {
      setChatMessages(prev => [...prev, {
        role: 'bot',
        text: "I'm having trouble connecting to the medical database. Please try again later."
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black p-4 md:p-8 space-y-8 text-slate-100 animate-fade-in">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300 tracking-tight">
            Clinical General Intelligence
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl">
            Next-generation decision support for modern pharmacy teams.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full backdrop-blur-md">
            <Bot className="w-3.5 h-3.5 mr-2" />
            Cortex v2.0 Live
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">

        {/* Navigation Tabs */}
        <div className="flex justify-center">
          <TabsList className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-1.5 h-auto rounded-full shadow-2xl inline-flex">
            <TabsTrigger
              value="chat"
              className="rounded-full px-6 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 transition-all duration-300"
            >
              <MessageSquare className="w-4 h-4 mr-2" /> Pharmacist Chat
            </TabsTrigger>
            <TabsTrigger
              value="info"
              className="rounded-full px-6 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 transition-all duration-300"
            >
              <Search className="w-4 h-4 mr-2" /> Drug Encyclopedia
            </TabsTrigger>
            <TabsTrigger
              value="interaction"
              className="rounded-full px-6 py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 transition-all duration-300"
            >
              <Activity className="w-4 h-4 mr-2" /> Interaction Matrix
            </TabsTrigger>
          </TabsList>
        </div>

        {/* --- TAB 1: PHARMACIST CHAT (Now Default & First) --- */}
        <TabsContent value="chat" className="focus-visible:ring-0">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[700px]">
            {/* Chat Area */}
            <Card className="lg:col-span-4 h-full flex flex-col border-white/10 bg-slate-900/40 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden">
              {/* Chat Header */}
              <div className="p-4 border-b border-white/5 bg-slate-900/60 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Clinical AI Assistant</h3>
                  <p className="text-xs text-blue-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Online & Ready
                  </p>
                </div>
              </div>

              {/* Chat History */}
              <ScrollArea className="flex-1 p-6 space-y-6">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} mb-6`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'bot' ? 'bg-slate-800 border border-white/10' : 'bg-blue-600'}`}>
                      {msg.role === 'bot' ? <Bot className="w-4 h-4 text-blue-400" /> : <div className="text-xs font-bold text-white">ME</div>}
                    </div>
                    <div className={`group relative max-w-[80%] p-4 rounded-2xl shadow-sm ${msg.role === 'bot'
                        ? 'bg-slate-800/80 border border-white/5 text-slate-200 rounded-tl-none'
                        : 'bg-blue-600 text-white rounded-tr-none'
                      }`}>
                      {msg.image && (
                        <img src={msg.image} alt="Upload" className="max-w-xs rounded-lg mb-3 border border-white/10" />
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                      {/* Action Chips for Bot */}
                      {msg.role === 'bot' && msg.sources && (
                        <div className="mt-3 flex gap-2 flex-wrap">
                          {msg.sources.map((src, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] border-blue-500/30 text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 cursor-pointer transition-colors">
                              {src}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex gap-4 mb-4">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-2xl rounded-tl-none flex items-center gap-1">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
              </ScrollArea>

              {/* Input Area */}
              <div className="p-4 bg-slate-900/80 border-t border-white/5 p-4 md:p-6 backdrop-blur-md">
                {selectedImage && (
                  <div className="mb-2 relative inline-block">
                    <img src={selectedImage} alt="Preview" className="h-16 w-16 rounded-lg object-cover border border-white/20" />
                    <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="flex gap-3">
                  <VoiceInput onTranscript={(text) => setCurrentChatInfo(text)} />

                  <Input
                    placeholder="Ask a clinical question or upload a prescription..."
                    value={currentChatInfo}
                    onChange={(e) => setCurrentChatInfo(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleChat()}
                    className="flex-1 bg-slate-950/50 border-white/10 focus-visible:ring-blue-500/50 text-white placeholder:text-slate-500 h-11"
                  />

                  <label className="cursor-pointer">
                    <Input type="file" onChange={handleFileSelect} className="hidden" accept="image/*" />
                    <div className="h-11 w-11 flex items-center justify-center rounded-md border border-white/10 bg-slate-950/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                      <Plus className="w-5 h-5" />
                    </div>
                  </label>

                  <Button onClick={handleChat} disabled={chatLoading} className="h-11 px-6 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20">
                    <MessageSquare className="w-5 h-5" />
                  </Button>
                </div>
                <p className="text-[10px] text-center text-slate-600 mt-2">
                  AI Output can be inaccurate. Always verify clinically.
                </p>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* --- TAB 2: DRUG INFORMATION --- */}
        <TabsContent value="info" className="space-y-6">
          <Card className="bg-slate-900/40 backdrop-blur-md border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Semantic Drug Search</CardTitle>
              <CardDescription className="text-slate-400">Search by brand, generic name, or symptom</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input
                  placeholder="Search e.g., 'Dolo 650', 'Augmentin'..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="bg-slate-950/50 border-white/10 text-white h-11"
                />
                <Button onClick={handleSearch} disabled={loading} className="h-11 w-11 p-0 bg-blue-600 hover:bg-blue-500">
                  {loading ? <Activity className="animate-spin w-5 h-5" /> : <Search className="w-5 h-5" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* RESULTS DISPLAY */}
          {drugInfo && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
              {/* Left Col: Clinical Details */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-slate-900/40 border-white/10 text-slate-200">
                  <CardHeader className="border-b border-white/5 pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-2xl text-blue-400">{drugInfo.name}</CardTitle>
                        <CardDescription className="text-lg font-medium mt-1 text-slate-400">{drugInfo.generic_name}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {drugInfo.is_h1_drug && <Badge variant="destructive" className="bg-red-500/20 text-red-300 border-red-500/50">Schedule H1</Badge>}
                        {drugInfo.banned_status?.is_banned && <Badge className="bg-red-600 animate-pulse text-white">BANNED</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-950/50 rounded-xl border border-white/5">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-blue-300"><Info className="w-4 h-4" /> Indications</h4>
                        <p className="text-sm text-slate-400">{drugInfo.indications}</p>
                      </div>
                      <div className="p-4 bg-slate-950/50 rounded-xl border border-white/5">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-green-400"><Activity className="w-4 h-4" /> Dosage (Adult)</h4>
                        <p className="text-sm text-slate-400">{drugInfo.dosage_guidelines.adult}</p>
                      </div>
                    </div>

                    <div className="p-4 border rounded-xl border-red-500/20 bg-red-500/5">
                      <h4 className="font-semibold mb-2 flex items-center gap-2 text-red-400"><AlertTriangle className="w-4 h-4" /> Safety Warning</h4>
                      <p className="text-sm text-slate-300">{drugInfo.safety_warning}</p>
                      <p className="text-xs text-slate-500 mt-2"><strong>Contraindications:</strong> {drugInfo.contraindications}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Col: Profit Engine */}
              <div className="space-y-6">
                <Card className="border-green-500/30 bg-green-500/5 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-green-400">
                      <TrendingUp className="w-5 h-5" /> Profit Engine
                    </CardTitle>
                    <CardDescription className="text-green-500/60">High-margin substitutes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {drugInfo.substitutes && drugInfo.substitutes.length > 0 ? (
                      drugInfo.substitutes.map((sub, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-slate-900/80 rounded-lg border border-white/5 cursor-pointer hover:border-green-500/50 transition-all group">
                          <div>
                            <div className="font-bold text-slate-200 group-hover:text-green-300 transition-colors">{sub.name}</div>
                            <div className="text-xs text-slate-500">Generic: {sub.generic_name}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-green-400">+{sub.margin_percentage}%</div>
                            <div className="text-xs text-slate-500">Save ₹{sub.savings}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-center text-slate-500 py-4">No high-margin substitutes found.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* --- TAB 3: INTERACTION MATRIX --- */}
        <TabsContent value="interaction" className="space-y-6">
          <Card className="bg-slate-900/40 backdrop-blur-md border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><AlertOctagon className="w-5 h-5 text-amber-500" /> Multi-Drug Interaction Checker</CardTitle>
              <CardDescription className="text-slate-400">Check for conflicts between multiple medications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-3">
                <Input
                  placeholder="Add drug (e.g., Warfarin)"
                  value={interactionQuery}
                  onChange={(e) => setInteractionQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddInteractionDrug()}
                  className="bg-slate-950/50 border-white/10 text-white h-11"
                />
                <Button onClick={handleAddInteractionDrug} className="h-11 px-6 bg-slate-800 hover:bg-slate-700">
                  <Plus className="w-4 h-4 mr-2" /> Add
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 min-h-[50px] p-4 bg-slate-950/30 rounded-xl border border-white/5 border-dashed">
                {interactionDrugs.length === 0 && <span className="text-slate-600 text-sm">No drugs added. Add at least 2.</span>}
                {interactionDrugs.map((d, i) => (
                  <Badge key={i} className="bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30 px-3 py-1.5 text-sm gap-2">
                    {d}
                    <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => handleRemoveInteractionDrug(d)} />
                  </Badge>
                ))}
              </div>

              <Button onClick={analyzeInteractions} disabled={analyzingMatrix || interactionDrugs.length < 2} className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-white font-bold tracking-wide">
                {analyzingMatrix ? "Analyzing Protocol..." : "Run Interaction Scan"}
              </Button>

              {/* Results Section */}
              {interactionResults.length > 0 && (
                <div className="space-y-3 mt-4">
                  {interactionResults.map((res, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border flex items-start gap-4 ${res.severity === 'Major' ? 'bg-red-500/10 border-red-500/30' :
                      res.severity === 'Moderate' ? 'bg-orange-500/10 border-orange-500/30' :
                        'bg-green-500/10 border-green-500/30'
                      }`}>
                      {res.severity === 'Major' ? <AlertOctagon className="w-5 h-5 text-red-500" /> :
                        res.severity === 'Moderate' ? <AlertTriangle className="w-5 h-5 text-orange-500" /> :
                          <CheckCircle className="w-5 h-5 text-green-500" />}
                      <div>
                        <h4 className={`font-bold ${res.severity === 'Major' ? 'text-red-500' :
                          res.severity === 'Moderate' ? 'text-orange-500' :
                            'text-green-500'
                          }`}>
                          {res.drug1} + {res.drug2}
                        </h4>
                        <p className="text-sm text-slate-300 mt-1">{res.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default AIInsights;
