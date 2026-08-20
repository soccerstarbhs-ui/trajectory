"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type CourseStatus = "planned" | "in_progress" | "completed";
type ActivityStatus = "planned" | "active" | "completed";
type ActivityCategory = "extracurricular" | "clinical" | "volunteering" | "leadership" | "research" | "other";

type BasicProfile = {
  major: string;
  gpa: string;
  graduationDate: string;
  applicationCycle: string;
};

type Course = {
  id: string;
  name: string;
  status: CourseStatus;
  term: string;
  grade: string;
};

type Activity = {
  id: string;
  category: ActivityCategory;
  name: string;
  role: string;
  status: ActivityStatus;
  startDate: string;
  endDate: string;
  hours: string;
  description: string;
};

type ResumeProfile = Pick<BasicProfile, "major" | "gpa" | "graduationDate">;
type ResumeActivity = Omit<Activity, "id"> & { selected: boolean };

type ResumeResult = {
  profile: ResumeProfile;
  activities: Array<Omit<ResumeActivity, "selected" | "hours">>;
  notes: string[];
};

type TranscriptCourse = {
  courseCode: string;
  title: string;
  term: string;
  grade: string;
  credits: string;
  catalogMatched: boolean;
  selected: boolean;
};

type TranscriptResult = {
  courses: Array<Omit<TranscriptCourse, "selected">>;
  notes: string[];
  catalog: { matched: number; total: number; updated: string };
  error?: string;
};

const storageKey = "trajectory-applicant-profile-v1";
const emptyBasic: BasicProfile = { major: "", gpa: "", graduationDate: "", applicationCycle: "" };
const emptyCourse: Omit<Course, "id"> = { name: "", status: "planned", term: "", grade: "" };
const emptyActivity: Omit<Activity, "id"> = {
  category: "extracurricular",
  name: "",
  role: "",
  status: "planned",
  startDate: "",
  endDate: "",
  hours: "",
  description: "",
};

const categoryLabels: Record<ActivityCategory, string> = {
  extracurricular: "Extracurricular",
  clinical: "Clinical experience",
  volunteering: "Volunteering",
  leadership: "Leadership",
  research: "Research",
  other: "Other activity",
};

const statusLabels: Record<CourseStatus | ActivityStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  active: "Active",
  completed: "Completed",
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export function ApplicantProfileForm() {
  const router = useRouter();
  const [basic, setBasic] = useState<BasicProfile>(emptyBasic);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [courseDraft, setCourseDraft] = useState(emptyCourse);
  const [activityDraft, setActivityDraft] = useState(emptyActivity);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [courseError, setCourseError] = useState("");
  const [activityError, setActivityError] = useState("");
  const [saved, setSaved] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeProfile, setResumeProfile] = useState<ResumeProfile | null>(null);
  const [resumeActivities, setResumeActivities] = useState<ResumeActivity[]>([]);
  const [resumeNotes, setResumeNotes] = useState<string[]>([]);
  const [resumeError, setResumeError] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [transcriptCourses, setTranscriptCourses] = useState<TranscriptCourse[]>([]);
  const [showAllCourses, setShowAllCourses] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [transcriptNotes, setTranscriptNotes] = useState<string[]>([]);
  const [transcriptCatalog, setTranscriptCatalog] = useState<TranscriptResult["catalog"] | null>(null);
  const [transcriptError, setTranscriptError] = useState("");
  const [isScanningTranscript, setIsScanningTranscript] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;

      try {
        const profile = JSON.parse(stored) as {
          basic?: BasicProfile;
          courses?: Course[];
          activities?: Activity[];
        };
        if (profile.basic) setBasic(profile.basic);
        if (profile.courses) setCourses(profile.courses);
        if (profile.activities) setActivities(profile.activities);
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const totalHours = useMemo(
    () => activities.reduce((sum, activity) => sum + (Number(activity.hours) || 0), 0),
    [activities]
  );

  const categoryCounts = useMemo(
    () => activities.reduce<Partial<Record<ActivityCategory, number>>>((counts, activity) => {
      counts[activity.category] = (counts[activity.category] ?? 0) + 1;
      return counts;
    }, {}),
    [activities]
  );

  function updateBasic(field: keyof BasicProfile, value: string) {
    setBasic((current) => ({ ...current, [field]: value }));
    setSaved(false);
  }

  function saveCourse() {
    if (!courseDraft.name.trim()) {
      setCourseError("Add a course name before saving.");
      return;
    }

    if (editingCourseId) {
      setCourses((current) => current.map((course) =>
        course.id === editingCourseId ? { ...courseDraft, id: editingCourseId } : course
      ));
    } else {
      setCourses((current) => [...current, { ...courseDraft, id: newId() }]);
    }

    setCourseDraft(emptyCourse);
    setEditingCourseId(null);
    setCourseError("");
    setSaved(false);
  }

  function editCourse(course: Course) {
    const { id, ...draft } = course;
    setCourseDraft(draft);
    setEditingCourseId(id);
    setCourseError("");
  }

  function removeCourse(id: string) {
    setCourses((current) => current.filter((course) => course.id !== id));
    if (editingCourseId === id) {
      setCourseDraft(emptyCourse);
      setEditingCourseId(null);
    }
    setSaved(false);
  }

  function saveActivity() {
    if (!activityDraft.name.trim() || !activityDraft.role.trim()) {
      setActivityError("Add both an activity name and your role before saving.");
      return;
    }

    if (editingActivityId) {
      setActivities((current) => current.map((activity) =>
        activity.id === editingActivityId ? { ...activityDraft, id: editingActivityId } : activity
      ));
    } else {
      setActivities((current) => [...current, { ...activityDraft, id: newId() }]);
    }

    setActivityDraft(emptyActivity);
    setEditingActivityId(null);
    setActivityError("");
    setSaved(false);
  }

  function editActivity(activity: Activity) {
    const { id, ...draft } = activity;
    setActivityDraft(draft);
    setEditingActivityId(id);
    setActivityError("");
  }

  function removeActivity(id: string) {
    setActivities((current) => current.filter((activity) => activity.id !== id));
    if (editingActivityId === id) {
      setActivityDraft(emptyActivity);
      setEditingActivityId(null);
    }
    setSaved(false);
  }

  function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem(storageKey, JSON.stringify({ basic, courses, activities }));
    setSaved(true);
    router.push("/trajectory");
  }

  async function scanResume() {
    if (!resumeFile) {
      setResumeError("Choose a PDF or DOCX resume first.");
      return;
    }

    setIsScanning(true);
    setResumeError("");
    const formData = new FormData();
    formData.append("resume", resumeFile);

    try {
      const response = await fetch("/api/resume/parse", { method: "POST", body: formData });
      const responseText = await response.text();
      let result: ResumeResult & { error?: string };

      try {
        result = JSON.parse(responseText) as ResumeResult & { error?: string };
      } catch {
        throw new Error(
          response.status === 504
            ? "Claude took too long to read this résumé. Please try once more or upload a smaller file."
            : "The résumé service returned an unexpected response. Please try again."
        );
      }
      if (!response.ok) throw new Error(result.error || "Resume scanning failed.");

      setResumeProfile(result.profile);
      setResumeActivities(result.activities.map((activity) => ({ ...activity, hours: "", selected: true })));
      setResumeNotes(result.notes);
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : "Resume scanning failed.");
    } finally {
      setIsScanning(false);
    }
  }

  function applyResumeSuggestions() {
    if (resumeProfile) {
      setBasic((current) => ({
        ...current,
        major: current.major || resumeProfile.major,
        gpa: current.gpa || resumeProfile.gpa,
        graduationDate: current.graduationDate || resumeProfile.graduationDate,
      }));
    }

    setActivities((current) => {
      const existing = new Set(current.map((activity) => `${activity.category}:${activity.name.trim().toLowerCase()}`));
      const additions = resumeActivities
        .filter((activity) => activity.selected && !existing.has(`${activity.category}:${activity.name.trim().toLowerCase()}`))
        .map((activity) => ({
          id: newId(),
          category: activity.category,
          name: activity.name,
          role: activity.role,
          status: activity.status,
          startDate: activity.startDate,
          endDate: activity.endDate,
          hours: activity.hours,
          description: activity.description,
        }));
      return [...current, ...additions];
    });

    setResumeProfile(null);
    setResumeActivities([]);
    setResumeNotes([]);
    setResumeFile(null);
    setSaved(false);
  }

  async function scanTranscript() {
    if (!transcriptFile) {
      setTranscriptError("Choose a PDF transcript first.");
      return;
    }

    setIsScanningTranscript(true);
    setTranscriptError("");
    const formData = new FormData();
    formData.append("transcript", transcriptFile);

    try {
      const response = await fetch("/api/transcript/parse", { method: "POST", body: formData });
      const responseText = await response.text();
      let result: TranscriptResult;

      try {
        result = JSON.parse(responseText) as TranscriptResult;
      } catch {
        throw new Error(
          response.status === 504
            ? "Claude took too long to read this transcript. Please try once more or upload a smaller PDF."
            : "The transcript service returned an unexpected response. Please try again."
        );
      }
      if (!response.ok) throw new Error(result.error || "Transcript scanning failed.");

      setTranscriptCourses(result.courses.map((course) => ({ ...course, selected: true })));
      setTranscriptNotes(result.notes);
      setTranscriptCatalog(result.catalog);
    } catch (error) {
      setTranscriptError(error instanceof Error ? error.message : "Transcript scanning failed.");
    } finally {
      setIsScanningTranscript(false);
    }
  }

  function applyTranscriptCourses() {
    setCourses((current) => {
      const existing = new Set(current.map((course) => course.name.trim().toLowerCase()));
      const additions = transcriptCourses
        .filter((course) => course.selected)
        .map((course) => ({
          id: newId(),
          name: [course.courseCode, course.title].filter(Boolean).join(" — "),
          status: "completed" as const,
          term: course.term,
          grade: course.grade,
        }))
        .filter((course) => !existing.has(course.name.trim().toLowerCase()));
      return [...current, ...additions];
    });

    setTranscriptCourses([]);
    setTranscriptNotes([]);
    setTranscriptCatalog(null);
    setTranscriptFile(null);
    setSaved(false);
  }

  return (
    <main className="profile-page">
      <div className="profile-page__glow" aria-hidden="true" />
      <header className="profile-nav">
        <Link href="/" className="orbit-brand" aria-label="Return to destinations">
          <span className="orbit-brand__mark" aria-hidden="true"><i /></span>
          TRAJECTORY
        </Link>
        <span>MEDICAL SCHOOL · APPLICANT PROFILE</span>
      </header>

      <section className="profile-heading">
        <div>
          <p>STEP 01 · YOUR BACKGROUND</p>
          <h1>Show us where you are now.</h1>
        </div>
        <p>Add your academics and experiences. Everything stays editable before Trajectory uses it to identify gaps and map your next moves.</p>
      </section>

      <form className="profile-layout" onSubmit={saveProfile}>
        <div className="profile-form-column">
          <section className="profile-section resume-import">
            <div className="resume-import__heading">
              <div>
                <span>QUICK START · CLAUDE-ASSISTED</span>
                <h2>Start with your résumé</h2>
                <p>Upload a PDF or DOCX. Review everything Claude finds, then add the missing hours yourself.</p>
              </div>
              <i aria-hidden="true">↥</i>
            </div>
            <div className="resume-dropzone">
              <input
                id="resume-upload"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => {
                  setResumeFile(event.target.files?.[0] ?? null);
                  setResumeError("");
                }}
              />
              <label htmlFor="resume-upload">
                <strong>{resumeFile?.name || "Choose your résumé"}</strong>
                <span>{resumeFile ? `${(resumeFile.size / 1024 / 1024).toFixed(2)} MB · ready to scan` : "PDF or DOCX · maximum 8 MB"}</span>
              </label>
              <button type="button" onClick={scanResume} disabled={isScanning}>
                {isScanning ? "Reading résumé…" : "Scan and autofill"}
              </button>
            </div>
            {resumeError ? <p className="resume-import__error" role="alert">{resumeError}</p> : null}

            {resumeProfile || resumeActivities.length > 0 ? (
              <div className="resume-review">
                <div className="resume-review__heading">
                  <div><span>REVIEW REQUIRED</span><strong>Confirm Claude&apos;s activity suggestions</strong></div>
                  <small>{resumeActivities.length} activities found</small>
                </div>

                {resumeProfile && (resumeProfile.major || resumeProfile.gpa || resumeProfile.graduationDate) ? (
                  <div className="resume-profile-suggestions">
                    <span>Academic details found</span>
                    {resumeProfile.major ? <strong>{resumeProfile.major}</strong> : null}
                    {resumeProfile.gpa ? <strong>GPA {resumeProfile.gpa}</strong> : null}
                    {resumeProfile.graduationDate ? <strong>Graduation {resumeProfile.graduationDate}</strong> : null}
                  </div>
                ) : null}

                <div className="resume-review-list">
                  {resumeActivities.map((activity, index) => (
                    <div className="resume-review-item resume-review-item--activity" key={`${activity.category}-${activity.name}-${index}`}>
                      <label>
                        <input type="checkbox" checked={activity.selected} onChange={(event) => setResumeActivities((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, selected: event.target.checked } : item))} />
                        <span><small>{categoryLabels[activity.category]} · {statusLabels[activity.status]}</small><strong>{activity.name}</strong><i>{activity.role}</i></span>
                      </label>
                      <label className="resume-hours"><span>Total hours</span><input type="number" min="0" placeholder="Add hours" value={activity.hours} onChange={(event) => setResumeActivities((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, hours: event.target.value } : item))} /></label>
                    </div>
                  ))}
                </div>

                {resumeNotes.length > 0 ? <p className="resume-review__notes">{resumeNotes.join(" ")}</p> : null}
                <button className="resume-apply" type="button" onClick={applyResumeSuggestions}>Add selected items to profile <span>→</span></button>
              </div>
            ) : null}
          </section>

          <section className="profile-section resume-import transcript-import">
            <div className="resume-import__heading">
              <div>
                <span>ACADEMIC IMPORT · COLUMBIA CATALOG</span>
                <h2>Add your transcript</h2>
                <p>Upload a PDF transcript. Trajectory extracts completed courses and verifies Columbia course codes against its local catalog.</p>
              </div>
              <i aria-hidden="true">▤</i>
            </div>
            <div className="resume-dropzone">
              <input
                id="transcript-upload"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) => {
                  setTranscriptFile(event.target.files?.[0] ?? null);
                  setTranscriptError("");
                }}
              />
              <label htmlFor="transcript-upload">
                <strong>{transcriptFile?.name || "Choose your transcript"}</strong>
                <span>{transcriptFile ? `${(transcriptFile.size / 1024 / 1024).toFixed(2)} MB · ready to scan` : "PDF · maximum 8 MB"}</span>
              </label>
              <button type="button" onClick={scanTranscript} disabled={isScanningTranscript}>
                {isScanningTranscript ? "Reading transcript…" : "Import coursework"}
              </button>
            </div>
            {transcriptError ? <p className="resume-import__error" role="alert">{transcriptError}</p> : null}

            {transcriptCourses.length > 0 ? (
              <div className="resume-review transcript-review">
                <div className="resume-review__heading">
                  <div><span>COMPLETED COURSEWORK</span><strong>Review transcript matches</strong></div>
                  <small>{transcriptCourses.length} courses found</small>
                </div>
                {transcriptCatalog ? (
                  <p className="transcript-catalog-status">
                    <strong>{transcriptCatalog.matched}</strong> codes matched against {transcriptCatalog.total.toLocaleString()} recent Columbia courses · updated {transcriptCatalog.updated}
                  </p>
                ) : null}
                <div className="resume-review-list">
                  {transcriptCourses.map((course, index) => (
                    <label className="resume-review-item transcript-course" key={`${course.courseCode}-${course.term}-${index}`}>
                      <input type="checkbox" checked={course.selected} onChange={(event) => setTranscriptCourses((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, selected: event.target.checked } : item))} />
                      <span>
                        <small>{course.catalogMatched ? "Columbia catalog match" : "Transcript entry"}</small>
                        <strong>{[course.courseCode, course.title].filter(Boolean).join(" — ")}</strong>
                        <i>{[course.term, course.grade && `Grade ${course.grade}`, course.credits && `${course.credits} credits`].filter(Boolean).join(" · ")}</i>
                      </span>
                    </label>
                  ))}
                </div>
                {transcriptNotes.length > 0 ? <p className="resume-review__notes">{transcriptNotes.join(" ")}</p> : null}
                <button className="resume-apply" type="button" onClick={applyTranscriptCourses}>Add selected courses as completed <span>→</span></button>
              </div>
            ) : null}
          </section>

          <section className="profile-section">
            <SectionHeading number="01" title="Academic foundation" detail="The timeline and academic context for your path." />
            <div className="profile-field-grid">
              <Field label="Major"><input required value={basic.major} onChange={(event) => updateBasic("major", event.target.value)} placeholder="Biomedical Engineering" /></Field>
              <Field label="Current GPA"><input required inputMode="decimal" value={basic.gpa} onChange={(event) => updateBasic("gpa", event.target.value)} placeholder="3.82" pattern="^(4(?:\.0{1,2})?|[0-3](?:\.\d{1,2})?)$" title="Enter a GPA from 0.00 to 4.00" /></Field>
              <Field label="Graduation date"><input required type="month" value={basic.graduationDate} onChange={(event) => updateBasic("graduationDate", event.target.value)} /></Field>
              <Field label="Intended application cycle">
                <select required value={basic.applicationCycle} onChange={(event) => updateBasic("applicationCycle", event.target.value)}>
                  <option value="">Select a cycle</option>
                  {["2026–2027", "2027–2028", "2028–2029", "2029–2030", "2030–2031", "Undecided"].map((cycle) => <option key={cycle} value={cycle}>{cycle}</option>)}
                </select>
              </Field>
            </div>
          </section>

          <section className="profile-section">
            <SectionHeading number="02" title="Coursework" detail="Add completed, current, or planned courses that shape your route." />
            {courses.length > 0 ? (
              <div className="profile-record-list">
                {courses.slice(0, showAllCourses ? undefined : 5).map((course) => (
                  <article className="profile-record" key={course.id}>
                    <div><small>{statusLabels[course.status]}</small><strong>{course.name}</strong><p>{[course.term, course.grade && `Grade ${course.grade}`].filter(Boolean).join(" · ") || "Details not added"}</p></div>
                    <RecordActions onEdit={() => editCourse(course)} onRemove={() => removeCourse(course.id)} />
                  </article>
                ))}
              </div>
            ) : <p className="profile-empty">No coursework added yet.</p>}

            {courses.length > 5 ? (
              <button className="review-toggle approved-list-toggle" type="button" onClick={() => setShowAllCourses((current) => !current)}>
                {showAllCourses ? "Show less" : `Show all ${courses.length} courses`}
              </button>
            ) : null}

            <div className="profile-editor">
              <EditorTitle title="Add coursework" editing={false} onCancel={() => undefined} />
              <div className="profile-field-grid profile-field-grid--course">
                <Field label="Course name"><input value={courseDraft.name} onChange={(event) => setCourseDraft({ ...courseDraft, name: event.target.value })} placeholder="Organic Chemistry I" /></Field>
                <Field label="Status"><select value={courseDraft.status} onChange={(event) => setCourseDraft({ ...courseDraft, status: event.target.value as CourseStatus })}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></Field>
                <Field label="Term"><input value={courseDraft.term} onChange={(event) => setCourseDraft({ ...courseDraft, term: event.target.value })} placeholder="Fall 2026" /></Field>
                <Field label="Grade"><input value={courseDraft.grade} onChange={(event) => setCourseDraft({ ...courseDraft, grade: event.target.value })} placeholder="A or in progress" /></Field>
              </div>
              {courseError ? <p className="profile-editor__error">{courseError}</p> : null}
              <button className="profile-add-button" type="button" onClick={saveCourse}>+ Add course</button>
            </div>
          </section>

          <section className="profile-section">
            <SectionHeading number="03" title="Experiences and activities" detail="Clinical work, service, leadership, research, and everything else that matters." />
            {activities.length > 0 ? (
              <div className="profile-record-list">
                {activities.slice(0, showAllActivities ? undefined : 5).map((activity) => (
                  <article className="profile-record profile-record--activity" key={activity.id}>
                    <div><small>{categoryLabels[activity.category]} · {statusLabels[activity.status]}</small><strong>{activity.name}</strong><p>{activity.role}{activity.hours ? ` · ${activity.hours} hours` : ""}</p></div>
                    <RecordActions onEdit={() => editActivity(activity)} onRemove={() => removeActivity(activity.id)} />
                  </article>
                ))}
              </div>
            ) : <p className="profile-empty">No experiences added yet.</p>}

            {activities.length > 5 ? (
              <button className="review-toggle approved-list-toggle" type="button" onClick={() => setShowAllActivities((current) => !current)}>
                {showAllActivities ? "Show less" : `Show all ${activities.length} activities`}
              </button>
            ) : null}

            <div className="profile-editor">
              <EditorTitle title="Add an activity" editing={false} onCancel={() => undefined} />
              <div className="profile-field-grid">
                <Field label="Category"><select value={activityDraft.category} onChange={(event) => setActivityDraft({ ...activityDraft, category: event.target.value as ActivityCategory })}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                <Field label="Activity or organization"><input value={activityDraft.name} onChange={(event) => setActivityDraft({ ...activityDraft, name: event.target.value })} placeholder="Emergency Department volunteer" /></Field>
                <Field label="Your role"><input value={activityDraft.role} onChange={(event) => setActivityDraft({ ...activityDraft, role: event.target.value })} placeholder="Volunteer" /></Field>
                <Field label="Status"><select value={activityDraft.status} onChange={(event) => setActivityDraft({ ...activityDraft, status: event.target.value as ActivityStatus })}><option value="planned">Planned</option><option value="active">Active</option><option value="completed">Completed</option></select></Field>
                <Field label="Start date"><input type="month" value={activityDraft.startDate} onChange={(event) => setActivityDraft({ ...activityDraft, startDate: event.target.value })} /></Field>
                <Field label="End date"><input type="month" value={activityDraft.endDate} onChange={(event) => setActivityDraft({ ...activityDraft, endDate: event.target.value })} /></Field>
                <Field label="Total hours"><input type="number" min="0" value={activityDraft.hours} onChange={(event) => setActivityDraft({ ...activityDraft, hours: event.target.value })} placeholder="120" /></Field>
                <Field label="Description" wide><textarea rows={4} value={activityDraft.description} onChange={(event) => setActivityDraft({ ...activityDraft, description: event.target.value })} placeholder="What did you do, who did it serve, and what responsibility did you hold?" /></Field>
              </div>
              {activityError ? <p className="profile-editor__error">{activityError}</p> : null}
              <button className="profile-add-button" type="button" onClick={saveActivity}>+ Add activity</button>
            </div>
          </section>
        </div>

        <aside className="profile-summary">
          <p>PROFILE SNAPSHOT</p>
          <h2>{basic.major || "Your applicant profile"}</h2>
          <div className="profile-summary__stats">
            <span><strong>{courses.length}</strong> courses</span>
            <span><strong>{activities.length}</strong> activities</span>
            <span><strong>{totalHours.toLocaleString()}</strong> total hours</span>
          </div>
          <div className="profile-summary__coverage">
            <span>Experience coverage</span>
            {(Object.keys(categoryLabels) as ActivityCategory[]).map((category) => (
              <div key={category} data-filled={Boolean(categoryCounts[category])}><i /><span>{categoryLabels[category]}</span><strong>{categoryCounts[category] ?? 0}</strong></div>
            ))}
          </div>
          <button className="profile-save" type="submit">Save applicant profile <span>→</span></button>
          {saved ? <p className="profile-saved" role="status">Profile saved. Gap analysis comes next.</p> : <small>Your information is saved in this browser for the MVP.</small>}
        </aside>
      </form>

      {editingCourseId ? (
        <div className="profile-edit-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) { setEditingCourseId(null); setCourseDraft(emptyCourse); }
        }}>
          <section className="profile-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-course-title">
            <div className="profile-edit-modal__heading"><div><small>EDIT COURSEWORK</small><h2 id="edit-course-title">{courseDraft.name}</h2></div><button type="button" aria-label="Close editor" onClick={() => { setEditingCourseId(null); setCourseDraft(emptyCourse); }}>×</button></div>
            <div className="profile-field-grid profile-field-grid--course">
              <Field label="Course name"><input value={courseDraft.name} onChange={(event) => setCourseDraft({ ...courseDraft, name: event.target.value })} /></Field>
              <Field label="Status"><select value={courseDraft.status} onChange={(event) => setCourseDraft({ ...courseDraft, status: event.target.value as CourseStatus })}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></Field>
              <Field label="Term"><input value={courseDraft.term} onChange={(event) => setCourseDraft({ ...courseDraft, term: event.target.value })} /></Field>
              <Field label="Grade"><input value={courseDraft.grade} onChange={(event) => setCourseDraft({ ...courseDraft, grade: event.target.value })} /></Field>
            </div>
            {courseError ? <p className="profile-editor__error">{courseError}</p> : null}
            <button className="profile-save profile-edit-save" type="button" onClick={saveCourse}>Save course changes <span>→</span></button>
          </section>
        </div>
      ) : null}

      {editingActivityId ? (
        <div className="profile-edit-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) { setEditingActivityId(null); setActivityDraft(emptyActivity); }
        }}>
          <section className="profile-edit-modal profile-edit-modal--activity" role="dialog" aria-modal="true" aria-labelledby="edit-activity-title">
            <div className="profile-edit-modal__heading"><div><small>EDIT ACTIVITY</small><h2 id="edit-activity-title">{activityDraft.name}</h2></div><button type="button" aria-label="Close editor" onClick={() => { setEditingActivityId(null); setActivityDraft(emptyActivity); }}>×</button></div>
            <div className="profile-field-grid">
              <Field label="Category"><select value={activityDraft.category} onChange={(event) => setActivityDraft({ ...activityDraft, category: event.target.value as ActivityCategory })}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <Field label="Activity or organization"><input value={activityDraft.name} onChange={(event) => setActivityDraft({ ...activityDraft, name: event.target.value })} /></Field>
              <Field label="Your role"><input value={activityDraft.role} onChange={(event) => setActivityDraft({ ...activityDraft, role: event.target.value })} /></Field>
              <Field label="Status"><select value={activityDraft.status} onChange={(event) => setActivityDraft({ ...activityDraft, status: event.target.value as ActivityStatus })}><option value="planned">Planned</option><option value="active">Active</option><option value="completed">Completed</option></select></Field>
              <Field label="Start date"><input type="month" value={activityDraft.startDate} onChange={(event) => setActivityDraft({ ...activityDraft, startDate: event.target.value })} /></Field>
              <Field label="End date"><input type="month" value={activityDraft.endDate} onChange={(event) => setActivityDraft({ ...activityDraft, endDate: event.target.value })} /></Field>
              <Field label="Total hours"><input type="number" min="0" value={activityDraft.hours} onChange={(event) => setActivityDraft({ ...activityDraft, hours: event.target.value })} /></Field>
              <Field label="Description" wide><textarea rows={5} value={activityDraft.description} onChange={(event) => setActivityDraft({ ...activityDraft, description: event.target.value })} /></Field>
            </div>
            {activityError ? <p className="profile-editor__error">{activityError}</p> : null}
            <button className="profile-save profile-edit-save" type="button" onClick={saveActivity}>Save activity changes <span>→</span></button>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function SectionHeading({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="profile-section__heading"><span>{number}</span><div><h2>{title}</h2><p>{detail}</p></div></div>;
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? "profile-field--wide" : undefined}><span>{label}</span>{children}</label>;
}

function RecordActions({ onEdit, onRemove }: { onEdit: () => void; onRemove: () => void }) {
  return <div className="profile-record__actions"><button type="button" onClick={onEdit}>Edit</button><button type="button" onClick={onRemove}>Remove</button></div>;
}

function EditorTitle({ title, editing, onCancel }: { title: string; editing: boolean; onCancel: () => void }) {
  return <div className="profile-editor__title"><strong>{title}</strong>{editing ? <button type="button" onClick={onCancel}>Cancel</button> : null}</div>;
}
