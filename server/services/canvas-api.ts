interface CanvasConfig {
  baseUrl: string;
  apiKey: string;
}

interface Course {
  id: string;
  _id: string;
  name: string;
  courseCode: string;
  state: string;
  enrollmentsConnection: {
    nodes: Array<{ type: string }>;
  };
}

interface Assignment {
  id: string;
  _id: string;
  name: string;
  description: string;
  pointsPossible: number;
  dueAt: string;
  submissionTypes: string[];
  rubric?: Array<{
    id: string;
    description: string;
    points: number;
    ratings: Array<{
      id: string;
      description: string;
      points: number;
    }>;
  }>;
}

interface User {
  id: string;
  name: string;
  email: string;
  first_name?: string;
  last_name?: string;
  short_name?: string;
  login_id?: string;
  avatar_url?: string;
  enrollments?: Array<{
    id: string;
    user_id: string;
    course_id: string;
    type: string;
    enrollment_state: string;
    grades?: {
      current_score?: number;
      final_score?: number;
      current_grade?: string;
      final_grade?: string;
    };
  }>;
}

interface Submission {
  id: string;
  _id: string;
  score: number;
  grade: string;
  submissionType: string;
  body: string;
  url: string;
  submittedAt: string;
  user: {
    id: string;
    _id: string;
    name: string;
    email: string;
  };
  attachments: Array<{
    id: string;
    displayName: string;
    url: string;
    contentType: string;
  }>;
  rubricAssessmentsConnection?: {
    nodes: Array<{
      score: number;
      data: Array<{
        criterion_id: string;
        points: number;
        comments: string;
      }>;
    }>;
  };
}

export class CanvasAPIService {
  private config: CanvasConfig;

  constructor() {
    this.config = {
      baseUrl: process.env.CANVAS_BASE_URL || 'https://linkschool.instructure.com',
      apiKey: process.env.CANVAS_API_KEY || ''
    };
    if (!this.config.apiKey) {
      console.warn('Canvas API key not configured. Add CANVAS_API_KEY to secrets to enable Canvas integration.');
    } else {
      console.log(`Canvas API configured for: ${this.config.baseUrl}`);
    }
  }

  async getCourses(): Promise<Course[]> {
    if (!this.config.apiKey) {
      throw new Error('Canvas API key not configured. Please add your CANVAS_API_KEY to secrets.');
    }
    const response = await fetch(`${this.config.baseUrl}/api/v1/courses`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Canvas REST API Error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Canvas API request failed: ${response.status} ${response.statusText}. Please verify your Canvas API key.`);
    }
    const courses = await response.json();
    return courses.map((course: any) => ({
      id: course.id.toString(),
      _id: course.id.toString(),
      name: course.name,
      courseCode: course.course_code,
      state: course.workflow_state,
      enrollmentsConnection: {
        nodes: [{ type: 'TeacherEnrollment' }] // Simplified for now
      }
    }));
  }

  async getCourseAssignments(courseId: string): Promise<Assignment[]> {
    if (!this.config.apiKey) {
      throw new Error('Canvas API key not configured. Please add your CANVAS_API_KEY to secrets.');
    }
    const response = await fetch(`${this.config.baseUrl}/api/v1/courses/${courseId}/assignments?include[]=rubric`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Canvas REST API Error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Canvas API request failed: ${response.status} ${response.statusText}`);
    }
    const assignments = await response.json();
    return assignments.map((assignment: any) => ({
      id: assignment.id.toString(),
      _id: assignment.id.toString(),
      name: assignment.name,
      description: assignment.description,
      pointsPossible: assignment.points_possible,
      dueAt: assignment.due_at,
      submissionTypes: assignment.submission_types || [],
      rubric: assignment.rubric?.map((criterion: any) => ({
        id: criterion._id || criterion.id || '',
        description: criterion.description || '',
        points: criterion.points || 0,
        ratings: criterion.ratings?.map((rating: any) => ({
          id: rating._id || rating.id || '',
          description: rating.description || '',
          points: rating.points || 0
        })) || []
      })) || undefined
    })).filter((assignment: any) => 
      assignment.submissionTypes.includes('online_upload') || 
      assignment.submissionTypes.includes('online_text_entry')
    );
  }

  async getCourseStudents(courseId: string): Promise<User[]> {
    if (!this.config.apiKey) {
      throw new Error('Canvas API key not configured. Please add your CANVAS_API_KEY to secrets.');
    }
    
    const allUsers: any[] = [];
    let page = 1;
    let hasMorePages = true;
    
    while (hasMorePages) {
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/courses/${courseId}/users?enrollment_type[]=student&include[]=enrollments&include[]=email&per_page=100&page=${page}`, 
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Canvas REST API Error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Canvas API request failed: ${response.status} ${response.statusText}`);
      }

      const users = await response.json();
      allUsers.push(...users);
      
      // Check if there are more pages using Link header
      const linkHeader = response.headers.get('Link');
      hasMorePages = linkHeader ? linkHeader.includes('rel="next"') : false;
      
      console.log(`Fetched page ${page} with ${users.length} students. Total so far: ${allUsers.length}`);
      page++;
      
      // Safety limit to prevent infinite loops
      if (page > 50) {
        console.warn(`Reached maximum page limit (50) when fetching students for course ${courseId}`);
        break;
      }
    }
    
    console.log(`Total students fetched for course ${courseId}: ${allUsers.length}`);

    return allUsers.map((user: any) => ({
      id: user.id.toString(),
      name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      email: user.email || user.login_id || '',
      first_name: user.first_name,
      last_name: user.last_name,
      short_name: user.short_name,
      login_id: user.login_id,
      avatar_url: user.avatar_url,
      enrollments: user.enrollments?.map((enrollment: any) => ({
        id: enrollment.id.toString(),
        user_id: enrollment.user_id.toString(),
        course_id: enrollment.course_id.toString(),
        type: enrollment.type,
        enrollment_state: enrollment.enrollment_state,
        grades: enrollment.grades
      })) || []
    }));
  }

  async getAssignmentSubmissions(courseId: string, assignmentId: string): Promise<Submission[]> {
    if (!this.config.apiKey) {
      throw new Error('Canvas API key not configured. Please add your CANVAS_API_KEY to secrets.');
    }
    // Try multiple submission endpoints to capture all students including those not actively submitting
    let allSubmissions: any[] = [];
    
    // First, try the standard submissions endpoint
    const submissionsUrl = `${this.config.baseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions?include[]=user&include[]=attachments&include[]=rubric_assessment&per_page=200`;
    const response = await fetch(submissionsUrl, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Canvas REST API Error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Canvas API request failed: ${response.status} ${response.statusText}`);
    }
    const submissions = await response.json();
    allSubmissions = allSubmissions.concat(submissions);
    
    // Fetch ALL possible submissions with comprehensive pagination to capture students like ADRIELE
    let nextPageUrl = `${this.config.baseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions?include[]=user&include[]=attachments&include[]=rubric_assessment&per_page=100`;
    let pageCount = 0;
    
    while (nextPageUrl && pageCount < 10) { // Safety limit
      try {
        const pageResponse = await fetch(nextPageUrl, {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!pageResponse.ok) break;
        
        const pageSubmissions = await pageResponse.json();
        if (pageSubmissions.length === 0) break;
        
        allSubmissions = allSubmissions.concat(pageSubmissions);
        pageCount++;
        
        // Check for next page in Link header
        const linkHeader = pageResponse.headers.get('Link');
        nextPageUrl = null;
        if (linkHeader) {
          const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          if (nextMatch) {
            nextPageUrl = nextMatch[1];
          }
        }
        
        // Force break if no progress to avoid infinite loops
        if (pageSubmissions.length === 0) {
          break;
        }
        
        console.log(`Fetched page ${pageCount} with ${pageSubmissions.length} submissions. Total: ${allSubmissions.length}`);
        
        // Check if we found ADRIELE on this page
        const adrieleOnPage = pageSubmissions.find((sub: any) => sub.user?.name?.includes("ADRIELE"));
        if (adrieleOnPage) {
          console.log(`FOUND ADRIELE on page ${pageCount}! Canvas ID: ${adrieleOnPage.user.id}`);
        }
        
      } catch (error) {
        console.log(`Error fetching page ${pageCount + 1}:`, error);
        break;
      }
    }
    
    console.log(`Total submissions fetched across ${pageCount} pages: ${allSubmissions.length}`);
    
    return allSubmissions.map((submission: any) => ({
      id: submission.id.toString(),
      _id: submission.id.toString(),
      score: submission.score,
      grade: submission.grade,
      submissionType: submission.submission_type,
      body: submission.body,
      url: submission.url,
      submittedAt: submission.submitted_at,
      user: {
        id: submission.user?.id?.toString() || '',
        _id: submission.user?.id?.toString() || '',
        name: submission.user?.name || '',
        email: submission.user?.email || ''
      },
      attachments: submission.attachments?.map((att: any) => ({
        id: att.id.toString(),
        displayName: att.display_name,
        url: att.url,
        contentType: att.content_type
      })) || [],
      rubricAssessmentsConnection: {
        nodes: submission.rubric_assessment ? [{
          score: submission.rubric_assessment.score || 0,
          data: Object.entries(submission.rubric_assessment.data || {}).map(([criterion_id, assessment]: [string, any]) => ({
            criterion_id,
            points: assessment.points || 0,
            comments: assessment.comments || ''
          }))
        }] : []
      }
    })).filter((submission: any) => 
      submission.user?.id && (
        submission.submittedAt || 
        submission.body || 
        submission.attachments.length > 0 ||
        submission.score !== null ||
        submission.grade !== null
      )
    );
  }

  async downloadAttachment(url: string): Promise<Buffer> {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.status} ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
}

export const canvasAPI = new CanvasAPIService();
