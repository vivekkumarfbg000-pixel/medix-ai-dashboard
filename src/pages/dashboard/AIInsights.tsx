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
  const [activeTab, setActiveTab] = useState("info");

  // Smart Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
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
    { role: 'bot', text: "Hello! I'm your Clinical Assistant. I can search National Library of Medicine & PubMed for you. Ask me about drug safety, dosage, or alternatives." }
  ]);
  const [currentChatInfo, setCurrentChatInfo] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // --- Handlers ---

  const handleSearch = async () => {
    if (!searchQuery) return;
    setLoading(true);
    try {
      const info = await drugService.searchDrug(searchQuery);
      setDrugInfo(info);
      if (info) {
        toast.success(`Found clinical data for ${info.name}`);
      } else {
        toast.error("No data found. Please check the drug name and try again.");
      }
    } catch (error) {
      toast.error("Failed to fetch drug info");
    } finally {
      setLoading(false);
    }
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
    if (interactionDrugs.length < 2) {
      toast.error("Please add at least 2 drugs to check interactions");
      return;
    }
    setAnalyzingMatrix(true);
    try {
      // Mocking interaction check if service not fully wired
      const results = await drugService.checkInteractions(interactionDrugs);
      setInteractionResults(results);
    } catch (e) {
      toast.error("Analysis failed");
    } finally {
      setAnalyzingMatrix(false);
    }
  };

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChat = async () => {
    if (!currentChatInfo && !selectedImage) return;

    const userMsg = currentChatInfo;
    const userImage = selectedImage;

    const newMessages = [...chatMessages, {
      role: 'user' as const,
      text: userMsg || (userImage ? "Analyzed Prescription/Image" : ""),
      image: userImage
    }];

    setChatMessages(newMessages);
    setCurrentChatInfo("");
    setSelectedImage(null); // Clear after sending
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
        text: "I'm having trouble connecting to the medical database right now. Please try again."
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in p-2">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">MedixAI Clinical Intelligence</h1>
          <p className="text-muted-foreground mt-1">AI-Powered Drug Analysis & Decision Support Engine</p>
        </div>
        <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 px-4 py-1">
          <Bot className="w-4 h-4 mr-2" />
          v2.0 Beta
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="info">
            <Search className="w-4 h-4 mr-2" /> Drug Info
          </TabsTrigger>
          <TabsTrigger value="interaction">
            <Activity className="w-4 h-4 mr-2" /> Interaction Matrix
          </TabsTrigger>
          <TabsTrigger value="chat">
            <MessageSquare className="w-4 h-4 mr-2" /> Pharmacist Chat
          </TabsTrigger>
        </TabsList>

        {/* --- TAB 1: DRUG INFO --- */}
        <TabsContent value="info" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Semantic Drug Search</CardTitle>
              <CardDescription>Search by brand, generic name, or symptom</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search e.g., 'Dolo 650', 'Metformin', 'Augmentin'..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="bg-background text-foreground"
                />
                <Button onClick={handleSearch} disabled={loading}>
                  {loading ? <Activity className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* RESULTS DISPLAY */}
          {drugInfo && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">

              {/* Left Col: Clinical Details */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-2xl text-primary">{drugInfo.name}</CardTitle>
                        <CardDescription className="text-lg font-medium mt-1">{drugInfo.generic_name}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {drugInfo.is_h1_drug && <Badge variant="destructive">Schedule H1</Badge>}
                        {drugInfo.banned_status?.is_banned && <Badge className="bg-red-600 animate-pulse">BANNED</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-semibold mb-2 flex items-center gap-2"><Info className="w-4 h-4 text-blue-500" /> Indications</h4>
                        <p className="text-sm text-muted-foreground">{drugInfo.indications}</p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-semibold mb-2 flex items-center gap-2"><Activity className="w-4 h-4 text-green-500" /> Dosage (Adult)</h4>
                        <p className="text-sm text-muted-foreground">{drugInfo.dosage_guidelines.adult}</p>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg border-destructive/20 bg-destructive/5">
                      <h4 className="font-semibold mb-2 flex items-center gap-2 text-destructive"><AlertTriangle className="w-4 h-4" /> Safety Warning</h4>
                      <p className="text-sm">{drugInfo.safety_warning}</p>
                      <p className="text-xs text-muted-foreground mt-2"><strong>Contraindications:</strong> {drugInfo.contraindications}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Patient Education (Dawa-Gyaan) */}
                {drugInfo.education_tips && (
                  <Card className="border-l-4 border-l-blue-500">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Brain className="w-5 h-5 text-blue-500" /> Patient Counselling (Dawa-Gyaan)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <strong className="text-sm block mb-1">Dietary Advice</strong>
                          <ul className="list-disc list-inside text-xs text-muted-foreground">
                            {drugInfo.education_tips.diet.map((t, i) => <li key={i}>{t}</li>)}
                          </ul>
                        </div>
                        <div>
                          <strong className="text-sm block mb-1">Lifestyle</strong>
                          <ul className="list-disc list-inside text-xs text-muted-foreground">
                            {drugInfo.education_tips.lifestyle.map((t, i) => <li key={i}>{t}</li>)}
                          </ul>
                        </div>
                        <div>
                          <strong className="text-sm block mb-1 text-orange-500">Warning</strong>
                          <p className="text-xs text-muted-foreground">{drugInfo.education_tips.warning}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right Col: Profit Engine & Side Effects */}
              <div className="space-y-6">

                {/* Profit Engine Widget */}
                <Card className="border-green-500/30 bg-green-500/5">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-600" /> Profit Engine
                    </CardTitle>
                    <CardDescription>High-margin substitutes available</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {drugInfo.substitutes && drugInfo.substitutes.length > 0 ? (
                      drugInfo.substitutes.map((sub, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-background rounded-lg border shadow-sm cursor-pointer hover:border-green-500 transition-all">
                          <div>
                            <div className="font-bold text-foreground">{sub.name}</div>
                            <div className="text-xs text-muted-foreground">Generic: {sub.generic_name}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-green-600">+{sub.margin_percentage}% Margin</div>
                            <div className="text-xs text-muted-foreground">Save ₹{sub.savings}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-center text-muted-foreground py-4">No high-margin substitutes found.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Side Effects */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Side Effects</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {drugInfo.side_effects.common.map((effect, idx) => (
                        <Badge key={idx} variant="secondary">{effect}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

              </div>
            </div>
          )}
        </TabsContent>

        {/* --- TAB 2: INTERACTION MATRIX --- */}
        <TabsContent value="interaction" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Multi-Drug Interaction Matrix</CardTitle>
              <CardDescription>Visualize conflict severity between multiple medications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2">
                <Input
                  placeholder="Add a medication (e.g. Warfarin)..."
                  value={interactionQuery}
                  onChange={(e) => setInteractionQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddInteractionDrug()}
                  className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-400"
                />
                <Button onClick={handleAddInteractionDrug} variant="secondary">
                  <Plus className="w-4 h-4 mr-2" /> Add
                </Button>
              </div>

              {interactionDrugs.length > 0 && (
                <div className="flex flex-wrap gap-2 p-4 bg-muted/30 rounded-lg border border-border/50">
                  {interactionDrugs.map((drug, idx) => (
                    <Badge key={idx} variant="secondary" className="pl-3 pr-1 py-1 flex items-center gap-2 text-sm">
                      {drug}
                      <button onClick={() => handleRemoveInteractionDrug(drug)} className="hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <Button
                onClick={analyzeInteractions}
                className="w-full"
                disabled={interactionDrugs.length < 2 || analyzingMatrix}
              >
                {analyzingMatrix ? (
                  <><Activity className="w-4 h-4 mr-2 animate-spin" /> Analyzing Conflicts...</>
                ) : (
                  <><AlertTriangle className="w-4 h-4 mr-2" /> Analyze Interactions</>
                )}
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
                        <p className="text-sm text-foreground mt-1">{res.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB 3: NLQ CHAT --- */}
        <TabsContent value="chat">
          <Card className="h-[600px] flex flex-col glass-card">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2"><Stethoscope className="w-5 h-5 text-primary" /> Clinical Pharmacist Bot</CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                      {msg.image && (
                        <img src={msg.image} alt="Upload" className="mb-2 max-w-full rounded-md max-h-[200px] object-cover border border-white/20" />
                      )}
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-primary/20 text-xs opacity-80">
                          <strong>Sources:</strong>
                          <ul className="list-disc list-inside mt-1">
                            {msg.sources.map((src, i) => <li key={i}>{src}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted p-3 rounded-lg text-sm flex items-center gap-2">
                      <Activity className="w-3 h-3 animate-spin" /> Analyzing Clinical Data...
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {selectedImage && (
              <div className="px-4 pt-2 flex items-center gap-2">
                <div className="relative group">
                  <img src={selectedImage} alt="Preview" className="h-16 w-16 object-cover rounded border border-primary/50" />
                  <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 shadow-sm hover:scale-110 transition">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">Ready to analyze</span>
              </div>
            )}

            <div className="p-4 border-t flex gap-2">
              <label className="cursor-pointer p-2 hover:bg-muted rounded-full transition text-muted-foreground hover:text-primary">
                <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                <Plus className="w-5 h-5" />
              </label>
              <Input
                placeholder="Ask about prescriptions, side effects..."
                value={currentChatInfo}
                onChange={e => setCurrentChatInfo(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleChat()}
                className="bg-background text-foreground"
              />
              <Button onClick={handleChat}><MessageSquare className="w-4 h-4" /></Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIInsights;
