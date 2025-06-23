import { Card, CardContent } from "@/components/ui/card";
import { Users, FileCheck, Star, BarChart3 } from "lucide-react";

interface StatsCardsProps {
  candidates: any[];
  assignments: any[];
}

export default function StatsCards({ candidates, assignments }: StatsCardsProps) {
  const totalCandidates = candidates.length;
  const submissionsAnalyzed = candidates.reduce((sum, candidate) => sum + (candidate.submissionCount || 0), 0);
  const interviewReady = candidates.filter(c => c.status === 'interview_ready').length;
  const averageScore = candidates.length > 0
    ? candidates.reduce((sum, c) => sum + (c.overallScore || 0), 0) / candidates.length
    : 0;

  const stats = [
    {
      title: "Total Candidates",
      value: totalCandidates,
      change: `${assignments.length} assignments`,
      icon: Users,
      iconBg: "bg-blue-50",
      iconColor: "text-primary",
    },
    {
      title: "Submissions Analyzed",
      value: submissionsAnalyzed,
      change: `${Math.round((submissionsAnalyzed / (totalCandidates * assignments.length || 1)) * 100)}% completion rate`,
      icon: FileCheck,
      iconBg: "bg-green-50",
      iconColor: "text-accent",
    },
    {
      title: "Interview Ready",
      value: interviewReady,
      change: `Top ${Math.round((interviewReady / totalCandidates || 0) * 100)}% performers`,
      icon: Star,
      iconBg: "bg-orange-50",
      iconColor: "text-warning",
    },
    {
      title: "Avg. Score",
      value: averageScore.toFixed(1),
      change: "+5.2 from last cohort",
      icon: BarChart3,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <Card key={index} className="shadow-sm border border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 ${stat.iconBg} rounded-xl flex items-center justify-center`}>
                <stat.icon className={`text-xl ${stat.iconColor}`} />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-sm text-accent font-medium">{stat.change}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
