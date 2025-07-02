import { aiAnalysis } from './ai-analysis.js';
import { storage } from '../storage.js';
import { canvasAPI } from './canvas-api.js';

export class BatchProcessor {
  private processingQueue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private readonly BATCH_SIZE = 3; // Process 3 submissions concurrently
  private readonly BATCH_DELAY = 5000; // 5 seconds between batches

  async addToQueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.processingQueue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.isProcessing) {
        this.processBatch();
      }
    });
  }

  private async processBatch() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    while (this.processingQueue.length > 0) {
      // Take a batch of tasks
      const batch = this.processingQueue.splice(0, this.BATCH_SIZE);
      
      console.log(`Processing batch of ${batch.length} submissions`);
      
      // Process batch in parallel
      const promises = batch.map(task => task().catch(error => {
        console.error('Batch task failed:', error);
        return null; // Continue processing other tasks
      }));
      
      await Promise.all(promises);
      
      // Wait between batches if there are more tasks
      if (this.processingQueue.length > 0) {
        console.log(`Waiting ${this.BATCH_DELAY}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
      }
    }
    
    this.isProcessing = false;
  }

  async analyzeSubmissionsBatch(submissions: any[], assignments: any[], jobId: number) {
    const unanalyzedSubmissions = submissions.filter(sub => !sub.isAnalyzed);
    
    if (unanalyzedSubmissions.length === 0) {
      return [];
    }

    console.log(`Starting batch analysis of ${unanalyzedSubmissions.length} submissions`);
    
    const analysisPromises = unanalyzedSubmissions.map((submission, index) => 
      this.addToQueue(async () => {
        try {
          const assignment = assignments.find(a => a.id === submission.assignmentId);
          if (!assignment) {
            console.log(`No assignment found for submission ${submission.id}`);
            return null;
          }

          let analysis;
          const assignmentContext = `${assignment.name}: ${assignment.description}`;

          if (submission.content) {
            const rubricCriteria = assignment.rubricData || undefined;
            analysis = await aiAnalysis.analyzeTextSubmission(submission.content, assignmentContext, rubricCriteria);
          } else if (submission.attachments && submission.attachments.length > 0) {
            analysis = await this.processSubmissionAttachment(submission, assignment, assignmentContext);
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

          // Update progress
          const progress = 20 + Math.round((index + 1) / unanalyzedSubmissions.length * 60);
          await storage.updateProcessingJob(jobId, { progress });

          console.log(`Analyzed submission ${submission.id} (${index + 1}/${unanalyzedSubmissions.length})`);
          return analysis;
        } catch (error) {
          console.error(`Error analyzing submission ${submission.id}:`, error);
          return null;
        }
      })
    );

    const results = await Promise.all(analysisPromises);
    return results.filter(result => result !== null);
  }

  private async processSubmissionAttachment(submission: any, assignment: any, assignmentContext: string) {
    try {
      const attachment = submission.attachments[0];
      
      if (!attachment.url) {
        return {
          summary: "File attachment without URL",
          strengths: ["File submitted"],
          improvements: ["Attachment URL not available for analysis"],
          skillsIdentified: ["File submission"],
          confidence: 0.2
        };
      }

      console.log(`Processing attachment: ${attachment.name} (${attachment.type})`);
      const fileBuffer = await canvasAPI.downloadAttachment(attachment.url);
      const rubricCriteria = Array.isArray(assignment.rubricData) ? assignment.rubricData : undefined;
      
      if (attachment.type?.includes('pdf')) {
        try {
          const pdfText = await aiAnalysis.extractTextFromPDF(fileBuffer);
          if (pdfText && pdfText.trim().length > 0) {
            return await aiAnalysis.analyzeTextSubmission(pdfText, assignmentContext, rubricCriteria);
          }
        } catch (pdfError) {
          console.log('PDF text extraction failed, using document analysis');
        }
        return await aiAnalysis.analyzeDocumentSubmission(fileBuffer.toString(), assignmentContext, rubricCriteria);
      } else if (attachment.type?.startsWith('image/') || attachment.type?.startsWith('video/')) {
        const base64Content = fileBuffer.toString('base64');
        return await aiAnalysis.analyzeImageSubmission(base64Content, assignmentContext, rubricCriteria, attachment.type);
      } else {
        const fileContent = fileBuffer.toString('utf8');
        if (fileContent && fileContent.trim().length > 0) {
          return await aiAnalysis.analyzeTextSubmission(fileContent, assignmentContext, rubricCriteria);
        }
      }
      
      return {
        summary: `File submitted: ${attachment.name}`,
        strengths: ["File submitted on time"],
        improvements: [`Unable to analyze ${attachment.type} file type automatically`],
        skillsIdentified: ["File management"],
        confidence: 0.3
      };
    } catch (error) {
      console.error('Error processing attachment:', error);
      return {
        summary: "File analysis failed",
        strengths: ["File submitted"],
        improvements: [`File analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        skillsIdentified: ["File submission"],
        confidence: 0.2
      };
    }
  }
}

export const batchProcessor = new BatchProcessor();