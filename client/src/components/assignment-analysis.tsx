import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface AssignmentAnalysisProps {
  assignments: any[];
}

export default function AssignmentAnalysis({ assignments }: AssignmentAnalysisProps) {
  if (assignments.length === 0) {
    return (
      <Card className="shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle>Assignment Performance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-500">No assignments available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border border-gray-200">
      <CardHeader>
        <CardTitle>Assignment Performance Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {assignments.slice(0, 5).map((assignment) => (
            <div key={assignment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {assignment.name}
                </p>
                <p className="text-xs text-gray-500">
                  {assignment.submissionTypes?.join(', ') || 'Multiple types'}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">
                    {assignment.averageScore?.toFixed(1) || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500">avg score</p>
                </div>
                <div className="w-16">
                  <Progress value={assignment.averageScore || 0} className="h-2"/>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
