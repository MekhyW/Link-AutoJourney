import { pgTable, text, serial, integer, boolean, json, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  canvasId: text("canvas_id").notNull().unique(),
  name: text("name").notNull(),
  code: text("code"),
  enrollmentCount: integer("enrollment_count").default(0),
  assignmentCount: integer("assignment_count").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  canvasUserId: text("canvas_user_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  courseId: integer("course_id").references(() => courses.id),
  overallScore: real("overall_score"),
  submissionCount: integer("submission_count").default(0),
  completionRate: real("completion_rate").default(0),
  status: text("status").default("in_progress"), // in_progress, interview_ready, needs_review
  strengths: json("strengths").$type<string[]>(),
  weaknesses: json("weaknesses").$type<string[]>(),
  aiInsights: text("ai_insights"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const assignments = pgTable("assignments", {
  id: serial("id").primaryKey(),
  canvasId: text("canvas_id").notNull().unique(),
  courseId: integer("course_id").references(() => courses.id),
  name: text("name").notNull(),
  description: text("description"),
  pointsPossible: real("points_possible"),
  dueAt: timestamp("due_at"),
  submissionTypes: json("submission_types").$type<string[]>(),
  hasRubric: boolean("has_rubric").default(false),
  rubricData: json("rubric_data"),
  averageScore: real("average_score"),
  submissionCount: integer("submission_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  canvasId: text("canvas_id").notNull().unique(),
  assignmentId: integer("assignment_id").references(() => assignments.id),
  candidateId: integer("candidate_id").references(() => candidates.id),
  score: real("score"),
  grade: text("grade"),
  submissionType: text("submission_type"),
  content: text("content"),
  attachments: json("attachments").$type<{name: string, url: string, type: string}[]>().default([]),
  submittedAt: timestamp("submitted_at"),
  aiAnalysis: json("ai_analysis").$type<{
    summary: string;
    strengths: string[];
    improvements: string[];
    skillsIdentified: string[];
    confidence: number;
  }>(),
  rubricAssessment: json("rubric_assessment"),
  isAnalyzed: boolean("is_analyzed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const processingJobs = pgTable("processing_jobs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // course_sync, submission_analysis
  status: text("status").default("pending"), // pending, processing, completed, failed
  progress: real("progress").default(0),
  totalItems: integer("total_items").default(0),
  processedItems: integer("processed_items").default(0),
  metadata: json("metadata"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
});

export const insertCandidateSchema = createInsertSchema(candidates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAssignmentSchema = createInsertSchema(assignments).omit({
  id: true,
  createdAt: true,
});

export const insertSubmissionSchema = createInsertSchema(submissions).omit({
  id: true,
  createdAt: true,
});

export const insertProcessingJobSchema = createInsertSchema(processingJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Assignment = typeof assignments.$inferSelect;
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type ProcessingJob = typeof processingJobs.$inferSelect;
export type InsertProcessingJob = z.infer<typeof insertProcessingJobSchema>;
