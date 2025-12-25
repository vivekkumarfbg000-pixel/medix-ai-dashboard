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
  ShieldAlert,
  Stethoscope,
  Brain,
  MessageSquare
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

                  </div>

                  {/* SATYA-CHECK: BANNED DRUG ALERT */}
                  {drugInfo.banned_status?.is_banned && (
                    <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-lg animate-pulse mb-4">
                      <h3 className="font-bold text-red-700 flex items-center gap-2 mb-2 text-lg">
                        <ShieldAlert className="w-6 h-6" /> STOP! BANNED DRUG DETECTED
                      </h3>
                      <p className="text-red-800 font-medium">Reason: {drugInfo.banned_status.reason}</p>
                      <p className="text-sm text-red-600 mt-1">Sale of this composition is illegal under CDSCO gazette.</p>
                      <Button variant="destructive" className="mt-2 w-full font-bold">
                        DO NOT DISPENSE
                      </Button>
                    </div>
                  )}

                  {/* DAWA-GYAAN: PATIENT EDUCATION CARD */}
                  {drugInfo.education_tips && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                      <div className="flex justify-between items-start">
                        <h3 className="text-blue-900 font-bold flex items-center gap-2 text-lg">
                          <Brain className="w-5 h-5" /> Dawa-Gyaan: Patient Tips
                        </h3>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white gap-2"
                          onClick={() => {
                            const tips = drugInfo.education_tips;
                            if (!tips) return;
                            const msg = `*💊 PharmaAssist Care Card*\n\n*Medicine:* ${drugInfo.name}\n\n*🥗 Diet:* ${tips.diet.join(", ")}\n*🚶 Lifestyle:* ${tips.lifestyle.join(", ")}\n\n*⚠️ Warning:* ${tips.warning}\n\n_Get Well Soon!_`;
                            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                          }}
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                          Share Care Card
                        </Button>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4 mt-3">
                        <div>
                          <p className="text-xs font-bold uppercase text-blue-500 tracking-wider">Recommended Diet</p>
                          <ul className="list-disc list-inside text-sm text-blue-800 mt-1">
                            {drugInfo.education_tips.diet.map((t, i) => <li key={i}>{t}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase text-blue-500 tracking-wider">Lifestyle Advice</p>
                          <ul className="list-disc list-inside text-sm text-blue-800 mt-1">
                            {drugInfo.education_tips.lifestyle.map((t, i) => <li key={i}>{t}</li>)}
                          </ul>
                        </div>
                      </div>
                      <div className="mt-3 bg-yellow-50 border border-yellow-200 p-2 rounded text-xs text-yellow-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        <b>Warning:</b> {drugInfo.education_tips.warning}
                      </div>
                    </div>
                  )}

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
                  {/* REMOVED EXTRA CLOSING DIV */}

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
    </div >
  );
};

export default AIInsights;
