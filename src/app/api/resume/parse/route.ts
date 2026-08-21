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
  required: ["profile", "activities", "notes"],
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
    activities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "name", "role", "status", "startDate", "endDate", "hours", "description"],
        properties: {
          category: { type: "string", enum: ["extracurricular", "clinical", "volunteering", "leadership", "research", "other"] },
          name: { type: "string" },
          role: { type: "string" },
          status: { type: "string", enum: ["planned", "active", "completed"] },
          startDate: { type: "string", description: "YYYY-MM when explicit, otherwise empty" },
          endDate: { type: "string", description: "YYYY-MM when explicit, otherwise empty" },
          hours: { type: "string", description: "Explicit total activity hours as digits only, otherwise empty" },
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
Do not extract or return coursework. Coursework is imported separately from the student's transcript.
Leave unknown strings empty. The student will review every extracted value before it is added to the profile.
For each activity, extract total hours when the résumé explicitly states a cumulative total (for example, "120 hours" or "Total: 85 hrs"). Return digits only in hours.
Do not convert hours per week into total hours. If only a weekly commitment is stated, keep hours empty and preserve that weekly commitment in the description.
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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 5000,
        system: "You extract applicant resume data for Trajectory. Accuracy is more important than completeness. Never infer missing facts.",
        messages: [{ role: "user", content }],
        output_config: { format: jsonSchemaOutputFormat(resumeSchema) },
      },
      { timeout: 52_000 }
    );

    if (message.parsed_output) return NextResponse.json(message.parsed_output);

    const textBlock = message.content.find((block) => block.type === "text");
    if (textBlock?.type === "text") {
      try {
        return NextResponse.json(JSON.parse(textBlock.text));
      } catch {
        // Fall through to the more useful completion error below.
      }
    }

    console.error("Resume extraction returned no structured output", message.stop_reason);
    return NextResponse.json(
      {
        error: message.stop_reason === "max_tokens"
          ? "This résumé contains more detail than Claude could process in one scan. Try a shorter version."
          : "Claude could not structure this résumé. Please try the scan once more.",
      },
      { status: 422 }
    );
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
