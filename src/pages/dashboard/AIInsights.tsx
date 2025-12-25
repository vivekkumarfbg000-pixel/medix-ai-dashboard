import { useState, useEffect } from "react";
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
  ShieldAlert
} from "lucide-react";
import { drugService, ClinicalDrugInfo, InteractionResult } from "@/services/drugService";
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

  // Chat State
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    { role: 'bot', text: "Hello! I'm your Clinical Assistant. Ask me about drug safety, dosage, or alternatives." }
  ]);
  const [currentChatInfo, setCurrentChatInfo] = useState("");

  // Debounce Search Suggestions
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 3) {
        const results = await drugService.getSuggestions(searchQuery);
        setSuggestions(results);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = async (term: string = searchQuery) => {
    if (!term) return;
    setLoading(true);
    setShowSuggestions(false);
    setSearchQuery(term);

    try {
      const info = await drugService.searchDrug(term);
      if (info) {
        setDrugInfo(info);
        toast.success("Clinical data retrieved successfully");
      } else {
        toast.error("Drug information not found in clinical database");
      }
    } catch (error) {
      toast.error("Failed to fetch drug information");
    } finally {
      setLoading(false);
    }
  };

  const addInteractionDrug = () => {
    if (interactionQuery && !interactionDrugs.includes(interactionQuery)) {
      const newList = [...interactionDrugs, interactionQuery];
      setInteractionDrugs(newList);
      setInteractionQuery("");
      checkInteractions(newList);
    }
  };

  const removeInteractionDrug = (drug: string) => {
    const newList = interactionDrugs.filter(d => d !== drug);
    setInteractionDrugs(newList);
    checkInteractions(newList);
  };

  const checkInteractions = async (drugs: string[]) => {
    if (drugs.length < 2) {
      setInteractionResults([]);
      return;
    }
    const results = await drugService.checkInteractions(drugs);
    setInteractionResults(results);
  };

  const handleChat = () => {
    if (!currentChatInfo) return;

    const newMessages = [...chatMessages, { role: 'user' as const, text: currentChatInfo }];
    setChatMessages(newMessages);
    setCurrentChatInfo("");

    // Simulate AI Response
    setTimeout(() => {
      let response = "I can currently identify drug interactions and provide clinical summaries. Please consult a doctor for specific medical advice.";
      if (currentChatInfo.toLowerCase().includes("headache")) response = "For headaches, common OTC options include Acetaminophen (Paracetamol) or Ibuprofen. However, check for interactions if you are on other medications.";
      if (currentChatInfo.toLowerCase().includes("safe")) response = "Safety depends on your medical history. Always check the 'Contraindications' section of the drug label.";

      setChatMessages([...newMessages, { role: 'bot', text: response }]);
    }, 1000);
  };

  return (
    <div className="space-y-8 animate-fade-in p-2">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">MediFlow Clinical Intelligence</h1>
          <p className="text-muted-foreground mt-1">AI-Powered Drug Analysis & Decision Support Engine</p>
        </div>
        <Badge variant="outline" className="px-3 py-1 bg-primary/10 text-primary border-primary/20">
          <Bot className="w-4 h-4 mr-2" />
          v2.0 Beta
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-[600px]">
          <TabsTrigger value="info" className="gap-2">
            <Search className="w-4 h-4" /> Drug Info
          </TabsTrigger>
          <TabsTrigger value="interactions" className="gap-2">
            <Activity className="w-4 h-4" /> Interaction Matrix
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="w-4 h-4" /> Pharmacist Chat
          </TabsTrigger>
        </TabsList>

        {/* --- TAB 1: SMART CLINICAL SEARCH --- */}
        <TabsContent value="info" className="space-y-6">
          <Card className="border-primary/20 shadow-lg">
            <CardHeader className="bg-primary/5 pb-4">
              <CardTitle>Clinical Search Engine</CardTitle>
              <CardDescription>Search for detailed clinical pharmacology, dosage, and safety profiles.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1 flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Enter brand or generic name (e.g., Crocin, Amoxicillin)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-12 text-lg"
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      />
                      {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute z-10 w-full bg-popover border rounded-md shadow-md mt-1 overflow-hidden">
                          {suggestions.map((s, i) => (
                            <div
                              key={i}
                              className="px-4 py-2 hover:bg-muted cursor-pointer text-sm"
                              onClick={() => handleSearch(s)}
                            >
                              {s}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <VoiceInput onTranscript={(text) => handleSearch(text)} />
                    <Button size="lg" onClick={() => handleSearch()} disabled={loading} className="px-8">
                      {loading ? <Activity className="w-4 h-4 animate-spin" /> : "Analyze"}
                    </Button>
                  </div>
                </div>
              </div>

              {drugInfo && (
                <div className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2">
                  <div className="flex flex-col gap-2 border-b pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
                          {drugInfo.name}
                          {drugInfo.is_h1_drug && (
                            <Badge variant="destructive" className="animate-pulse gap-1">
                              <ShieldAlert className="w-3 h-3" /> H1 DRUG - REGISTER MANDATORY
                            </Badge>
                          )}
                        </h2>
                        <p className="text-sm text-muted-foreground font-mono">{drugInfo.generic_name}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">RX ONLY</Badge>
                    </div>

                    {/* MARGADARSHAK PROFIT ENGINE */}
                    {drugInfo.substitutes && drugInfo.substitutes.length > 0 && (
                      <div className="mt-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                        <h3 className="text-green-800 font-bold flex items-center gap-2 mb-2">
                          <TrendingUp className="w-5 h-5" />
                          Margadarshak Insight: Profit Opportunity
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {drugInfo.substitutes.map((sub, idx) => (
                            <div key={idx} className="bg-white p-3 rounded border border-green-100 shadow-sm flex justify-between items-center">
                              <div>
                                <p className="font-semibold text-green-900">{sub.name}</p>
                                <p className="text-xs text-green-600">{sub.generic_name}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-green-700">₹{sub.price}</p>
                                <Badge className="bg-green-600 hover:bg-green-700 text-white border-none">
                                  Save ₹{sub.savings}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CRITICAL BOXED WARNINGS */}
                  {drugInfo.boxed_warnings && drugInfo.boxed_warnings.length > 0 && (
                    <div className="bg-destructive/10 border-l-4 border-destructive p-4 rounded-r-lg animate-pulse">
                      <h3 className="font-bold text-destructive flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5" /> BLACK BOX WARNING
                      </h3>
                      <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1">
                        {drugInfo.boxed_warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-6">
                    <Card className="bg-muted/30">
                      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Info className="w-4 h-4" /> Indications & Uses</CardTitle></CardHeader>
                      <CardContent className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto pr-2">
                        {drugInfo.indications}
                      </CardContent>
                    </Card>

                    <Card className="bg-muted/30">
                      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Dosage Guidelines</CardTitle></CardHeader>
                      <CardContent className="space-y-4 text-sm max-h-[300px] overflow-y-auto pr-2">
                        <div>
                          <span className="font-semibold block mb-1 text-primary">Adults:</span>
                          <span className="text-muted-foreground">{drugInfo.dosage_guidelines.adult}</span>
                        </div>
                        <div>
                          <span className="font-semibold block mb-1 text-primary">Pediatric:</span>
                          <span className="text-muted-foreground">{drugInfo.dosage_guidelines.pediatric}</span>
                        </div>
                        <div>
                          <span className="font-semibold block mb-1 text-primary">Geriatric:</span>
                          <span className="text-muted-foreground">{drugInfo.dosage_guidelines.geriatric}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* PHARMACOLOGY & SPECIAL POPULATIONS */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card className="bg-blue-50/50 dark:bg-blue-950/10 border-blue-100 dark:border-blue-900">
                      <CardHeader><CardTitle className="text-sm flex items-center gap-2 text-blue-700 dark:text-blue-400"><Stethoscope className="w-4 h-4" /> Mechanism of Action</CardTitle></CardHeader>
                      <CardContent className="text-sm text-muted-foreground leading-relaxed max-h-[200px] overflow-y-auto">
                        {drugInfo.mechanism_of_action}
                      </CardContent>
                    </Card>

                    <Card className="bg-purple-50/50 dark:bg-purple-950/10 border-purple-100 dark:border-purple-900">
                      <CardHeader><CardTitle className="text-sm flex items-center gap-2 text-purple-700 dark:text-purple-400"><Activity className="w-4 h-4" /> Pregnancy & Lactation</CardTitle></CardHeader>
                      <CardContent className="text-sm text-muted-foreground leading-relaxed max-h-[200px] overflow-y-auto whitespace-pre-line">
                        {drugInfo.pregnancy_lactation}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <Card className="border-destructive/20 bg-destructive/5">
                      <CardHeader><CardTitle className="text-sm text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Contraindications</CardTitle></CardHeader>
                      <CardContent className="text-sm text-muted-foreground leading-relaxed max-h-[200px] overflow-y-auto pr-2">
                        {drugInfo.contraindications}
                      </CardContent>
                    </Card>

                    <Card className="bg-muted/30">
                      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> Side Effects Profile</CardTitle></CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex flex-wrap gap-2">
                          {drugInfo.side_effects.common.map(e => <Badge key={e} variant="outline">{e}</Badge>)}
                        </div>
                        {drugInfo.side_effects.severe.length > 0 && (
                          <p className="text-destructive text-xs mt-2">Severe: {drugInfo.side_effects.severe.join(", ")}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg flex items-center gap-3 text-sm text-yellow-600 dark:text-yellow-400">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    {drugInfo.safety_warning}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB 2: VISUAL INTERACTION MATRIX --- */}
        <TabsContent value="interactions">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle>Multi-Drug Interaction Matrix</CardTitle>
              <CardDescription>Visualize conflict severity between multiple medications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2">
                <Input
                  placeholder="Add a medication (e.g. Warfarin)..."
                  value={interactionQuery}
                  onChange={e => setInteractionQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addInteractionDrug()}
                />
                <Button onClick={addInteractionDrug} variant="secondary"><Plus className="w-4 h-4" /> Add</Button>
              </div>

              <div className="flex flex-wrap gap-2 min-h-[50px] p-4 bg-muted/20 rounded-lg border border-dashed">
                {interactionDrugs.length === 0 && <span className="text-muted-foreground text-sm italic">No drugs added yet.</span>}
                {interactionDrugs.map(drug => (
                  <Badge key={drug} className="pl-3 pr-1 py-1 h-8 text-sm flex items-center gap-2 bg-background border hover:bg-accent">
                    {drug}
                    <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full hover:bg-destructive/20 hover:text-destructive" onClick={() => removeInteractionDrug(drug)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </Badge>
                ))}
              </div>

              {interactionResults.length > 0 && (
                <div className="space-y-3 mt-6">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Detected Interactions</h3>
                  {interactionResults.map((res, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border-l-4 flex items-start gap-4 ${res.severity === 'Major' ? 'bg-destructive/10 border-destructive' :
                      res.severity === 'Moderate' ? 'bg-yellow-500/10 border-yellow-500' :
                        'bg-green-500/10 border-green-500'
                      }`}>
                      {res.severity === 'Major' ? <AlertTriangle className="w-6 h-6 text-destructive" /> :
                        <Info className="w-6 h-6 text-foreground" />}
                      <div>
                        <div className="font-bold flex items-center gap-2">
                          {res.drug1} + {res.drug2}
                          <Badge variant={res.severity === 'Major' ? 'destructive' : 'outline'}>{res.severity}</Badge>
                        </div>
                        <p className="text-sm mt-1">{res.description}</p>
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
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2"><Stethoscope className="w-5 h-5 text-primary" /> Clinical Pharmacist Bot</CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="p-4 border-t flex gap-2">
              <Input
                placeholder="Ask about side effects, safety, or dosage..."
                value={currentChatInfo}
                onChange={e => setCurrentChatInfo(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleChat()}
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
