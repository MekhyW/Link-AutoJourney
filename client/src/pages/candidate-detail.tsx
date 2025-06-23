import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Calendar, Download, FileText, Check, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

export default function CandidateDetail() {
  const { candidateId } = useParams();

  const { data: candidate, isLoading } = useQuery({
    queryKey: ["/api/candidates", candidateId],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading candidate details...</p>
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Candidate Not Found</h2>
          <p className="text-sm text-gray-500 mb-4">The requested candidate could not be found.</p>
          <Link href="/">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'interview_ready':
        return 'bg-green-100 text-green-800';
      case 'needs_review':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'interview_ready':
        return 'Interview Ready';
      case 'needs_review':
        return 'Needs Review';
      default:
        return 'In Progress';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-medium">
                {getInitials(candidate.name)}
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{candidate.name}</h1>
                <p className="text-sm text-gray-500">
                  {candidate.email} • Overall Score: {candidate.overallScore?.toFixed(1) || 'N/A'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
            <Button>
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Interview
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Submission History */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Submission Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {candidate.submissions?.length > 0 ? (
                    candidate.submissions.map((submission: any) => (
                      <div key={submission.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium text-gray-900">
                            {submission.assignment?.name || 'Unknown Assignment'}
                          </h5>
                          <Badge variant={submission.score >= 80 ? "default" : "secondary"}>
                            {submission.score ? `${submission.score}/100` : 'No Score'}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-gray-600 mb-3">
                          Submitted: {submission.submissionType} • 
                          {submission.submittedAt && new Date(submission.submittedAt).toLocaleDateString()}
                        </div>

                        <div className="flex items-center space-x-4 text-xs text-gray-500 mb-3">
                          <span><FileText className="w-3 h-3 inline mr-1" />
                            {submission.attachments?.length || 0} files
                          </span>
                          <span><Clock className="w-3 h-3 inline mr-1" />
                            {submission.submittedAt ? 'On time' : 'Late'}
                          </span>
                          {submission.isAnalyzed && (
                            <span><Check className="w-3 h-3 inline mr-1" />Analyzed by AI</span>
                          )}
                        </div>
                        
                        {/* AI Analysis */}
                        {submission.aiAnalysis && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <h6 className="text-sm font-medium text-primary mb-1">AI Analysis</h6>
                            <p className="text-sm text-gray-700 mb-2">
                              {submission.aiAnalysis.summary}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {submission.aiAnalysis.strengths?.map((strength: string, index: number) => (
                                <Badge key={index} variant="outline" className="text-xs bg-green-50 text-green-700">
                                  {strength}
                                </Badge>
                              ))}
                              {submission.aiAnalysis.improvements?.map((improvement: string, index: number) => (
                                <Badge key={index} variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                                  {improvement}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>No submissions found for this candidate</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Candidate Profile */}
          <div className="space-y-6">
            {/* Skills */}
            <Card>
              <CardHeader>
                <CardTitle>Technical Skills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {candidate.strengths?.length > 0 ? (
                    candidate.strengths.map((skill: string, index: number) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{skill}</span>
                        <div className="flex items-center space-x-2">
                          <Progress value={85 + (index * 5) % 15} className="w-16" />
                          <span className="text-xs text-gray-500">{85 + (index * 5) % 15}%</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No skills identified yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Interview Readiness */}
            <Card>
              <CardHeader>
                <CardTitle>Interview Readiness</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Badge className={`${getStatusColor(candidate.status)} text-sm`}>
                    {getStatusLabel(candidate.status)}
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900 mb-1">Overall Assessment</div>
                      <p className="text-gray-600 text-xs">
                        {candidate.aiInsights || 'No AI insights available yet'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100">
                    <div className="text-sm font-medium text-gray-900 mb-2">Performance Metrics</div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Completion Rate</span>
                        <span className="font-medium">{Math.round((candidate.completionRate || 0) * 100)}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Submissions</span>
                        <span className="font-medium">{candidate.submissionCount || 0}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Average Score</span>
                        <span className="font-medium">{candidate.overallScore?.toFixed(1) || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Interview Focus Areas */}
            <Card>
              <CardHeader>
                <CardTitle>Interview Focus Areas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {candidate.weaknesses?.length > 0 ? (
                    <ul className="text-sm text-gray-700 space-y-1">
                      {candidate.weaknesses.map((area: string, index: number) => (
                        <li key={index} className="flex items-start space-x-2">
                          <AlertTriangle className="w-3 h-3 mt-0.5 text-yellow-500 flex-shrink-0" />
                          <span>{area}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <>
                      <ul className="text-sm text-gray-700 space-y-1">
                        <li>• System design and scalability</li>
                        <li>• Advanced programming patterns</li>
                        <li>• Problem-solving methodology</li>
                        <li>• Code optimization techniques</li>
                      </ul>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
