import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import catalogData from "@/data/columbia-courses.json";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const maxTranscriptBytes = 8 * 1024 * 1024;

const transcriptSchema = {
  type: "object",
  additionalProperties: false,
  required: ["courses", "notes"],
  properties: {
    courses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["courseCode", "title", "term", "grade", "credits"],
        properties: {
          courseCode: { type: "string" },
          title: { type: "string" },
          term: { type: "string" },
          grade: { type: "string" },
          credits: { type: "string" },
        },
      },
    },
    notes: { type: "array", items: { type: "string" } },
  },
} as const;

type ExtractedCourse = {
  courseCode: string;
  title: string;
  term: string;
  grade: string;
  credits: string;
};

type TranscriptOutput = { courses: ExtractedCourse[]; notes: string[] };
type CatalogCourse = { code: string; title: string; terms: string[] };
type ParsedTranscriptMessage = Anthropic.Message & { parsed_output?: unknown };

function normalizeCourseCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function subjectNumberKey(value: string) {
  const match = value.toUpperCase().match(/([A-Z]{4})\s*[A-Z]{0,2}\s*(\d{4})/);
  return match ? `${match[1]}${match[2]}` : "";
}

const catalogCourses = catalogData.courses as CatalogCourse[];
const catalogByExactCode = new Map(catalogCourses.map((course) => [normalizeCourseCode(course.code), course]));
const catalogBySubjectNumber = new Map<string, CatalogCourse>();

for (const course of catalogCourses) {
  const key = subjectNumberKey(course.code);
  if (key && !catalogBySubjectNumber.has(key)) catalogBySubjectNumber.set(key, course);
}

function parseStructuredOutput(message: ParsedTranscriptMessage): TranscriptOutput | null {
  if (message.parsed_output) return message.parsed_output as TranscriptOutput;
  const textBlock = message.content.find((block) => block.type === "text");
  if (textBlock?.type !== "text") return null;

  try {
    return JSON.parse(textBlock.text) as TranscriptOutput;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Transcript scanning is ready but Claude has not been connected yet." },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const transcript = formData.get("transcript");
    if (!(transcript instanceof File)) {
      return NextResponse.json({ error: "Choose a PDF transcript." }, { status: 400 });
    }
    if (transcript.size === 0 || transcript.size > maxTranscriptBytes) {
      return NextResponse.json({ error: "Transcript files must be between 1 byte and 8 MB." }, { status: 400 });
    }
    if (!transcript.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF transcripts are supported." }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.parse(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 6000,
        system: "You extract completed coursework from academic transcripts. Never infer a course, grade, term, or credit value that is not visible in the supplied transcript.",
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: Buffer.from(await transcript.arrayBuffer()).toString("base64"),
              },
            },
            {
              type: "text",
              text: `Extract every completed course shown on this transcript, including completed transfer coursework.
Preserve course codes, titles, terms, grades, and credits exactly as displayed.
Exclude courses that are merely registered, in progress, withdrawn, or have no completed grade or completed-credit designation.
Do not calculate GPA and do not invent expanded course titles. Leave an unknown string empty.
Use concise notes only for genuinely ambiguous transcript entries.`,
            },
          ],
        }],
        output_config: { format: jsonSchemaOutputFormat(transcriptSchema) },
      },
      { timeout: 52_000 }
    );

    const output = parseStructuredOutput(message);
    if (!output) {
      return NextResponse.json(
        { error: "Claude could not structure this transcript. Please try the scan once more." },
        { status: 422 }
      );
    }

    const seen = new Set<string>();
    const courses = output.courses.flatMap((course) => {
      const identity = `${normalizeCourseCode(course.courseCode)}:${course.term}:${course.grade}`;
      if (seen.has(identity)) return [];
      seen.add(identity);

      const catalogMatch = catalogByExactCode.get(normalizeCourseCode(course.courseCode))
        ?? catalogBySubjectNumber.get(subjectNumberKey(course.courseCode));
      return [{
        ...course,
        courseCode: catalogMatch?.code ?? course.courseCode,
        title: catalogMatch?.title || course.title,
        catalogMatched: Boolean(catalogMatch),
      }];
    });

    return NextResponse.json({
      courses,
      notes: output.notes,
      catalog: {
        matched: courses.filter((course) => course.catalogMatched).length,
        total: catalogCourses.length,
        updated: catalogData.updated,
      },
    });
  } catch (error) {
    console.error("Transcript extraction failed", error instanceof Error ? error.message : "Unknown error");
    if (error instanceof Error && /timed?\s*out|timeout/i.test(error.message)) {
      return NextResponse.json(
        { error: "Claude took too long to read this transcript. Please try once more or upload a smaller PDF." },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "We could not read this transcript. Try another PDF file." },
      { status: 500 }
    );
  }
}
