import Anthropic from '@anthropic-ai/sdk';

interface PDFData {
  text: string;
  numpages: number;
  numrender: number;
  info: any;
  metadata: any;
}

const DEFAULT_MODEL_STR = "claude-sonnet-4-20250514";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, });

export interface RubricCriteria {
  id: string;
  description: string;
  points: number;
  ratings: Array<{
    id: string;
    description: string;
    points: number;
  }>;
}

export interface RubricAssessment {
  criteriaId: string;
  points: number;
  comments?: string;
  ratingDescription: string;
}

export interface SubmissionAnalysis {
  summary: string;
  strengths: string[];
  improvements: string[];
  skillsIdentified: string[];
  confidence: number;
  rubricAssessments?: RubricAssessment[];
  overallRubricScore?: number;
  maxPossibleScore?: number;
}

export interface CandidateInsights {
  overallAssessment: string;
  topStrengths: string[];
  areasForImprovement: string[];
  interviewFocus: string[];
  readinessLevel: 'interview_ready' | 'needs_review' | 'in_progress';
  confidenceScore: number;
}

export class AIAnalysisService {
  private lastApiCall = 0;
  private readonly RATE_LIMIT_DELAY = 3000; // 3 seconds between API calls
  
  private ensureAPIKey() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
  }

  private async rateLimitedApiCall<T>(apiCall: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    if (timeSinceLastCall < this.RATE_LIMIT_DELAY) {
      const delay = this.RATE_LIMIT_DELAY - timeSinceLastCall;
      console.log(`Rate limiting: waiting ${delay}ms before next API call`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    this.lastApiCall = Date.now();
    return await apiCall();
  }

  private truncateContent(content: string, maxLength: number = 8000): string {
    if (content.length <= maxLength) return content;
    // Try to truncate at a natural break point (sentence or paragraph)
    const truncated = content.substring(0, maxLength);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('\n\n'),
      truncated.lastIndexOf('\n')
    );
    if (lastSentenceEnd > maxLength * 0.8) {
      return truncated.substring(0, lastSentenceEnd + 1) + '\n\n[Conteúdo truncado para análise...]';
    }
    return truncated + '\n\n[Conteúdo truncado para análise...]';
  }

  private buildRubricSection(rubricCriteria?: RubricCriteria[]): string {
    if (!rubricCriteria) return '';
    return `
    CRITÉRIOS DE RUBRICA:
    ${rubricCriteria.map(criteria => `
    ${criteria.description} (${criteria.points} pontos máximos):
    ${criteria.ratings.map(rating => `- ${rating.description} (${rating.points} pts)`).join('\n')}
    `).join('\n')}
    `;
  }

  private buildAnalysisInstructions(rubricCriteria?: RubricCriteria[], submissionType: string = 'submissão'): string {
    if (rubricCriteria) {
      return `
      Analise esta ${submissionType} em relação aos critérios de rubrica fornecidos. Para cada critério, determine qual nível de classificação melhor se adequa à ${submissionType} e forneça um feedback específico.
      
      Responda com um objeto JSON contendo:
      - summary: Uma breve avaliação geral
      - strengths: Conjunto de pontos fortes específicos identificados
      - improvements: Conjunto de áreas que precisam de melhorias  
      - skillsIdentified: Conjunto de habilidades demonstradas
      - confidence: Pontuação de confiança da sua análise (0-1)
      - rubricAssessments: Array de objetos com {criteriaId, points, ratingDescription, comments}
      - overallRubricScore: Nota total recebida
      - maxPossibleScore: Nota máxima possível
      `;
    }
    return `
    Forneça uma análise geral com foco na qualidade do conteúdo, na compreensão demonstrada e nas áreas de melhoria.
    
    Responda com um objeto JSON contendo:
    - summary: Uma breve avaliação geral
    - strengths: Conjunto de pontos fortes específicos identificados
    - improvements: Conjunto de áreas que precisam de melhorias
    - skillsIdentified: Conjunto de habilidades demonstradas  
    - confidence: Pontuação de confiança da sua análise (0-1)
    `;
  }

  private buildBasePrompt(assignmentContext: string, rubricCriteria?: RubricCriteria[]): string {
    const rubricSection = this.buildRubricSection(rubricCriteria);
    return `
    Você é um avaliador especialista analisando a submissão de um candidato ao vestibular da faculdade.
    
    Contexto da Tarefa: ${assignmentContext}
    ${rubricSection}
    `;
  }

  private parseAIResponse(response: Anthropic.Messages.Message): SubmissionAnalysis {
    try {
      const responseContent = response.content[0];
      if (responseContent.type === 'text') { return JSON.parse(responseContent.text); }
      throw new Error('Unexpected response format from AI');
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${(error as Error).message ?? 'Unknown error'}`);
    }
  }

  async analyzeTextSubmission(content: string, assignmentContext: string, rubricCriteria?: RubricCriteria[]): Promise<SubmissionAnalysis> {
    this.ensureAPIKey();
    const truncatedContent = this.truncateContent(content); // Truncate content to prevent token limit issues
    const basePrompt = this.buildBasePrompt(assignmentContext, rubricCriteria);
    const analysisInstructions = this.buildAnalysisInstructions(rubricCriteria, 'submissão');
    const prompt = `${basePrompt}
    
    Submissão do Candidato:
    ${truncatedContent}
    ${analysisInstructions}`;
    return await this.rateLimitedApiCall(async () => {
      const message = await anthropic.messages.create({
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
        model: DEFAULT_MODEL_STR,
      });
      return this.parseAIResponse(message);
    });
  }

  async analyzeImageSubmission(base64Image: string, assignmentContext: string, rubricCriteria?: RubricCriteria[], mimeType: string = "image/jpeg"): Promise<SubmissionAnalysis> {
    this.ensureAPIKey();
    const basePrompt = this.buildBasePrompt(assignmentContext, rubricCriteria);
    const isVideo = mimeType.startsWith('video/'); // Determine if this is a video file based on mime type
    const mediaTypeForAnalysis = isVideo ? 'vídeo enviado' : 'imagem enviada';
    const analysisInstructions = this.buildAnalysisInstructions(rubricCriteria, mediaTypeForAnalysis);
    const textContent = `${basePrompt}
    
    ${isVideo ? 'Este é um arquivo de vídeo submetido pelo candidato. Analise o conteúdo visual disponível.' : 'Esta é uma imagem submetida pelo candidato.'}
    
    ${analysisInstructions}`;
    return await this.rateLimitedApiCall(async () => {
      const response = await anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: textContent
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64Image
              }
            }
          ]
        }]
      });
      return this.parseAIResponse(response);
    });
  }

  async analyzeDocumentSubmission(content: string, assignmentContext: string, rubricCriteria?: RubricCriteria[]): Promise<SubmissionAnalysis> {
    this.ensureAPIKey();
    const truncatedContent = this.truncateContent(content); // Truncate content to prevent token limit issues
    const basePrompt = this.buildBasePrompt(assignmentContext, rubricCriteria);
    const analysisInstructions = this.buildAnalysisInstructions(rubricCriteria, 'documento submetido');
    const prompt = `${basePrompt}
    Document Content:
    ${truncatedContent}
    ${analysisInstructions}`;
    return await this.rateLimitedApiCall(async () => {
      const message = await anthropic.messages.create({
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
        model: DEFAULT_MODEL_STR,
      });
      return this.parseAIResponse(message);
    });
  }

  async generateCandidateInsights(submissions: Array<{analysis: SubmissionAnalysis; assignmentName: string; score: number;}>): Promise<CandidateInsights> {
    this.ensureAPIKey();
    const submissionSummaries = submissions.map(sub => ({
      assignment: sub.assignmentName,
      score: sub.score,
      summary: sub.analysis.summary,
      strengths: sub.analysis.strengths,
      improvements: sub.analysis.improvements,
      skills: sub.analysis.skillsIdentified
    }));
    const summariesJson = JSON.stringify(submissionSummaries, null, 2);
    const truncatedSummaries = this.truncateContent(summariesJson, 6000); // Truncate submission summaries if too large
    const prompt = `
    Você é um recrutador da Link School of Business, uma faculdade de empreendedorismo do Brasil com metodologia inovadora e perspectiva global. Você é responsável por selecionar os melhores candidatos do processo de seleção.
    
    Histórico de submissão do candidato:
    ${truncatedSummaries}
    
    Com base nesses dados abrangentes, forneça insights para que um entrevistador conheça bem o candidato. Considere:
    1. Experiência com empreendedorismo e vontade de empreender ou de melhorar já existente negócios
    2. Nível de proficiência na língua portuguesa e na língua inglesa
    3. Habilidades técnicas e soft skills

    Procure por inconsistências! Podem haver informações contraditórias ou inconsistentes.
    
    Responder com um objeto JSON contendo:
    - overallAssessment: Parágrafo de avaliação abrangente
    - topStrengths: Array com 3 a 5 principais pontos fortes
    - areasForImprovement: Array de principais áreas de melhoria
    - interviewFocus: Array de tópicos a serem focados durante as entrevistas
    - readinessLevel: Um entre "interview_ready", "needs_review", ou "in_progress"
    - confidenceScore: Confiança geral nesta avaliação (0-1)
    `;
    return await this.rateLimitedApiCall(async () => {
      const message = await anthropic.messages.create({
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
        model: DEFAULT_MODEL_STR,
      });
      try {
        const response = message.content[0];
        if (response.type === 'text') {
          return JSON.parse(response.text);
        }
        throw new Error('Unexpected response format from AI');
      } catch (error) {
        throw new Error(`Failed to parse AI response: ${(error as Error).message ?? 'Unknown error'}}`);
      }
    });
  }

  async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      const pdfParse = await import('pdf-parse');
      const data: PDFData = await pdfParse.default(buffer);
      return data.text;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const aiAnalysis = new AIAnalysisService();
