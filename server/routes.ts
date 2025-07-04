import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { canvasAPI } from "./services/canvas-api";
import { aiAnalysis } from "./services/ai-analysis";
import { batchProcessor } from "./services/batch-processor";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/status", async (req, res) => {
    try {
      // Health check
      await canvasAPI.getCourses();
      res.json({ 
        status: "connected", 
        canvas: true, 
        ai: !!process.env.ANTHROPIC_API_KEY 
      });
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        message: error instanceof Error ? error.message : 'Unknown error',
        canvas: false,
        ai: !!process.env.ANTHROPIC_API_KEY
      });
    }
  });

  // Sync courses from Canvas
  app.post("/api/sync/courses", async (req, res) => {
    try {
      const job = await storage.createProcessingJob({
        type: "course_sync",
        status: "processing",
        progress: 0,
        totalItems: 0,
        processedItems: 0,
      });
      processCourseSync(job.id); // Start async processing
      res.json({ jobId: job.id, message: "Course sync started" });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get courses
  app.get("/api/courses", async (req, res) => {
    try {
      const courses = await storage.getCourses();
      res.json(courses);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get candidates for a course
  app.get("/api/courses/:courseId/candidates", async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const candidates = await storage.getCandidates(courseId);
      const candidatesWithSubmissions = await Promise.all(
        candidates.map(async (candidate) => {
          const submissions = await storage.getSubmissions({ candidateId: candidate.id });
          const submissionsWithAssignments = await Promise.all(
            submissions.map(async (sub) => {
              const assignment = await storage.getAssignment(sub.assignmentId!);
              return {
                ...sub,
                assignment: assignment || { name: 'Unknown Assignment', id: sub.assignmentId }
              };
            })
          );
          return {
            ...candidate,
            submissions: submissionsWithAssignments
          };
        })
      );
      res.json(candidatesWithSubmissions);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get candidate details with submissions
  app.get("/api/candidates/:candidateId", async (req, res) => {
    try {
      const candidateId = parseInt(req.params.candidateId);
      const candidate = await storage.getCandidate(candidateId);
      if (!candidate) { return res.status(404).json({ message: "Candidate not found" }); }
      const submissions = await storage.getSubmissions({ candidateId });
      const submissionsWithAssignments = await Promise.all(
        submissions.map(async (sub) => {
          const assignment = await storage.getAssignment(sub.assignmentId!);
          console.log(`Looking up assignment ${sub.assignmentId}: found ${assignment ? assignment.name : 'null'}`);
          return {
            ...sub,
            assignment: assignment || { name: 'Unknown Assignment', id: sub.assignmentId }
          };
        })
      );
      res.json({
        ...candidate,
        submissions: submissionsWithAssignments
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get assignments for a course
  app.get("/api/courses/:courseId/assignments", async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const assignments = await storage.getAssignments(courseId);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Analyse single candidate
  app.post("/api/candidates/:id/analyze", async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      const candidate = await storage.getCandidate(candidateId);
      if (!candidate) { return res.status(404).json({ error: "Candidate not found" }); }
      const job = await storage.createProcessingJob({
        type: "candidate_analysis",
        status: "processing",
        progress: 0,
        totalItems: 0,
        error: null
      });
      processCandidateAnalysis(job.id, candidateId).catch(error => {
        console.error(`Error in candidate analysis job ${job.id}:`, error);
        storage.updateProcessingJob(job.id, {
          status: "failed",
          error: error.message
        });
      });
      res.json({
        jobId: job.id,
        message: "Candidate analysis started"
      });
    } catch (error) {
      console.error("Error starting candidate analysis:", error);
      res.status(500).json({ error: "Failed to start candidate analysis" });
    }
  });

  // Start assignment analysis
  app.post("/api/courses/:courseId/analyze", async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const course = await storage.getCourse(courseId);
      if (!course) { return res.status(404).json({ message: "Course not found" }); }
      const job = await storage.createProcessingJob({
        type: "submission_analysis",
        status: "processing",
        progress: 0,
        totalItems: 0,
        processedItems: 0,
        metadata: { courseId }
      });
      processSubmissionAnalysis(job.id, courseId); // Start async processing
      res.json({ jobId: job.id, message: "Analysis started" });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get processing job status
  app.get("/api/jobs/:jobId", async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getProcessingJob(jobId);
      if (!job) { return res.status(404).json({ message: "Job not found" }); }
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/jobs", async (req, res) => {
    try {
      const jobs = await storage.getProcessingJobs();
      res.json(jobs.slice(-10)); // Return last 10 jobs
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Background processing functions
async function processCourseSync(jobId: number) {
  try {
    await storage.updateProcessingJob(jobId, { status: "processing" });
    const canvasCourses = await canvasAPI.getCourses();
    await storage.updateProcessingJob(jobId, { 
      totalItems: canvasCourses.length,
      progress: 10 
    });
    let processed = 0;
    for (const canvasCourse of canvasCourses) {
      let course = await storage.getCourseByCanvasId(canvasCourse._id);
      if (!course) {
        course = await storage.createCourse({
          canvasId: canvasCourse._id,
          name: canvasCourse.name,
          code: canvasCourse.courseCode,
          enrollmentCount: canvasCourse.enrollmentsConnection.nodes.length,
          isActive: canvasCourse.state === 'available'
        });
      } else {
        await storage.updateCourse(course.id, {
          name: canvasCourse.name,
          code: canvasCourse.courseCode,
          enrollmentCount: canvasCourse.enrollmentsConnection.nodes.length,
          isActive: canvasCourse.state === 'available'
        });
      }
      const assignments = await canvasAPI.getCourseAssignments(canvasCourse._id); // Sync assignments for this course
      await storage.updateCourse(course.id, { assignmentCount: assignments.length });
      const students = await canvasAPI.getCourseStudents(canvasCourse._id); // Sync students (candidates) for this course
      console.log(`Found ${students.length} students in course ${canvasCourse.name}`);
      for (const student of students) {
        let candidate = await storage.getCandidateByCanvasUserId(student.id);
        if (!candidate) {
          candidate = await storage.createCandidate({
            canvasUserId: student.id,
            name: student.name,
            email: student.email,
            courseId: course.id,
            status: "in_progress"
          });
          console.log(`Created candidate: ${student.name} (${student.email})`);
        } else {
          // Update existing candidate info
          await storage.updateCandidate(candidate.id, {
            name: student.name,
            email: student.email,
            courseId: course.id
          });
          console.log(`Updated candidate: ${student.name} (${student.email})`);
        }
      }
      for (const canvasAssignment of assignments) {
        let assignment = await storage.getAssignmentByCanvasId(canvasAssignment._id);
        if (!assignment) {
          assignment = await storage.createAssignment({
            canvasId: canvasAssignment._id,
            courseId: course.id,
            name: canvasAssignment.name,
            description: canvasAssignment.description,
            pointsPossible: canvasAssignment.pointsPossible,
            dueAt: canvasAssignment.dueAt ? new Date(canvasAssignment.dueAt) : null,
            submissionTypes: canvasAssignment.submissionTypes,
            hasRubric: !!canvasAssignment.rubric,
            rubricData: canvasAssignment.rubric || null
          });
        }
        // Fetch submissions for this assignment
        try {
          const submissions = await canvasAPI.getAssignmentSubmissions(canvasCourse._id, canvasAssignment._id);
          console.log(`Found ${submissions.length} submissions for assignment ${canvasAssignment.name}`);
          if (submissions.length > 0) {
            const submissionUserIds = submissions.map(s => parseInt(s.user.id)).filter(id => !isNaN(id)).sort((a, b) => a - b);
            console.log(`${submissions.length} submissions - Canvas ID range: ${submissionUserIds[0]} to ${submissionUserIds[submissionUserIds.length - 1]}`);
          }
          const allCandidates = await storage.getCandidates(course.id);
          const candidateUserIds = allCandidates.map(c => parseInt(c.canvasUserId)).filter(id => !isNaN(id)).sort((a, b) => a - b);
          console.log(`${allCandidates.length} candidates - Canvas ID range: ${candidateUserIds[0]} to ${candidateUserIds[candidateUserIds.length - 1]}`);
          // Calculate overlap
          const submissionIds = submissions.map(s => parseInt(s.user.id)).filter(id => !isNaN(id));
          const candidateIds = allCandidates.map(c => parseInt(c.canvasUserId)).filter(id => !isNaN(id));
          const overlap = submissionIds.filter(id => candidateIds.includes(id));
          console.log(`Canvas ID overlap: ${overlap.length}/${submissions.length} submissions match ${allCandidates.length} candidates`);
          // Track matching statistics
          let matchedSubmissions = 0;
          let unmatchedSubmissions = 0;
          for (const canvasSubmission of submissions) {
            if (!canvasSubmission.user?.id) {
              console.log(`Skipping submission ${canvasSubmission._id} - no user ID`);
              continue;
            }
            console.log(`Processing submission ${canvasSubmission._id} by ${canvasSubmission.user.name} (Canvas ID: ${canvasSubmission.user.id}):`, {
              hasBody: !!canvasSubmission.body,
              bodyLength: canvasSubmission.body?.length || 0,
              attachmentCount: canvasSubmission.attachments?.length || 0,
              submissionType: canvasSubmission.submissionType,
              email: canvasSubmission.user.email
            });
            // Comprehensive candidate matching strategy due to Canvas API user ID inconsistencies
            let candidate = await storage.getCandidateByCanvasUserId(canvasSubmission.user.id);
            let matchMethod = "canvas_id";
            if (!candidate) {
              // Try email matching first (most reliable)
              const allCandidates = await storage.getCandidates(course.id);
              if (canvasSubmission.user.email) {
                candidate = allCandidates.find(c => c.email === canvasSubmission.user.email);
                if (candidate) matchMethod = "email";
              }
              // Try exact name matching
              if (!candidate && canvasSubmission.user.name) {
                candidate = allCandidates.find(c => c.name === canvasSubmission.user.name);
                if (candidate) matchMethod = "name";
              }
              // Try partial name matching for variations
              if (!candidate && canvasSubmission.user.name) {
                const submissionName = canvasSubmission.user.name.toLowerCase().trim();
                candidate = allCandidates.find(c => {
                  const candidateName = c.name.toLowerCase().trim();
                  // Check if names match when normalized
                  return candidateName === submissionName ||
                         candidateName.includes(submissionName) ||
                         submissionName.includes(candidateName);
                });
                if (candidate) matchMethod = "partial_name";
              }
              if (!candidate) {
                console.warn(`No candidate match for submission: ${canvasSubmission.user.name} (Canvas ID: ${canvasSubmission.user.id}, Email: ${canvasSubmission.user.email || 'none'})`);
                unmatchedSubmissions++;
                continue;
              } else {
                console.log(`Matched submission via ${matchMethod}: ${candidate.name} -> ${canvasSubmission.user.name}`);
              }
            }
            let submission = await storage.getSubmissionByCanvasId(canvasSubmission._id);
            if (!submission) {
              await storage.createSubmission({
                canvasId: canvasSubmission._id,
                assignmentId: assignment.id,
                candidateId: candidate.id,
                submittedAt: new Date(canvasSubmission.submittedAt),
                score: canvasSubmission.score,
                grade: canvasSubmission.grade,
                submissionType: canvasSubmission.submissionType,
                content: canvasSubmission.body || '',
                attachments: canvasSubmission.attachments?.map((att: any) => ({
                  name: att.displayName || att.display_name || '',
                  url: att.url || '',
                  type: att.contentType || att.content_type || ''
                })) || []
              });
              console.log(`Created submission for ${candidate.name} on ${canvasAssignment.name}`);
              matchedSubmissions++;
            } else {
              unmatchedSubmissions++;
            }
          }
          console.log(`Assignment ${canvasAssignment.name}: ${matchedSubmissions} matched, ${unmatchedSubmissions} unmatched submissions`);
          if (submissions.length === 0) {
            console.log(`No submissions found for assignment: ${canvasAssignment.name}`);
          }
        } catch (error) {
          console.error(`Error fetching submissions for assignment ${canvasAssignment.name}:`, error);
        }
      }
      processed++;
      await storage.updateProcessingJob(jobId, { 
        processedItems: processed,
        progress: Math.round((processed / canvasCourses.length) * 100)
      });
    }
    await storage.updateProcessingJob(jobId, { 
      status: "completed",
      progress: 100 
    });
  } catch (error) {
    await storage.updateProcessingJob(jobId, { 
      status: "failed",
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

async function processSubmissionAnalysis(jobId: number, courseId: number) {
  try {
    await storage.updateProcessingJob(jobId, { status: "processing" });
    const assignments = await storage.getAssignments(courseId);
    const course = await storage.getCourse(courseId);
    if (!course) throw new Error("Course not found");
    let totalSubmissions = 0;
    let processed = 0;
    // First, sync all submissions
    for (const assignment of assignments) {
      const canvasSubmissions = await canvasAPI.getAssignmentSubmissions(course.canvasId, assignment.canvasId);
      totalSubmissions += canvasSubmissions.length;
      for (const canvasSubmission of canvasSubmissions) {
        // Create or update candidate
        let candidate = await storage.getCandidateByCanvasUserId(canvasSubmission.user._id);
        if (!candidate) {
          candidate = await storage.createCandidate({
            canvasUserId: canvasSubmission.user._id,
            name: canvasSubmission.user.name,
            email: canvasSubmission.user.email,
            courseId: courseId,
            status: "in_progress"
          });
        }
        // Create or update submission
        let submission = await storage.getSubmissionByCanvasId(canvasSubmission._id);
        if (!submission) {
          submission = await storage.createSubmission({
            canvasId: canvasSubmission._id,
            assignmentId: assignment.id,
            candidateId: candidate.id,
            score: canvasSubmission.score,
            grade: canvasSubmission.grade,
            submissionType: canvasSubmission.submissionType,
            content: canvasSubmission.body || canvasSubmission.url || '',
            attachments: canvasSubmission.attachments.map(att => ({
              name: att.displayName,
              url: att.url,
              type: att.contentType
            })),
            submittedAt: canvasSubmission.submittedAt ? new Date(canvasSubmission.submittedAt) : null,
            rubricAssessment: canvasSubmission.rubricAssessmentsConnection?.nodes[0] || null
          });
        }
      }
    }
    await storage.updateProcessingJob(jobId, { 
      totalItems: totalSubmissions,
      progress: 30 
    });
    // Now analyze submissions with AI
    const allSubmissions = await storage.getSubmissions();
    const unanalyzedSubmissions = allSubmissions.filter(sub => !sub.isAnalyzed);
    for (const submission of unanalyzedSubmissions) {
      try {
        const assignment = await storage.getAssignment(submission.assignmentId!);
        if (!assignment) continue;
        let analysis;
        const assignmentContext = `${assignment.name}: ${assignment.description}`;
        if (submission.content) {
          // Analyze text content using rubric if available
          const rubricCriteria = (assignment.rubricData && Array.isArray(assignment.rubricData)) ? assignment.rubricData as any[] : undefined;
          analysis = await aiAnalysis.analyzeTextSubmission(submission.content, assignmentContext, rubricCriteria);
        } else if (submission.attachments && submission.attachments.length > 0) {
          // For now, just provide basic analysis for attachments
          analysis = {
            summary: "File submission analyzed",
            strengths: ["File submitted on time"],
            improvements: ["Unable to analyze file content automatically"],
            skillsIdentified: ["File management"],
            confidence: 0.3
          };
        } else {
          analysis = {
            summary: "No content to analyze",
            strengths: [],
            improvements: ["No submission content found"],
            skillsIdentified: [],
            confidence: 0.1
          };
        }
        await storage.updateSubmission(submission.id, {
          aiAnalysis: analysis,
          isAnalyzed: true
        });
        processed++;
        await storage.updateProcessingJob(jobId, { 
          processedItems: processed,
          progress: 30 + Math.round((processed / totalSubmissions) * 60)
        });
      } catch (error) {
        console.error(`Error analyzing submission ${submission.id}:`, error);
        processed++;
      }
    }
    // Generate candidate insights
    const candidates = await storage.getCandidates(courseId);
    for (const candidate of candidates) {
      const candidateSubmissions = await storage.getSubmissions({ candidateId: candidate.id });
      const analyzedSubmissions = candidateSubmissions.filter(sub => sub.aiAnalysis);
      if (analyzedSubmissions.length > 0) {
        const submissionData = analyzedSubmissions.map(sub => ({
          analysis: sub.aiAnalysis!,
          assignmentName: assignments.find(a => a.id === sub.assignmentId)?.name || 'Unknown',
          score: sub.score || 0
        }));
        try {
          const submissionDataWithAnalysis = submissionData.map(s => ({
            ...s,
            analysis: {
              ...s.analysis,
              technicalQuality: 0,
              creativity: 0,
              completeness: 0
            }
          }));
          const insights = await aiAnalysis.generateCandidateInsights(submissionDataWithAnalysis);
          const overallScore = analyzedSubmissions.reduce((sum, sub) => sum + (sub.aiAnalysis?.confidence || 0), 0) / analyzedSubmissions.length;
          const completionRate = candidateSubmissions.length / assignments.length;
          await storage.updateCandidate(candidate.id, {
            overallScore,
            submissionCount: candidateSubmissions.length,
            completionRate,
            status: insights.readinessLevel,
            strengths: insights.topStrengths,
            weaknesses: insights.areasForImprovement,
            aiInsights: insights.overallAssessment
          });
        } catch (error) {
          console.error(`Error generating insights for candidate ${candidate.id}:`, error);
        }
      }
    }
    await storage.updateProcessingJob(jobId, { 
      status: "completed",
      progress: 100 
    });
  } catch (error) {
    await storage.updateProcessingJob(jobId, { 
      status: "failed",
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}


async function processCandidateAnalysis(jobId: number, candidateId: number) {
  try {
    await storage.updateProcessingJob(jobId, {
      status: "processing",
      progress: 10
    });
    console.log(`Starting optimized AI analysis for candidate ${candidateId}`);
    const submissions = await storage.getSubmissions({ candidateId });
    const unanalyzedSubmissions = submissions.filter(sub => !sub.isAnalyzed);
    await storage.updateProcessingJob(jobId, {
      totalItems: unanalyzedSubmissions.length,
      progress: 20
    });
    if (unanalyzedSubmissions.length === 0) {
      await storage.updateProcessingJob(jobId, {
        status: "completed",
        progress: 100
      });
      console.log(`No submissions to analyze for candidate ${candidateId}`);
      return;
    }
    const assignments = await storage.getAssignments();
    await batchProcessor.analyzeSubmissionsBatch(unanalyzedSubmissions, assignments, jobId);
    // Generate candidate insights after all submissions are analyzed
    const analyzedSubmissions = await storage.getSubmissions({ candidateId });
    const submissionsWithAnalysis = analyzedSubmissions.filter(sub => sub.aiAnalysis);
    if (submissionsWithAnalysis.length > 0) {
      const insights = await aiAnalysis.generateCandidateInsights(
        submissionsWithAnalysis.map(sub => ({
          analysis: sub.aiAnalysis!,
          assignmentName: assignments.find(a => a.id === sub.assignmentId)?.name || "Assignment",
          score: sub.score || 0
        }))
      );
      await storage.updateCandidate(candidateId, {
        aiInsights: insights.overallAssessment,
        strengths: insights.topStrengths,
        weaknesses: insights.areasForImprovement,
        status: insights.readinessLevel
      });
    }
    await storage.updateProcessingJob(jobId, {
      status: "completed",
      progress: 100
    });
    console.log(`Completed AI analysis for candidate ${candidateId}`);
  } catch (error) {
    console.error(`Error in candidate analysis job ${jobId}:`, error);
    await storage.updateProcessingJob(jobId, {
      status: "failed",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
