import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  ChartLine, 
  BookOpen, 
  Users, 
  FileText, 
  Settings,
  FolderSync,
  Bot
} from "lucide-react";

interface SidebarProps {
  courses: any[];
  selectedCourseId: number | null;
  onCourseSelect: (courseId: number) => void;
  onSyncCourses: () => void;
}

export default function Sidebar({ courses, selectedCourseId, onCourseSelect, onSyncCourses }: SidebarProps) {
  const { data: jobs } = useQuery({
    queryKey: ["/api/jobs"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const activeJob = jobs?.find((job: any) => job.status === 'processing');

  const navItems = [
    { icon: ChartLine, label: "Dashboard", active: true },
    { icon: BookOpen, label: "Courses", active: false },
    { icon: Users, label: "Candidates", active: false },
    { icon: FileText, label: "Reports", active: false },
    { icon: Settings, label: "Settings", active: false },
  ];

  const getCourseStatusColor = (course: any) => {
    if (!course.isActive) return "bg-gray-400";
    if (course.assignmentCount === 0) return "bg-yellow-400";
    return "bg-green-400";
  };

  return (
    <aside className="w-72 bg-white shadow-sm border-r border-gray-200 overflow-y-auto">
      <nav className="p-6">
        <div className="space-y-1 mb-8">
          {navItems.map((item, index) => (
            <a
              key={index}
              href="#"
              className={`flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                item.active
                  ? "text-primary bg-blue-50"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </a>
          ))}
        </div>

        {/* Course Selection */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Active Courses
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onSyncCourses}
              disabled={!!activeJob}
            >
              <FolderSync className={`w-4 h-4 ${activeJob ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          <div className="space-y-2">
            {courses.length > 0 ? (
              courses.map((course) => (
                <div
                  key={course.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedCourseId === course.id
                      ? "bg-blue-50 border border-blue-200"
                      : "bg-gray-50 hover:bg-gray-100"
                  }`}
                  onClick={() => onCourseSelect(course.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {course.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {course.enrollmentCount || 0} candidates • {course.assignmentCount || 0} assignments
                      </p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${getCourseStatusColor(course)}`}></div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No courses available</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={onSyncCourses}
                >
                  FolderSync from Canvas
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* AI Processing Status */}
        {activeJob && (
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Bot className="text-primary w-4 h-4" />
              <span className="text-sm font-medium text-primary">
                {activeJob.type === 'course_sync' ? 'Syncing Courses' : 'AI Analysis'}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600">
                  {activeJob.type === 'course_sync' ? 'Syncing from Canvas...' : 'Processing submissions...'}
                </span>
                <span className="text-primary font-medium">{Math.round(activeJob.progress || 0)}%</span>
              </div>
              <Progress value={activeJob.progress || 0} className="h-1.5" />
              <p className="text-xs text-gray-500">
                {activeJob.processedItems || 0} of {activeJob.totalItems || 0} items processed
              </p>
            </div>
          </div>
        )}

        {/* Recent Jobs Status */}
        {jobs && jobs.length > 0 && !activeJob && (
          <div className="mt-8">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Recent Activity
            </h3>
            <div className="space-y-2">
              {jobs.slice(0, 3).map((job: any) => (
                <div key={job.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 truncate">
                    {job.type === 'course_sync' ? 'Course FolderSync' : 'AI Analysis'}
                  </span>
                  <span className={`font-medium ${
                    job.status === 'completed' ? 'text-green-600' :
                    job.status === 'failed' ? 'text-red-600' :
                    'text-blue-600'
                  }`}>
                    {job.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
