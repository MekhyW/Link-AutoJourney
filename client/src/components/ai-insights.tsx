import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, TrendingUp, AlertTriangle, CheckCircle, Brain } from "lucide-react";

interface AIInsightsProps {
  candidates: any[];
}

export default function AIInsights({ candidates }: AIInsightsProps) {
  const topPerformers = candidates.filter(c => c.status === 'interview_ready').length;
  const totalCandidates = candidates.length;
  const topPerformerPercentage = Math.round((topPerformers / totalCandidates || 0) * 100);

  // Calculate common strengths and weaknesses
  const allStrengths = candidates.flatMap(c => c.strengths || []);
  const allWeaknesses = candidates.flatMap(c => c.weaknesses || []);
  
  const strengthCounts = allStrengths.reduce((acc, strength) => {
    acc[strength] = (acc[strength] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const weaknessCounts = allWeaknesses.reduce((acc, weakness) => {
    acc[weakness] = (acc[weakness] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topStrengths = Object.entries(strengthCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([skill, count]) => ({ skill, percentage: Math.round((count / totalCandidates) * 100) }));

  const topWeaknesses = Object.entries(weaknessCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([skill, count]) => ({ skill, percentage: Math.round((count / totalCandidates) * 100) }));

  const insights = [
    {
      title: "Top Performers",
      description: `${topPerformers} candidates (${topPerformerPercentage}%) show exceptional problem-solving skills and consistently deliver high-quality work.`,
      icon: CheckCircle,
      color: "text-primary",
      bgColor: "bg-blue-50",
      borderColor: "border-primary",
    },
    {
      title: "Areas for Improvement",
      description: topWeaknesses.length > 0 
        ? `Common weaknesses include ${topWeaknesses.map(w => `${w.skill} (${w.percentage}%)`).join(' and ')}.`
        : "Comprehensive analysis pending for detailed improvement areas.",
      icon: AlertTriangle,
      color: "text-warning",
      bgColor: "bg-amber-50",
      borderColor: "border-warning",
    },
    {
      title: "Interview Recommendations",
      description: "Focus technical interviews on system design and practical problem-solving for top candidates.",
      icon: TrendingUp,
      color: "text-accent",
      bgColor: "bg-green-50",
      borderColor: "border-accent",
    },
  ];

  return (
    <Card className="shadow-sm border border-gray-200">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Bot className="text-primary w-5 h-5" />
          <CardTitle>AI-Generated Insights</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {insights.map((insight, index) => (
            <div
              key={index}
              className={`p-4 ${insight.bgColor} rounded-lg border-l-4 ${insight.borderColor}`}
            >
              <div className="flex items-start space-x-3">
                <insight.icon className={`w-5 h-5 mt-0.5 ${insight.color} flex-shrink-0`} />
                <div>
                  <h4 className={`text-sm font-medium ${insight.color} mb-2`}>
                    {insight.title}
                  </h4>
                  <p className="text-sm text-gray-700">{insight.description}</p>
                </div>
              </div>
            </div>
          ))}

          {topStrengths.length > 0 && (
            <div className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
              <div className="flex items-start space-x-3">
                <Brain className="w-5 h-5 mt-0.5 text-purple-700 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-purple-700 mb-2">Skill Distribution</h4>
                  <div className="space-y-2">
                    {topStrengths.map((strength, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-gray-600">{strength.skill}</span>
                        <span className="font-medium">{strength.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
