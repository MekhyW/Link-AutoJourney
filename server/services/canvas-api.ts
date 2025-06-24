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
  rubric?: {
    id: string;
    title: string;
    criteria: Array<{
      id: string;
      description: string;
      points: number;
      ratings: Array<{
        id: string;
        description: string;
        points: number;
      }>;
    }>;
  };
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
      rubric: assignment.rubric ? {
        id: assignment.rubric.id?.toString() || '',
        title: assignment.rubric.title || '',
        criteria: assignment.rubric.criteria?.map((criterion: any) => ({
          id: criterion._id || criterion.id || '',
          description: criterion.description || '',
          points: criterion.points || 0,
          ratings: criterion.ratings?.map((rating: any) => ({
            id: rating._id || rating.id || '',
            description: rating.description || '',
            points: rating.points || 0
          })) || []
        })) || []
      } : undefined
    })).filter((assignment: any) => 
      assignment.submissionTypes.includes('online_upload') || 
      assignment.submissionTypes.includes('online_text_entry')
    );
  }

  async getAssignmentSubmissions(courseId: string, assignmentId: string): Promise<Submission[]> {
    if (!this.config.apiKey) {
      throw new Error('Canvas API key not configured. Please add your CANVAS_API_KEY to secrets.');
    }
    const response = await fetch(`${this.config.baseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions?include[]=user&include[]=attachments&include[]=rubric_assessment`, {
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
    return submissions.map((submission: any) => ({
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
      submission.submittedAt && submission.user?.id && (submission.body || submission.attachments.length > 0)
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
