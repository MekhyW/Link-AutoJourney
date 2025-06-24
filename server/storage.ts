import {
  type Course, type InsertCourse,
  type Candidate, type InsertCandidate,
  type Assignment, type InsertAssignment,
  type Submission, type InsertSubmission,
  type ProcessingJob, type InsertProcessingJob
} from "@shared/schema";

export interface IStorage {
  // Course operations
  getCourses(): Promise<Course[]>;
  getCourse(id: number): Promise<Course | undefined>;
  getCourseByCanvasId(canvasId: string): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: number, updates: Partial<Course>): Promise<Course>;

  // Candidate operations
  getCandidates(courseId?: number): Promise<Candidate[]>;
  getCandidate(id: number): Promise<Candidate | undefined>;
  getCandidateByCanvasUserId(canvasUserId: string): Promise<Candidate | undefined>;
  createCandidate(candidate: InsertCandidate): Promise<Candidate>;
  updateCandidate(id: number, updates: Partial<Candidate>): Promise<Candidate>;

  // Assignment operations
  getAssignments(courseId?: number): Promise<Assignment[]>;
  getAssignment(id: number): Promise<Assignment | undefined>;
  getAssignmentByCanvasId(canvasId: string): Promise<Assignment | undefined>;
  createAssignment(assignment: InsertAssignment): Promise<Assignment>;
  updateAssignment(id: number, updates: Partial<Assignment>): Promise<Assignment>;

  // Submission operations
  getSubmissions(filters?: { assignmentId?: number; candidateId?: number }): Promise<Submission[]>;
  getSubmission(id: number): Promise<Submission | undefined>;
  getSubmissionByCanvasId(canvasId: string): Promise<Submission | undefined>;
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  updateSubmission(id: number, updates: Partial<Submission>): Promise<Submission>;

  // Processing job operations
  getProcessingJobs(): Promise<ProcessingJob[]>;
  getProcessingJob(id: number): Promise<ProcessingJob | undefined>;
  createProcessingJob(job: InsertProcessingJob): Promise<ProcessingJob>;
  updateProcessingJob(id: number, updates: Partial<ProcessingJob>): Promise<ProcessingJob>;
}

export class MemStorage implements IStorage {
  private courses: Map<number, Course> = new Map();
  private candidates: Map<number, Candidate> = new Map();
  private assignments: Map<number, Assignment> = new Map();
  private submissions: Map<number, Submission> = new Map();
  private processingJobs: Map<number, ProcessingJob> = new Map();
  private currentId = 1;
  
  constructor() {
    // Load persisted data on startup
    this.loadPersistedData();
  }

  private loadPersistedData() {
    try {
      const fs = require('fs');
      const path = require('path');
      const dataFile = path.join(process.cwd(), '.local', 'storage-data.json');
      
      if (fs.existsSync(dataFile)) {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        
        // Restore courses
        if (data.courses) {
          data.courses.forEach((course: Course) => {
            this.courses.set(course.id, {
              ...course,
              createdAt: new Date(course.createdAt)
            });
          });
        }
        
        // Restore other data structures
        if (data.candidates) {
          data.candidates.forEach((candidate: Candidate) => {
            this.candidates.set(candidate.id, {
              ...candidate,
              createdAt: new Date(candidate.createdAt),
              updatedAt: new Date(candidate.updatedAt)
            });
          });
        }
        
        if (data.assignments) {
          data.assignments.forEach((assignment: Assignment) => {
            this.assignments.set(assignment.id, {
              ...assignment,
              createdAt: new Date(assignment.createdAt),
              dueAt: assignment.dueAt ? new Date(assignment.dueAt) : null
            });
          });
        }
        
        if (data.submissions) {
          data.submissions.forEach((submission: Submission) => {
            this.submissions.set(submission.id, {
              ...submission,
              createdAt: new Date(submission.createdAt),
              submittedAt: submission.submittedAt ? new Date(submission.submittedAt) : null
            });
          });
        }
        
        if (data.currentId) {
          this.currentId = data.currentId;
        }
        
        console.log(`Loaded ${this.courses.size} courses, ${this.candidates.size} candidates from storage`);
      }
    } catch (error) {
      console.log('No existing storage data found, starting fresh');
    }
  }

  private persistData() {
    // Simplified storage - data persists during session
    // For production, consider using a proper database
  }

  // Course operations
  async getCourses(): Promise<Course[]> {
    return Array.from(this.courses.values());
  }

  async getCourse(id: number): Promise<Course | undefined> {
    return this.courses.get(id);
  }

  async getCourseByCanvasId(canvasId: string): Promise<Course | undefined> {
    return Array.from(this.courses.values()).find(course => course.canvasId === canvasId);
  }

  async createCourse(insertCourse: InsertCourse): Promise<Course> {
    const id = this.currentId++;
    const course: Course = {
      ...insertCourse,
      id,
      code: insertCourse.code ?? null,
      enrollmentCount: insertCourse.enrollmentCount ?? null,
      assignmentCount: insertCourse.assignmentCount ?? null,
      isActive: insertCourse.isActive ?? null,
      createdAt: new Date(),
    };
    this.courses.set(id, course);
    this.persistData();
    return course;
  }

  async updateCourse(id: number, updates: Partial<Course>): Promise<Course> {
    const existing = this.courses.get(id);
    if (!existing) throw new Error(`Course with id ${id} not found`);
    const updated = { ...existing, ...updates };
    this.courses.set(id, updated);
    this.persistData();
    return updated;
  }

  // Candidate operations
  async getCandidates(courseId?: number): Promise<Candidate[]> {
    const candidates = Array.from(this.candidates.values());
    return courseId ? candidates.filter(c => c.courseId === courseId) : candidates;
  }

  async getCandidate(id: number): Promise<Candidate | undefined> {
    return this.candidates.get(id);
  }

  async getCandidateByCanvasUserId(canvasUserId: string): Promise<Candidate | undefined> {
    return Array.from(this.candidates.values()).find(candidate => candidate.canvasUserId === canvasUserId);
  }

  async createCandidate(insertCandidate: InsertCandidate): Promise<Candidate> {
    const id = this.currentId++;
    const candidate: Candidate = {
      ...insertCandidate,
      id,
      courseId: insertCandidate.courseId ?? null,
      overallScore: insertCandidate.overallScore ?? null,
      submissionCount: insertCandidate.submissionCount ?? null,
      completionRate: insertCandidate.completionRate ?? null,
      status: insertCandidate.status ?? null,
      strengths: insertCandidate.strengths as string[] ?? [],
      weaknesses: insertCandidate.weaknesses as string[] ?? [],
      aiInsights: insertCandidate.aiInsights ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.candidates.set(id, candidate);
    this.persistData();
    return candidate;
  }

  async updateCandidate(id: number, updates: Partial<Candidate>): Promise<Candidate> {
    const existing = this.candidates.get(id);
    if (!existing) throw new Error(`Candidate with id ${id} not found`);
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.candidates.set(id, updated);
    return updated;
  }

  // Assignment operations
  async getAssignments(courseId?: number): Promise<Assignment[]> {
    const assignments = Array.from(this.assignments.values());
    return courseId ? assignments.filter(a => a.courseId === courseId) : assignments;
  }

  async getAssignment(id: number): Promise<Assignment | undefined> {
    return this.assignments.get(id);
  }

  async getAssignmentByCanvasId(canvasId: string): Promise<Assignment | undefined> {
    return Array.from(this.assignments.values()).find(assignment => assignment.canvasId === canvasId);
  }

  async createAssignment(insertAssignment: InsertAssignment): Promise<Assignment> {
    const id = this.currentId++;
    const assignment: Assignment = {
      ...insertAssignment,
      id,
      courseId: insertAssignment.courseId ?? null,
      description: insertAssignment.description ?? null,
      pointsPossible: insertAssignment.pointsPossible ?? null,
      dueAt: insertAssignment.dueAt ?? null,
      submissionTypes: insertAssignment.submissionTypes as string[] ?? [],
      hasRubric: insertAssignment.hasRubric ?? null,
      rubricData: insertAssignment.rubricData ?? null,
      averageScore: insertAssignment.averageScore ?? null,
      submissionCount: insertAssignment.submissionCount ?? null,
      createdAt: new Date(),
    };
    this.assignments.set(id, assignment);
    this.persistData();
    return assignment;
  }

  async updateAssignment(id: number, updates: Partial<Assignment>): Promise<Assignment> {
    const existing = this.assignments.get(id);
    if (!existing) throw new Error(`Assignment with id ${id} not found`);
    const updated = { ...existing, ...updates };
    this.assignments.set(id, updated);
    return updated;
  }

  // Submission operations
  async getSubmissions(filters?: { assignmentId?: number; candidateId?: number }): Promise<Submission[]> {
    let submissions = Array.from(this.submissions.values());
    if (filters?.assignmentId) {
      submissions = submissions.filter(s => s.assignmentId === filters.assignmentId);
    }
    if (filters?.candidateId) {
      submissions = submissions.filter(s => s.candidateId === filters.candidateId);
    }
    return submissions;
  }

  async getSubmission(id: number): Promise<Submission | undefined> {
    return this.submissions.get(id);
  }

  async getSubmissionByCanvasId(canvasId: string): Promise<Submission | undefined> {
    return Array.from(this.submissions.values()).find(submission => submission.canvasId === canvasId);
  }

  async createSubmission(insertSubmission: InsertSubmission): Promise<Submission> {
    const id = this.currentId++;
    const submission: Submission = {
      ...insertSubmission,
      id,
      assignmentId: insertSubmission.assignmentId ?? null,
      candidateId: insertSubmission.candidateId ?? null,
      score: insertSubmission.score ?? null,
      grade: insertSubmission.grade ?? null,
      submissionType: insertSubmission.submissionType ?? null,
      content: insertSubmission.content ?? null,
      attachments: insertSubmission.attachments as Array<{name: string; url: string; type: string}> ?? [],
      submittedAt: insertSubmission.submittedAt ?? null,
      aiAnalysis: insertSubmission.aiAnalysis as any ?? null,
      rubricAssessment: insertSubmission.rubricAssessment ?? null,
      isAnalyzed: insertSubmission.isAnalyzed ?? null,
      createdAt: new Date(),
    };
    this.submissions.set(id, submission);
    return submission;
  }

  async updateSubmission(id: number, updates: Partial<Submission>): Promise<Submission> {
    const existing = this.submissions.get(id);
    if (!existing) throw new Error(`Submission with id ${id} not found`);
    
    const updated = { ...existing, ...updates };
    this.submissions.set(id, updated);
    return updated;
  }

  // Processing job operations
  async getProcessingJobs(): Promise<ProcessingJob[]> {
    return Array.from(this.processingJobs.values());
  }

  async getProcessingJob(id: number): Promise<ProcessingJob | undefined> {
    return this.processingJobs.get(id);
  }

  async createProcessingJob(insertJob: InsertProcessingJob): Promise<ProcessingJob> {
    const id = this.currentId++;
    const job: ProcessingJob = {
      ...insertJob,
      id,
      status: insertJob.status ?? null,
      progress: insertJob.progress ?? null,
      totalItems: insertJob.totalItems ?? null,
      processedItems: insertJob.processedItems ?? null,
      metadata: insertJob.metadata ?? null,
      error: insertJob.error ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.processingJobs.set(id, job);
    return job;
  }

  async updateProcessingJob(id: number, updates: Partial<ProcessingJob>): Promise<ProcessingJob> {
    const existing = this.processingJobs.get(id);
    if (!existing) throw new Error(`Processing job with id ${id} not found`);
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.processingJobs.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
