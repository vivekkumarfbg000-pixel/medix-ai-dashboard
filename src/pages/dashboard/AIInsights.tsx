import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Brain, 
  Search, 
  AlertTriangle, 
  ShieldCheck, 
  Pill,
  Loader2,
  ExternalLink,
  Activity,
  Info
} from "lucide-react";

const AIInsights = () => {
  const [drugQuery, setDrugQuery] = useState("");
  const [interactionDrugs, setInteractionDrugs] = useState<string[]>([]);
  const [newDrug, setNewDrug] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [drugInfo, setDrugInfo] = useState<any>(null);
  const [interactions, setInteractions] = useState<any[]>([]);

  const handleDrugSearch = async () => {
    if (!drugQuery.trim()) return;
    
    setIsLoading(true);
    // Simulate API call to National Library of Medicine
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setDrugInfo({
      name: drugQuery,
      genericName: "Acetaminophen",
      uses: [
        "Pain relief",
        "Fever reduction",
        "Headache treatment",
        "Muscle aches"
      ],
      sideEffects: [
        { effect: "Nausea", severity: "mild" },
        { effect: "Liver damage (high doses)", severity: "severe" },
        { effect: "Allergic reactions", severity: "moderate" },
        { effect: "Skin rash", severity: "mild" }
      ],
      warnings: [
        "Do not exceed 4000mg per day",
        "Avoid alcohol consumption",
        "Consult doctor if pregnant or breastfeeding"
      ]
    });
    
    setIsLoading(false);
  };

  const addDrugForInteraction = () => {
    if (newDrug.trim() && !interactionDrugs.includes(newDrug.trim())) {
      setInteractionDrugs([...interactionDrugs, newDrug.trim()]);
      setNewDrug("");
    }
  };

  const removeDrug = (drug: string) => {
    setInteractionDrugs(interactionDrugs.filter(d => d !== drug));
  };

  const checkInteractions = async () => {
    if (interactionDrugs.length < 2) return;
    
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulated interaction results
    setInteractions([
      {
        drugs: ["Aspirin", "Warfarin"],
        severity: "severe",
        description: "Increased risk of bleeding when combined. Aspirin inhibits platelet function while Warfarin is an anticoagulant.",
        recommendation: "Avoid combination or monitor closely"
      },
      {
        drugs: ["Ibuprofen", "Aspirin"],
        severity: "moderate",
        description: "Ibuprofen may reduce the cardioprotective effects of low-dose aspirin.",
        recommendation: "Take aspirin at least 30 minutes before ibuprofen"
      }
    ]);
    
    setIsLoading(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">AI Health Insights</h1>
        <p className="text-muted-foreground mt-1">
          Drug information and interaction checker powered by AI
        </p>
      </div>

      <Tabs defaultValue="drug-info" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="drug-info" className="gap-2">
            <Pill className="w-4 h-4" />
            Drug Info
          </TabsTrigger>
          <TabsTrigger value="interactions" className="gap-2">
            <Activity className="w-4 h-4" />
            Interactions
          </TabsTrigger>
        </TabsList>

        {/* Drug Information Tab */}
        <TabsContent value="drug-info" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                Drug Information Search
              </CardTitle>
              <CardDescription>
                Search for drug details, side effects, and benefits from medical databases
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Enter medicine name (e.g., Paracetamol)"
                    value={drugQuery}
                    onChange={(e) => setDrugQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleDrugSearch()}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleDrugSearch} disabled={isLoading || !drugQuery.trim()}>
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Search"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {drugInfo && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Uses */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-success" />
                    Uses & Benefits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {drugInfo.uses.map((use: string, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-success" />
                        {use}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Side Effects */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-warning" />
                    Side Effects
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {drugInfo.sideEffects.map((effect: any, i: number) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span>{effect.effect}</span>
                        <Badge 
                          variant={
                            effect.severity === "severe" ? "destructive" :
                            effect.severity === "moderate" ? "secondary" : "outline"
                          }
                          className="text-xs"
                        >
                          {effect.severity}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Warnings */}
              <Card className="md:col-span-2 border-warning/50 bg-warning/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-warning">
                    <Info className="w-5 h-5" />
                    Important Warnings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {drugInfo.warnings.map((warning: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                        {warning}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Drug Interactions Tab */}
        <TabsContent value="interactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Drug Interaction Checker
              </CardTitle>
              <CardDescription>
                Add multiple medicines to check for potential harmful interactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Input
                  placeholder="Add medicine name"
                  value={newDrug}
                  onChange={(e) => setNewDrug(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDrugForInteraction()}
                />
                <Button onClick={addDrugForInteraction} variant="outline">
                  Add
                </Button>
              </div>

              {interactionDrugs.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {interactionDrugs.map((drug) => (
                    <Badge 
                      key={drug} 
                      variant="secondary"
                      className="gap-1 cursor-pointer hover:bg-destructive/20"
                      onClick={() => removeDrug(drug)}
                    >
                      <Pill className="w-3 h-3" />
                      {drug}
                      <span className="ml-1">×</span>
                    </Badge>
                  ))}
                </div>
              )}

              <Button 
                onClick={checkInteractions} 
                disabled={interactionDrugs.length < 2 || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking Interactions...
                  </>
                ) : (
                  "Check Interactions"
                )}
              </Button>
            </CardContent>
          </Card>

          {interactions.length > 0 && (
            <div className="space-y-4">
              {interactions.map((interaction, i) => (
                <Card 
                  key={i} 
                  className={
                    interaction.severity === "severe" 
                      ? "border-destructive/50 bg-destructive/5" 
                      : "border-warning/50 bg-warning/5"
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                        interaction.severity === "severe" ? "text-destructive" : "text-warning"
                      }`} />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{interaction.drugs.join(" + ")}</span>
                          <Badge variant={interaction.severity === "severe" ? "destructive" : "secondary"}>
                            {interaction.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{interaction.description}</p>
                        <p className="text-sm font-medium">
                          Recommendation: {interaction.recommendation}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* API Reference */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Powered by Medical APIs</p>
              <p className="text-xs text-muted-foreground">
                Data sourced from National Library of Medicine
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="gap-1">
            Learn More
            <ExternalLink className="w-3 h-3" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIInsights;
