import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import mammoth from "mammoth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const maxResumeBytes = 8 * 1024 * 1024;

const resumeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["profile", "courses", "activities", "notes"],
  properties: {
    profile: {
      type: "object",
      additionalProperties: false,
      required: ["major", "gpa", "graduationDate"],
      properties: {
        major: { type: "string" },
        gpa: { type: "string" },
        graduationDate: { type: "string", description: "YYYY-MM when explicit, otherwise empty" },
      },
    },
    courses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "status", "term", "grade"],
        properties: {
          name: { type: "string" },
          status: { type: "string", enum: ["planned", "in_progress", "completed"] },
          term: { type: "string" },
          grade: { type: "string" },
        },
      },
    },
    activities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "name", "role", "status", "startDate", "endDate", "description"],
        properties: {
          category: { type: "string", enum: ["extracurricular", "clinical", "volunteering", "leadership", "research", "other"] },
          name: { type: "string" },
          role: { type: "string" },
          status: { type: "string", enum: ["planned", "active", "completed"] },
          startDate: { type: "string", description: "YYYY-MM when explicit, otherwise empty" },
          endDate: { type: "string", description: "YYYY-MM when explicit, otherwise empty" },
          description: { type: "string" },
        },
      },
    },
    notes: { type: "array", items: { type: "string" } },
  },
} as const;

const extractionPrompt = `Extract only information explicitly supported by this applicant resume.
Classify experiences as extracurricular, clinical, volunteering, leadership, research, or other.
Do not invent dates, GPA, grades, duties, application timing, or hours.
Leave unknown strings empty. Do not return total hours even if the resume contains them; the student will verify and enter hours manually.
Treat substantial projects performed within a research lab as one research experience rather than multiple separate lab commitments.
Return concise, editable descriptions and include a note for anything genuinely ambiguous.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Resume scanning is ready but Claude has not been connected yet.", code: "ANTHROPIC_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const resume = formData.get("resume");
  if (!(resume instanceof File)) {
    return NextResponse.json({ error: "Choose a PDF or DOCX resume." }, { status: 400 });
  }

  if (resume.size === 0 || resume.size > maxResumeBytes) {
    return NextResponse.json({ error: "Resume files must be between 1 byte and 8 MB." }, { status: 400 });
  }

  const extension = resume.name.toLowerCase().split(".").pop();
  if (extension !== "pdf" && extension !== "docx") {
    return NextResponse.json({ error: "Only PDF and DOCX resumes are supported." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await resume.arrayBuffer());
    const content = extension === "pdf"
      ? [
          {
            type: "document" as const,
            source: {
              type: "base64" as const,
              media_type: "application/pdf" as const,
              data: buffer.toString("base64"),
            },
          },
          { type: "text" as const, text: extractionPrompt },
        ]
      : [
          {
            type: "text" as const,
            text: `${extractionPrompt}\n\n<resume>\n${(await mammoth.extractRawText({ buffer })).value}\n</resume>`,
          },
        ];

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.parse(
      {
        model: "claude-sonnet-5",
        max_tokens: 2600,
        system: "You extract applicant resume data for Trajectory. Accuracy is more important than completeness. Never infer missing facts.",
        messages: [{ role: "user", content }],
        output_config: { format: jsonSchemaOutputFormat(resumeSchema) },
      },
      { timeout: 52_000 }
    );

    if (!message.parsed_output) {
      return NextResponse.json({ error: "Claude could not structure this resume." }, { status: 422 });
    }

    return NextResponse.json(message.parsed_output);
  } catch (error) {
    console.error("Resume extraction failed", error instanceof Error ? error.message : "Unknown error");
    if (error instanceof Error && /timed?\s*out|timeout/i.test(error.message)) {
      return NextResponse.json(
        { error: "Claude took too long to read this résumé. Please try once more or upload a smaller file." },
        { status: 504 }
      );
    }
    return NextResponse.json({ error: "We could not read this resume. Try another PDF or DOCX file." }, { status: 500 });
  }
}
