# Canvas Candidate Analysis Application

## Overview
This is an AI-powered recruitment intelligence platform that integrates with Canvas LMS to analyze student submissions and generate comprehensive candidate reports for technical interviews. The application uses Canvas GraphQL API to fetch course data, assignments, and submissions, then employs Claude AI to analyze the quality of student work and provide hiring insights.

## Project Architecture

### Core Components
- **Frontend**: React with TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **AI Analysis**: Anthropic Claude for submission evaluation
- **Canvas Integration**: GraphQL API for data synchronization
- **Storage**: In-memory storage with typed interfaces
- **Routing**: Wouter for client-side navigation

### Key Features
1. **Canvas Integration**: Syncs courses, assignments, and submissions from Canvas LMS
2. **AI Analysis**: Automatically analyzes text submissions, code, and documents
3. **Candidate Profiling**: Generates comprehensive candidate reports with strengths/weaknesses
4. **Interview Preparation**: Provides AI-generated insights and focus areas
5. **Real-time Processing**: Background job processing with progress tracking
6. **Export Capabilities**: Generate candidate reports for HR teams

### Data Flow
1. Canvas API fetches courses and assignments
2. Submission data is synchronized and stored
3. AI analysis processes each submission for quality assessment
4. Candidate profiles are generated with aggregated insights
5. Interview recommendations are provided based on performance patterns

## API Endpoints

### Core Routes
- `GET /api/status` - Check Canvas and AI API connectivity
- `POST /api/sync/courses` - Sync courses from Canvas
- `GET /api/courses` - List synchronized courses
- `GET /api/courses/:id/candidates` - Get candidates for a course
- `GET /api/candidates/:id` - Get detailed candidate information
- `POST /api/courses/:id/analyze` - Start AI analysis of submissions
- `GET /api/jobs/:id` - Check processing job status

### Canvas Integration
Uses Canvas GraphQL API to fetch:
- Course information with enrollment data
- Assignment details including rubrics
- Student submissions with attachments
- Grading information and rubric assessments

### AI Analysis Pipeline
1. **Text Analysis**: Evaluates code quality, technical understanding
2. **Document Analysis**: Reviews written submissions and documentation
3. **Image Analysis**: Processes screenshots, diagrams, and visual submissions
4. **Candidate Insights**: Aggregates submission data into hiring recommendations

## Environment Configuration

Required environment variables:
- `CANVAS_API_KEY`: Canvas LMS API access token
- `CANVAS_BASE_URL`: Canvas instance URL (optional, defaults to instructure.com)
- `ANTHROPIC_API_KEY`: Claude AI API key for analysis

## User Preferences
- Technical communication preferred for setup and troubleshooting
- Focus on practical functionality over theoretical explanations
- Prioritize data accuracy and AI analysis quality
- Prefer comprehensive candidate reports over summary data

## Recent Changes
- **2025-06-23**: Successfully connected to linkschool.instructure.com Canvas instance
- **2025-06-23**: Migrated from GraphQL to REST API for better Canvas compatibility
- **2025-06-23**: Completed course synchronization with 2 active courses imported
- **2025-06-23**: Fixed Canvas API authentication and data mapping
- **2025-06-23**: Implemented comprehensive error handling and logging
- **2025-06-23**: Validated end-to-end Canvas integration workflow

## Technical Notes
- Uses Canvas REST API v1 for reliable data access
- Supports courses, assignments, and submissions with attachments
- Handles rubric assessments and grading data
- Implements proper Canvas API authentication with Bearer tokens
- Uses Claude 4.0 Sonnet for submission analysis and candidate insights
- Employs TypeScript throughout for type safety
- Real-time progress tracking for background processing jobs

## Current Status
Application is fully operational with Canvas LMS integration successfully established. The system can:
- Sync courses from linkschool.instructure.com
- Import assignments and student submissions
- Analyze submission content using AI
- Generate comprehensive candidate reports for recruitment
- Track processing jobs with real-time status updates

Ready for production use with eliminatory course analysis and interview preparation.