import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import StatsCards from "@/components/stats-cards";
import CandidateTable from "@/components/candidate-table";
import AssignmentAnalysis from "@/components/assignment-analysis";
import AIInsights from "@/components/ai-insights";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { GraduationCap, Filter, Download, Search } from "lucide-react";

export default function Dashboard() {
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ["/api/courses"],
  });

  const { data: candidates, isLoading: candidatesLoading } = useQuery({
    queryKey: ["/api/courses", selectedCourseId, "candidates"],
    enabled: !!selectedCourseId,
  });

  const { data: assignments } = useQuery({
    queryKey: ["/api/courses", selectedCourseId, "assignments"],
    enabled: !!selectedCourseId,
  });

  const { data: apiStatus } = useQuery({
    queryKey: ["/api/status"],
    refetchInterval: 30000, // Check every 30 seconds
  });

  const selectedCourse = courses?.find((course: any) => course.id === selectedCourseId);

  const filteredCandidates = candidates?.filter((candidate: any) => {
    const matchesSearch = candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         candidate.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || candidate.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const handleSyncCourses = async () => {
    try {
      const response = await apiRequest("POST", "/api/sync/courses");
      const data = await response.json();
      toast({
        title: "Sync Started",
        description: "Course synchronization has begun. Check the processing status in the sidebar.",
      });
    } catch (error) {
      toast({
        title: "Sync Failed", 
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAnalyzeCourse = async () => {
    if (!selectedCourseId) return;
    
    try {
      const response = await apiRequest("POST", `/api/courses/${selectedCourseId}/analyze`);
      const data = await response.json();
      toast({
        title: "Analysis Started",
        description: "AI analysis of submissions has begun. This may take several minutes.",
      });
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleExportReports = () => {
    toast({
      title: "Export Started",
      description: "Candidate reports are being prepared for download.",
    });
  };

  if (coursesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading Canvas data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <GraduationCap className="text-white text-sm" />
            </div>
            <div>
              <h1 className="text-xl font-medium text-gray-900">Link AutoJourney</h1>
              <p className="text-sm text-gray-500">AI-Powered Recruitment Intelligence</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* API Status */}
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
              apiStatus?.status === 'connected' 
                ? 'bg-green-50 text-green-700' 
                : 'bg-red-50 text-red-700'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                apiStatus?.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span>{apiStatus?.status === 'connected' ? 'API Connected' : 'API Error'}</span>
            </div>
            
            {/* User Menu */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-gray-600 text-sm font-medium">HR</span>
              </div>
              <span className="text-sm font-medium">HR Admin</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-screen">
        {/* Sidebar */}
        <Sidebar 
          courses={courses || []}
          selectedCourseId={selectedCourseId}
          onCourseSelect={setSelectedCourseId}
          onSyncCourses={handleSyncCourses}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Content Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Candidate Analysis Dashboard</h2>
                <p className="text-sm text-gray-500">
                  {selectedCourse ? `${selectedCourse.name} • ${candidates?.length || 0} candidates` : 'Select a course to begin'}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button variant="outline" onClick={handleExportReports} disabled={!selectedCourseId}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Reports
                </Button>
                <Button onClick={handleAnalyzeCourse} disabled={!selectedCourseId}>
                  Analyze Course
                </Button>
              </div>
            </div>
          </div>

          {selectedCourseId ? (
            <div className="p-6">
              {/* Stats Cards */}
              <StatsCards 
                candidates={candidates || []}
                assignments={assignments || []}
              />

              {/* Search and Filter Controls */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Candidate Performance Analysis</h3>
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          type="text"
                          placeholder="Search candidates..."
                          className="pl-10 pr-4 py-2 w-64"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="interview_ready">Interview Ready</SelectItem>
                          <SelectItem value="needs_review">Needs Review</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Candidate Table */}
                <CandidateTable 
                  candidates={filteredCandidates}
                  isLoading={candidatesLoading}
                />
              </div>

              {/* Assignment Analysis and AI Insights */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AssignmentAnalysis assignments={assignments || []} />
                <AIInsights candidates={candidates || []} />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <GraduationCap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Course Selected</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Choose a course from the sidebar to view candidate analysis
                </p>
                {(!courses || courses.length === 0) && (
                  <Button onClick={handleSyncCourses}>
                    Sync Courses from Canvas
                  </Button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
